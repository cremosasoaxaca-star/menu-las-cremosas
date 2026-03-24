/* ══════════════════════════════════════════
   Las Cremosas — app.js v4.1
   Fix: CORS-safe fetch + error diagnosis
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

/* ── CSV FETCH (CORS-safe) ──────────────────
   Google Sheets public CSV puede fallar con CORS
   en algunos entornos. Usamos dos estrategias:
   1. fetch directo (funciona en GitHub Pages / hosting normal)
   2. Si falla, intenta via allorigins.win proxy
─────────────────────────────────────────── */
async function fetchText(url) {
  // Intento 1: directo
  try {
    const r = await fetch(url, { cache: "no-store", mode: "cors" });
    if (r.ok) return await r.text();
    throw new Error(`HTTP ${r.status}`);
  } catch(e1) {
    console.warn("Fetch directo falló:", e1.message, "— intentando proxy…");
  }

  // Intento 2: proxy público (solo si el directo falla)
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxyUrl, { cache: "no-store" });
    if (!r.ok) throw new Error(`Proxy HTTP ${r.status}`);
    const json = await r.json();
    if (!json.contents) throw new Error("Proxy sin contenido");
    return json.contents;
  } catch(e2) {
    throw new Error(`No se pudo cargar el CSV.\n\nDirecto: intento 1 falló.\nProxy: ${e2.message}\n\nVerifica que la hoja esté publicada como CSV en Google Sheets.`);
  }
}

function parseCSV(text) {
  // Detecta si recibimos HTML en vez de CSV (hoja no publicada)
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error("La hoja de Google Sheets NO está publicada como CSV. Ve a Archivo → Compartir → Publicar en la web → elige la hoja → CSV.");
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
  console.log("📋 Columnas CSV:", hdr); // Debug: muestra las columnas en consola

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

/* ── Normalizar items
   Acepta cualquier combinación de nombres de columna
   que pueda venir del sheet
─────────────────────────────────────────── */
function normalizeItem(r) {
  // Buscar la key de categoría de forma flexible (cualquier columna que empiece con "Cat")
  const catKey = Object.keys(r).find(k => /^cat/i.test(k.trim())) || "Categoria";
  const cat = r[catKey] || r.Categoria || r.Category || r.categoria || "";

  // Buscar variante de forma flexible
  const varKey = Object.keys(r).find(k => /variante|tama/i.test(k)) || "";
  const variante = (varKey ? r[varKey] : "") || r["Variante/Tamaño"] || r.Variante || r.Tamaño || "";

  // Buscar descripción flexible
  const descKey = Object.keys(r).find(k => /descrip/i.test(k)) || "";
  const desc = (descKey ? r[descKey] : "") || r.Descripcion || r.Description || "";

  return {
    Categoria:   cat,
    Nombre:      r.Producto    || r.Nombre       || r.Item   || "",
    Variante:    variante,
    Descripcion: desc,
    Precio:      r.Precio      || r.PrecioMXN    || r.Price  || "",
    Disponible:  r.Activo      || r.Disponible   || "Sí",
    Badges:      r.Badges      || r.Etiquetas    || "",
    Notas:       r.Notas       || "",
  };
}

function normalizeExtra(r) {
  return {
    Tipo:       r.Tipo       || r.Categoria || "",
    Nombre:     r.Nombre     || r.Item      || "",
    Precio:     r.Precio     || "",
    Activo:     r.Activo     || r.Disponible || "Sí",
    TipoPrecio: r["Tipo de precio"] || r.TipoPrecio || "",
    Notas:      r.Notas      || "",
  };
}

/* ── Category → section ID ─────────────── */
// Ultra-robusto: limpia espacios, tildes, mayúsculas y compara
function getSec(cat) {
  // Limpia completamente: sin tildes, sin espacios dobles, lowercase, trim
  const s = String(cat||"")
    .toLowerCase()
    .replace(/[áàâä]/g,"a").replace(/[éèêë]/g,"e")
    .replace(/[íìîï]/g,"i").replace(/[óòôö]/g,"o")
    .replace(/[úùûü]/g,"u").replace(/ñ/g,"n")
    .replace(/\s+/g," ").trim();

  // Fresas con crema — muchas variaciones posibles
  if (s === "fresas con crema" || s === "fresa con crema" ||
      s.startsWith("fresas con") || s.includes("con crema")) return "fresas";

  // Fresas especiales / golosas
  if (s === "fresas especiales" || s === "fresa especial" ||
      s.includes("especial") || s.includes("golosa") ||
      s.includes("chocolate")) return "especiales";

  // Frappes
  if (s === "frappes" || s === "frappe" || s.includes("frappe")) return "frappes";

  // Waffles
  if (s === "waffles" || s === "waffle" || s.includes("waffle")) return "waffles";

  // Snacks
  if (s === "snacks" || s === "snack" || s.includes("snack")) return "snacks";

  // Bebidas
  if (s === "bebidas" || s === "bebida" || s.includes("bebida")) return "bebidas";

  console.warn("⚠ Categoria sin sección (valor exacto):", JSON.stringify(cat), "→ normalizado:", JSON.stringify(s));
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
      const hay = [it.Nombre,it.Variante,it.Descripcion,it.Categoria,it.Badges,it.Notas]
        .map(x=>String(x||"").toLowerCase()).join(" ");
      if (!hay.includes(q)) continue;
    }
    const sec   = getSec(it.Categoria);
    const avail = bool(it.Disponible, true);
    if (sec === "fresas") renderSizeCard(it, avail);
    else if (sec)         renderProdCard(it, avail, sec);
    count++;
  }

  // Mostrar/ocultar secciones
  [
    {id:"sec-fresas",     grid:"#sizes-fresas"},
    {id:"sec-especiales", grid:"#grid-especiales"},
    {id:"sec-frappes",    grid:"#grid-frappes"},
    {id:"sec-waffles",    grid:"#grid-waffles"},
    {id:"sec-snacks",     grid:"#grid-snacks"},
    {id:"sec-bebidas",    grid:"#grid-bebidas"},
  ].forEach(({id,grid})=>{
    const secEl=$(`#${id}`);
    const gEl=$(grid);
    if(secEl) secEl.style.display = (gEl && gEl.children.length > 0) ? "" : "none";
  });

  $("#emptyState")?.classList.toggle("hidden", count > 0);
  const ic=$("#itemsCount"); if(ic) ic.textContent=`${count} productos`;
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
      const target = (tp.includes("fijo")||tp.includes("costo extra"))
        ? ids.fijo : ids.var;
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
    o.value=c;o.textContent=c;sel.appendChild(o);
  });
}

function buildSaleSelect() {
  const sel=$("#saleProduct"); if(!sel)return;
  sel.innerHTML=`<option value="">Selecciona producto…</option>`;
  S.items
    .filter(it=>bool(it.Disponible,true))
    .sort((a,b)=>{
      const na=[a.Nombre,a.Variante].filter(Boolean).join(" ");
      const nb=[b.Nombre,b.Variante].filter(Boolean).join(" ");
      return na.localeCompare(nb,"es");
    })
    .forEach(it=>{
      const label=[it.Nombre,it.Variante].filter(Boolean).join(" — ");
      const p=num(it.Precio);
      const o=document.createElement("option");
      o.value=label;
      o.textContent=`${label}  ·  ${fmt(p)}`;
      o.dataset.price=p;
      sel.appendChild(o);
    });
}

function setMeta() {
  const lu=$("#lastUpdated");
  if(lu) lu.textContent=`${new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})} · actualizado`;
  const ic=$("#itemsCount");
  if(ic) ic.textContent=`${S.items.length} productos`;
}

/* ── PIN ────────────────────────────────── */
const PIN   = String(CFG.cajaPin || "1234");
const SESS  = "cremosas_ok";
let   pinBuf= "";

const cajaOk   = () => sessionStorage.getItem(SESS)==="ok";
const showPin  = () => {
  pinBuf=""; updPin();
  $("#pinError")?.classList.add("hidden");
  $("#cajaLocked")?.classList.remove("hidden");
  $("#cajaContent")?.classList.add("hidden");
};
const showCaja = () => {
  $("#cajaLocked")?.classList.add("hidden");
  $("#cajaContent")?.classList.remove("hidden");
};
const lockCaja = () => { sessionStorage.removeItem(SESS); goTab("menu"); };

function pinPress(v){ if(pinBuf.length<8){pinBuf+=v;updPin();} }
function pinDel()   { pinBuf=pinBuf.slice(0,-1);updPin(); }
function updPin()   { const el=$("#pinDisplay");if(el)el.textContent=pinBuf.length?"●".repeat(pinBuf.length):"· · · ·"; }
function pinOk() {
  if(pinBuf===PIN){
    sessionStorage.setItem(SESS,"ok");
    showCaja(); loadFinancials(); pinBuf="";
  } else {
    pinBuf=""; updPin();
    $("#pinError")?.classList.remove("hidden");
    const d=$("#pinDisplay");
    d?.classList.add("shake");
    setTimeout(()=>d?.classList.remove("shake"),500);
  }
}

/* ── Tab switch ─────────────────────────── */
function goTab(t) {
  $$(".ntab").forEach(b=>b.classList.toggle("ntab--active",b.dataset.tab===t));
  $$(".tview").forEach(v=>v.classList.toggle("tview--active",v.id===`tab${t[0].toUpperCase()+t.slice(1)}`));
  if(t==="caja") cajaOk()?(showCaja(),loadFinancials()):showPin();
}

/* ── Financials ─────────────────────────── */
function buildSummary() {
  const td=today();
  const ts=S.sales.filter(s=>normDate(s.fecha)===td);
  const te=S.expenses.filter(e=>normDate(e.fecha)===td);
  const totalS=ts.reduce((a,s)=>a+num(s.total),0);
  const totalE=te.reduce((a,e)=>a+num(e.monto),0);
  const profit=totalS-totalE;
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};
  set("#salesTodayTotal",    fmt(totalS));
  set("#expensesTodayTotal", fmt(totalE));
  set("#profitTodayTotal",   fmt(profit));
  set("#salesCountToday",    `${ts.length} venta${ts.length!==1?"s":""}`);
  const pe=$("#profitTodayTotal");
  if(pe)pe.style.color=profit>=0?"#16a34a":"var(--rose)";

  const grouped={};
  ts.forEach(s=>{const n=s.producto||"?";grouped[n]=(grouped[n]||0)+num(s.cantidad);});
  const cont=$("#topProductsToday");if(!cont)return;
  cont.innerHTML="";
  const sorted=Object.entries(grouped).sort((a,b)=>b[1]-a[1]);
  if(!sorted.length){cont.innerHTML=`<p class="prod-list__empty">Sin ventas hoy.</p>`;return;}
  sorted.forEach(([name,qty],i)=>{
    const row=document.createElement("div");
    row.className="prod-row";
    const medal=["🥇","🥈","🥉"][i]||`${i+1}.`;
    row.innerHTML=`<span>${medal} ${name}</span><strong>${qty}</strong>`;
    cont.appendChild(row);
  });
}

async function loadFinancials() {
  const {ventasCsvUrl,gastosCsvUrl}=CFG.sheets||{};
  if(!ventasCsvUrl||!gastosCsvUrl){buildSummary();return;}
  try {
    const [s,e]=await Promise.all([csv(ventasCsvUrl),csv(gastosCsvUrl)]);
    S.sales=s.map(r=>({
      fecha:r.fecha||r.Fecha||"",producto:r.producto||r.Producto||"",
      cantidad:r.cantidad||r.Cantidad||"0",total:r.total||r.Total||"0",
      encargado:r.encargado||r.Encargado||"",notas:r.notas||r.Notas||"",
    }));
    S.expenses=e.map(r=>({
      fecha:r.fecha||r.Fecha||"",concepto:r.concepto||r.Concepto||"",
      categoria:r.categoria||r.Categoria||"",monto:r.monto||r.Monto||"0",
      encargado:r.encargado||r.Encargado||"",notas:r.notas||r.Notas||"",
    }));
    buildSummary();
  } catch(err){
    console.error("Error financials:",err);
    showMsg("No pude cargar ventas/gastos: "+err.message,"error");
  }
}

/* ── API save ───────────────────────────── */
// Google Apps Script desde GitHub Pages necesita no-cors + form data
async function apiPost(payload) {
  const url = CFG.api?.saveUrl || "";
  if (!url || url.includes("PEGA"))
    throw new Error("Configura la URL del Apps Script en config.js");

  // Usamos fetch con mode no-cors (la única forma que funciona cross-origin con Apps Script)
  // No podemos leer la respuesta en no-cors, pero el dato SÍ llega al script
  try {
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    await fetch(url, { method:"POST", body: form, mode:"no-cors" });
    // Con no-cors la respuesta es opaca — asumimos éxito si no lanza error de red
    return { ok: true };
  } catch(err) {
    throw new Error("Error de red al guardar: " + err.message);
  }
}

function showMsg(txt,type="success"){
  const el=$("#adminMessage");if(!el)return;
  el.textContent=txt;el.className=`status-msg status-msg--${type}`;
  el.classList.remove("hidden");
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.add("hidden"),5000);
}

function previewTotal(){
  const q=num($("#saleQty")?.value),p=num($("#salePrice")?.value);
  const el=$("#saleTotalPreview");if(!el)return;
  el.textContent=(q>0&&p>=0)?fmt(q*p):"—";
}

const ICON_SAVE=`<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;

async function saveSale(){
  const producto=$("#saleProduct")?.value.trim();
  const cantidad=num($("#saleQty")?.value);
  const precio=num($("#salePrice")?.value);
  const encargado=$("#saleManager")?.value.trim();
  const notas=$("#saleNotes")?.value.trim();
  if(!producto||cantidad<=0||precio<0){showMsg("Completa todos los datos.","error");return;}
  const btn=$("#btnSaveSale");if(!btn)return;
  btn.disabled=true;btn.innerHTML=`<span class="spinner"></span> Guardando…`;
  try{
    await apiPost({action:"saveSale",data:{producto,cantidad,precio_unitario:precio,total:cantidad*precio,encargado,notas}});
    showMsg("✅ Venta guardada.");
    ["saleManager","saleNotes","salePrice"].forEach(id=>{const e=$(`#${id}`);if(e)e.value="";});
    const sp=$("#saleProduct");if(sp)sp.selectedIndex=0;
    const sq=$("#saleQty");if(sq)sq.value="1";
    const st=$("#saleTotalPreview");if(st)st.textContent="—";
    await loadFinancials();
  }catch(err){showMsg(err.message||"Error.","error");}
  finally{btn.disabled=false;btn.innerHTML=ICON_SAVE+" Guardar venta";}
}

async function saveExpense(){
  const concepto=$("#expenseConcept")?.value.trim();
  const catRaw=$("#expenseCategory")?.value.trim();
  const categoria=catRaw.replace(/^[^\s]+\s/,"");
  const monto=num($("#expenseAmount")?.value);
  const encargado=$("#expenseManager")?.value.trim();
  const notas=$("#expenseNotes")?.value.trim();
  if(!concepto||!catRaw||monto<=0){showMsg("Completa todos los datos.","error");return;}
  const btn=$("#btnSaveExpense");if(!btn)return;
  btn.disabled=true;btn.innerHTML=`<span class="spinner"></span> Guardando…`;
  try{
    await apiPost({action:"saveExpense",data:{concepto,categoria,monto,encargado,notas}});
    showMsg("✅ Gasto guardado.");
    ["expenseConcept","expenseAmount","expenseManager","expenseNotes"].forEach(id=>{const e=$(`#${id}`);if(e)e.value="";});
    const ec=$("#expenseCategory");if(ec)ec.selectedIndex=0;
    await loadFinancials();
  }catch(err){showMsg(err.message||"Error.","error");}
  finally{btn.disabled=false;btn.innerHTML=ICON_SAVE+" Guardar gasto";}
}

/* ── Setup UI ───────────────────────────── */
function setupUI(){
  const waMsg=encodeURIComponent(`Hola ${CFG.businessName||"Las Cremosas"}! Quiero hacer un pedido 😊🍓`);
  const waLink=`https://wa.me/${CFG.whatsappPhoneE164||""}?text=${waMsg}`;
  ["#btnWhats","#ctaWhats","#heroWhats"].forEach(id=>{const e=$(id);if(e)e.href=waLink;});
  const yn=$("#yearNow");if(yn)yn.textContent=new Date().getFullYear();
  const cd=$("#cajaDate");
  if(cd)cd.textContent=new Date().toLocaleDateString("es-MX",{weekday:"long",year:"numeric",month:"long",day:"numeric"});

  $$(".ntab").forEach(t=>t.addEventListener("click",()=>goTab(t.dataset.tab)));

  $$(".pkey").forEach(k=>k.addEventListener("click",()=>{
    const v=k.dataset.val;
    if(v==="del")pinDel();
    else if(v==="ok")pinOk();
    else pinPress(v);
  }));
  document.addEventListener("keydown",e=>{
    if($("#cajaLocked")?.classList.contains("hidden"))return;
    if(e.key>="0"&&e.key<="9")pinPress(e.key);
    else if(e.key==="Backspace")pinDel();
    else if(e.key==="Enter")pinOk();
  });
  $("#btnLockCaja")?.addEventListener("click",lockCaja);

  $$(".ctab").forEach(t=>t.addEventListener("click",()=>{
    $$(".ctab").forEach(x=>x.classList.remove("ctab--active"));
    t.classList.add("ctab--active");
    const f=t.dataset.form;
    $$(".cform").forEach(x=>x.classList.remove("cform--active"));
    $(`#form${f[0].toUpperCase()+f.slice(1)}`)?.classList.add("cform--active");
  }));

  $("#searchInput")?.addEventListener("input",e=>{S.q=e.target.value;renderAll();});
  $("#categorySelect")?.addEventListener("change",e=>{S.cat=e.target.value;renderAll();});
  $("#toggleAvailable")?.addEventListener("change",e=>{S.avail=e.target.checked;renderAll();});

  $("#btnShare")?.addEventListener("click",async()=>{
    try{
      if(navigator.share)await navigator.share({title:"Las Cremosas 🍓",text:"Mira el menú",url:location.href});
      else{await navigator.clipboard.writeText(location.href);alert("¡Link copiado! ✅");}
    }catch{}
  });

  const dlg=$("#howDialog");
  $("#openHow")?.addEventListener("click",e=>{e.preventDefault();dlg?.showModal();});
  $("#closeHow")?.addEventListener("click",()=>dlg?.close());
  dlg?.addEventListener("click",e=>{if(e.target===dlg)dlg.close();});

  $("#saleProduct")?.addEventListener("change",e=>{
    const o=e.target.selectedOptions[0];
    const sp=$("#salePrice");if(sp)sp.value=o?.dataset?.price??"";
    previewTotal();
  });
  ["saleQty","salePrice"].forEach(id=>$(`#${id}`)?.addEventListener("input",previewTotal));
  $("#btnSaveSale")?.addEventListener("click",saveSale);
  $("#btnSaveExpense")?.addEventListener("click",saveExpense);
  $("#refreshSummary")?.addEventListener("click",async()=>{await loadFinancials();showMsg("Corte actualizado.");});
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

  // Mostrar estado de carga
  const lu=$("#lastUpdated");
  if(lu)lu.textContent="Cargando menú…";

  try{
    const [rawItems,rawExtras]=await Promise.all([
      csv(itemsCsvUrl),
      csv(extrasCsvUrl),
    ]);

    console.log(`✅ Items cargados: ${rawItems.length}, Extras: ${rawExtras.length}`);
    if(rawItems.length>0){
      console.log("🔑 Columnas CSV:", Object.keys(rawItems[0]));
      console.log("📄 Primer row:", rawItems[0]);
    }

    S.items  = rawItems.map(normalizeItem);
    S.extras = rawExtras.map(normalizeExtra);

    const cats = [...new Set(S.items.map(i=>i.Categoria).filter(Boolean))];
    console.log("📂 Categorías:", cats);
    console.log("📦 Mapeo:", cats.map(c => c + " → " + (getSec(c)||"❌ SIN SECCIÓN")));

    buildCatSelect();
    renderExtras();
    buildSaleSelect();
    setMeta();
    renderAll();

  }catch(err){
    console.error("❌ Error al cargar menú:", err);
    // Mostrar error claro al usuario
    const lu=$("#lastUpdated");
    if(lu)lu.textContent="⚠ Error al cargar datos";

    // Mostrar mensaje de diagnóstico en el menú
    const grid=$("#sizes-fresas");
    const page=document.querySelector(".page-wrap");
    if(page){
      const errBox=document.createElement("div");
      errBox.style.cssText="margin:40px auto;max-width:600px;background:#fef2f2;border:2px solid #fca5a5;border-radius:16px;padding:28px;font-family:sans-serif;";
      errBox.innerHTML=`
        <h3 style="color:#dc2626;margin:0 0 12px;font-size:18px">⚠ No se pudo cargar el menú</h3>
        <p style="color:#7f1d1d;margin:0 0 16px;font-size:14px;line-height:1.6">${err.message.replace(/\n/g,"<br>")}</p>
        <p style="color:#991b1b;font-size:13px;font-weight:600;margin:0">
          <strong>Solución:</strong><br>
          1. Abre tu Google Sheet<br>
          2. Ve a <em>Archivo → Compartir → Publicar en la web</em><br>
          3. Selecciona la hoja <strong>DATA_ITEMS</strong><br>
          4. Elige formato <strong>Valores separados por comas (.csv)</strong><br>
          5. Haz clic en <strong>Publicar</strong><br>
          6. Repite para <strong>DATA_EXTRAS</strong>
        </p>
      `;
      page.prepend(errBox);
    }
  }
}

document.addEventListener("DOMContentLoaded",main);
