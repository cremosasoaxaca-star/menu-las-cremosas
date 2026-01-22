/* Las Cremosas — app.js (Layout tipo póster con Seccion/Subseccion y orden) */

const $ = (sel) => document.querySelector(sel);

const state = {
  items: [],
  extras: [],
  section: "",
  q: "",
  onlyAvailable: true
};

function formatPrice(value, currency="MXN"){
  if (value === null || value === undefined || value === "") return "";
  const num = Number(String(value).replace(/[^0-9.]/g, ""));
  if (Number.isNaN(num)) return String(value);
  try{
    return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(num);
  }catch{
    return `$${num}`;
  }
}

function parseCSV(csvText){
  // CSV simple con soporte de comillas
  const rows = [];
  let cur = "";
  let inQuotes = false;
  let row = [];
  for (let i=0; i<csvText.length; i++){
    const ch = csvText[i];
    const next = csvText[i+1];
    if (ch === '"'){
      if (inQuotes && next === '"'){ cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes){
      row.push(cur); cur = "";
    } else if ((ch === '\n' || ch === '\r') && !inQuotes){
      if (ch === '\r' && next === '\n') i++;
      row.push(cur); rows.push(row);
      row = []; cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.length || row.length){ row.push(cur); rows.push(row); }

  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  const data = [];
  for (let r=1; r<rows.length; r++){
    const cols = rows[r];
    if (!cols.some(c => String(c || "").trim() !== "")) continue;
    const obj = {};
    for (let c=0; c<header.length; c++){
      obj[header[c]] = (cols[c] ?? "").trim();
    }
    data.push(obj);
  }
  return data;
}

async function fetchCSV(url){
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar CSV: ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

function normalizeBool(v, defaultVal=true){
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return defaultVal;
  if (["si","sí","true","1","yes","y"].includes(s)) return true;
  if (["no","false","0","n"].includes(s)) return false;
  return defaultVal;
}

function nOrInf(v){
  const num = Number(String(v ?? "").replace(/[^\d.-]/g,""));
  return Number.isFinite(num) ? num : Infinity;
}

function buildSections(items){
  const set = new Set();
  for (const it of items){
    if (it.Seccion) set.add(it.Seccion);
  }
  return Array.from(set).sort((a,b)=> a.localeCompare(b, "es"));
}

function applyFilters(items){
  const q = state.q.trim().toLowerCase();
  const sec = state.section;
  const onlyAvail = state.onlyAvailable;

  return items.filter(it => {
    const available = normalizeBool(it.Disponible, true);
    if (onlyAvail && !available) return false;

    if (sec){
      if ((it.Seccion || "") !== sec) return false;
    }

    if (q){
      const hay = [
        it.Seccion, it.Subseccion, it.Nombre, it.Descripcion
      ].map(x => String(x||"").toLowerCase()).join(" ");
      return hay.includes(q);
    }
    return true;
  });
}

function renderSectionsSelect(sections){
  const sel = $("#categorySelect");
  sel.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = "Todas las secciones";
  sel.appendChild(first);

  for (const s of sections){
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  }
}

function groupBy(arr, keyFn){
  const m = new Map();
  for (const x of arr){
    const k = keyFn(x) || "";
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

function setMeta(filteredCount){
  const now = new Date();
  $("#lastUpdated").textContent = `Actualizado: ${now.toLocaleString("es-MX")}`;
  $("#itemsCount").textContent = `${filteredCount} visibles`;
}

function buildWhatsAppLink(){
  const phone = window.MENU_CONFIG?.whatsappPhoneE164 || "";
  const name = window.MENU_CONFIG?.businessName || "Las Cremosas";
  const msg = encodeURIComponent(`Hola ${name}! Quiero hacer un pedido 😊🍓`);
  return `https://wa.me/${phone}?text=${msg}`;
}

function setupUI(){
  $("#yearNow").textContent = new Date().getFullYear();

  const whats = buildWhatsAppLink();
  $("#btnWhats").href = whats;
  $("#ctaWhats").href = whats;

  $("#searchInput").addEventListener("input", (e)=>{
    state.q = e.target.value || "";
    rerender();
  });

  $("#categorySelect").addEventListener("change", (e)=>{
    state.section = e.target.value || "";
    rerender();
  });

  $("#toggleAvailable").addEventListener("change", (e)=>{
    state.onlyAvailable = !!e.target.checked;
    rerender();
  });

  $("#btnShare").addEventListener("click", async ()=>{
    const shareData = {
      title: document.title,
      text: "Mira el menú de Las Cremosas 🍓",
      url: location.href
    };
    try{
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(location.href);
        alert("Link copiado ✅");
      }
    }catch{}
  });

  const dlg = $("#howDialog");
  $("#openHow").addEventListener("click", (e)=>{
    e.preventDefault();
    dlg.showModal();
  });
  $("#closeHow").addEventListener("click", ()=> dlg.close());
  dlg.addEventListener("click", (e)=>{
    const rect = dlg.querySelector(".dialog__card").getBoundingClientRect();
    const inCard = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inCard) dlg.close();
  });
}

function renderMenu(items){
  const grid = $("#menuGrid");
  const empty = $("#emptyState");
  grid.innerHTML = "";

  if (!items.length){
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  // Agrupar por Seccion (ordenado por OrdenSeccion)
  const bySection = groupBy(items, it => it.Seccion || "Sin sección");
  const sections = Array.from(bySection.entries())
    .sort((a,b)=> nOrInf(a[1][0]?.OrdenSeccion) - nOrInf(b[1][0]?.OrdenSeccion) || a[0].localeCompare(b[0], "es"));

  for (const [sectionName, sectionItems] of sections){
    const sectionWrap = document.createElement("section");
    sectionWrap.className = "poster-section";

    const h = document.createElement("h3");
    h.className = "poster-title";
    h.textContent = sectionName;
    sectionWrap.appendChild(h);

    // Agrupar por Subseccion (como “Escoge tu tamaño…”, “¿Qué le vas…?”)
    const bySub = groupBy(sectionItems, it => it.Subseccion || "General");
    const subs = Array.from(bySub.entries())
      .sort((a,b)=>{
        // orden por el mínimo OrdenItem dentro de la subsección
        const minA = Math.min(...a[1].map(x=>nOrInf(x.OrdenItem)));
        const minB = Math.min(...b[1].map(x=>nOrInf(x.OrdenItem)));
        return minA - minB || a[0].localeCompare(b[0],"es");
      });

    for (const [subName, subItems] of subs){
      const block = document.createElement("div");
      block.className = "poster-block";

      const sh = document.createElement("div");
      sh.className = "poster-subtitle";
      sh.textContent = subName;
      block.appendChild(sh);

      // Ordenar items por OrdenItem
      subItems.sort((a,b)=> nOrInf(a.OrdenItem) - nOrInf(b.OrdenItem));

      const list = document.createElement("div");
      list.className = "poster-list";

      const currency = (window.MENU_CONFIG?.currency) || "MXN";

      for (const it of subItems){
        const row = document.createElement("div");
        row.className = "poster-row";

        const left = document.createElement("div");
        left.className = "poster-left";

        const name = document.createElement("div");
        name.className = "poster-name";
        name.textContent = it.Nombre || "—";

        const desc = document.createElement("div");
        desc.className = "poster-desc";
        desc.textContent = it.Descripcion || "";

        left.appendChild(name);
        if ((it.Descripcion || "").trim()) left.appendChild(desc);

        const price = document.createElement("div");
        price.className = "poster-price";
        price.textContent = (it.Precio || "").trim() ? formatPrice(it.Precio, currency) : "";

        row.appendChild(left);
        row.appendChild(price);

        list.appendChild(row);
      }

      block.appendChild(list);
      sectionWrap.appendChild(block);
    }

    grid.appendChild(sectionWrap);
  }
}

function renderExtras(extras){
  const tUl = $("#extrasToppings");
  const bUl = $("#extrasBases");
  const cUl = $("#extrasChocolates");
  tUl.innerHTML = "";
  bUl.innerHTML = "";
  cUl.innerHTML = "";

  const toppings = [];
  const bases = [];
  const chocolates = [];

  for (const ex of extras){
    const type = (ex.Tipo || "").trim().toLowerCase();
    const name = (ex.Nombre || "").trim();
    if (!name) continue;

    if (type.includes("topping")) toppings.push(name);
    else if (type.includes("base") || type.includes("jarabe")) bases.push(name);
    else if (type.includes("chocolate")) chocolates.push(name);
  }

  for (const name of toppings.sort((a,b)=>a.localeCompare(b,"es"))){
    const li = document.createElement("li");
    li.textContent = name;
    tUl.appendChild(li);
  }
  for (const name of bases.sort((a,b)=>a.localeCompare(b,"es"))){
    const li = document.createElement("li");
    li.textContent = name;
    bUl.appendChild(li);
  }
  for (const name of chocolates.sort((a,b)=>a.localeCompare(b,"es"))){
    const li = document.createElement("li");
    li.textContent = name;
    cUl.appendChild(li);
  }
}

function rerender(){
  const filtered = applyFilters(state.items);
  renderMenu(filtered);
  setMeta(filtered.length);
}

async function main(){
  setupUI();

  const { itemsCsvUrl, extrasCsvUrl } = window.MENU_CONFIG?.sheets || {};
  if (!itemsCsvUrl || !extrasCsvUrl || itemsCsvUrl.includes("PASTE_") || extrasCsvUrl.includes("PASTE_")){
    $("#lastUpdated").textContent = "Falta configurar los links CSV (config.js)";
    $("#itemsCount").textContent = "—";
    return;
  }

  try{
    const [items, extras] = await Promise.all([
      fetchCSV(itemsCsvUrl),
      fetchCSV(extrasCsvUrl)
    ]);

    // Normalizar campos (por si alguna vez cambias nombres)
    state.items = items.map(it => ({
      Seccion: it.Seccion || it.Categoria || "Menú",
      OrdenSeccion: it.OrdenSeccion || it.Orden || "",
      Subseccion: it.Subseccion || it.Subcategoría || it.Subcategoria || it.Categoria || "General",
      OrdenItem: it.OrdenItem || it.Orden || "",
      Nombre: it.Nombre || it.Producto || it.Item || "",
      Descripcion: it.Descripcion || it.Descripción || it.Variante || it["Variante/Tamaño"] || "",
      Precio: it.Precio || it.PrecioMXN || it.Price || "",
      Disponible: it.Disponible || it.Activo || "Si"
    }));

    state.extras = extras.map(ex => ({
      Tipo: ex.Tipo || ex.Categoria || "",
      Nombre: ex.Nombre || ex.Item || ""
    }));

    // Secciones para el selector
    const sections = buildSections(state.items);
    renderSectionsSelect(sections);

    rerender();
    renderExtras(state.extras);
  }catch(err){
    console.error(err);
    $("#lastUpdated").textContent = "Error cargando datos";
    $("#itemsCount").textContent = "—";
  }
}

document.addEventListener("DOMContentLoaded", main);
