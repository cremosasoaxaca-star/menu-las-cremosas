/* ══════════════════════════════════════════
   Las Cremosas — caja.js
   Sistema de Caja con roles Empleado / Admin
   ══════════════════════════════════════════ */
"use strict";

const CFG = window.MENU_CONFIG || {};

/* ── Helpers ─────────────────────────────── */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function fmt(n) {
  return new Intl.NumberFormat("es-MX", { style:"currency", currency:"MXN" }).format(Number(n)||0);
}
function num(v) {
  const c = String(v||0).replace(/[$,\s]/g,"").replace(/[^0-9.-]/g,"");
  return parseFloat(c) || 0;
}
function bool(v, def=true) {
  const s = String(v||"").toLowerCase().trim();
  if (!s) return def;
  return ["si","sí","true","1","yes","y"].includes(s);
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function normDate(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const p = s.split(/[\/-]/);
  if (p.length===3) return p[0].length===4
    ? `${p[0]}-${p[1].padStart(2,"0")}-${p[2].padStart(2,"0")}`
    : `${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
  return s;
}
function genFolio() {
  const n = (parseInt(localStorage.getItem("cremosas_folio")||"0")+1);
  localStorage.setItem("cremosas_folio", n);
  return String(n).padStart(4,"0");
}
function timeStr(date) {
  return (date||new Date()).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"});
}

/* ── CSV ─────────────────────────────────── */
function parseCSV(text) {
  if (text.trim().startsWith("<")) throw new Error("La hoja no está publicada como CSV.");
  const rows=[]; let cur="",inQ=false,row=[];
  for (let i=0;i<text.length;i++) {
    const c=text[i],nx=text[i+1];
    if(c==='"'){if(inQ&&nx==='"'){cur+='"';i++;}else inQ=!inQ;}
    else if(c===','&&!inQ){row.push(cur);cur="";}
    else if((c==='\n'||c==='\r')&&!inQ){if(c==='\r'&&nx==='\n')i++;row.push(cur);rows.push(row);row=[];cur="";}
    else cur+=c;
  }
  if(cur.length||row.length){row.push(cur);rows.push(row);}
  if(!rows.length)return[];
  const hdr=rows[0].map(h=>h.trim());
  return rows.slice(1).filter(r=>r.some(c=>String(c||"").trim())).map(r=>{
    const o={};hdr.forEach((h,i)=>{o[h]=(r[i]??"").trim();});return o;
  });
}

async function fetchCSV(url) {
  try {
    const r = await fetch(url,{cache:"no-store",mode:"cors"});
    if(r.ok) return parseCSV(await r.text());
  } catch {}
  // Proxy fallback
  const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,{cache:"no-store"});
  if(!r.ok) throw new Error("No se pudo cargar el CSV.");
  const j = await r.json();
  return parseCSV(j.contents||"");
}

/* ── State global ────────────────────────── */
const STATE = {
  role:     null,   // "empleado" | "admin"
  userName: "",
  items:    [],     // productos del menú
  extras:   [],     // extras/toppings
  sales:    [],     // ventas del día (desde CSV)
  expenses: [],     // gastos del día (desde CSV)
  order:    [],     // orden actual: [{id, nombre, cantidad, precio, extras[], subtotal}]
  folio:    "0001",
  activeRole: "empleado", // tab seleccionada en login
  activeCat:  "",
  modalItem:  null, // item que se está configurando en el modal
  modalQty:   1,
  modalExtras:[],   // extras seleccionados en modal
};

/* ── PINs ────────────────────────────────── */
const PIN_EMP   = String(CFG.pinEmpleado || CFG.cajaPin || "1234");
const PIN_ADMIN = String(CFG.pinAdmin    || "9999");
let pinBuf = "";

/* ══════════════════════════════════════════
   PANTALLA: LOGIN
   ══════════════════════════════════════════ */
function initLogin() {
  // Role tabs
  $$(".rtab").forEach(t => {
    t.addEventListener("click", () => {
      $$(".rtab").forEach(x=>x.classList.remove("rtab--active"));
      t.classList.add("rtab--active");
      STATE.activeRole = t.dataset.role;
      pinBuf = ""; updPin();
      $("#pinLabel").textContent = STATE.activeRole === "admin"
        ? "Ingresa tu PIN de administrador"
        : "Ingresa tu PIN de empleado";
      $("#pinError").classList.add("hidden");
    });
  });

  // PIN pad
  $$(".pkey").forEach(k => k.addEventListener("click", () => {
    const v = k.dataset.val;
    if (v==="del") { pinBuf=pinBuf.slice(0,-1); updPin(); }
    else if (v==="ok") checkPin();
    else { if(pinBuf.length<8){pinBuf+=v;updPin();} }
  }));

  document.addEventListener("keydown", e => {
    if (!$("#screenLogin").classList.contains("screen--active")) return;
    if(e.key>="0"&&e.key<="9"){if(pinBuf.length<8){pinBuf+=e.key;updPin();}}
    else if(e.key==="Backspace"){pinBuf=pinBuf.slice(0,-1);updPin();}
    else if(e.key==="Enter") checkPin();
  });
}

function updPin() {
  const el=$("#pinDisplay");
  if(el) el.textContent = pinBuf.length ? "●".repeat(pinBuf.length) : "· · · ·";
}

function checkPin() {
  const role = STATE.activeRole;
  const ok = (role==="admin" && pinBuf===PIN_ADMIN) || (role==="empleado" && pinBuf===PIN_EMP);
  if (ok) {
    STATE.role = role;
    STATE.userName = role==="admin" ? "Admin" : "Encargado";
    pinBuf = "";
    goToApp();
  } else {
    pinBuf=""; updPin();
    const err=$("#pinError"); err.classList.remove("hidden");
    const disp=$("#pinDisplay");
    disp.classList.add("shake");
    setTimeout(()=>disp.classList.remove("shake"),500);
  }
}

function goToApp() {
  $("#screenLogin").classList.remove("screen--active");
  if (STATE.role==="empleado") {
    $("#screenEmpleado").classList.add("screen--active");
    initEmpleado();
  } else {
    $("#screenAdmin").classList.add("screen--active");
    initAdmin();
  }
}

/* ══════════════════════════════════════════
   PANTALLA: EMPLEADO
   ══════════════════════════════════════════ */
function initEmpleado() {
  const date = new Date().toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"});
  $("#empDate").textContent = date;
  $("#empName").textContent = STATE.userName;

  // Folio
  STATE.folio = genFolio();
  $("#empFolio").textContent = STATE.folio;

  // Logout
  $("#btnLogoutEmp").addEventListener("click", logout);

  // Botones de orden
  $("#btnClearOrder").addEventListener("click", () => { clearOrder("emp"); });
  $("#btnSaveOrder").addEventListener("click", () => saveOrder("emp"));

  buildProductUI("emp");
}

/* ══════════════════════════════════════════
   PANTALLA: ADMIN
   ══════════════════════════════════════════ */
function initAdmin() {
  const date = new Date().toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"});
  $("#adminDate").textContent = date;

  // Logout
  $("#btnLogoutAdmin").addEventListener("click", logout);

  // Admin tabs
  $$(".atab").forEach(t => {
    t.addEventListener("click", () => {
      $$(".atab").forEach(x=>x.classList.remove("atab--active"));
      t.classList.add("atab--active");
      $$(".admin-view").forEach(v=>v.classList.remove("admin-view--active"));
      $(`#adminView${t.dataset.view[0].toUpperCase()+t.dataset.view.slice(1)}`).classList.add("admin-view--active");
      if (t.dataset.view==="corte") loadAndBuildCorte();
    });
  });

  // Folio
  STATE.folio = genFolio();
  $("#adminFolio").textContent = STATE.folio;

  // Botones orden admin
  $("#adminBtnClear").addEventListener("click", ()=>clearOrder("admin"));
  $("#adminBtnSave").addEventListener("click",  ()=>saveOrder("admin"));

  // Gasto
  $("#btnSaveGasto").addEventListener("click", saveGasto);

  // Corte refresh
  $("#btnRefreshCorte").addEventListener("click", loadAndBuildCorte);

  buildProductUI("admin");
}

/* ══════════════════════════════════════════
   PRODUCTOS UI
   ══════════════════════════════════════════ */
function buildProductUI(prefix) {
  buildCatPills(prefix);
  buildProdGrid(prefix, "");
}

function buildCatPills(prefix) {
  const el = $(`#${prefix}CatPills`);
  if (!el) return;
  el.innerHTML = "";

  // Pill "Todos"
  const all = document.createElement("button");
  all.className = "cat-pill cat-pill--active";
  all.textContent = "Todos";
  all.addEventListener("click", () => {
    $$(`#${prefix}CatPills .cat-pill`).forEach(p=>p.classList.remove("cat-pill--active"));
    all.classList.add("cat-pill--active");
    STATE.activeCat="";
    buildProdGrid(prefix, $(`#${prefix}Search`)?.value||"");
  });
  el.appendChild(all);

  // Una pill por sección
  const cats = [...new Set(STATE.items.map(it=>it.Seccion).filter(Boolean))];
  cats.forEach(cat => {
    const pill = document.createElement("button");
    pill.className = "cat-pill";
    pill.textContent = cat;
    pill.addEventListener("click", () => {
      $$(`#${prefix}CatPills .cat-pill`).forEach(p=>p.classList.remove("cat-pill--active"));
      pill.classList.add("cat-pill--active");
      STATE.activeCat = cat;
      buildProdGrid(prefix, $(`#${prefix}Search`)?.value||"");
    });
    el.appendChild(pill);
  });

  // Search
  $(`#${prefix}Search`)?.addEventListener("input", e => {
    buildProdGrid(prefix, e.target.value);
  });
}

function buildProdGrid(prefix, q) {
  const grid = $(`#${prefix}ProdGrid`);
  if (!grid) return;
  grid.innerHTML = "";
  const qLow = q.trim().toLowerCase();

  STATE.items
    .filter(it => {
      if (!bool(it.Activo||it.Disponible, true)) return false;
      if (STATE.activeCat && it.Seccion !== STATE.activeCat) return false;
      if (qLow) {
        const hay = [it.Nombre,it.Descripcion,it.Seccion].map(x=>String(x||"").toLowerCase()).join(" ");
        return hay.includes(qLow);
      }
      return true;
    })
    .forEach(it => {
      const p = num(it.Precio);
      const btn = document.createElement("button");
      btn.className = "prod-btn";
      btn.innerHTML = `
        <div class="prod-btn__sec">${it.Seccion||""}</div>
        <div class="prod-btn__name">${it.Nombre}</div>
        ${it.Descripcion?`<div class="prod-btn__desc">${it.Descripcion}</div>`:""}
        <div class="prod-btn__price">${p>0?fmt(p):"Precio variable"}</div>
      `;
      btn.addEventListener("click", () => openModal(it));
      grid.appendChild(btn);
    });
}

/* ══════════════════════════════════════════
   MODAL: Configurar item
   ══════════════════════════════════════════ */
function openModal(item) {
  STATE.modalItem   = item;
  STATE.modalQty    = 1;
  STATE.modalExtras = [];

  const basePrice = num(item.Precio);

  $("#modalProductName").textContent = item.Nombre;
  $("#modalProductBase").textContent = `Precio base: ${basePrice>0?fmt(basePrice):"Variable"}`;
  $("#modalQty").textContent = "1";
  $("#modalPrice").value = basePrice || "";

  // Extras disponibles (toppings + chocolates con precio)
  const extrasGrid = $("#modalExtrasGrid");
  extrasGrid.innerHTML = "";

  const disponibles = STATE.extras.filter(ex => {
    if (!bool(ex.Activo||ex.Disponible, true)) return false;
    const p = num(ex.Precio);
    return p > 0; // Solo extras con precio extra
  });

  if (disponibles.length > 0) {
    $("#modalExtrasSection").style.display = "";
    disponibles.forEach(ex => {
      const p = num(ex.Precio);
      const btn = document.createElement("button");
      btn.className = "extra-toggle";
      btn.innerHTML = `${ex.Nombre} <span class="extra-toggle__price">+${fmt(p)}</span>`;
      btn.dataset.nombre = ex.Nombre;
      btn.dataset.precio = p;
      btn.addEventListener("click", () => {
        const idx = STATE.modalExtras.findIndex(e=>e.nombre===ex.Nombre);
        if (idx>=0) {
          STATE.modalExtras.splice(idx,1);
          btn.classList.remove("extra-toggle--active");
        } else {
          STATE.modalExtras.push({nombre:ex.Nombre, precio:p});
          btn.classList.add("extra-toggle--active");
        }
        recalcModal();
      });
      extrasGrid.appendChild(btn);
    });
  } else {
    $("#modalExtrasSection").style.display = "none";
  }

  // Recalc al cambiar precio manualmente
  $("#modalPrice").addEventListener("input", recalcModal);

  recalcModal();
  $("#modalItem").classList.remove("hidden");

  // Qty buttons
  $("#btnQtyMinus").onclick = () => {
    if (STATE.modalQty>1) { STATE.modalQty--; $("#modalQty").textContent=STATE.modalQty; recalcModal(); }
  };
  $("#btnQtyPlus").onclick = () => {
    STATE.modalQty++;
    $("#modalQty").textContent = STATE.modalQty;
    recalcModal();
  };

  // Agregar a orden
  $("#btnAddToOrder").onclick = () => addToOrder();
  $("#btnModalClose").onclick = closeModal;
  $("#modalItem").onclick = e => { if(e.target==$("#modalItem")) closeModal(); };
}

function recalcModal() {
  const basePrice = num($("#modalPrice").value);
  const extrasSum = STATE.modalExtras.reduce((a,e)=>a+e.precio,0);
  const unit      = basePrice + extrasSum;
  const subtotal  = unit * STATE.modalQty;
  $("#modalSubtotal").textContent = fmt(subtotal);
  // Actualizar precio input con extras sumados si se agregaron extras
  if (STATE.modalExtras.length>0) {
    const base = num(STATE.modalItem?.Precio||0);
    $("#modalPrice").value = base + extrasSum;
  }
}

function closeModal() {
  $("#modalItem").classList.add("hidden");
  STATE.modalItem   = null;
  STATE.modalExtras = [];
}

function addToOrder() {
  const item    = STATE.modalItem;
  if (!item) return;
  const precio  = num($("#modalPrice").value);
  const qty     = STATE.modalQty;
  const extras  = [...STATE.modalExtras];
  const subtotal= precio * qty;

  STATE.order.push({
    id:       Date.now(),
    nombre:   item.Nombre,
    seccion:  item.Seccion||"",
    cantidad: qty,
    precio,
    extras,
    subtotal,
  });

  closeModal();
  renderOrder();
}

/* ══════════════════════════════════════════
   ORDEN
   ══════════════════════════════════════════ */
function renderOrder() {
  const isAdmin = STATE.role==="admin";
  const itemsEl = isAdmin ? $("#adminOrderItems") : $("#orderItems");
  const emptyEl = isAdmin ? $("#adminOrderEmpty") : $("#orderEmpty");
  const totalEl = isAdmin ? $("#adminOrderTotal") : $("#orderTotal");

  if (!itemsEl) return;
  itemsEl.innerHTML = "";

  if (STATE.order.length===0) {
    const e=document.createElement("div");
    e.className="order-empty";
    e.textContent="Agrega productos para comenzar";
    itemsEl.appendChild(e);
    if(totalEl) totalEl.textContent="$0.00";
    return;
  }

  let total = 0;
  STATE.order.forEach(it => {
    total += it.subtotal;
    const extrasStr = it.extras.map(e=>`${e.nombre} +${fmt(e.precio)}`).join(", ");

    const row = document.createElement("div");
    row.className = "order-item";
    row.innerHTML = `
      <div class="order-item__info">
        <div class="order-item__name">${it.nombre}</div>
        ${extrasStr?`<div class="order-item__extras">+ ${extrasStr}</div>`:""}
        <div class="order-item__qty">${it.cantidad>1?`${it.cantidad}x `:""}${fmt(it.precio)} c/u</div>
      </div>
      <div class="order-item__price">${fmt(it.subtotal)}</div>
      <button class="order-item__remove" data-id="${it.id}">×</button>
    `;
    row.querySelector(".order-item__remove").addEventListener("click", () => {
      STATE.order = STATE.order.filter(x=>x.id!==it.id);
      renderOrder();
    });
    itemsEl.appendChild(row);
  });

  if(totalEl) totalEl.textContent = fmt(total);
}

function clearOrder(prefix) {
  STATE.order = [];
  renderOrder();
}

/* ══════════════════════════════════════════
   GUARDAR VENTA
   ══════════════════════════════════════════ */
async function saveOrder(prefix) {
  if (STATE.order.length===0) { showToast("Agrega al menos un producto","error", prefix); return; }

  const isAdmin = prefix==="admin";
  const notesEl = isAdmin ? $("#adminNotes") : $("#empNotes");
  const notas   = notesEl?.value.trim()||"";
  const encargado = STATE.userName;
  const total   = STATE.order.reduce((a,it)=>a+it.subtotal,0);
  const folio   = STATE.folio;

  const payload = {
    action: "saveSale",
    data: {
      folio,
      encargado,
      notas,
      total,
      items: STATE.order.map(it=>({
        producto: it.nombre,
        cantidad: it.cantidad,
        precio:   it.precio,
        extras:   it.extras.map(e=>e.nombre).join(", "),
        subtotal: it.subtotal,
      }))
    }
  };

  const btn = isAdmin ? $("#adminBtnSave") : $("#btnSaveOrder");
  if(btn){ btn.disabled=true; btn.innerHTML=`<span class="spinner"></span> Guardando…`; }

  try {
    await apiPost(payload);
    showToast("✅ Venta guardada correctamente","success", prefix);
    STATE.order = [];
    renderOrder();
    if(notesEl) notesEl.value="";
    STATE.folio = genFolio();
    const folioEl = isAdmin ? $("#adminFolio") : $("#empFolio");
    if(folioEl) folioEl.textContent = STATE.folio;
  } catch(err) {
    showToast("❌ " + (err.message||"Error al guardar"), "error", prefix);
  } finally {
    if(btn){ btn.disabled=false; btn.innerHTML="✓ Guardar venta"; }
  }
}

/* ══════════════════════════════════════════
   GUARDAR GASTO
   ══════════════════════════════════════════ */
async function saveGasto() {
  const concepto  = $("#gConcepto")?.value.trim();
  const categoria = $("#gCategoria")?.value.trim().replace(/^[^\s]+\s/,"");
  const monto     = num($("#gMonto")?.value);
  const encargado = $("#gEncargado")?.value.trim()||STATE.userName;
  const notas     = $("#gNotas")?.value.trim();

  if(!concepto||!categoria||monto<=0){ showToast("Completa todos los campos","error","admin"); return; }

  const btn=$("#btnSaveGasto");
  if(btn){btn.disabled=true;btn.innerHTML=`<span class="spinner"></span> Guardando…`;}

  try {
    await apiPost({action:"saveExpense",data:{concepto,categoria,monto,encargado,notas}});
    showToast("✅ Gasto guardado","success","admin");
    ["gConcepto","gMonto","gEncargado","gNotas"].forEach(id=>{const e=$(` #${id}`);if(e)e.value="";});
    $("#gCategoria").selectedIndex=0;
  } catch(err) {
    showToast("❌ "+(err.message||"Error"),"error","admin");
  } finally {
    if(btn){btn.disabled=false;btn.innerHTML="Guardar gasto";}
  }
}

/* ══════════════════════════════════════════
   CORTE DEL DÍA
   ══════════════════════════════════════════ */
async function loadAndBuildCorte() {
  const btn=$("#btnRefreshCorte");
  if(btn){btn.disabled=true;btn.textContent="Cargando…";}

  try {
    const {ventasCsvUrl,gastosCsvUrl} = CFG.sheets||{};
    if(!ventasCsvUrl||!gastosCsvUrl) throw new Error("Configura las URLs de ventas/gastos en config.js");

    const [sales,expenses] = await Promise.all([fetchCSV(ventasCsvUrl),fetchCSV(gastosCsvUrl)]);

    STATE.sales = sales.map(r=>({
      fecha:     r.fecha||r.Fecha||"",
      hora:      r.hora||r.Hora||"",
      producto:  r.producto||r.Producto||"",
      cantidad:  num(r.cantidad||r.Cantidad||1),
      precio:    num(r.precio||r.precio_unitario||0),
      extras:    r.extras||"",
      subtotal:  num(r.subtotal||r.total||0),
      total:     num(r.total||r.Total||0),
      encargado: r.encargado||r.Encargado||"",
      notas:     r.notas||r.Notas||"",
      folio:     r.folio||r.Folio||"",
    }));

    STATE.expenses = expenses.map(r=>({
      fecha:     r.fecha||r.Fecha||"",
      hora:      r.hora||r.Hora||"",
      concepto:  r.concepto||r.Concepto||"",
      categoria: r.categoria||r.Categoria||"",
      monto:     num(r.monto||r.Monto||0),
      encargado: r.encargado||r.Encargado||"",
      notas:     r.notas||r.Notas||"",
    }));

    buildCorte();
  } catch(err) {
    showToast("Error: "+err.message,"error","admin");
  } finally {
    if(btn){btn.disabled=false;btn.textContent="↻ Actualizar";}
  }
}

function buildCorte() {
  const td = today();
  const sales    = STATE.sales.filter(s => normDate(s.fecha)===td);
  const expenses = STATE.expenses.filter(e => normDate(e.fecha)===td);

  // Agrupar ventas por folio para sumar totales únicos
  const folios = {};
  sales.forEach(s => {
    if(s.folio) {
      if(!folios[s.folio]) folios[s.folio] = {total:s.total, hora:s.hora, encargado:s.encargado, items:[]};
      folios[s.folio].items.push(s);
    }
  });

  // Total ventas — suma de totales únicos por folio, o subtotales si no hay folio
  let totalVentas = 0;
  const sinFolio = sales.filter(s=>!s.folio);
  const conFolio = Object.values(folios);

  conFolio.forEach(f => totalVentas+=num(f.total));
  sinFolio.forEach(s => totalVentas+=s.subtotal||s.total||0);

  const totalGastos  = expenses.reduce((a,e)=>a+e.monto,0);
  const utilidad     = totalVentas - totalGastos;
  const numVentas    = conFolio.length + sinFolio.length;
  const ticket       = numVentas>0 ? totalVentas/numVentas : 0;

  // KPIs
  $("#kpiVentas").textContent      = fmt(totalVentas);
  $("#kpiGastos").textContent      = fmt(totalGastos);
  $("#kpiUtilidad").textContent    = fmt(utilidad);
  $("#kpiVentasCount").textContent = `${numVentas} venta${numVentas!==1?"s":""}`;
  $("#kpiTicket").textContent      = fmt(ticket);
  $("#kpiUtilidad").style.color    = utilidad>=0?"var(--green)":"var(--rose)";

  // Top productos
  const grouped={};
  sales.forEach(s=>{
    const n=s.producto||"?";
    if(!grouped[n]) grouped[n]={qty:0,total:0};
    grouped[n].qty   += s.cantidad||1;
    grouped[n].total += s.subtotal||s.total||0;
  });
  const sorted=Object.entries(grouped).sort((a,b)=>b[1].qty-a[1].qty);
  const topEl=$("#topProductos");
  topEl.innerHTML="";
  if(!sorted.length){topEl.innerHTML=`<p class="empty-msg">Sin ventas hoy.</p>`;return;}
  const medals=["🥇","🥈","🥉"];
  sorted.slice(0,8).forEach(([name,d],i)=>{
    const row=document.createElement("div");
    row.className="rank-row";
    row.innerHTML=`
      <span class="rank-pos">${medals[i]||`${i+1}`}</span>
      <span class="rank-name">${name}</span>
      <span class="rank-qty">${d.qty} uds.</span>
      <span class="rank-total">${fmt(d.total)}</span>
    `;
    topEl.appendChild(row);
  });

  // Lista ventas
  const ventasEl=$("#listaVentas");
  ventasEl.innerHTML="";
  if(!sales.length){ventasEl.innerHTML=`<p class="empty-msg">Sin ventas.</p>`;}
  else {
    sales.slice().reverse().forEach(s=>{
      const row=document.createElement("div");
      row.className="txn-row";
      row.innerHTML=`
        <span class="txn-row__time">${s.hora?s.hora.slice(0,5):""}</span>
        <span class="txn-row__name">${s.producto||"?"}</span>
        <span class="txn-row__extras">${s.extras||""}</span>
        <span class="txn-row__amount">${fmt(s.subtotal||s.total||0)}</span>
        <span class="txn-row__enc">${s.encargado||""}</span>
      `;
      ventasEl.appendChild(row);
    });
  }

  // Lista gastos
  const gastosEl=$("#listaGastos");
  gastosEl.innerHTML="";
  if(!expenses.length){gastosEl.innerHTML=`<p class="empty-msg">Sin gastos.</p>`;}
  else {
    expenses.slice().reverse().forEach(g=>{
      const row=document.createElement("div");
      row.className="txn-row";
      row.innerHTML=`
        <span class="txn-row__time">${g.hora?g.hora.slice(0,5):""}</span>
        <span class="txn-row__name">${g.concepto||"?"} <small style="color:var(--ink4)">${g.categoria||""}</small></span>
        <span class="txn-row__extras">${g.notas||""}</span>
        <span class="txn-row__amount">${fmt(g.monto)}</span>
        <span class="txn-row__enc">${g.encargado||""}</span>
      `;
      gastosEl.appendChild(row);
    });
  }
}

/* ══════════════════════════════════════════
   API POST
   ══════════════════════════════════════════ */
async function apiPost(payload) {
  const url = CFG.api?.saveUrl||"";
  if(!url||url.includes("PEGA")) throw new Error("Configura saveUrl en config.js");

  // Primero intenta fetch normal con JSON
  try {
    const r = await fetch(url, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload),
      mode: "cors"
    });
    const text = await r.text();
    const d = JSON.parse(text);
    if(d.ok) return d;
  } catch {}

  // Fallback: no-cors con FormData (no podemos leer respuesta pero llega)
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  await fetch(url, { method:"POST", body:form, mode:"no-cors" });
  return { ok:true }; // asumimos éxito
}

/* ══════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════ */
function showToast(msg, type="success", prefix="emp") {
  const id = prefix==="admin" ? "adminToast" : "empToast";
  const el = $(`#${id}`);
  if(!el) return;
  el.textContent = msg;
  el.className = `toast toast--${type}`;
  el.classList.remove("hidden");
  clearTimeout(el._t);
  el._t = setTimeout(()=>el.classList.add("hidden"), 3500);
}

/* ══════════════════════════════════════════
   LOGOUT
   ══════════════════════════════════════════ */
function logout() {
  STATE.role = null;
  STATE.order = [];
  pinBuf = "";
  $$(".screen").forEach(s=>s.classList.remove("screen--active"));
  $("#screenLogin").classList.add("screen--active");
  updPin();
}

/* ══════════════════════════════════════════
   CARGAR DATOS
   ══════════════════════════════════════════ */
async function loadData() {
  const {itemsCsvUrl, extrasCsvUrl} = CFG.sheets||{};
  if(!itemsCsvUrl||!extrasCsvUrl) return;

  try {
    const [items,extras] = await Promise.all([fetchCSV(itemsCsvUrl),fetchCSV(extrasCsvUrl)]);

    STATE.items = items.map(r=>({
      Seccion:     r.Seccion     || r.Categoria || "",
      Nombre:      r.Nombre      || r.Producto  || "",
      Descripcion: r.Descripcion || "",
      Precio:      r.Precio      || "0",
      Activo:      r.Activo      || r.Disponible|| "Sí",
    })).filter(it=>bool(it.Activo,true));

    STATE.extras = extras.map(r=>({
      Tipo:       r.Tipo||"",
      Nombre:     r.Nombre||"",
      Precio:     r.Precio||"0",
      TipoPrecio: r["Tipo de precio"]||"",
      Activo:     r.Activo||r.Disponible||"Sí",
    }));

  } catch(err) {
    console.error("Error cargando datos:", err);
  }
}

/* ══════════════════════════════════════════
   INIT
   ══════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  initLogin();
});
