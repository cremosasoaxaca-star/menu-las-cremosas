/* Las Cremosas — app.js (Modo PÓSTER por Seccion/Subseccion/Orden) */

const $ = (s) => document.querySelector(s);

const state = {
  rows: [],
  extras: [],
  q: "",
  sectionFilter: "",
  onlyAvailable: true,
};

function norm(str) {
  return String(str ?? "").trim();
}

function normLower(str) {
  return norm(str).toLowerCase();
}

function toNum(v, fallback = 999999) {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function isYes(v, def = true) {
  const s = normLower(v);
  if (!s) return def;
  if (["si", "sí", "true", "1", "yes", "y"].includes(s)) return true;
  if (["no", "false", "0", "n"].includes(s)) return false;
  return def;
}

function formatPrice(v) {
  const currency = window.MENU_CONFIG?.currency || "MXN";
  const raw = norm(v);
  if (!raw) return "";
  const num = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num)) return raw;
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(num);
  } catch {
    return `$${num}`;
  }
}

function parseCSV(text) {
  // CSV básico con comillas
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nx = text[i + 1];

    if (ch === '"') {
      if (inQ && nx === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      row.push(cur); cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQ) {
      if (ch === "\r" && nx === "\n") i++;
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
  const header = rows[0].map(h => norm(h));
  const out = [];

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols.some(c => norm(c))) continue;
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = norm(cols[c]);
    out.push(obj);
  }
  return out;
}

async function fetchCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV error ${res.status}`);
  const txt = await res.text();
  return parseCSV(txt);
}

function waLink() {
  const phone = window.MENU_CONFIG?.whatsappPhoneE164 || "";
  const name = window.MENU_CONFIG?.businessName || "Las Cremosas";
  const msg = encodeURIComponent(`Hola ${name}! Quiero hacer un pedido 😊🍓`);
  return `https://wa.me/${phone}?text=${msg}`;
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x) || "";
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

function buildSectionOptions(rows) {
  const sel = $("#categorySelect");
  sel.innerHTML = "";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Todas las secciones";
  sel.appendChild(opt0);

  const set = new Set(rows.map(r => r.seccion).filter(Boolean));
  const list = Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  for (const s of list) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  }
}

function applyFilters(rows) {
  const q = normLower(state.q);
  const sec = norm(state.sectionFilter);
  const onlyAvail = state.onlyAvailable;

  return rows.filter(r => {
    if (onlyAvail && !r.disponible) return false;
    if (sec && r.seccion !== sec) return false;

    if (q) {
      const hay = `${r.seccion} ${r.subseccion} ${r.nombre} ${r.descripcion}`.toLowerCase();
      return hay.includes(q);
    }
    return true;
  });
}

function setMeta(count) {
  $("#lastUpdated").textContent = `Actualizado: ${new Date().toLocaleString("es-MX")}`;
  $("#itemsCount").textContent = `${count} visibles`;
}

function renderPoster(rows) {
  const grid = $("#menuGrid");
  const empty = $("#emptyState");
  grid.innerHTML = "";

  if (!rows.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  // Secciones ordenadas por OrdenSeccion
  const bySec = groupBy(rows, r => r.seccion || "Menú");
  const sections = Array.from(bySec.entries()).sort((a, b) => {
    const ao = Math.min(...a[1].map(x => x.ordenSeccion));
    const bo = Math.min(...b[1].map(x => x.ordenSeccion));
    return ao - bo || a[0].localeCompare(b[0], "es");
  });

  for (const [secName, secRows] of sections) {
    const secEl = document.createElement("section");
    secEl.className = "poster-section";

    const h = document.createElement("h3");
    h.className = "poster-title";
    h.textContent = secName;
    secEl.appendChild(h);

    // Subsecciones dentro de la sección
    const bySub = groupBy(secRows, r => r.subseccion || "General");
    const subs = Array.from(bySub.entries()).sort((a, b) => {
      const ao = Math.min(...a[1].map(x => x.ordenItem));
      const bo = Math.min(...b[1].map(x => x.ordenItem));
      return ao - bo || a[0].localeCompare(b[0], "es");
    });

    for (const [subName, subRows] of subs) {
      const block = document.createElement("div");
      block.className = "poster-block";

      const sh = document.createElement("div");
      sh.className = "poster-subtitle";
      sh.textContent = subName;
      block.appendChild(sh);

      subRows.sort((a, b) => a.ordenItem - b.ordenItem);

      const list = document.createElement("div");
      list.className = "poster-list";

      for (const r of subRows) {
        const row = document.createElement("div");
        row.className = "poster-row";

        // Si NO tiene precio, lo tratamos como "incluye"
        const hasPrice = !!norm(r.precio);
        if (!hasPrice) row.classList.add("poster-row--info");

        const left = document.createElement("div");
        left.className = "poster-left";

        const name = document.createElement("div");
        name.className = "poster-name";
        name.textContent = r.nombre;

        const desc = document.createElement("div");
        desc.className = "poster-desc";
        desc.textContent = r.descripcion;

        left.appendChild(name);
        if (norm(r.descripcion)) left.appendChild(desc);

        const price = document.createElement("div");
        price.className = "poster-price";
        price.textContent = hasPrice ? formatPrice(r.precio) : "Incluye";

        row.appendChild(left);
        row.appendChild(price);
        list.appendChild(row);
      }

      block.appendChild(list);
      secEl.appendChild(block);
    }

    grid.appendChild(secEl);
  }
}

function renderExtras(extras) {
  const tUl = $("#extrasToppings");
  const bUl = $("#extrasBases");
  const cUl = $("#extrasChocolates");
  if (!tUl || !bUl || !cUl) return;

  tUl.innerHTML = "";
  bUl.innerHTML = "";
  cUl.innerHTML = "";

  const tops = [];
  const bases = [];
  const chocs = [];

  for (const ex of extras) {
    const tipo = normLower(ex.tipo);
    const name = norm(ex.nombre);
    if (!name) continue;

    if (tipo.includes("topping")) tops.push(name);
    else if (tipo.includes("base") || tipo.includes("jarabe")) bases.push(name);
    else if (tipo.includes("chocolate")) chocs.push(name);
  }

  for (const n of tops.sort((a, b) => a.localeCompare(b, "es"))) {
    const li = document.createElement("li"); li.textContent = n; tUl.appendChild(li);
  }
  for (const n of bases.sort((a, b) => a.localeCompare(b, "es"))) {
    const li = document.createElement("li"); li.textContent = n; bUl.appendChild(li);
  }
  for (const n of chocs.sort((a, b) => a.localeCompare(b, "es"))) {
    const li = document.createElement("li"); li.textContent = n; cUl.appendChild(li);
  }
}

function setupUI() {
  $("#yearNow").textContent = new Date().getFullYear();

  const w = waLink();
  $("#btnWhats").href = w;
  $("#ctaWhats").href = w;

  $("#searchInput").addEventListener("input", (e) => {
    state.q = e.target.value || "";
    rerender();
  });

  $("#categorySelect").addEventListener("change", (e) => {
    state.sectionFilter = e.target.value || "";
    rerender();
  });

  $("#toggleAvailable").addEventListener("change", (e) => {
    state.onlyAvailable = !!e.target.checked;
    rerender();
  });

  $("#btnShare").addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, text: "Menú Las Cremosas 🍓", url: location.href });
      } else {
        await navigator.clipboard.writeText(location.href);
        alert("Link copiado ✅");
      }
    } catch {}
  });

  const dlg = $("#howDialog");
  $("#openHow")?.addEventListener("click", (e) => { e.preventDefault(); dlg.showModal(); });
  $("#closeHow")?.addEventListener("click", () => dlg.close());
  dlg?.addEventListener("click", (e) => {
    const card = dlg.querySelector(".dialog__card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dlg.close();
  });
}

function rerender() {
  const filtered = applyFilters(state.rows);
  renderPoster(filtered);
  setMeta(filtered.length);
}

async function main() {
  setupUI();

  const itemsUrl = window.MENU_CONFIG?.sheets?.itemsCsvUrl;
  const extrasUrl = window.MENU_CONFIG?.sheets?.extrasCsvUrl;

  if (!itemsUrl || !extrasUrl) {
    $("#lastUpdated").textContent = "Falta configurar links CSV (config.js)";
    return;
  }

  try {
    const [items, extras] = await Promise.all([fetchCSV(itemsUrl), fetchCSV(extrasUrl)]);

    // Mapeo exacto a tu sheet actual (Seccion, OrdenSeccion, Subseccion, OrdenItem, Nombre, Descripcion, Precio, Disponible)
    state.rows = items.map(it => ({
      seccion: norm(it.Seccion),
      ordenSeccion: toNum(it.OrdenSeccion, 999999),
      subseccion: norm(it.Subseccion),
      ordenItem: toNum(it.OrdenItem, 999999),
      nombre: norm(it.Nombre),
      descripcion: norm(it.Descripcion),
      precio: norm(it.Precio),
      disponible: isYes(it.Disponible, true),
    })).filter(r => r.nombre); // sin nombre no mostramos

    state.extras = extras.map(ex => ({
      tipo: ex.Tipo || ex.Categoria || "",
      nombre: ex.Nombre || ex.Item || "",
    }));

    buildSectionOptions(state.rows);
    rerender();
    renderExtras(state.extras);
  } catch (e) {
    console.error(e);
    $("#lastUpdated").textContent = "Error cargando menú (revisa CSV público)";
  }
}

document.addEventListener("DOMContentLoaded", main);
