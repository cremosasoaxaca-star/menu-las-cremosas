/* =============================================
   Las Cremosas — app.js
   Menú Digital + Caja
   ============================================= */

"use strict";

// ─── HELPERS ──────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const CFG = window.MENU_CONFIG || {};

function formatPrice(value, currency) {
  const cur = currency || CFG.currency || "MXN";
  const num = toNumber(value);
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: cur }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
}

function toNumber(value) {
  const num = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return isNaN(num) ? 0 : num;
}

function normalizeBool(v, defaultVal = true) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return defaultVal;
  if (["si", "sí", "true", "1", "yes", "y"].includes(s)) return true;
  if (["no", "false", "0", "n"].includes(s)) return false;
  return defaultVal;
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function normalizeDateString(value) {
  if (!value) return "";
  const v = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const parts = v.split(/[\/-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2,"0")}-${parts[2].padStart(2,"0")}`;
    return `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
  }
  return v;
}

// ─── CSV PARSER ───────────────────────────────
function parseCSV(text) {
  const rows = [];
  let cur = "", inQ = false, row = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i+1];
    if (ch === '"') {
      if (inQ && nx === '"') { cur += '"'; i++; } else { inQ = !inQ; }
    } else if (ch === ',' && !inQ) {
      row.push(cur); cur = "";
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (ch === '\r' && nx === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else { cur += ch; }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  if (!rows.length) return [];

  const header = rows[0].map(h => h.trim());
  const data = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols.some(c => String(c||"").trim())) continue;
    const obj = {};
    header.forEach((h, i) => { obj[h] = (cols[i] ?? "").trim(); });
    data.push(obj);
  }
  return data;
}

async function fetchCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV error: ${res.status}`);
  return parseCSV(await res.text());
}

// ─── STATE ────────────────────────────────────
const state = {
  items: [],
  extras: [],
  sales: [],
  expenses: [],
  category: "",
  q: "",
  onlyAvailable: true,
};

// ─── RENDER MENU ─────────────────────────────
function applyFilters(items) {
  const q = state.q.trim().toLowerCase();
  const cat = state.category;
  return items.filter(it => {
    if (state.onlyAvailable && !normalizeBool(it.Disponible, true)) return false;
    if (cat && it.Categoria !== cat) return false;
    if (q) {
      const hay = [it.Nombre, it.Descripcion, it.Categoria, it.Tags, it.Badges, it.Notas]
        .map(x => String(x||"").toLowerCase()).join(" ");
      return hay.includes(q);
    }
    return true;
  });
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

  const currency = CFG.currency || "MXN";

  for (const it of items) {
    const available = normalizeBool(it.Disponible, true);
    const name  = it.Nombre || "Sin nombre";
    const desc  = it.Descripcion || "";
    const price = it.Precio;
    const cat   = it.Categoria || "";

    const badgesRaw = (it.Badges || it.Etiquetas || "")
      .split("|").map(s => s.trim()).filter(Boolean);
    const note = (it.Notas || "").trim();
    if (note) badgesRaw.push(note);

    const card = document.createElement("article");
    card.className = "card" + (available ? "" : " card--unavailable");

    // Top row
    const top = document.createElement("div");
    top.className = "card__top";

    const info = document.createElement("div");
    info.className = "card__info";
    info.innerHTML = `<div class="card__name">${name}</div>`;
    if (desc) info.innerHTML += `<div class="card__desc">${desc}</div>`;
    if (cat)  info.innerHTML += `<div class="card__category">${cat}</div>`;

    const right = document.createElement("div");
    right.className = "card__right";
    right.innerHTML = `<div class="card__price">${price ? formatPrice(price, currency) : "—"}</div>`;
    if (!available) right.innerHTML += `<span class="badge-unavail">No disponible</span>`;

    top.appendChild(info);
    top.appendChild(right);
    card.appendChild(top);

    // Badges
    if (badgesRaw.length) {
      const bdiv = document.createElement("div");
      bdiv.className = "card__badges";
      for (const b of badgesRaw.slice(0, 4)) {
        const bl = b.toLowerCase();
        let cls = "badge";
        if (bl.includes("más vendido") || bl.includes("top") || bl.includes("⭐")) cls += " badge--fav";
        if (bl.includes("🔥") || bl.includes("hot") || bl.includes("picante")) cls += " badge--hot";
        if (b === note) cls += " badge--note";
        bdiv.innerHTML += `<span class="${cls}">${b}</span>`;
      }
      card.appendChild(bdiv);
    }

    grid.appendChild(card);
  }
}

function renderExtras(extras) {
  const tUl = $("#extrasToppings");
  const bUl = $("#extrasBases");
  const cUl = $("#extrasChocolates");
  tUl.innerHTML = bUl.innerHTML = cUl.innerHTML = "";

  const toppings=[], bases=[], chocolates=[];
  for (const ex of extras) {
    const type = (ex.Tipo||"").trim().toLowerCase();
    const name = (ex.Nombre||"").trim();
    if (!name) continue;
    if (type.includes("topping")) toppings.push(name);
    else if (type.includes("base") || type.includes("jarabe")) bases.push(name);
    else if (type.includes("chocolate")) chocolates.push(name);
  }

  const fill = (ul, arr) => arr.sort((a,b)=>a.localeCompare(b,"es"))
    .forEach(n => { const li=document.createElement("li"); li.textContent=n; ul.appendChild(li); });
  fill(tUl, toppings);
  fill(bUl, bases);
  fill(cUl, chocolates);
}

function renderCategoriesSelect(categories) {
  const sel = $("#categorySelect");
  sel.innerHTML = `<option value="">Todas las categorías</option>`;
  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
}

function buildCategories(items) {
  const set = new Set(items.map(it => (it.Categoria||"").trim()).filter(Boolean));
  return Array.from(set).sort((a,b) => a.localeCompare(b,"es"));
}

function setMeta() {
  $("#lastUpdated").textContent = `Actualizado: ${new Date().toLocaleString("es-MX")}`;
  $("#itemsCount").textContent = `${state.items.length} productos`;
}

function rerender() {
  const filtered = applyFilters(state.items);
  renderMenu(filtered);
  $("#itemsCount").textContent = `${filtered.length} visibles`;
}

// ─── CAJA / VENTAS / GASTOS ───────────────────

function populateSaleProducts() {
  const sel = $("#saleProduct");
  sel.innerHTML = `<option value="">Selecciona producto</option>`;
  state.items
    .filter(it => normalizeBool(it.Disponible, true))
    .sort((a,b) => (a.Nombre||"").localeCompare(b.Nombre||"","es"))
    .forEach(it => {
      const opt = document.createElement("option");
      opt.value = it.Nombre || "";
      opt.textContent = `${it.Nombre||"Sin nombre"} — ${formatPrice(it.Precio||0)}`;
      opt.dataset.price = toNumber(it.Precio||0);
      sel.appendChild(opt);
    });
}

function updateTotalPreview() {
  const qty   = toNumber($("#saleQty").value);
  const price = toNumber($("#salePrice").value);
  const el    = $("#saleTotalPreview");
  if (qty > 0 && price >= 0) {
    el.textContent = formatPrice(qty * price);
  } else {
    el.textContent = "—";
  }
}

function buildSummary() {
  const today = getTodayString();
  const todaySales    = state.sales.filter(s => normalizeDateString(s.fecha) === today);
  const todayExpenses = state.expenses.filter(e => normalizeDateString(e.fecha) === today);
  const totalSales    = todaySales.reduce((acc,s) => acc + toNumber(s.total), 0);
  const totalExpenses = todayExpenses.reduce((acc,e) => acc + toNumber(e.monto), 0);
  const profit        = totalSales - totalExpenses;

  $("#salesTodayTotal").textContent    = formatPrice(totalSales);
  $("#expensesTodayTotal").textContent = formatPrice(totalExpenses);
  $("#profitTodayTotal").textContent   = formatPrice(profit);
  $("#salesCountToday").textContent    = `${todaySales.length} venta${todaySales.length !== 1 ? "s" : ""}`;

  // Products today
  const grouped = {};
  for (const s of todaySales) {
    const n = s.producto || "Producto";
    grouped[n] = (grouped[n]||0) + toNumber(s.cantidad);
  }
  const container = $("#topProductsToday");
  container.innerHTML = "";

  const sorted = Object.entries(grouped).sort((a,b) => b[1]-a[1]);
  if (!sorted.length) {
    container.innerHTML = `<div class="mini-list__empty">Sin ventas registradas hoy.</div>`;
    return;
  }
  for (const [name, qty] of sorted) {
    const row = document.createElement("div");
    row.className = "mini-list__row";
    row.innerHTML = `<span>${name}</span><strong>${qty}</strong>`;
    container.appendChild(row);
  }
}

function showMessage(msg, type = "success") {
  const box = $("#adminMessage");
  box.textContent = msg;
  box.className = `status-message status-message--${type}`;
  box.classList.remove("hidden");
  clearTimeout(box._timer);
  box._timer = setTimeout(() => box.classList.add("hidden"), 3800);
}

async function sendToApi(payload) {
  const url = CFG.api?.saveUrl || "";
  if (!url || url.includes("PEGA")) throw new Error("Falta configurar la URL del Apps Script en config.js");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  let data = {};
  try { data = await res.json(); } catch { data = { ok: false, message: await res.text() }; }
  if (!res.ok || !data.ok) throw new Error(data.message || "Error al guardar");
  return data;
}

async function loadSalesAndExpenses() {
  const { ventasCsvUrl, gastosCsvUrl } = CFG.sheets || {};
  if (!ventasCsvUrl || !gastosCsvUrl || ventasCsvUrl.includes("PEGA")) {
    buildSummary();
    return;
  }
  try {
    const [sales, expenses] = await Promise.all([fetchCSV(ventasCsvUrl), fetchCSV(gastosCsvUrl)]);
    state.sales = sales.map(r => ({
      fecha: r.fecha || r.Fecha || "",
      hora:  r.hora  || r.Hora  || "",
      producto:  r.producto  || r.Producto || "",
      cantidad:  r.cantidad  || r.Cantidad || "0",
      precio_unitario: r.precio_unitario || r.Precio_unitario || "0",
      total: r.total || r.Total || "0",
      encargado: r.encargado || r.Encargado || "",
      notas: r.notas || r.Notas || ""
    }));
    state.expenses = expenses.map(r => ({
      fecha: r.fecha || r.Fecha || "",
      hora:  r.hora  || r.Hora  || "",
      concepto:  r.concepto  || r.Concepto  || "",
      categoria: r.categoria || r.Categoria || "",
      monto: r.monto || r.Monto || "0",
      encargado: r.encargado || r.Encargado || "",
      notas: r.notas || r.Notas || ""
    }));
    buildSummary();
  } catch (err) {
    console.error(err);
    showMessage("No pude cargar ventas/gastos. Revisa los CSV.", "error");
  }
}

// ─── SETUP UI ─────────────────────────────────
function setupUI() {
  // WhatsApp links
  const waPhone = CFG.whatsappPhoneE164 || "";
  const waName  = CFG.businessName || "Las Cremosas";
  const waMsg   = encodeURIComponent(`Hola ${waName}! Quiero hacer un pedido 😊🍓`);
  const waLink  = `https://wa.me/${waPhone}?text=${waMsg}`;
  $("#btnWhats").href = waLink;
  $("#ctaWhats").href = waLink;

  // Year
  $("#yearNow").textContent = new Date().getFullYear();

  // Tabs (menú / caja)
  $$(".nav-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".nav-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      $$(".tab-view").forEach(v => v.classList.remove("active"));
      $(`#tab${target.charAt(0).toUpperCase()+target.slice(1)}`).classList.add("active");
    });
  });

  // Caja sub-tabs (venta / gasto)
  $$(".caja-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".caja-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const form = tab.dataset.form;
      $$(".caja-form").forEach(f => f.classList.remove("active"));
      $(`#form${form.charAt(0).toUpperCase()+form.slice(1)}`).classList.add("active");
    });
  });

  // Filtros
  $("#searchInput").addEventListener("input", e => { state.q = e.target.value; rerender(); });
  $("#categorySelect").addEventListener("change", e => { state.category = e.target.value; rerender(); });
  $("#toggleAvailable").addEventListener("change", e => { state.onlyAvailable = e.target.checked; rerender(); });

  // Compartir
  $("#btnShare").addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, text: "Mira el menú de Las Cremosas 🍓", url: location.href });
      } else {
        await navigator.clipboard.writeText(location.href);
        alert("¡Link copiado al portapapeles! ✅");
      }
    } catch {}
  });

  // Dialog: cómo se actualiza
  const dlg = $("#howDialog");
  $("#openHow").addEventListener("click", e => { e.preventDefault(); dlg.showModal(); });
  $("#closeHow").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", e => {
    if (e.target === dlg) dlg.close();
  });

  // Sale form: product change → fill price
  $("#saleProduct").addEventListener("change", e => {
    const opt = e.target.selectedOptions[0];
    const price = opt?.dataset?.price || "";
    $("#salePrice").value = price;
    updateTotalPreview();
  });

  // Total preview on qty / price change
  ["saleQty", "salePrice"].forEach(id => {
    $(` #${id}`).addEventListener("input", updateTotalPreview);
  });

  // Guardar venta
  $("#btnSaveSale").addEventListener("click", async () => {
    const producto   = $("#saleProduct").value.trim();
    const cantidad   = toNumber($("#saleQty").value);
    const precio     = toNumber($("#salePrice").value);
    const encargado  = $("#saleManager").value.trim();
    const notas      = $("#saleNotes").value.trim();

    if (!producto || cantidad <= 0 || precio < 0) {
      showMessage("Completa los datos de la venta correctamente.", "error");
      return;
    }

    const payload = {
      action: "saveSale",
      data: { producto, cantidad, precio_unitario: precio, total: cantidad * precio, encargado, notas }
    };

    const btn = $("#btnSaveSale");
    btn.disabled = true; btn.textContent = "Guardando…";
    try {
      await sendToApi(payload);
      showMessage("✅ Venta guardada correctamente.");
      // Reset form
      ["saleProduct","saleQty","saleManager","saleNotes","salePrice"].forEach(id => {
        const el = $(`#${id}`);
        if (el.tagName === "SELECT") el.selectedIndex = 0;
        else el.value = id === "saleQty" ? "1" : "";
      });
      $("#saleTotalPreview").textContent = "—";
      await loadSalesAndExpenses();
    } catch (err) {
      showMessage(err.message || "No se pudo guardar la venta.", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar venta`;
    }
  });

  // Guardar gasto
  $("#btnSaveExpense").addEventListener("click", async () => {
    const concepto   = $("#expenseConcept").value.trim();
    const categoria  = $("#expenseCategory").value.trim();
    const monto      = toNumber($("#expenseAmount").value);
    const encargado  = $("#expenseManager").value.trim();
    const notas      = $("#expenseNotes").value.trim();

    if (!concepto || !categoria || monto <= 0) {
      showMessage("Completa los datos del gasto correctamente.", "error");
      return;
    }

    const payload = {
      action: "saveExpense",
      data: { concepto, categoria, monto, encargado, notas }
    };

    const btn = $("#btnSaveExpense");
    btn.disabled = true; btn.textContent = "Guardando…";
    try {
      await sendToApi(payload);
      showMessage("✅ Gasto guardado correctamente.");
      ["expenseConcept","expenseCategory","expenseAmount","expenseManager","expenseNotes"].forEach(id => {
        const el = $(`#${id}`);
        if (el.tagName === "SELECT") el.selectedIndex = 0;
        else el.value = "";
      });
      await loadSalesAndExpenses();
    } catch (err) {
      showMessage(err.message || "No se pudo guardar el gasto.", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar gasto`;
    }
  });

  // Actualizar corte
  $("#refreshSummary").addEventListener("click", async () => {
    await loadSalesAndExpenses();
    showMessage("Corte actualizado.");
  });
}

// ─── MAIN ─────────────────────────────────────
async function main() {
  setupUI();

  const { itemsCsvUrl, extrasCsvUrl } = CFG.sheets || {};

  if (!itemsCsvUrl || !extrasCsvUrl || itemsCsvUrl.includes("PASTE_") || extrasCsvUrl.includes("PASTE_")) {
    $("#lastUpdated").textContent = "Configura los CSV en config.js";
    $("#menuGrid").innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-state__emoji">🧩</span>
        <strong>Configura tus hojas CSV</strong>
        <span>Abre <code>config.js</code> y pega los links de Google Sheets.</span>
      </div>`;
    return;
  }

  try {
    const [items, extras] = await Promise.all([fetchCSV(itemsCsvUrl), fetchCSV(extrasCsvUrl)]);

    state.items = items.map(it => ({
      ...it,
      Categoria:   it.Categoria   || it.Category || "",
      Nombre:      it.Nombre      || it.Producto  || it.Item || "",
      Descripcion: it.Descripcion || it["Descripción"] || "",
      Precio:      it.Precio      || it.PrecioMXN || it.Price || "",
      Disponible:  it.Disponible  || it.Activo    || "Si",
      Badges:      it.Badges      || it.Etiquetas || "",
      Notas:       it.Notas       || "",
    }));

    state.extras = extras.map(ex => ({
      ...ex,
      Tipo:   ex.Tipo   || ex.Categoria || "",
      Nombre: ex.Nombre || ex.Item      || "",
    }));

    renderCategoriesSelect(buildCategories(state.items));
    renderExtras(state.extras);
    populateSaleProducts();
    setMeta();
    rerender();

    await loadSalesAndExpenses();
  } catch (err) {
    console.error(err);
    $("#lastUpdated").textContent = "Error cargando datos";
    $("#menuGrid").innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-state__emoji">⚠️</span>
        <strong>No pude cargar el menú</strong>
        <span>Verifica que los links CSV estén públicos y con <code>output=csv</code>.</span>
      </div>`;
  }
}

document.addEventListener("DOMContentLoaded", main);
