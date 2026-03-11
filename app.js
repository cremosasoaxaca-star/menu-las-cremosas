const $ = (sel) => document.querySelector(sel);

const state = {
  items: [],
  extras: [],
  sales: [],
  expenses: [],
  category: "",
  q: "",
  onlyAvailable: true
};

function formatPrice(value, currency = "MXN") {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(num)) return String(value);
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
}

function toNumber(value) {
  const num = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isNaN(num) ? 0 : num;
}

function parseCSV(csvText) {
  const rows = [];
  let cur = "";
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += ch;
    }
  }

  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  if (!rows.length) return [];

  const header = rows[0].map(h => h.trim());
  const data = [];

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols.some(c => String(c || "").trim() !== "")) continue;

    const obj = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = (cols[c] ?? "").trim();
    }
    data.push(obj);
  }

  return data;
}

async function fetchCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar CSV: ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

function normalizeBool(v, defaultVal = true) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return defaultVal;
  if (["si", "sí", "true", "1", "yes", "y"].includes(s)) return true;
  if (["no", "false", "0", "n"].includes(s)) return false;
  return defaultVal;
}

function buildCategories(items) {
  const set = new Set();
  for (const it of items) {
    const cat = (it.Categoria || it.Category || "").trim();
    if (cat) set.add(cat);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

function applyFilters(items) {
  const q = state.q.trim().toLowerCase();
  const cat = state.category;
  const onlyAvail = state.onlyAvailable;

  return items.filter(it => {
    const available = normalizeBool(it.Disponible, true);
    if (onlyAvail && !available) return false;

    if (cat) {
      const c = (it.Categoria || "").trim();
      if (c !== cat) return false;
    }

    if (q) {
      const hay = [
        it.Nombre, it.Descripcion, it.Categoria,
        it.Tags, it.Badges, it.Notas
      ].map(x => String(x || "").toLowerCase()).join(" ");
      return hay.includes(q);
    }

    return true;
  });
}

function renderCategoriesSelect(categories) {
  const sel = $("#categorySelect");
  const first = document.createElement("option");
  first.value = "";
  first.textContent = "Todas las categorías";
  sel.innerHTML = "";
  sel.appendChild(first);

  for (const c of categories) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  }
}

function renderMenu(items) {
  const grid = $("#menuGrid");
  const empty = $("#emptyState");
  grid.innerHTML = "";

  if (!items.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  for (const it of items) {
    const name = it.Nombre || "Sin nombre";
    const desc = it.Descripcion || "";
    const price = it.Precio || it.PrecioMXN || "";
    const currency = window.MENU_CONFIG?.currency || "MXN";

    const badgesRaw = (it.Badges || it.Etiquetas || "")
      .split("|")
      .map(s => s.trim())
      .filter(Boolean);

    const note = (it.Notas || "").trim();
    if (note) badgesRaw.push(note);

    const card = document.createElement("article");
    card.className = "card";

    const top = document.createElement("div");
    top.className = "card__top";

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "card__name";
    title.textContent = name;
    left.appendChild(title);

    if (desc) {
      const p = document.createElement("div");
      p.className = "card__desc";
      p.textContent = desc;
      left.appendChild(p);
    }

    const priceEl = document.createElement("div");
    priceEl.className = "card__price";
    priceEl.textContent = price ? formatPrice(price, currency) : "—";

    top.appendChild(left);
    top.appendChild(priceEl);
    card.appendChild(top);

    if (badgesRaw.length) {
      const badges = document.createElement("div");
      badges.className = "badges";

      for (const b of badgesRaw.slice(0, 4)) {
        const span = document.createElement("span");
        span.className = "badge";
        const bLower = b.toLowerCase();

        if (bLower.includes("más vendido") || bLower.includes("mas vendido") || bLower.includes("top")) {
          span.classList.add("badge--fav");
        }
        if (bLower.includes("🔥") || bLower.includes("hot") || bLower.includes("picante")) {
          span.classList.add("badge--hot");
        }
        if (b === note) {
          span.classList.add("badge--note");
        }

        span.textContent = b;
        badges.appendChild(span);
      }

      card.appendChild(badges);
    }

    grid.appendChild(card);
  }
}

function renderExtras(extras) {
  const tUl = $("#extrasToppings");
  const bUl = $("#extrasBases");
  const cUl = $("#extrasChocolates");

  tUl.innerHTML = "";
  bUl.innerHTML = "";
  cUl.innerHTML = "";

  const toppings = [];
  const bases = [];
  const chocolates = [];

  for (const ex of extras) {
    const type = (ex.Tipo || "").trim().toLowerCase();
    const name = (ex.Nombre || "").trim();
    if (!name) continue;

    if (type.includes("topping")) toppings.push(name);
    else if (type.includes("base") || type.includes("jarabe")) bases.push(name);
    else if (type.includes("chocolate")) chocolates.push(name);
  }

  for (const name of toppings.sort((a, b) => a.localeCompare(b, "es"))) {
    const li = document.createElement("li");
    li.textContent = name;
    tUl.appendChild(li);
  }

  for (const name of bases.sort((a, b) => a.localeCompare(b, "es"))) {
    const li = document.createElement("li");
    li.textContent = name;
    bUl.appendChild(li);
  }

  for (const name of chocolates.sort((a, b) => a.localeCompare(b, "es"))) {
    const li = document.createElement("li");
    li.textContent = name;
    cUl.appendChild(li);
  }
}

function setMeta() {
  const now = new Date();
  $("#lastUpdated").textContent = `Actualizado: ${now.toLocaleString("es-MX")}`;
  $("#itemsCount").textContent = `${state.items.length} productos`;
}

function buildWhatsAppLink() {
  const phone = window.MENU_CONFIG?.whatsappPhoneE164 || "";
  const name = window.MENU_CONFIG?.businessName || "Las Cremosas";
  const msg = encodeURIComponent(`Hola ${name}! Quiero hacer un pedido 😊🍓`);
  return `https://wa.me/${phone}?text=${msg}`;
}

function populateSaleProducts() {
  const sel = $("#saleProduct");
  sel.innerHTML = `<option value="">Selecciona un producto</option>`;

  const visibles = state.items
    .filter(it => normalizeBool(it.Disponible, true))
    .sort((a, b) => (a.Nombre || "").localeCompare((b.Nombre || ""), "es"));

  for (const item of visibles) {
    const option = document.createElement("option");
    option.value = item.Nombre || "";
    option.textContent = `${item.Nombre || "Sin nombre"} — ${formatPrice(item.Precio || 0)}`;
    option.dataset.price = toNumber(item.Precio || 0);
    sel.appendChild(option);
  }
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateString(value) {
  if (!value) return "";
  const v = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const parts = v.split(/[\/-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const [y, m, d] = parts;
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    } else {
      const [d, m, y] = parts;
      if (y && m && d) {
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }
  }

  return v;
}

function buildSummary() {
  const today = getTodayString();

  const todaySales = state.sales.filter(s => normalizeDateString(s.fecha) === today);
  const todayExpenses = state.expenses.filter(e => normalizeDateString(e.fecha) === today);

  const totalSales = todaySales.reduce((acc, s) => acc + toNumber(s.total), 0);
  const totalExpenses = todayExpenses.reduce((acc, e) => acc + toNumber(e.monto), 0);
  const profit = totalSales - totalExpenses;

  $("#salesTodayTotal").textContent = formatPrice(totalSales);
  $("#expensesTodayTotal").textContent = formatPrice(totalExpenses);
  $("#profitTodayTotal").textContent = formatPrice(profit);
  $("#salesCountToday").textContent = String(todaySales.length);

  const grouped = {};
  for (const sale of todaySales) {
    const name = sale.producto || "Producto";
    const qty = toNumber(sale.cantidad);
    grouped[name] = (grouped[name] || 0) + qty;
  }

  const topProducts = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1]);

  const container = $("#topProductsToday");
  container.innerHTML = "";

  if (!topProducts.length) {
    container.innerHTML = `<div class="mini-list__empty">Todavía no hay ventas registradas hoy.</div>`;
    return;
  }

  for (const [name, qty] of topProducts) {
    const row = document.createElement("div");
    row.className = "mini-list__row";
    row.innerHTML = `<span>${name}</span><strong>${qty}</strong>`;
    container.appendChild(row);
  }
}

function showAdminMessage(message, type = "success") {
  const box = $("#adminMessage");
  box.textContent = message;
  box.className = `status-message status-message--${type}`;
  box.classList.remove("hidden");

  setTimeout(() => {
    box.classList.add("hidden");
  }, 3500);
}

async function sendToApi(payload) {
  const saveUrl = window.MENU_CONFIG?.api?.saveUrl || "";
  if (!saveUrl || saveUrl.includes("PEGA_AQUI")) {
    throw new Error("Falta configurar la URL del Google Apps Script en js/config.js");
  }

  const res = await fetch(saveUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  let data = {};

  try {
    data = JSON.parse(text);
  } catch {
    data = { ok: false, message: text };
  }

  if (!res.ok || !data.ok) {
    throw new Error(data.message || "No se pudo guardar la información");
  }

  return data;
}

async function loadSalesAndExpenses() {
  const { ventasCsvUrl, gastosCsvUrl } = window.MENU_CONFIG?.sheets || {};

  if (!ventasCsvUrl || !gastosCsvUrl || ventasCsvUrl.includes("PEGA_AQUI") || gastosCsvUrl.includes("PEGA_AQUI")) {
    buildSummary();
    return;
  }

  try {
    const [sales, expenses] = await Promise.all([
      fetchCSV(ventasCsvUrl),
      fetchCSV(gastosCsvUrl)
    ]);

    state.sales = sales.map(row => ({
      fecha: row.fecha || row.Fecha || "",
      hora: row.hora || row.Hora || "",
      producto: row.producto || row.Producto || "",
      cantidad: row.cantidad || row.Cantidad || "0",
      precio_unitario: row.precio_unitario || row.Precio_unitario || row["precio unitario"] || "0",
      total: row.total || row.Total || "0",
      encargado: row.encargado || row.Encargado || "",
      notas: row.notas || row.Notas || ""
    }));

    state.expenses = expenses.map(row => ({
      fecha: row.fecha || row.Fecha || "",
      hora: row.hora || row.Hora || "",
      concepto: row.concepto || row.Concepto || "",
      categoria: row.categoria || row.Categoria || "",
      monto: row.monto || row.Monto || "0",
      encargado: row.encargado || row.Encargado || "",
      notas: row.notas || row.Notas || ""
    }));

    buildSummary();
  } catch (err) {
    console.error(err);
    showAdminMessage("No pude cargar ventas/gastos para el corte.", "error");
  }
}

function setupUI() {
  $("#yearNow").textContent = new Date().getFullYear();

  const whats = buildWhatsAppLink();
  $("#btnWhats").href = whats;
  $("#ctaWhats").href = whats;

  $("#searchInput").addEventListener("input", (e) => {
    state.q = e.target.value || "";
    rerender();
  });

  $("#categorySelect").addEventListener("change", (e) => {
    state.category = e.target.value || "";
    rerender();
  });

  $("#toggleAvailable").addEventListener("change", (e) => {
    state.onlyAvailable = !!e.target.checked;
    rerender();
  });

  $("#btnShare").addEventListener("click", async () => {
    const shareData = {
      title: document.title,
      text: "Mira el menú de Las Cremosas 🍓",
      url: location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(location.href);
        alert("Link copiado ✅");
      }
    } catch {}
  });

  const dlg = $("#howDialog");
  $("#openHow").addEventListener("click", (e) => {
    e.preventDefault();
    dlg.showModal();
  });

  $("#closeHow").addEventListener("click", () => dlg.close());

  dlg.addEventListener("click", (e) => {
    const rect = dlg.querySelector(".dialog__card").getBoundingClientRect();
    const inCard =
      e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inCard) dlg.close();
  });

  $("#saleProduct").addEventListener("change", (e) => {
    const selected = e.target.selectedOptions[0];
    const price = selected?.dataset?.price || "";
    $("#salePrice").value = price;
  });

  $("#saleForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const producto = $("#saleProduct").value.trim();
    const cantidad = toNumber($("#saleQty").value);
    const precio = toNumber($("#salePrice").value);
    const encargado = $("#saleManager").value.trim();
    const notas = $("#saleNotes").value.trim();

    if (!producto || cantidad <= 0 || precio < 0) {
      showAdminMessage("Completa correctamente los datos de la venta.", "error");
      return;
    }

    const payload = {
      action: "saveSale",
      data: {
        producto,
        cantidad,
        precio_unitario: precio,
        total: cantidad * precio,
        encargado,
        notas
      }
    };

    try {
      await sendToApi(payload);
      showAdminMessage("Venta guardada correctamente.");
      $("#saleForm").reset();
      $("#saleQty").value = 1;
      await loadSalesAndExpenses();
    } catch (err) {
      console.error(err);
      showAdminMessage(err.message || "No se pudo guardar la venta.", "error");
    }
  });

  $("#expenseForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const concepto = $("#expenseConcept").value.trim();
    const categoria = $("#expenseCategory").value.trim();
    const monto = toNumber($("#expenseAmount").value);
    const encargado = $("#expenseManager").value.trim();
    const notas = $("#expenseNotes").value.trim();

    if (!concepto || !categoria || monto <= 0) {
      showAdminMessage("Completa correctamente los datos del gasto.", "error");
      return;
    }

    const payload = {
      action: "saveExpense",
      data: {
        concepto,
        categoria,
        monto,
        encargado,
        notas
      }
    };

    try {
      await sendToApi(payload);
      showAdminMessage("Gasto guardado correctamente.");
      $("#expenseForm").reset();
      await loadSalesAndExpenses();
    } catch (err) {
      console.error(err);
      showAdminMessage(err.message || "No se pudo guardar el gasto.", "error");
    }
  });

  $("#refreshSummary").addEventListener("click", async () => {
    await loadSalesAndExpenses();
    showAdminMessage("Corte actualizado.");
  });
}

function rerender() {
  const filtered = applyFilters(state.items);
  renderMenu(filtered);
  $("#itemsCount").textContent = `${filtered.length} visibles`;
}

async function main() {
  setupUI();

  const { itemsCsvUrl, extrasCsvUrl } = window.MENU_CONFIG?.sheets || {};
  if (!itemsCsvUrl || !extrasCsvUrl || itemsCsvUrl.includes("PASTE_") || extrasCsvUrl.includes("PASTE_")) {
    $("#lastUpdated").textContent = "Falta configurar los links CSV (js/config.js)";
    $("#itemsCount").textContent = "—";
    $("#menuGrid").innerHTML = `
      <div class="empty">
        <div class="empty__emoji">🧩</div>
        <div class="empty__title">Configura tus CSV</div>
        <div class="empty__subtitle">Abre <code>js/config.js</code> y pega los links de Google Sheets publicados como CSV.</div>
      </div>
    `;
    return;
  }

  try {
    const [items, extras] = await Promise.all([
      fetchCSV(itemsCsvUrl),
      fetchCSV(extrasCsvUrl)
    ]);

    state.items = items.map(it => ({
      ...it,
      Categoria: it.Categoria || it.Category || "",
      Nombre: it.Nombre || it.Producto || it.Item || "",
      Descripcion: it.Descripcion || it.Descripción || "",
      Precio: it.Precio || it.PrecioMXN || it.Price || "",
      Disponible: it.Disponible || it.Activo || "Si",
      Badges: it.Badges || it.Etiquetas || ""
    }));

    state.extras = extras.map(ex => ({
      ...ex,
      Tipo: ex.Tipo || ex.Categoria || "",
      Nombre: ex.Nombre || ex.Item || ""
    }));

    const categories = buildCategories(state.items);
    renderCategoriesSelect(categories);
    renderExtras(state.extras);
    populateSaleProducts();

    setMeta();
    rerender();

    await loadSalesAndExpenses();
  } catch (err) {
    console.error(err);
    $("#lastUpdated").textContent = "Error cargando datos";
    $("#menuGrid").innerHTML = `
      <div class="empty">
        <div class="empty__emoji">⚠️</div>
        <div class="empty__title">No pude cargar el menú</div>
        <div class="empty__subtitle">Revisa que los links CSV estén públicos y correctos (output=csv).</div>
      </div>
    `;
  }
}

document.addEventListener("DOMContentLoaded", main);
