/* ═══════════════════════════════════════════
   Las Cremosas — app.js v3
   Menú por secciones + Caja con PIN
   ═══════════════════════════════════════════ */
"use strict";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const CFG = window.MENU_CONFIG || {};

// ═══ HELPERS ══════════════════════════════
function formatPrice(val, cur) {
  const currency = cur || CFG.currency || "MXN";
  const n = toNumber(val);
  try { return new Intl.NumberFormat("es-MX", { style:"currency", currency }).format(n); }
  catch { return `$${n.toFixed(2)}`; }
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return 0;
  const c = String(v).replace(/\s/g,"").replace(/[$€£¥]/g,"").replace(/[a-zA-Z,]/g,"").replace(/[^0-9.-]/g,"");
  const n = parseFloat(c);
  return isNaN(n) ? 0 : n;
}

function normalizeBool(v, def = true) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return def;
  if (["si","sí","true","1","yes","y"].includes(s)) return true;
  if (["no","false","0","n"].includes(s)) return false;
  return def;
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function normDate(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const p = s.split(/[\/-]/);
  if (p.length === 3) {
    if (p[0].length === 4) return `${p[0]}-${p[1].padStart(2,"0")}-${p[2].padStart(2,"0")}`;
    return `${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
  }
  return s;
}

// ═══ CSV ══════════════════════════════════
function parseCSV(text) {
  const rows = []; let cur="",inQ=false,row=[];
  for (let i=0;i<text.length;i++) {
    const ch=text[i],nx=text[i+1];
    if (ch==='"') { if(inQ&&nx==='"'){cur+='"';i++;}else{inQ=!inQ;} }
    else if (ch===','&&!inQ){row.push(cur);cur="";}
    else if ((ch==='\n'||ch==='\r')&&!inQ){if(ch==='\r'&&nx==='\n')i++;row.push(cur);rows.push(row);row=[];cur="";}
    else{cur+=ch;}
  }
  if(cur.length||row.length){row.push(cur);rows.push(row);}
  if(!rows.length)return[];
  const header=rows[0].map(h=>h.trim());
  const data=[];
  for(let r=1;r<rows.length;r++){
    const cols=rows[r];
    if(!cols.some(c=>String(c||"").trim()))continue;
    const obj={};
    header.forEach((h,i)=>{obj[h]=(cols[i]??"").trim();});
    data.push(obj);
  }
  return data;
}

async function fetchCSV(url) {
  const res = await fetch(url, { cache:"no-store" });
  if (!res.ok) throw new Error(`CSV ${res.status}`);
  return parseCSV(await res.text());
}

// ═══ STATE ════════════════════════════════
const state = {
  items: [], extras: [], sales: [], expenses: [],
  q: "", category: "", onlyAvailable: true,
};

// Mapeo de categoría CSV → sección HTML
// key: normalizado (lowercase sin acento), value: id de sección
const CAT_MAP = {
  "fresas con crema":  "fresas-con-crema",
  "fresas especiales": "fresas-especiales",
  "frappes":           "frappes",
  "frappe":            "frappes",
  "waffles":           "waffles",
  "waffle":            "waffles",
  "snacks":            "snacks",
  "snack":             "snacks",
  "bebidas":           "bebidas",
  "bebida":            "bebidas",
};

function normCat(cat) {
  return (cat||"").toLowerCase()
    .replace(/á/g,"a").replace(/é/g,"e").replace(/í/g,"i").replace(/ó/g,"o").replace(/ú/g,"u")
    .trim();
}

function getSectionId(cat) {
  return CAT_MAP[normCat(cat)] || "otros";
}

// ═══ RENDER MENÚ ══════════════════════════

function renderAllSections() {
  // Limpiar todos los grids
  [
    "grid-fresas-con-crema","grid-fresas-especiales","grid-frappes",
    "grid-waffles","grid-snacks","grid-bebidas","grid-otros",
    "chips-toppings","chips-chocolates-fijo","chips-chocolates-variable",
  ].forEach(id => { const el = $(`#${id}`); if (el) el.innerHTML=""; });

  const q = state.q.trim().toLowerCase();
  const filterCat = state.category;
  const onlyAvail = state.onlyAvailable;

  let visibleCount = 0;

  for (const it of state.items) {
    const available = normalizeBool(it.Disponible, true);
    if (onlyAvail && !available) continue;

    const catNorm = normCat(it.Categoria);
    const secId   = getSectionId(it.Categoria);

    // Filtro categoría del select
    if (filterCat && it.Categoria !== filterCat) continue;

    // Filtro búsqueda
    if (q) {
      const hay = [it.Nombre,it.Descripcion,it.Variante,it.Categoria,it.Badges,it.Notas]
        .map(x=>String(x||"").toLowerCase()).join(" ");
      if (!hay.includes(q)) continue;
    }

    visibleCount++;

    if (catNorm === "fresas con crema") {
      renderSizeCard(it, available);
    } else {
      renderProdCard(it, available, secId);
    }
  }

  // Mostrar/ocultar empty state
  $("#emptyState")?.classList.toggle("hidden", visibleCount > 0);

  // Mostrar sección "otros" solo si tiene contenido
  const otrosGrid = $("#grid-otros");
  if (otrosGrid) {
    const hasOtros = otrosGrid.children.length > 0;
    const secOtros = $("#sec-otros");
    if (secOtros) secOtros.style.display = hasOtros ? "" : "none";
  }

  // Mostrar/ocultar secciones vacías
  ["fresas-con-crema","fresas-especiales","frappes","waffles","snacks","bebidas"].forEach(id => {
    const sec  = $(`#sec-${id}`);
    const grid = $(`#grid-${id}`);
    const szGrid = $(`#grid-${id}`); // para fresas-con-crema es .size-grid

    if (!sec) return;
    // Para fresas-con-crema verificamos el size-grid
    if (id === "fresas-con-crema") {
      const sg = $(".size-grid");
      if (sg) sec.style.display = sg.children.length > 0 ? "" : "none";
    } else {
      if (grid) sec.style.display = grid.children.length > 0 ? "" : "none";
    }
  });

  $("#itemsCount").textContent = `${visibleCount} visibles`;
}

function renderSizeCard(it, available) {
  const grid = $(".size-grid");
  if (!grid) return;
  const price = toNumber(it.Precio);
  const card = document.createElement("div");
  card.className = "size-card" + (available ? "" : " size-card--unavail");
  card.innerHTML = `
    <div class="size-card__name">${it.Nombre||""}</div>
    <div class="size-card__variant">${it.Variante||""}</div>
    <div class="size-card__price">${price ? formatPrice(price) : "—"}</div>
    ${it.Descripcion ? `<div class="size-card__desc">${it.Descripcion}</div>` : ""}
    ${!available ? `<div style="margin-top:6px;font-size:11px;font-weight:700;color:#854d0e">No disponible</div>` : ""}
  `;
  grid.appendChild(card);
}

function renderProdCard(it, available, secId) {
  const grid = $(`#grid-${secId}`);
  if (!grid) return;

  const price = toNumber(it.Precio);
  const badgesRaw = (it.Badges||it.Etiquetas||"").split("|").map(s=>s.trim()).filter(Boolean);
  const note = (it.Notas||"").trim();
  if (note) badgesRaw.push(note);

  const card = document.createElement("div");
  card.className = "prod-card" + (available ? "" : " prod-card--unavail");

  const nameStr    = [it.Nombre, it.Variante].filter(Boolean).join(" — ");
  const badgesHtml = badgesRaw.length
    ? `<div class="prod-card__badges">${badgesRaw.slice(0,3).map(b=>`<span class="prod-badge">${b}</span>`).join("")}</div>`
    : "";

  card.innerHTML = `
    <div class="prod-card__left">
      <div class="prod-card__name">${nameStr}</div>
      ${it.Descripcion ? `<div class="prod-card__desc">${it.Descripcion}</div>` : ""}
      ${badgesHtml}
    </div>
    <div class="prod-card__right">
      <div class="prod-card__price">${price ? formatPrice(price) : "—"}</div>
      ${!available ? `<span class="prod-badge--unavail">No disponible</span>` : ""}
    </div>
  `;
  grid.appendChild(card);
}

function renderExtrasChips(extras) {
  const tChips = $("#chips-toppings");
  const cFijo  = $("#chips-chocolates-fijo");
  const cVar   = $("#chips-chocolates-variable");
  if (tChips) tChips.innerHTML="";
  if (cFijo)  cFijo.innerHTML="";
  if (cVar)   cVar.innerHTML="";

  for (const ex of extras) {
    if (!normalizeBool(ex.Activo, true)) continue;
    const tipo      = (ex.Tipo||ex.Categoria||"").trim().toLowerCase();
    const nombre    = (ex.Nombre||ex.Item||"").trim();
    const precio    = toNumber(ex.Precio||"");
    const tipoPrecio= (ex["Tipo de precio"]||ex.TipoPrecio||"").toLowerCase();
    if (!nombre) continue;

    const chip = document.createElement("span");
    chip.className = "extra-chip";
    chip.textContent = nombre;
    if (precio) {
      chip.setAttribute("data-price", formatPrice(precio));
      chip.classList.add("extra-chip--price");
      chip.textContent = `${nombre} +${formatPrice(precio)}`;
    }

    if (tipo === "topping" && tChips) {
      tChips.appendChild(chip);
    } else if (tipo === "chocolate extra" || tipo === "chocolate") {
      chip.classList.add("extra-chip--dark");
      if (tipoPrecio.includes("fijo") || tipoPrecio.includes("costo extra")) {
        if (cFijo) cFijo.appendChild(chip);
      } else {
        if (cVar) cVar.appendChild(chip);
      }
    }
  }
}

function renderCategorySelect(items) {
  const sel = $("#categorySelect");
  if (!sel) return;
  const cats = [...new Set(items.map(it=>(it.Categoria||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  sel.innerHTML = `<option value="">Todas las categorías</option>`;
  cats.forEach(c => {
    const opt = document.createElement("option");
    opt.value=c; opt.textContent=c; sel.appendChild(opt);
  });
}

function setMeta() {
  $("#lastUpdated").textContent = `🕒 ${new Date().toLocaleString("es-MX")}`;
  $("#itemsCount").textContent  = `${state.items.length} productos`;
}

// ═══ PIN ══════════════════════════════════
const CAJA_PIN   = String(CFG.cajaPin || "1234");
const SESS_KEY   = "cremosas_caja_ok";
let   pinBuf     = "";

function cajaUnlocked() { return sessionStorage.getItem(SESS_KEY)==="ok" }
function lockCaja() {
  sessionStorage.removeItem(SESS_KEY);
  showPin();
  $$(".nav-pill").forEach(t=>t.classList.remove("active"));
  $$(".tab-view").forEach(v=>v.classList.remove("active"));
  $(".nav-pill[data-tab='menu']").classList.add("active");
  $("#tabMenu").classList.add("active");
}
function showPin() {
  pinBuf=""; updatePinDisp();
  $("#pinError")?.classList.add("hidden");
  $("#cajaLocked")?.classList.remove("hidden");
  $("#cajaContent")?.classList.add("hidden");
}
function showCajaUI() {
  $("#cajaLocked")?.classList.add("hidden");
  $("#cajaContent")?.classList.remove("hidden");
}
function pinPress(v)  { if(pinBuf.length<8){pinBuf+=v;updatePinDisp();} }
function pinDelete()  { pinBuf=pinBuf.slice(0,-1);updatePinDisp(); }
function updatePinDisp() {
  const el=$("#pinDisplay"); if(!el)return;
  el.textContent = pinBuf.length ? "●".repeat(pinBuf.length) : "––––";
}
function pinSubmit() {
  if (pinBuf===CAJA_PIN) {
    sessionStorage.setItem(SESS_KEY,"ok");
    showCajaUI();
    loadFinancials();
    pinBuf="";
  } else {
    pinBuf="";updatePinDisp();
    $("#pinError")?.classList.remove("hidden");
    const d=$("#pinDisplay");d?.classList.add("shake");
    setTimeout(()=>d?.classList.remove("shake"),500);
  }
}

// ═══ CAJA ═════════════════════════════════
function populateSaleProducts() {
  const sel=$("#saleProduct"); if(!sel)return;
  sel.innerHTML=`<option value="">Selecciona producto…</option>`;
  state.items
    .filter(it=>normalizeBool(it.Disponible,true))
    .sort((a,b)=>(a.Nombre||"").localeCompare(b.Nombre||"","es"))
    .forEach(it=>{
      const price=toNumber(it.Precio);
      const label=[it.Nombre,it.Variante].filter(Boolean).join(" — ");
      const opt=document.createElement("option");
      opt.value=label;
      opt.textContent=`${label} — ${formatPrice(price)}`;
      opt.dataset.price=price;
      sel.appendChild(opt);
    });
}

function updateTotalPreview() {
  const qty=toNumber($("#saleQty")?.value);
  const price=toNumber($("#salePrice")?.value);
  const el=$("#saleTotalPreview"); if(!el)return;
  el.textContent=(qty>0&&price>=0)?formatPrice(qty*price):"—";
}

function buildSummary() {
  const today=getTodayString();
  const ts=state.sales.filter(s=>normDate(s.fecha)===today);
  const te=state.expenses.filter(e=>normDate(e.fecha)===today);
  const totalS=ts.reduce((a,s)=>a+toNumber(s.total),0);
  const totalE=te.reduce((a,e)=>a+toNumber(e.monto),0);
  const profit=totalS-totalE;

  $("#salesTodayTotal").textContent    = formatPrice(totalS);
  $("#expensesTodayTotal").textContent = formatPrice(totalE);
  $("#profitTodayTotal").textContent   = formatPrice(profit);
  $("#salesCountToday").textContent    = `${ts.length} venta${ts.length!==1?"s":""}`;
  if($("#profitTodayTotal")) $("#profitTodayTotal").style.color = profit>=0?"#16a34a":"var(--pink)";

  const grouped={};
  for(const s of ts){const n=s.producto||"?";grouped[n]=(grouped[n]||0)+toNumber(s.cantidad);}
  const container=$("#topProductsToday"); if(!container)return;
  container.innerHTML="";
  const sorted=Object.entries(grouped).sort((a,b)=>b[1]-a[1]);
  if(!sorted.length){container.innerHTML=`<div class="mini-empty">Sin ventas aún hoy.</div>`;return;}
  sorted.forEach(([name,qty],i)=>{
    const row=document.createElement("div");
    row.className="mini-row";
    const medal=["🥇","🥈","🥉"][i]||`${i+1}.`;
    row.innerHTML=`<span>${medal} ${name}</span><strong>${qty}</strong>`;
    container.appendChild(row);
  });
}

function showMsg(txt,type="success") {
  const el=$("#adminMessage"); if(!el)return;
  el.textContent=txt; el.className=`status-msg status-msg--${type}`;
  el.classList.remove("hidden");
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.add("hidden"),4200);
}

async function apiPost(payload) {
  const url=CFG.api?.saveUrl||"";
  if(!url||url.includes("PEGA"))throw new Error("Configura la URL del Apps Script en config.js");
  const res=await fetch(url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
  let data={};
  try{data=await res.json();}catch{data={ok:false,message:await res.text()};}
  if(!res.ok||!data.ok)throw new Error(data.message||"Error al guardar");
  return data;
}

async function loadFinancials() {
  const {ventasCsvUrl,gastosCsvUrl}=CFG.sheets||{};
  if(!ventasCsvUrl||!gastosCsvUrl){buildSummary();return;}
  try {
    const [s,e]=await Promise.all([fetchCSV(ventasCsvUrl),fetchCSV(gastosCsvUrl)]);
    state.sales=s.map(r=>({
      fecha:r.fecha||r.Fecha||"",hora:r.hora||r.Hora||"",
      producto:r.producto||r.Producto||"",cantidad:r.cantidad||r.Cantidad||"0",
      precio_unitario:r.precio_unitario||"0",total:r.total||r.Total||"0",
      encargado:r.encargado||r.Encargado||"",notas:r.notas||r.Notas||"",
    }));
    state.expenses=e.map(r=>({
      fecha:r.fecha||r.Fecha||"",hora:r.hora||r.Hora||"",
      concepto:r.concepto||r.Concepto||"",categoria:r.categoria||r.Categoria||"",
      monto:r.monto||r.Monto||"0",encargado:r.encargado||r.Encargado||"",notas:r.notas||r.Notas||"",
    }));
    buildSummary();
  } catch(err) { console.error(err); showMsg("No pude cargar ventas/gastos.","error"); }
}

const ICON_SAVE=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;

async function saveSale() {
  const producto =$("#saleProduct")?.value.trim();
  const cantidad =toNumber($("#saleQty")?.value);
  const precio   =toNumber($("#salePrice")?.value);
  const encargado=$("#saleManager")?.value.trim();
  const notas    =$("#saleNotes")?.value.trim();
  if(!producto||cantidad<=0||precio<0){showMsg("Completa los datos correctamente.","error");return;}
  const btn=$("#btnSaveSale"); if(!btn)return;
  btn.disabled=true;btn.innerHTML=`<span class="spinner"></span> Guardando…`;
  try {
    await apiPost({action:"saveSale",data:{producto,cantidad,precio_unitario:precio,total:cantidad*precio,encargado,notas}});
    showMsg("✅ Venta guardada.");
    $("#saleProduct").selectedIndex=0;$("#saleQty").value="1";
    $("#salePrice").value="";$("#saleManager").value="";$("#saleNotes").value="";
    if($("#saleTotalPreview"))$("#saleTotalPreview").textContent="—";
    await loadFinancials();
  } catch(err){showMsg(err.message||"Error.","error");}
  finally{btn.disabled=false;btn.innerHTML=ICON_SAVE+" Guardar venta";}
}

async function saveExpense() {
  const concepto =$("#expenseConcept")?.value.trim();
  const categoria=$("#expenseCategory")?.value.trim().replace(/^[^ ]+ /,""); // strip emoji
  const monto    =toNumber($("#expenseAmount")?.value);
  const encargado=$("#expenseManager")?.value.trim();
  const notas    =$("#expenseNotes")?.value.trim();
  if(!concepto||!categoria||monto<=0){showMsg("Completa los datos correctamente.","error");return;}
  const btn=$("#btnSaveExpense"); if(!btn)return;
  btn.disabled=true;btn.innerHTML=`<span class="spinner"></span> Guardando…`;
  try {
    await apiPost({action:"saveExpense",data:{concepto,categoria,monto,encargado,notas}});
    showMsg("✅ Gasto guardado.");
    $("#expenseConcept").value="";$("#expenseCategory").selectedIndex=0;
    $("#expenseAmount").value="";$("#expenseManager").value="";$("#expenseNotes").value="";
    await loadFinancials();
  } catch(err){showMsg(err.message||"Error.","error");}
  finally{btn.disabled=false;btn.innerHTML=ICON_SAVE+" Guardar gasto";}
}

// ═══ SETUP UI ═════════════════════════════
function setupUI() {
  // WhatsApp
  const waMsg=encodeURIComponent(`Hola ${CFG.businessName||"Las Cremosas"}! Quiero hacer un pedido 😊🍓`);
  const waLink=`https://wa.me/${CFG.whatsappPhoneE164||""}?text=${waMsg}`;
  if($("#btnWhats"))$("#btnWhats").href=waLink;
  if($("#ctaWhats"))$("#ctaWhats").href=waLink;
  if($("#yearNow")) $("#yearNow").textContent=new Date().getFullYear();
  if($("#cajaDate"))$("#cajaDate").textContent=new Date().toLocaleDateString("es-MX",{weekday:"long",year:"numeric",month:"long",day:"numeric"});

  // Tabs menú/caja
  $$(".nav-pill").forEach(tab=>{
    tab.addEventListener("click",()=>{
      $$(".nav-pill").forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      const t=tab.dataset.tab;
      $$(".tab-view").forEach(v=>v.classList.remove("active"));
      $(`#tab${t[0].toUpperCase()+t.slice(1)}`).classList.add("active");
      if(t==="caja"){cajaUnlocked()?(showCajaUI(),loadFinancials()):showPin();}
    });
  });

  // PIN teclado
  $$(".pk").forEach(k=>{
    k.addEventListener("click",()=>{
      const v=k.dataset.val;
      if(v==="del") pinDelete();
      else if(v==="ok") pinSubmit();
      else pinPress(v);
    });
  });
  document.addEventListener("keydown",e=>{
    if($("#cajaLocked")?.classList.contains("hidden"))return;
    if(e.key>="0"&&e.key<="9")pinPress(e.key);
    else if(e.key==="Backspace")pinDelete();
    else if(e.key==="Enter")pinSubmit();
  });

  // Cerrar sesión
  $("#btnLockCaja")?.addEventListener("click",lockCaja);

  // Sub-tabs caja
  $$(".ctab").forEach(tab=>{
    tab.addEventListener("click",()=>{
      $$(".ctab").forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      const f=tab.dataset.form;
      $$(".caja-form").forEach(fm=>fm.classList.remove("active"));
      $(`#form${f[0].toUpperCase()+f.slice(1)}`).classList.add("active");
    });
  });

  // Filtros
  $("#searchInput")?.addEventListener("input",e=>{state.q=e.target.value;renderAllSections();});
  $("#categorySelect")?.addEventListener("change",e=>{state.category=e.target.value;renderAllSections();});
  $("#toggleAvailable")?.addEventListener("change",e=>{state.onlyAvailable=e.target.checked;renderAllSections();});

  // Compartir
  $("#btnShare")?.addEventListener("click",async()=>{
    try{
      if(navigator.share) await navigator.share({title:document.title,text:"Mira el menú de Las Cremosas 🍓",url:location.href});
      else{await navigator.clipboard.writeText(location.href);alert("¡Link copiado! ✅");}
    }catch{}
  });

  // Dialog
  const dlg=$("#howDialog");
  $("#openHow")?.addEventListener("click",e=>{e.preventDefault();dlg?.showModal();});
  $("#closeHow")?.addEventListener("click",()=>dlg?.close());
  dlg?.addEventListener("click",e=>{if(e.target===dlg)dlg.close();});

  // Venta
  $("#saleProduct")?.addEventListener("change",e=>{
    const opt=e.target.selectedOptions[0];
    if($("#salePrice"))$("#salePrice").value=opt?.dataset?.price??"";
    updateTotalPreview();
  });
  ["saleQty","salePrice"].forEach(id=>$(`#${id}`)?.addEventListener("input",updateTotalPreview));
  $("#btnSaveSale")?.addEventListener("click",saveSale);
  $("#btnSaveExpense")?.addEventListener("click",saveExpense);
  $("#refreshSummary")?.addEventListener("click",async()=>{await loadFinancials();showMsg("Corte actualizado.");});
}

// ═══ MAIN ═════════════════════════════════
async function main() {
  setupUI();
  const {itemsCsvUrl,extrasCsvUrl}=CFG.sheets||{};

  if(!itemsCsvUrl||!extrasCsvUrl||itemsCsvUrl.includes("PASTE_")){
    if($("#lastUpdated"))$("#lastUpdated").textContent="⚠ Configura los CSV en config.js";
    return;
  }

  try {
    const [items,extras]=await Promise.all([fetchCSV(itemsCsvUrl),fetchCSV(extrasCsvUrl)]);

    // Normalizar columnas — el sheet usa: Categoria, Producto, Variante/Tamaño, Descripción, Precio, Moneda, Activo, Orden
    state.items=items.map(it=>({
      ...it,
      Categoria:   it.Categoria   || it.Category      || "",
      Nombre:      it.Producto    || it.Nombre         || it.Item || "",
      Variante:    it["Variante/Tamaño"] || it.Variante|| it.Tamaño || "",
      Descripcion: it["Descripción"]||it.Descripcion   || it.Descripcion || "",
      Precio:      it.Precio      || it.PrecioMXN      || it.Price || "",
      Disponible:  it.Activo      || it.Disponible     || "Sí",
      Badges:      it.Badges      || it.Etiquetas      || "",
      Notas:       it.Notas       || "",
    }));

    // Normalizar extras — el sheet usa: ID, Tipo, Nombre, Precio, Moneda, Tipo de precio, Notas, Activo, Orden
    state.extras=extras.map(ex=>({
      ...ex,
      Tipo:   ex.Tipo   || ex.Categoria || "",
      Nombre: ex.Nombre || ex.Item      || "",
      Precio: ex.Precio || "",
      Activo: ex.Activo || ex.Disponible|| "Sí",
      "Tipo de precio": ex["Tipo de precio"]||ex.TipoPrecio||"",
    }));

    renderCategorySelect(state.items);
    renderExtrasChips(state.extras);
    populateSaleProducts();
    setMeta();
    renderAllSections();

  } catch(err) {
    console.error(err);
    if($("#lastUpdated"))$("#lastUpdated").textContent="⚠ Error cargando datos";
  }
}

document.addEventListener("DOMContentLoaded", main);
