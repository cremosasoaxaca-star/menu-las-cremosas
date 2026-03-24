/* ══════════════════════════════════════════
   Las Cremosas — app.js v4.2
   Auto refresh del menú desde Google Sheets
   ══════════════════════════════════════════ */
"use strict";

const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const CFG = window.MENU_CONFIG || {};

/* ── Auto refresh ───────────────────────── */
let MENU_SNAPSHOT = "";
let MENU_RELOAD_TIMER = null;
const MENU_REFRESH_MS = 10000; // cada 10 segundos

/* ── Helpers ───────────────────────────── */
function fmt(v, cur) {
  const n = num(v);
  try {
    return new Intl.NumberFormat("es-MX", {
      style:"currency", currency: cur || CFG.currency || "MXN"
    }).format(n);
  } catch { return `$${n.toFixed(2)}`; }
}

function num(v) {
  if (v == null || v === "") return 0;
  const c = String(v)
    .replace(/[$€£¥\s]/g,"")
    .replace(/,/g,"")
    .replace(/[a-zA-Z]/g,"")
    .replace(/[^0-9.-]/g,"");
  const n = parseFloat(c);
  return isNaN(n) ? 0 : n;
}

function bool(v, def=true) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return def;
  return ["si","sí","true","1","yes","y"].includes(s) ? true
       : ["no","false","0","n"].includes(s) ? false
       : def;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function normDate(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const p = s.split(/[\/\-]/);
  if (p.length === 3)
    return p[0].length === 4
      ? `${p[0]}-${p[1].padStart(2,"0")}-${p[2].padStart(2,"0")}`
      : `${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
  return s;
}

function strip(s) {
  return String(s||"").toLowerCase()
    .replace(/[áàä]/g,"a").replace(/[éèë]/g,"e")
    .replace(/[íìï]/g,"i").replace(/[óòö]/g,"o")
    .replace(/[úùü]/g,"u").trim();
}

/* ── CSV FETCH (CORS-safe) ────────────────── */
async function fetchText(url) {
  try {
    const r = await fetch(url, {
      cache: "no-store", mode: "cors",
      headers: { "Cache-Control": "no-cache" }
    });
    if (r.ok) return await r.text();
    throw new Error(`HTTP ${r.status}`);
  } catch(e1) {
    console.warn("Fetch directo falló:", e1.message, "— intentando proxy…");
  }
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxyUrl, { cache: "no-store" });
    if (!r.ok) throw new Error(`Proxy HTTP ${r.status}`);
    const json = await r.json();
    if (!json.contents) throw new Error("Proxy sin contenido");
    return json.contents;
  } catch(e2) {
    throw new Error(`No se pudo cargar el CSV.\nProxy: ${e2.message}\n\nVerifica que la hoja esté publicada como CSV.`);
  }
}

function parseCSV(text) {
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error("La hoja NO está publicada como CSV. Ve a Archivo → Compartir → Publicar en la web → elige la hoja → CSV.");
  }
  const rows=[]; let cur="",inQ=false,row=[];
  for (let i=0;i<text.length;i++) {
    const c=text[i],nx=text[i+1];
    if (c==='"') { if(inQ&&nx==='"'){cur+='"';i++;}else inQ=!inQ; }
    else if (c===','&&!inQ) { row.push(cur);cur=""; }
    else if ((c==='\n'||c==='\r')&&!inQ) {
      if(c==='\r'&&nx==='\n')i++;
      row.push(cur);rows.push(row);row=[];cur="";
    } else cur+=c;
  }
  if(cur.length||row.length){row.push(cur);rows.push(row);}
  if(!rows.length) return [];
  const hdr = rows[0].map(h=>h.trim());
  console.log("📋 Columnas CSV:", hdr);
  const data=[];
  for(let r=1;r<rows.length;r++){
    const cols=rows[r];
    if(!cols.some(c=>String(c||"").trim())) continue;
    const o={};
    hdr.forEach((h,i)=>{ o[h]=(cols[i]??"").trim(); });
    data.push(o);
  }
  return data;
}

async function csv(url) {
  const text = await fetchText(url);
  return parseCSV(text);
}

/* ── State ─────────────────────────────── */
const S = { items:[], extras:[], sales:[], expenses:[], q:"", cat:"", avail:true };

/* ── Normalizar items ───────────────────── */
function normalizeItem(r) {
  return {
    Categoria:   r.Seccion      || r.Categoria   || r.Category  || "",
    Nombre:      r.Nombre       || r.Producto    || r.Item      || "",
    Variante:    r["Variante/Tamaño"] || r.Variante || "",
    Descripcion: r.Descripcion  || r["Descripción"] || r.Description || "",
    Precio:      r.Precio       || r.PrecioMXN   || r.Price     || "",
    Disponible:  r.Disponible   || r.Activo      || "Sí",
    Badges:      r.Badges       || r.Etiquetas   || "",
    Notas:       r.Notas        || "",
    Subseccion:  r.Subseccion   || "",
  };
}

function normalizeExtra(r) {
  return {
    Tipo:       r.Tipo        || r.Categoria  || "",
    Nombre:     r.Nombre      || r.Item       || "",
    Precio:     r.Precio      || "",
    Activo:     r.Activo      || r.Disponible || "Sí",
    TipoPrecio: r["Tipo de precio"] || r.TipoPrecio || r["tipo de precio"] || "",
    Notas:      r.Notas       || "",
  };
}

/* ── Category → section ID ─────────────── */
function getSec(cat) {
  const s = String(cat||"")
    .toLowerCase()
    .replace(/[áàâä]/g,"a").replace(/[éèêë]/g,"e")
    .replace(/[íìîï]/g,"i").replace(/[óòôö]/g,"o")
    .replace(/[úùûü]/g,"u").replace(/ñ/g,"n")
    .replace(/\s+/g," ").trim();

  if (s === "fresas con crema" || s === "fresa con crema" ||
      s.startsWith("fresas con") || s.includes("con crema") ||
      s === "fresas") return "fresas";

  if (s === "fresas especiales" || s === "fresa especial" ||
      s.includes("especial") || s.includes("golosa") ||
      s.includes("chocolate")) return "especiales";

  if (s === "frappes" || s === "frappe" || s.includes("frappe")) return "frappes";
  if (s === "waffles" || s === "waffle" || s.includes("waffle")) return "waffles";
  if (s === "snacks"  || s === "snack"  || s.includes("snack"))  return "snacks";
  if (s === "bebidas" || s === "bebida" || s.includes("bebida"))  return "bebidas";

  console.warn("⚠ Categoria sin sección:", JSON.stringify(cat), "→", JSON.stringify(s));
  return null;
}

/* ── Render ─────────────────────────────── */
function clearSections() {
  ["sizes-fresas","grid-especiales","grid-frappes","grid-waffles","grid-snacks","grid-bebidas",
   "chips-toppings","chips-bases","chips-choco-fijo","chips-choco-var"]
    .forEach(id=>{ const e=$(`#${id}`); if(e) e.innerHTML=""; });
}

function renderAll() {
  clearSections();
  const q   = S.q.trim().toLowerCase();
  const cat = S.cat;
  let count = 0;

  for (const it of S.items) {
    if (S.avail && !bool(it.Disponible, true)) continue;
    if (cat && it.Categoria !== cat) continue;
    if (q) {
      const hay = [it.Nombre, it.Variante, it.Descripcion, it.Categoria, it.Badges, it.Notas]
        .map(x => String(x || "").toLowerCase()).join(" ");
      if (!hay.includes(q)) continue;
    }
    const sec = getSec(it.Categoria);
    const avail = bool(it.Disponible, true);
    if (sec === "fresas") renderSizeCard(it, avail);
    else if (sec)         renderProdCard(it, avail, sec);
    count++;
  }

  renderExtras();

  [
    { id:"sec-fresas",     grid:"#sizes-fresas" },
    { id:"sec-especiales", grid:"#grid-especiales" },
    { id:"sec-frappes",    grid:"#grid-frappes" },
    { id:"sec-waffles",    grid:"#grid-waffles" },
    { id:"sec-snacks",     grid:"#grid-snacks" },
    { id:"sec-bebidas",    grid:"#grid-bebidas" },
  ].forEach(({ id, grid }) => {
    const secEl = document.querySelector(`#${id}`);
    const gEl   = document.querySelector(grid);
    if (secEl) secEl.style.display = (gEl && gEl.children.length > 0) ? "" : "none";
  });

  document.querySelector("#emptyState")?.classList.toggle("hidden", count > 0);
  const ic = document.querySelector("#itemsCount");
  if (ic) ic.textContent = `${count} productos`;
}

function renderSizeCard(it, avail) {
  const grid=$("#sizes-fresas"); if(!grid)return;
  const p = num(it.Precio);
  const card=document.createElement("div");
  card.className="sz-card"+(avail?"":" sz-card--na");
  card.innerHTML=`
    ${it.Variante?`<div class="sz-card__tag">${it.Variante}</div>`:""}
    <div class="sz-card__name">${it.Nombre}</div>
    <div class="sz-card__price">${p>0?fmt(p):"—"}</div>
    ${it.Descripcion?`<div class="sz-card__desc">${it.Descripcion}</div>`:""}
    ${!avail?`<div style="margin-top:6px;font-size:11px;font-weight:700;color:#713f12">No disponible</div>`:""}
  `;
  grid.appendChild(card);
}

function renderProdCard(it, avail, sec) {
  const grid=$(`#grid-${sec}`); if(!grid)return;
  const p=num(it.Precio);
  const title=it.Variante
    ? `${it.Nombre}<span class="pcard__variant"> · ${it.Variante}</span>`
    : it.Nombre;
  const card=document.createElement("div");
  card.className="pcard"+(avail?"":" pcard--na");
  card.innerHTML=`
    <div class="pcard__info">
      <div class="pcard__name">${title}</div>
      ${it.Descripcion?`<div class="pcard__desc">${it.Descripcion}</div>`:""}
    </div>
    <div class="pcard__right">
      <div class="pcard__price">${p>0?fmt(p):"—"}</div>
      ${!avail?`<span class="pcard__na-tag">No disponible</span>`:""}
    </div>
  `;
  grid.appendChild(card);
}

function renderExtras() {
  const ids={toppings:"chips-toppings",bases:"chips-bases",fijo:"chips-choco-fijo",var:"chips-choco-var"};
  Object.values(ids).forEach(id=>{ const e=$(`#${id}`);if(e)e.innerHTML=""; });

  for (const ex of S.extras) {
    if (!bool(ex.Activo, true)) continue;
    const tipo  = strip(ex.Tipo);
    const name  = ex.Nombre.trim();
    if (!name) continue;
    const precio= num(ex.Precio);
    const tp    = strip(ex.TipoPrecio);

    const chip=document.createElement("span");
    chip.className="chip";
    chip.textContent=name;
    if(precio>0){
      chip.classList.add("chip--priced");
      chip.setAttribute("data-price", fmt(precio));
      chip.textContent=`${name} +${fmt(precio)}`;
    }

    if (tipo==="topping") {
      $(`#${ids.toppings}`)?.appendChild(chip);
    } else if (tipo==="base extra"||tipo==="base"||tipo==="jarabe") {
      $(`#${ids.bases}`)?.appendChild(chip);
    } else if (tipo==="chocolate extra"||tipo==="chocolate") {
      const target = (tp.includes("fijo")||tp.includes("costo extra")) ? ids.fijo : ids.var;
      $(`#${target}`)?.appendChild(chip);
    }
  }
}

function buildCatSelect() {
  const sel=$("#categorySelect"); if(!sel)return;
  const cats=[...new Set(S.items.map(it=>(it.Categoria||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  sel.innerHTML=`<option value="">Todas las categorías</option>`;
  cats.forEach(c=>{
    const o=document.createElement("option");
    o.value=c; o.textContent=c; sel.appendChild(o);
  });
}

function setMeta(msg = null) {
  const lu=$("#lastUpdated");
  if(lu) lu.textContent = msg || `${new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})} · actualizado`;
  const ic=$("#itemsCount");
  if(ic) ic.textContent=`${S.items.length} productos`;
}

/* ── Auto reload ────────────────────────── */
async function reloadMenuIfChanged() {
  const { itemsCsvUrl, extrasCsvUrl } = CFG.sheets || {};
  if (!itemsCsvUrl || !extrasCsvUrl) return;
  try {
    const [rawItems, rawExtras] = await Promise.all([csv(itemsCsvUrl), csv(extrasCsvUrl)]);
    const nextSnapshot = JSON.stringify({ items: rawItems, extras: rawExtras });
    if (nextSnapshot === MENU_SNAPSHOT) return;
    MENU_SNAPSHOT = nextSnapshot;
    S.items  = rawItems.map(normalizeItem);
    S.extras = rawExtras.map(normalizeExtra);
    buildCatSelect();
    renderExtras();
    setMeta(`${new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})} · actualizado`);
    renderAll();
    // Actualizar datos en caja.js
    window._cajaItems  = S.items;
    window._cajaExtras = S.extras;
    if (window._setCajaData) window._setCajaData(S.items, S.extras);
    console.log("🔄 Menú actualizado automáticamente");
  } catch (err) {
    console.error("Error al auto-actualizar:", err);
  }
}

/* ── Tab switch ─────────────────────────── */
function goTab(t) {
  $$(".ntab").forEach(b=>b.classList.toggle("ntab--active", b.dataset.tab===t));
  $$(".tview").forEach(v=>v.classList.toggle("tview--active", v.id===`tab${t[0].toUpperCase()+t.slice(1)}`));
  // La caja la maneja caja.js — no necesita lógica aquí
}

/* ── Setup UI ───────────────────────────── */
function setupUI(){
  const waMsg=encodeURIComponent(`Hola ${CFG.businessName||"Las Cremosas"}! Quiero hacer un pedido 😊🍓`);
  const waLink=`https://wa.me/${CFG.whatsappPhoneE164||""}?text=${waMsg}`;
  ["#btnWhats","#ctaWhats","#heroWhats"].forEach(id=>{const e=$(id);if(e)e.href=waLink;});

  const yn=$("#yearNow"); if(yn)yn.textContent=new Date().getFullYear();

  $$(".ntab").forEach(t=>t.addEventListener("click",()=>goTab(t.dataset.tab)));

  $("#searchInput")?.addEventListener("input",e=>{S.q=e.target.value;renderAll();});
  $("#categorySelect")?.addEventListener("change",e=>{S.cat=e.target.value;renderAll();});
  $("#toggleAvailable")?.addEventListener("change",e=>{S.avail=e.target.checked;renderAll();});

  $("#btnShare")?.addEventListener("click",async()=>{
    try{
      if(navigator.share) await navigator.share({title:"Las Cremosas 🍓",text:"Mira el menú",url:location.href});
      else { await navigator.clipboard.writeText(location.href); alert("¡Link copiado! ✅"); }
    }catch{}
  });

  const dlg=$("#howDialog");
  $("#openHow")?.addEventListener("click",e=>{e.preventDefault();dlg?.showModal();});
  $("#closeHow")?.addEventListener("click",()=>dlg?.close());
  dlg?.addEventListener("click",e=>{if(e.target===dlg)dlg.close();});
}

/* ── MAIN ───────────────────────────────── */
async function main(){
  setupUI();
  const {itemsCsvUrl,extrasCsvUrl}=CFG.sheets||{};

  if(!itemsCsvUrl||!extrasCsvUrl){
    const lu=$("#lastUpdated");
    if(lu)lu.textContent="⚠ Configura los CSV en config.js";
    return;
  }

  const lu=$("#lastUpdated");
  if(lu)lu.textContent="Cargando menú…";

  try{
    const [rawItems,rawExtras]=await Promise.all([csv(itemsCsvUrl),csv(extrasCsvUrl)]);

    MENU_SNAPSHOT = JSON.stringify({ items: rawItems, extras: rawExtras });

    console.log(`✅ Items: ${rawItems.length}, Extras: ${rawExtras.length}`);
    if(rawItems.length>0){
      console.log("🔑 Columnas:", Object.keys(rawItems[0]));
      console.log("📄 Primer row:", rawItems[0]);
    }

    S.items  = rawItems.map(normalizeItem);
    S.extras = rawExtras.map(normalizeExtra);

    const cats=[...new Set(S.items.map(i=>i.Categoria).filter(Boolean))];
    console.log("📂 Categorías:", cats);
    console.log("📦 Mapeo:", cats.map(c=>c+" → "+(getSec(c)||"❌ SIN SECCIÓN")));

    buildCatSelect();
    renderExtras();
    setMeta();
    renderAll();

    // ── Compartir datos con caja.js ──────────
    window._cajaItems  = S.items;
    window._cajaExtras = S.extras;
    if (window._setCajaData) window._setCajaData(S.items, S.extras);

    if (MENU_RELOAD_TIMER) clearInterval(MENU_RELOAD_TIMER);
    MENU_RELOAD_TIMER = setInterval(reloadMenuIfChanged, MENU_REFRESH_MS);

  }catch(err){
    console.error("❌ Error:", err);
    const lu=$("#lastUpdated"); if(lu)lu.textContent="⚠ Error al cargar datos";
    const page=document.querySelector(".page-wrap");
    if(page){
      const box=document.createElement("div");
      box.style.cssText="margin:40px auto;max-width:600px;background:#fef2f2;border:2px solid #fca5a5;border-radius:16px;padding:28px;font-family:sans-serif;";
      box.innerHTML=`<h3 style="color:#dc2626;margin:0 0 12px">⚠ No se pudo cargar el menú</h3>
        <p style="color:#7f1d1d;font-size:14px;line-height:1.6">${err.message.replace(/\n/g,"<br>")}</p>
        <p style="color:#991b1b;font-size:13px;font-weight:600;margin-top:12px">
          Solución: Abre tu Google Sheet → Archivo → Compartir → Publicar en la web → selecciona DATA_ITEMS → CSV → Publicar. Repite para DATA_EXTRAS.
        </p>`;
      page.prepend(box);
    }
  }
}

document.addEventListener("DOMContentLoaded", main);
