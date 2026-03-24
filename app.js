/* ══════════════════════════════════════════
   Las Cremosas — app.js v4
   Menú por secciones + Caja con PIN
   ══════════════════════════════════════════ */
"use strict";

const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const CFG = window.MENU_CONFIG || {};

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
  const c = String(v).replace(/[$€£¥\s,]/g,"").replace(/[a-zA-Z]/g,"").replace(/[^0-9.-]/g,"");
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

/* ── CSV ───────────────────────────────── */
function parseCSV(text) {
  const rows=[]; let cur="",inQ=false,row=[];
  for (let i=0;i<text.length;i++) {
    const c=text[i],n=text[i+1];
    if (c==='"') { if(inQ&&n==='"'){cur+='"';i++;}else inQ=!inQ; }
    else if (c===','&&!inQ) { row.push(cur);cur=""; }
    else if ((c==='\n'||c==='\r')&&!inQ) {
      if(c==='\r'&&n==='\n')i++;
      row.push(cur);rows.push(row);row=[];cur="";
    } else cur+=c;
  }
  if(cur.length||row.length){row.push(cur);rows.push(row);}
  if(!rows.length)return[];
  const hdr=rows[0].map(h=>h.trim());
  const data=[];
  for(let r=1;r<rows.length;r++){
    const cols=rows[r];
    if(!cols.some(c=>String(c||"").trim()))continue;
    const o={};
    hdr.forEach((h,i)=>{ o[h]=(cols[i]??"").trim(); });
    data.push(o);
  }
  return data;
}

async function csv(url) {
  const r = await fetch(url, {cache:"no-store"});
  if (!r.ok) throw new Error(`CSV ${r.status}`);
  return parseCSV(await r.text());
}

/* ── State ─────────────────────────────── */
const S = { items:[], extras:[], sales:[], expenses:[], q:"", cat:"", avail:true };

/* 
  Normalización de items desde el sheet real.
  Columnas reales en DATA_ITEMS:
    ID, Categoria, Producto, Variante/Tamaño, Descripción, Precio, Moneda, Activo, Orden
*/
function normalizeItem(r) {
  return {
    id:        r.ID        || "",
    Categoria: r.Categoria || r.Category || "",
    Nombre:    r.Producto  || r.Nombre   || r.Item || "",
    Variante:  r["Variante/Tamaño"] || r.Variante || r["Variante"] || "",
    Descripcion: r["Descripción"] || r.Descripcion || r.Descripcion || "",
    Precio:    r.Precio    || r.PrecioMXN || r.Price || "",
    Disponible: r.Activo   || r.Disponible || "Sí",
    Badges:    r.Badges    || r.Etiquetas || "",
    Notas:     r.Notas     || "",
  };
}

/*
  Normalización de extras desde el sheet real.
  Columnas reales en DATA_EXTRAS:
    ID, Tipo, Nombre, Precio, Moneda, Tipo de precio, Notas, Activo, Orden
*/
function normalizeExtra(r) {
  return {
    Tipo:       r.Tipo    || r.Categoria || "",
    Nombre:     r.Nombre  || r.Item      || "",
    Precio:     r.Precio  || "",
    Activo:     r.Activo  || r.Disponible || "Sí",
    TipoPrecio: r["Tipo de precio"] || r.TipoPrecio || "",
    Notas:      r.Notas   || "",
  };
}

/* ── Category → section map ────────────── */
// Mapeo flexible: el strip() quita tildes y mayúsculas
function getSec(cat) {
  const s = strip(cat);
  if (s.includes("fresas con crema") || s === "fresas") return "fresas";
  if (s.includes("fresas especiales") || s.includes("golosa") || s.includes("chocolate")) return "especiales";
  if (s.includes("frappe") || s.includes("frappes")) return "frappes";
  if (s.includes("waffle") || s.includes("waffles")) return "waffles";
  if (s.includes("snack")) return "snacks";
  if (s.includes("bebida")) return "bebidas";
  return null; // categoría no mapeada → ocultar de secciones fijas
}

/* ── Render helpers ─────────────────────── */
function priceFmt(p) {
  const n = num(p);
  return n > 0 ? fmt(n) : "—";
}

/* ── RENDER SECTIONS ────────────────────── */
function clearSections() {
  [
    "sizes-fresas","grid-especiales","grid-frappes",
    "grid-waffles","grid-snacks","grid-bebidas",
    "chips-toppings","chips-bases","chips-choco-fijo","chips-choco-var",
  ].forEach(id=>{ const e=$(`#${id}`); if(e) e.innerHTML=""; });
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
      const hay = [it.Nombre,it.Variante,it.Descripcion,it.Categoria,it.Badges,it.Notas]
        .map(x=>String(x||"").toLowerCase()).join(" ");
      if (!hay.includes(q)) continue;
    }

    const sec = getSec(it.Categoria);
    const avail = bool(it.Disponible, true);

    if (sec === "fresas") {
      renderSizeCard(it, avail);
    } else if (sec) {
      renderProdCard(it, avail, sec);
    }
    count++;
  }

  // Ocultar/mostrar secciones vacías
  [
    {sec:"sec-fresas",    check:".sizes-row"},
    {sec:"sec-especiales",check:"#grid-especiales"},
    {sec:"sec-frappes",   check:"#grid-frappes"},
    {sec:"sec-waffles",   check:"#grid-waffles"},
    {sec:"sec-snacks",    check:"#grid-snacks"},
    {sec:"sec-bebidas",   check:"#grid-bebidas"},
  ].forEach(({sec,check})=>{
    const el = $(check);
    const secEl = $(`#${sec}`);
    if (!secEl) return;
    secEl.style.display = (el && el.children.length > 0) ? "" : "none";
  });

  const empty = $("#emptyState");
  if (empty) empty.classList.toggle("hidden", count > 0);
  const cnt = $("#itemsCount");
  if (cnt) cnt.textContent = `${count} productos`;
}

function renderSizeCard(it, avail) {
  const grid = $("#sizes-fresas");
  if (!grid) return;
  const p = num(it.Precio);
  const card = document.createElement("div");
  card.className = "sz-card" + (avail ? "" : " sz-card--na");
  card.innerHTML = `
    ${it.Variante ? `<div class="sz-card__tag">${it.Variante}</div>` : ""}
    <div class="sz-card__name">${it.Nombre}</div>
    <div class="sz-card__price">${p ? fmt(p) : "—"}</div>
    ${it.Descripcion ? `<div class="sz-card__desc">${it.Descripcion}</div>` : ""}
    ${!avail ? `<div style="margin-top:6px;font-size:11px;font-weight:700;color:#713f12">No disponible</div>` : ""}
  `;
  grid.appendChild(card);
}

function renderProdCard(it, avail, sec) {
  const grid = $(`#grid-${sec}`);
  if (!grid) return;
  const p = num(it.Precio);
  const nameDisplay = it.Variante
    ? `${it.Nombre} <span class="pcard__variant">${it.Variante}</span>`
    : it.Nombre;

  const card = document.createElement("div");
  card.className = "pcard" + (avail ? "" : " pcard--na");
  card.innerHTML = `
    <div class="pcard__info">
      <div class="pcard__name">${nameDisplay}</div>
      ${it.Descripcion ? `<div class="pcard__desc">${it.Descripcion}</div>` : ""}
    </div>
    <div class="pcard__right">
      <div class="pcard__price">${priceFmt(it.Precio)}</div>
      ${!avail ? `<span class="pcard__na-tag">No disponible</span>` : ""}
    </div>
  `;
  grid.appendChild(card);
}

/* ── RENDER EXTRAS ──────────────────────── */
function renderExtras() {
  const toppings = $("#chips-toppings");
  const bases    = $("#chips-bases");
  const cFijo    = $("#chips-choco-fijo");
  const cVar     = $("#chips-choco-var");
  if (toppings) toppings.innerHTML="";
  if (bases)    bases.innerHTML="";
  if (cFijo)    cFijo.innerHTML="";
  if (cVar)     cVar.innerHTML="";

  for (const ex of S.extras) {
    if (!bool(ex.Activo, true)) continue;
    const tipo = strip(ex.Tipo);
    const name = ex.Nombre.trim();
    if (!name) continue;
    const precio = num(ex.Precio);
    const tp     = strip(ex.TipoPrecio);

    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = name;

    if (precio > 0) {
      chip.classList.add("chip--priced");
      chip.setAttribute("data-price", fmt(precio));
    }

    if (tipo === "topping" && toppings) {
      toppings.appendChild(chip);
    } else if ((tipo === "base extra" || tipo === "jarabe" || tipo === "base") && bases) {
      bases.appendChild(chip);
    } else if (tipo === "chocolate extra" || tipo === "chocolate") {
      chip.classList.add(/* dark bg */ "");
      if (tp.includes("fijo") || tp.includes("costo extra")) {
        if (cFijo) cFijo.appendChild(chip);
      } else {
        if (cVar) cVar.appendChild(chip);
      }
    }
  }
}

/* ── CATEGORY SELECT ────────────────────── */
function buildCatSelect() {
  const sel = $("#categorySelect");
  if (!sel) return;
  const cats = [...new Set(S.items.map(it=>(it.Categoria||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  sel.innerHTML = `<option value="">Todas las categorías</option>`;
  cats.forEach(c=>{
    const o=document.createElement("option");
    o.value=c; o.textContent=c; sel.appendChild(o);
  });
}

/* ── SALE PRODUCT SELECT ────────────────── */
function buildSaleSelect() {
  const sel = $("#saleProduct");
  if (!sel) return;
  sel.innerHTML = `<option value="">Selecciona producto…</option>`;
  S.items
    .filter(it=>bool(it.Disponible,true))
    .sort((a,b)=>{
      const na = [a.Nombre,a.Variante].filter(Boolean).join(" ");
      const nb = [b.Nombre,b.Variante].filter(Boolean).join(" ");
      return na.localeCompare(nb,"es");
    })
    .forEach(it=>{
      const label = [it.Nombre,it.Variante].filter(Boolean).join(" — ");
      const p = num(it.Precio);
      const o = document.createElement("option");
      o.value = label;
      o.textContent = `${label}  ·  ${fmt(p)}`;
      o.dataset.price = p;
      sel.appendChild(o);
    });
}

/* ── META ───────────────────────────────── */
function setMeta() {
  const lu = $("#lastUpdated");
  if (lu) lu.textContent = new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}) + " · actualizado";
  const ic = $("#itemsCount");
  if (ic) ic.textContent = `${S.items.length} productos`;
}

/* ── PIN ────────────────────────────────── */
const PIN     = String(CFG.cajaPin || "1234");
const SESS    = "cremosas_ok";
let   pinBuf  = "";

const cajaOk    = () => sessionStorage.getItem(SESS) === "ok";
const showPin   = () => { pinBuf=""; updPin(); $("#pinError")?.classList.add("hidden"); $("#cajaLocked")?.classList.remove("hidden"); $("#cajaContent")?.classList.add("hidden"); };
const showCaja  = () => { $("#cajaLocked")?.classList.add("hidden"); $("#cajaContent")?.classList.remove("hidden"); };
const lockCaja  = () => { sessionStorage.removeItem(SESS); goTab("menu"); };

function pinPress(v) { if(pinBuf.length<8){pinBuf+=v;updPin();} }
function pinDel()    { pinBuf=pinBuf.slice(0,-1);updPin(); }
function updPin()    { const el=$("#pinDisplay"); if(el) el.textContent=pinBuf.length?"●".repeat(pinBuf.length):"· · · ·"; }
function pinOk() {
  if (pinBuf === PIN) {
    sessionStorage.setItem(SESS,"ok");
    showCaja();
    loadFinancials();
    pinBuf="";
  } else {
    pinBuf=""; updPin();
    $("#pinError")?.classList.remove("hidden");
    const d=$("#pinDisplay");
    d?.classList.add("shake");
    setTimeout(()=>d?.classList.remove("shake"),500);
  }
}

/* ── TAB SWITCH ─────────────────────────── */
function goTab(t) {
  $$(".ntab").forEach(b=>b.classList.toggle("ntab--active", b.dataset.tab===t));
  $$(".tview").forEach(v=>v.classList.toggle("tview--active", v.id===`tab${t[0].toUpperCase()+t.slice(1)}`));
  if (t==="caja") cajaOk() ? (showCaja(),loadFinancials()) : showPin();
}

/* ── FINANCIALS ─────────────────────────── */
function buildSummary() {
  const td = today();
  const ts = S.sales.filter(s=>normDate(s.fecha)===td);
  const te = S.expenses.filter(e=>normDate(e.fecha)===td);
  const totalS = ts.reduce((a,s)=>a+num(s.total),0);
  const totalE = te.reduce((a,e)=>a+num(e.monto),0);
  const profit = totalS - totalE;

  const set = (id,v) => { const e=$(id); if(e)e.textContent=v; };
  set("#salesTodayTotal",    fmt(totalS));
  set("#expensesTodayTotal", fmt(totalE));
  set("#profitTodayTotal",   fmt(profit));
  set("#salesCountToday",    `${ts.length} venta${ts.length!==1?"s":""}`);

  const pEl=$("#profitTodayTotal");
  if(pEl) pEl.style.color = profit>=0?"#16a34a":"var(--rose)";

  // Products today
  const grouped={};
  ts.forEach(s=>{ const n=s.producto||"?"; grouped[n]=(grouped[n]||0)+num(s.cantidad); });
  const container=$("#topProductsToday");
  if(!container) return;
  container.innerHTML="";
  const sorted=Object.entries(grouped).sort((a,b)=>b[1]-a[1]);
  if(!sorted.length){ container.innerHTML=`<p class="prod-list__empty">Sin ventas registradas hoy.</p>`; return; }
  sorted.forEach(([name,qty],i)=>{
    const row=document.createElement("div");
    row.className="prod-row";
    const medal=["🥇","🥈","🥉"][i]||`${i+1}.`;
    row.innerHTML=`<span>${medal} ${name}</span><strong>${qty}</strong>`;
    container.appendChild(row);
  });
}

async function loadFinancials() {
  const {ventasCsvUrl,gastosCsvUrl}=CFG.sheets||{};
  if(!ventasCsvUrl||!gastosCsvUrl){buildSummary();return;}
  try {
    const [s,e]=await Promise.all([csv(ventasCsvUrl),csv(gastosCsvUrl)]);
    S.sales=s.map(r=>({ fecha:r.fecha||r.Fecha||"",hora:r.hora||r.Hora||"",
      producto:r.producto||r.Producto||"",cantidad:r.cantidad||r.Cantidad||"0",
      precio_unitario:r.precio_unitario||"0",total:r.total||r.Total||"0",
      encargado:r.encargado||r.Encargado||"",notas:r.notas||r.Notas||"" }));
    S.expenses=e.map(r=>({ fecha:r.fecha||r.Fecha||"",hora:r.hora||r.Hora||"",
      concepto:r.concepto||r.Concepto||"",categoria:r.categoria||r.Categoria||"",
      monto:r.monto||r.Monto||"0",encargado:r.encargado||r.Encargado||"",notas:r.notas||r.Notas||"" }));
    buildSummary();
  } catch(err){ console.error(err); showMsg("No pude cargar ventas/gastos.","error"); }
}

/* ── API ────────────────────────────────── */
async function apiPost(payload) {
  const url=CFG.api?.saveUrl||"";
  if(!url||url.includes("PEGA"))throw new Error("Configura la URL del Apps Script en config.js");
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
  let d={};
  try{d=await r.json();}catch{d={ok:false,message:"Error de red"};}
  if(!r.ok||!d.ok)throw new Error(d.message||"Error al guardar");
  return d;
}

function showMsg(txt,type="success") {
  const el=$("#adminMessage"); if(!el)return;
  el.textContent=txt; el.className=`status-msg status-msg--${type}`;
  el.classList.remove("hidden");
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.add("hidden"),4500);
}

function previewTotal() {
  const q=num($("#saleQty")?.value), p=num($("#salePrice")?.value);
  const el=$("#saleTotalPreview"); if(!el)return;
  el.textContent=(q>0&&p>=0)?fmt(q*p):"—";
}

const ICON_SAVE=`<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;

async function saveSale() {
  const producto  = $("#saleProduct")?.value.trim();
  const cantidad  = num($("#saleQty")?.value);
  const precio    = num($("#salePrice")?.value);
  const encargado = $("#saleManager")?.value.trim();
  const notas     = $("#saleNotes")?.value.trim();
  if(!producto||cantidad<=0||precio<0){showMsg("Completa los datos.","error");return;}
  const btn=$("#btnSaveSale"); if(!btn)return;
  btn.disabled=true; btn.innerHTML=`<span class="spinner"></span> Guardando…`;
  try {
    await apiPost({action:"saveSale",data:{producto,cantidad,precio_unitario:precio,total:cantidad*precio,encargado,notas}});
    showMsg("✅ Venta guardada correctamente.");
    ["saleProduct","saleManager","saleNotes","salePrice"].forEach(id=>{
      const el=$(`#${id}`); if(!el)return;
      el.tagName==="SELECT"?el.selectedIndex=0:el.value="";
    });
    if($("#saleQty"))$("#saleQty").value="1";
    if($("#saleTotalPreview"))$("#saleTotalPreview").textContent="—";
    await loadFinancials();
  } catch(err){showMsg(err.message||"Error.","error");}
  finally{btn.disabled=false;btn.innerHTML=ICON_SAVE+" Guardar venta";}
}

async function saveExpense() {
  const concepto  = $("#expenseConcept")?.value.trim();
  const catRaw    = $("#expenseCategory")?.value.trim();
  const categoria = catRaw.replace(/^[^\s]+\s/,""); // strip emoji
  const monto     = num($("#expenseAmount")?.value);
  const encargado = $("#expenseManager")?.value.trim();
  const notas     = $("#expenseNotes")?.value.trim();
  if(!concepto||!catRaw||monto<=0){showMsg("Completa los datos.","error");return;}
  const btn=$("#btnSaveExpense"); if(!btn)return;
  btn.disabled=true; btn.innerHTML=`<span class="spinner"></span> Guardando…`;
  try {
    await apiPost({action:"saveExpense",data:{concepto,categoria,monto,encargado,notas}});
    showMsg("✅ Gasto guardado correctamente.");
    ["expenseConcept","expenseAmount","expenseManager","expenseNotes"].forEach(id=>{
      const el=$(`#${id}`); if(el)el.value="";
    });
    if($("#expenseCategory"))$("#expenseCategory").selectedIndex=0;
    await loadFinancials();
  } catch(err){showMsg(err.message||"Error.","error");}
  finally{btn.disabled=false;btn.innerHTML=ICON_SAVE+" Guardar gasto";}
}

/* ── SETUP UI ───────────────────────────── */
function setupUI() {
  // WhatsApp links
  const waMsg  = encodeURIComponent(`Hola ${CFG.businessName||"Las Cremosas"}! Quiero hacer un pedido 😊🍓`);
  const waLink = `https://wa.me/${CFG.whatsappPhoneE164||""}?text=${waMsg}`;
  ["#btnWhats","#ctaWhats","#heroWhats"].forEach(id=>{
    const el=$(id); if(el){ el.href=waLink; }
  });
  const yn=$("#yearNow"); if(yn)yn.textContent=new Date().getFullYear();
  const cd=$("#cajaDate");
  if(cd) cd.textContent=new Date().toLocaleDateString("es-MX",{weekday:"long",year:"numeric",month:"long",day:"numeric"});

  // Nav tabs
  $$(".ntab").forEach(t=>t.addEventListener("click",()=>goTab(t.dataset.tab)));

  // PIN
  $$(".pkey").forEach(k=>k.addEventListener("click",()=>{
    const v=k.dataset.val;
    if(v==="del") pinDel();
    else if(v==="ok") pinOk();
    else pinPress(v);
  }));
  document.addEventListener("keydown",e=>{
    if($("#cajaLocked")?.classList.contains("hidden"))return;
    if(e.key>="0"&&e.key<="9") pinPress(e.key);
    else if(e.key==="Backspace") pinDel();
    else if(e.key==="Enter") pinOk();
  });
  $("#btnLockCaja")?.addEventListener("click", lockCaja);

  // Caja sub-tabs
  $$(".ctab").forEach(t=>t.addEventListener("click",()=>{
    $$(".ctab").forEach(x=>x.classList.remove("ctab--active"));
    t.classList.add("ctab--active");
    const f=t.dataset.form;
    $$(".cform").forEach(x=>x.classList.remove("cform--active"));
    $(`#form${f[0].toUpperCase()+f.slice(1)}`)?.classList.add("cform--active");
  }));

  // Search/filter
  $("#searchInput")?.addEventListener("input",e=>{S.q=e.target.value;renderAll();});
  $("#categorySelect")?.addEventListener("change",e=>{S.cat=e.target.value;renderAll();});
  $("#toggleAvailable")?.addEventListener("change",e=>{S.avail=e.target.checked;renderAll();});

  // Share
  $("#btnShare")?.addEventListener("click",async()=>{
    try{
      if(navigator.share) await navigator.share({title:"Las Cremosas 🍓",text:"Mira el menú",url:location.href});
      else{await navigator.clipboard.writeText(location.href);alert("¡Link copiado! ✅");}
    }catch{}
  });

  // Dialog
  const dlg=$("#howDialog");
  $("#openHow")?.addEventListener("click",e=>{e.preventDefault();dlg?.showModal();});
  $("#closeHow")?.addEventListener("click",()=>dlg?.close());
  dlg?.addEventListener("click",e=>{if(e.target===dlg)dlg.close();});

  // Venta form
  $("#saleProduct")?.addEventListener("change",e=>{
    const o=e.target.selectedOptions[0];
    const p=o?.dataset?.price??"";
    const sp=$("#salePrice"); if(sp)sp.value=p;
    previewTotal();
  });
  ["saleQty","salePrice"].forEach(id=>$(`#${id}`)?.addEventListener("input",previewTotal));
  $("#btnSaveSale")?.addEventListener("click",saveSale);
  $("#btnSaveExpense")?.addEventListener("click",saveExpense);
  $("#refreshSummary")?.addEventListener("click",async()=>{await loadFinancials();showMsg("Corte actualizado.");});
}

/* ── MAIN ───────────────────────────────── */
async function main() {
  setupUI();
  const {itemsCsvUrl,extrasCsvUrl}=CFG.sheets||{};
  if(!itemsCsvUrl||!extrasCsvUrl){
    const lu=$("#lastUpdated");
    if(lu)lu.textContent="⚠ Configura los CSV en config.js";
    return;
  }
  try {
    const [rawItems,rawExtras]=await Promise.all([csv(itemsCsvUrl),csv(extrasCsvUrl)]);
    S.items   = rawItems.map(normalizeItem);
    S.extras  = rawExtras.map(normalizeExtra);
    buildCatSelect();
    renderExtras();
    buildSaleSelect();
    setMeta();
    renderAll();
  } catch(err){
    console.error(err);
    const lu=$("#lastUpdated");
    if(lu)lu.textContent="⚠ Error al cargar datos";
  }
}

document.addEventListener("DOMContentLoaded",main);
