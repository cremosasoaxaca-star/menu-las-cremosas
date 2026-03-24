/* ══════════════════════════════════════════
   Las Cremosas — caja.js (integrado)
   Sistema de Caja con roles Empleado / Admin
   Se carga en index.html después de app.js
   ══════════════════════════════════════════ */
"use strict";

(function() {
  // Espera a que el DOM esté listo y los datos del menú cargados
  const CFG = window.MENU_CONFIG || {};

  /* ── Helpers ─────────────────────────── */
  const $c = s => document.querySelector(s);
  const $$c = s => document.querySelectorAll(s);

  function fmtC(n) {
    return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(n)||0);
  }
  function numC(v) {
    return parseFloat(String(v||0).replace(/[$,\s]/g,"").replace(/[^0-9.-]/g,""))||0;
  }
  function boolC(v, def=true) {
    const s = String(v||"").toLowerCase().trim();
    if(!s) return def;
    return ["si","sí","true","1","yes","y"].includes(s)?true:["no","false","0","n"].includes(s)?false:def;
  }
  function todayC() {
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function normDateC(v) {
    if(!v)return"";
    const s=String(v).trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const p=s.split(/[\/-]/);
    if(p.length===3)return p[0].length===4?`${p[0]}-${p[1].padStart(2,"0")}-${p[2].padStart(2,"0")}`:`${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
    return s;
  }
  function genFolioC() {
    const n=(parseInt(localStorage.getItem("cremosas_folio_v2")||"0")+1);
    localStorage.setItem("cremosas_folio_v2",n);
    return String(n).padStart(4,"0");
  }

  /* ── CSV fetch (reutiliza la función global si existe) ── */
  async function fetchCSVC(url) {
    try {
      const r=await fetch(url,{cache:"no-store",mode:"cors"});
      if(r.ok){
        const text=await r.text();
        if(!text.trim().startsWith("<")) return parseCSVC(text);
      }
    } catch {}
    try {
      const r=await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,{cache:"no-store"});
      if(r.ok){const j=await r.json();return parseCSVC(j.contents||"");}
    } catch {}
    return [];
  }

  function parseCSVC(text) {
    if(text.trim().startsWith("<"))return[];
    const rows=[];let cur="",inQ=false,row=[];
    for(let i=0;i<text.length;i++){
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

  /* ── State ─────────────────────────── */
  const CS = {
    role:        null,
    activeRole:  "empleado",
    items:       [],
    extras:      [],
    sales:       [],
    expenses:    [],
    order:       [],
    folio:       "0001",
    modalItem:   null,
    modalQty:    1,
    modalExtras: [],
    activeCat:   "",
  };

  const PIN_EMP   = String(CFG.pinEmpleado || CFG.cajaPin || "1234");
  const PIN_ADMIN = String(CFG.pinAdmin    || "9999");
  let pinBuf = "";

  /* ══ PIN LOGIN ══════════════════════ */
  function initCajaLogin() {
    // Role tabs
    $$c(".crtab").forEach(t => {
      t.addEventListener("click", () => {
        $$c(".crtab").forEach(x=>x.classList.remove("crtab--active"));
        t.classList.add("crtab--active");
        CS.activeRole = t.dataset.role;
        pinBuf=""; updPinC();
        const lbl = $c("#cajaRoleLabel");
        if(lbl) lbl.textContent = CS.activeRole==="admin"?"PIN de administrador":"PIN de empleado";
        $c("#cajaPinError")?.classList.add("hidden");
      });
    });

    $$c(".cpkey").forEach(k => {
      k.addEventListener("click", () => {
        const v=k.dataset.val;
        if(v==="del"){pinBuf=pinBuf.slice(0,-1);updPinC();}
        else if(v==="ok")checkPinC();
        else if(pinBuf.length<8){pinBuf+=v;updPinC();}
      });
    });
  }

  function updPinC() {
    const el=$c("#cajaPinDisplay");
    if(el) el.textContent=pinBuf.length?"●".repeat(pinBuf.length):"· · · ·";
  }

  function checkPinC() {
    const ok=(CS.activeRole==="admin"&&pinBuf===PIN_ADMIN)||(CS.activeRole==="empleado"&&pinBuf===PIN_EMP);
    if(ok){
      CS.role=CS.activeRole; pinBuf="";
      $c("#cajaLogin")?.classList.add("hidden");
      if(CS.role==="empleado"){
        $c("#cajaEmpleado")?.classList.remove("hidden");
        $c("#cajaAdmin")?.classList.add("hidden");
        startEmpleado();
      } else {
        $c("#cajaAdmin")?.classList.remove("hidden");
        $c("#cajaEmpleado")?.classList.add("hidden");
        startAdmin();
      }
    } else {
      pinBuf=""; updPinC();
      const err=$c("#cajaPinError");
      err?.classList.remove("hidden");
      const disp=$c("#cajaPinDisplay");
      disp?.classList.add("shake");
      setTimeout(()=>disp?.classList.remove("shake"),500);
    }
  }

  function logoutC() {
    CS.role=null; CS.order=[]; pinBuf="";
    $c("#cajaLogin")?.classList.remove("hidden");
    $c("#cajaEmpleado")?.classList.add("hidden");
    $c("#cajaAdmin")?.classList.add("hidden");
    updPinC();
  }

  /* ══ EMPLEADO ══════════════════════ */
  function startEmpleado() {
    $c("#empDate").textContent=new Date().toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"});
    CS.folio=genFolioC();
    if($c("#empFolio")) $c("#empFolio").textContent=CS.folio;
    $c("#btnLogoutEmp")?.addEventListener("click",logoutC);
    $c("#empBtnClear")?.addEventListener("click",()=>clearOrderC("emp"));
    $c("#empBtnSave")?.addEventListener("click",()=>saveOrderC("emp"));
    buildCatPillsC("emp");
    buildProdGridC("emp","");
    $c("#empSearch")?.addEventListener("input",e=>buildProdGridC("emp",e.target.value));
  }

  /* ══ ADMIN ═════════════════════════ */
  function startAdmin() {
    if($c("#adminDate")) $c("#adminDate").textContent=new Date().toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"});
    CS.folio=genFolioC();
    if($c("#adminFolio")) $c("#adminFolio").textContent=CS.folio;

    // Usar delegación de eventos en el documento para evitar problemas con elementos ocultos
    document.addEventListener("click", function adminClickHandler(e) {
      const id = e.target.closest("[id]")?.id || e.target.id;
      if(e.target.id==="btnLogoutAdmin"||e.target.closest("#btnLogoutAdmin"))logoutC();
      else if(e.target.id==="adminBtnClear"||e.target.closest("#adminBtnClear"))clearOrderC("admin");
      else if(e.target.id==="adminBtnSave"||e.target.closest("#adminBtnSave"))saveOrderC("admin");
      else if(e.target.id==="btnSaveGasto"||e.target.closest("#btnSaveGasto"))saveGastoC();
      else if(e.target.id==="btnRefreshCorte"||e.target.closest("#btnRefreshCorte")){
        console.log("🔄 Botón Actualizar presionado");
        loadCorteC();
      }
    });

    // Admin tabs
    $$c(".catab").forEach(t=>{
      t.addEventListener("click",()=>{
        $$c(".catab").forEach(x=>x.classList.remove("catab--active"));
        t.classList.add("catab--active");
        const v=t.dataset.view;
        $$c(".cadmin-view").forEach(x=>x.classList.remove("cadmin-view--active"));
        $c(`#cajaAdmin${v[0].toUpperCase()+v.slice(1)}`)?.classList.add("cadmin-view--active");
        if(v==="corte"){
          console.log("📊 Entrando al tab Corte — cargando datos...");
          loadCorteC();
        }
      });
    });

    buildCatPillsC("admin");
    buildProdGridC("admin","");
    $c("#adminSearch")?.addEventListener("input",e=>buildProdGridC("admin",e.target.value));

    // Cargar corte automáticamente al entrar como admin
    setTimeout(()=>{
      console.log("📊 Carga inicial del corte...");
      loadCorteC();
    }, 500);
  }

  /* ══ PRODUCTOS UI ══════════════════ */
  function buildCatPillsC(prefix) {
    const el=$c(`#${prefix}CatPills`);
    if(!el)return;
    el.innerHTML="";

    const allPill=document.createElement("button");
    allPill.className="caja-cat-pill caja-cat-pill--active";
    allPill.textContent="Todos";
    allPill.addEventListener("click",()=>{
      $$c(`#${prefix}CatPills .caja-cat-pill`).forEach(p=>p.classList.remove("caja-cat-pill--active"));
      allPill.classList.add("caja-cat-pill--active");
      CS.activeCat="";
      buildProdGridC(prefix,$c(`#${prefix}Search`)?.value||"");
    });
    el.appendChild(allPill);

    [...new Set(CS.items.map(it=>it.Seccion).filter(Boolean))].forEach(cat=>{
      const pill=document.createElement("button");
      pill.className="caja-cat-pill";
      pill.textContent=cat;
      pill.addEventListener("click",()=>{
        $$c(`#${prefix}CatPills .caja-cat-pill`).forEach(p=>p.classList.remove("caja-cat-pill--active"));
        pill.classList.add("caja-cat-pill--active");
        CS.activeCat=cat;
        buildProdGridC(prefix,$c(`#${prefix}Search`)?.value||"");
      });
      el.appendChild(pill);
    });
  }

  function buildProdGridC(prefix,q) {
    const grid=$c(`#${prefix}ProdGrid`);
    if(!grid)return;
    grid.innerHTML="";
    const qL=q.trim().toLowerCase();

    CS.items.filter(it=>{
      if(!boolC(it.Activo||it.Disponible,true))return false;
      if(CS.activeCat&&it.Seccion!==CS.activeCat)return false;
      if(qL){
        const hay=[it.Nombre,it.Descripcion,it.Seccion].map(x=>String(x||"").toLowerCase()).join(" ");
        return hay.includes(qL);
      }
      return true;
    }).forEach(it=>{
      const p=numC(it.Precio);
      const btn=document.createElement("button");
      btn.className="caja-prod-btn";
      btn.innerHTML=`
        <div class="caja-prod-btn__cat">${it.Seccion||""}</div>
        <div class="caja-prod-btn__name">${it.Nombre}</div>
        ${it.Descripcion?`<div class="caja-prod-btn__desc">${it.Descripcion}</div>`:""}
        <div class="caja-prod-btn__price">${p>0?fmtC(p):"Variable"}</div>
      `;
      btn.addEventListener("click",()=>openModalC(it));
      grid.appendChild(btn);
    });
  }

  /* ══ MODAL ═════════════════════════ */

  // Secciones que SÍ pueden llevar extras (toppings, chocolates, bases)
  const SECCIONES_CON_EXTRAS = ["fresas con crema","fresas especiales","waffles","waffle","waffles"];

  function productoAceptaExtras(item) {
    const sec = String(item.Seccion||item.Categoria||"").toLowerCase()
      .replace(/[áàä]/g,"a").replace(/[éèë]/g,"e")
      .replace(/[íìï]/g,"i").replace(/[óòö]/g,"o").replace(/[úùü]/g,"u").trim();
    // Aceptan extras: Fresas con crema, Fresas especiales, Waffles y Frappes
    return sec.includes("fresas") || sec.includes("waffle") || sec.includes("frappe");
  }

  function openModalC(item) {
    CS.modalItem=item; CS.modalQty=1; CS.modalExtras=[];
    const base=numC(item.Precio);
    if($c("#modalProductName")) $c("#modalProductName").textContent=item.Nombre;
    if($c("#modalProductBase")) $c("#modalProductBase").textContent=`Precio base: ${base>0?fmtC(base):"Variable"}`;
    if($c("#modalQty")) $c("#modalQty").textContent="1";
    if($c("#modalPrice")) $c("#modalPrice").value=base||"";

    const extrasSection=$c("#modalExtrasSection");
    const grid=$c("#modalExtrasGrid");

    // Solo mostrar extras si el producto los acepta
    if(!productoAceptaExtras(item)){
      if(extrasSection) extrasSection.style.display="none";
    } else {
      if(extrasSection) extrasSection.style.display="";
      if(grid){
        grid.innerHTML="";

        // ── Extras con precio FIJO (botones seleccionables) ──
        const fijos=CS.extras.filter(ex=>{
          if(!boolC(ex.Activo||ex.Disponible,true))return false;
          const p=numC(ex.Precio);
          const tp=String(ex.TipoPrecio||"").toLowerCase();
          return p>0&&(tp.includes("fijo")||tp.includes("costo extra")||tp.includes("incluido"));
        });

        if(fijos.length>0){
          const labelFijo=document.createElement("p");
          labelFijo.style.cssText="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ink4);margin-bottom:6px;";
          labelFijo.textContent="Precio fijo";
          grid.appendChild(labelFijo);

          const wrapFijo=document.createElement("div");
          wrapFijo.style.cssText="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;";
          fijos.forEach(ex=>{
            const p=numC(ex.Precio);
            const btn=document.createElement("button");
            btn.className="caja-extra-btn";
            btn.innerHTML=`${ex.Nombre} <span style="opacity:.7;font-size:11px">+${fmtC(p)}</span>`;
            btn.addEventListener("click",()=>{
              const idx=CS.modalExtras.findIndex(e=>e.nombre===ex.Nombre);
              if(idx>=0){CS.modalExtras.splice(idx,1);btn.classList.remove("caja-extra-btn--on");}
              else{CS.modalExtras.push({nombre:ex.Nombre,precio:p});btn.classList.add("caja-extra-btn--on");}
              recalcModalC();
            });
            wrapFijo.appendChild(btn);
          });
          grid.appendChild(wrapFijo);
        }

        // ── Extras con precio VARIABLE (el encargado escribe el precio) ──
        const variables=CS.extras.filter(ex=>{
          if(!boolC(ex.Activo||ex.Disponible,true))return false;
          const tp=String(ex.TipoPrecio||"").toLowerCase();
          const p=numC(ex.Precio);
          return p===0&&(tp.includes("variable")||tp.includes("costo variable"));
        });

        if(variables.length>0){
          const labelVar=document.createElement("p");
          labelVar.style.cssText="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ink4);margin-bottom:6px;";
          labelVar.textContent="Costo variable (escribe el precio)";
          grid.appendChild(labelVar);

          variables.forEach(ex=>{
            const row=document.createElement("div");
            row.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:8px;";

            const toggle=document.createElement("button");
            toggle.className="caja-extra-btn";
            toggle.style.flexShrink="0";
            toggle.textContent=ex.Nombre;

            const priceIn=document.createElement("input");
            priceIn.type="number";
            priceIn.min="0";
            priceIn.placeholder="$ precio";
            priceIn.style.cssText="width:90px;padding:6px 10px;border:1.5px solid var(--line);border-radius:10px;font-size:13px;font-weight:700;outline:none;";
            priceIn.disabled=true;

            toggle.addEventListener("click",()=>{
              const idx=CS.modalExtras.findIndex(e=>e.nombre===ex.Nombre);
              if(idx>=0){
                CS.modalExtras.splice(idx,1);
                toggle.classList.remove("caja-extra-btn--on");
                priceIn.disabled=true; priceIn.value="";
              } else {
                const p=numC(priceIn.value)||0;
                CS.modalExtras.push({nombre:ex.Nombre,precio:p,variable:true,inputRef:priceIn});
                toggle.classList.add("caja-extra-btn--on");
                priceIn.disabled=false; priceIn.focus();
              }
              recalcModalC();
            });

            priceIn.addEventListener("input",()=>{
              const idx=CS.modalExtras.findIndex(e=>e.nombre===ex.Nombre);
              if(idx>=0){
                CS.modalExtras[idx].precio=numC(priceIn.value)||0;
                recalcModalC();
              }
            });

            row.appendChild(toggle);
            row.appendChild(priceIn);
            grid.appendChild(row);
          });
        }

        // Si no hay ningún extra disponible
        if(fijos.length===0&&variables.length===0){
          grid.innerHTML=`<p style="font-size:13px;color:var(--ink4)">Sin extras disponibles para este producto.</p>`;
        }
      }
    }

    const priceInput=$c("#modalPrice");
    if(priceInput) priceInput.oninput=recalcModalC;

    $c("#btnQtyMinus").onclick=()=>{if(CS.modalQty>1){CS.modalQty--;if($c("#modalQty"))$c("#modalQty").textContent=CS.modalQty;recalcModalC();}};
    $c("#btnQtyPlus").onclick=()=>{CS.modalQty++;if($c("#modalQty"))$c("#modalQty").textContent=CS.modalQty;recalcModalC();};
    $c("#btnAddToOrder").onclick=addToOrderC;
    $c("#btnModalClose").onclick=closeModalC;
    $c("#modalItem").onclick=e=>{if(e.target===$c("#modalItem"))closeModalC();};

    recalcModalC();
    $c("#modalItem")?.classList.remove("hidden");
  }

  function recalcModalC() {
    const base=numC(CS.modalItem?.Precio||0);
    const extrasSum=CS.modalExtras.reduce((a,e)=>a+e.precio,0);
    const priceInput=$c("#modalPrice");
    // Solo actualizar el precio automáticamente si hay extras fijos seleccionados
    const tieneExtrasFijos=CS.modalExtras.some(e=>!e.variable);
    if(priceInput&&tieneExtrasFijos) priceInput.value=base+extrasSum;
    const unit=numC(priceInput?.value||0);
    const sub=unit*CS.modalQty;
    if($c("#modalSubtotal")) $c("#modalSubtotal").textContent=fmtC(sub);
  }

  function closeModalC() {
    $c("#modalItem")?.classList.add("hidden");
    CS.modalItem=null; CS.modalExtras=[];
  }

  function addToOrderC() {
    if(!CS.modalItem)return;
    const precio=numC($c("#modalPrice")?.value||0);
    const qty=CS.modalQty;
    const extras=[...CS.modalExtras];
    CS.order.push({
      id:Date.now(),
      nombre:CS.modalItem.Nombre,
      seccion:CS.modalItem.Seccion||"",
      cantidad:qty, precio, extras,
      subtotal:precio*qty,
    });
    closeModalC();
    renderOrderC();
  }

  /* ══ ORDEN ═════════════════════════ */
  function renderOrderC() {
    const isAdmin=CS.role==="admin";
    const itemsEl=isAdmin?$c("#adminOrderItems"):$c("#empOrderItems");
    const totalEl=isAdmin?$c("#adminOrderTotal"):$c("#empOrderTotal");
    if(!itemsEl)return;

    itemsEl.innerHTML="";
    if(CS.order.length===0){
      const d=document.createElement("div");
      d.className="caja-order-empty";
      d.textContent="Agrega productos para empezar";
      itemsEl.appendChild(d);
      if(totalEl)totalEl.textContent="$0.00";
      return;
    }

    let total=0;
    CS.order.forEach(it=>{
      total+=it.subtotal;
      const extrasStr=it.extras.map(e=>`${e.nombre} +${fmtC(e.precio)}`).join(", ");
      const row=document.createElement("div");
      row.className="caja-order-item";
      row.innerHTML=`
        <div class="caja-order-item__info">
          <div class="caja-order-item__name">${it.nombre}</div>
          ${extrasStr?`<div class="caja-order-item__extras">+ ${extrasStr}</div>`:""}
          <div class="caja-order-item__qty">${it.cantidad>1?`${it.cantidad}× `:""}${fmtC(it.precio)}</div>
        </div>
        <div class="caja-order-item__price">${fmtC(it.subtotal)}</div>
        <button class="caja-order-item__del" data-id="${it.id}">×</button>
      `;
      row.querySelector(".caja-order-item__del").addEventListener("click",()=>{
        CS.order=CS.order.filter(x=>x.id!==it.id); renderOrderC();
      });
      itemsEl.appendChild(row);
    });
    if(totalEl)totalEl.textContent=fmtC(total);
  }

  function clearOrderC(prefix) { CS.order=[]; renderOrderC(); }

  /* ══ GUARDAR VENTA ═════════════════ */
  async function saveOrderC(prefix) {
    if(CS.order.length===0){showToastC("Agrega al menos un producto","error",prefix);return;}
    const isAdmin=prefix==="admin";
    const notesEl=isAdmin?$c("#adminNotes"):$c("#empNotes");
    const notas=notesEl?.value.trim()||"";
    const total=CS.order.reduce((a,it)=>a+it.subtotal,0);
    const folio=CS.folio;
    const encargado=CS.role==="admin"?"Admin":"Encargado";

    const payload={action:"saveSale",data:{
      folio,encargado,notas,total,
      items:CS.order.map(it=>({
        producto:it.nombre,cantidad:it.cantidad,
        precio:it.precio,extras:it.extras.map(e=>e.nombre).join(", "),
        subtotal:it.subtotal,
      }))
    }};

    const btn=isAdmin?$c("#adminBtnSave"):$c("#empBtnSave");
    if(btn){btn.disabled=true;btn.innerHTML=`<span class="caja-spinner"></span> Guardando…`;}

    try {
      await apiPostC(payload);
      showToastC("✅ Venta guardada correctamente","success",prefix);
      CS.order=[]; renderOrderC();
      if(notesEl)notesEl.value="";
      CS.folio=genFolioC();
      const fEl=isAdmin?$c("#adminFolio"):$c("#empFolio");
      if(fEl)fEl.textContent=CS.folio;
    } catch(err){
      showToastC("❌ "+(err.message||"Error al guardar"),"error",prefix);
    } finally {
      if(btn){btn.disabled=false;btn.innerHTML="✓ Guardar venta";}
    }
  }

  /* ══ GUARDAR GASTO ═════════════════ */
  async function saveGastoC() {
    const concepto=$c("#gConcepto")?.value.trim();
    const catRaw=$c("#gCategoria")?.value.trim();
    const categoria=catRaw.replace(/^[^\s]+\s/,"");
    const monto=numC($c("#gMonto")?.value);
    const encargado=$c("#gEncargado")?.value.trim()||"Admin";
    const notas=$c("#gNotas")?.value.trim()||"";

    if(!concepto||!catRaw||monto<=0){showToastC("Completa todos los campos","error","admin");return;}

    const btn=$c("#btnSaveGasto");
    if(btn){btn.disabled=true;btn.innerHTML=`<span class="caja-spinner"></span> Guardando…`;}

    try {
      await apiPostC({action:"saveExpense",data:{concepto,categoria,monto,encargado,notas}});
      showToastC("✅ Gasto guardado","success","admin");
      ["gConcepto","gMonto","gEncargado","gNotas"].forEach(id=>{const e=$c(`#${id}`);if(e)e.value="";});
      if($c("#gCategoria"))$c("#gCategoria").selectedIndex=0;
    } catch(err){
      showToastC("❌ "+(err.message||"Error"),"error","admin");
    } finally {
      if(btn){btn.disabled=false;btn.innerHTML="Guardar gasto";}
    }
  }

  /* ══ CORTE ═════════════════════════ */
  async function loadCorteC() {
    const btn=$c("#btnRefreshCorte");
    if(btn){btn.disabled=true;btn.textContent="Cargando…";}
    try {
      const {ventasCsvUrl,gastosCsvUrl}=CFG.sheets||{};
      if(!ventasCsvUrl||!gastosCsvUrl) throw new Error("Faltan URLs de ventas/gastos en config.js");

      console.log("🔄 Cargando corte...");
      console.log("📊 ventasCsvUrl:", ventasCsvUrl);
      console.log("📊 gastosCsvUrl:", gastosCsvUrl);

      const [sales,expenses]=await Promise.all([fetchCSVC(ventasCsvUrl),fetchCSVC(gastosCsvUrl)]);

      console.log(`✅ Ventas cargadas: ${sales.length} filas`);
      console.log(`✅ Gastos cargados: ${expenses.length} filas`);
      if(sales.length>0) console.log("📋 Columnas ventas:", Object.keys(sales[0]));
      if(expenses.length>0) console.log("📋 Columnas gastos:", Object.keys(expenses[0]));
      if(sales.length>0) console.log("📄 Primera venta:", sales[0]);

      CS.sales=sales.map(r=>({
        fecha:    r.fecha     || r.Fecha     || "",
        hora:     r.hora      || r.Hora      || "",
        producto: r.producto  || r.Producto  || "",
        cantidad: numC(r.cantidad || r.Cantidad || 1),
        precio:   numC(r.precio_unitario || r.precio || r.Precio || 0),
        extras:   r.extras    || "",
        total:    numC(r.total || r.Total || 0),
        encargado:r.encargado || r.Encargado || "",
        notas:    r.notas     || r.Notas     || "",
        folio:    r.folio     || r.Folio     || "",
      }));

      CS.expenses=expenses.map(r=>({
        fecha:    r.fecha     || r.Fecha     || "",
        hora:     r.hora      || r.Hora      || "",
        concepto: r.concepto  || r.Concepto  || "",
        categoria:r.categoria || r.Categoria || "",
        monto:    numC(r.monto || r.Monto || 0),
        encargado:r.encargado || r.Encargado || "",
        notas:    r.notas     || r.Notas     || "",
      }));

      const hoy = todayC();
      console.log("📅 Hoy:", hoy);
      console.log("📅 Fechas en ventas:", CS.sales.map(s=>s.fecha));
      console.log("📅 Ventas de hoy:", CS.sales.filter(s=>normDateC(s.fecha)===hoy).length);

      buildCorteC();
    } catch(err){
      console.error("❌ Error en corte:", err);
      showToastC("Error al cargar corte: "+err.message,"error","admin");
    } finally {
      if(btn){btn.disabled=false;btn.textContent="↻ Actualizar";}
    }
  }

  function buildCorteC() {
    const td=todayC();
    const sales=CS.sales.filter(s=>normDateC(s.fecha)===td);
    const expenses=CS.expenses.filter(e=>normDateC(e.fecha)===td);

    // Cada fila del sheet es un producto vendido — sumar todos los totales del día
    const totalVentas = sales.reduce((a,s) => a + s.total, 0);
    const totalGastos = expenses.reduce((a,e) => a + e.monto, 0);
    const utilidad    = totalVentas - totalGastos;
    const numVentas   = sales.length;
    const ticket      = numVentas > 0 ? totalVentas / numVentas : 0;

    // KPIs
    const set=(id,v)=>{const e=$c(id);if(e)e.textContent=v;};
    set("#kpiVentas",fmtC(totalVentas));
    set("#kpiGastos",fmtC(totalGastos));
    set("#kpiUtilidad",fmtC(utilidad));
    set("#kpiVentasCount",`${numVentas} venta${numVentas!==1?"s":""}`);
    set("#kpiTicket",fmtC(ticket));
    const ku=$c("#kpiUtilidad");
    if(ku)ku.style.color=utilidad>=0?"#16a34a":"var(--rose)";

    // Top productos
    const grouped={};
    sales.forEach(s=>{
      const n=s.producto||"?";
      if(!grouped[n])grouped[n]={qty:0,total:0};
      grouped[n].qty   += numC(s.cantidad)||1;
      grouped[n].total += s.total||0;
    });
    const sorted=Object.entries(grouped).sort((a,b)=>b[1].qty-a[1].qty);
    const topEl=$c("#topProductos");
    if(topEl){
      topEl.innerHTML="";
      if(!sorted.length){topEl.innerHTML=`<p class="caja-empty-msg">Sin ventas hoy.</p>`;}
      else{
        const medals=["🥇","🥈","🥉"];
        sorted.slice(0,8).forEach(([name,d],i)=>{
          const row=document.createElement("div");
          row.className="caja-rank-row";
          row.innerHTML=`<span class="caja-rank-pos">${medals[i]||i+1}</span><span class="caja-rank-name">${name}</span><span class="caja-rank-qty">${d.qty} uds.</span><span class="caja-rank-total">${fmtC(d.total)}</span>`;
          topEl.appendChild(row);
        });
      }
    }

    // Lista ventas
    const ventasEl=$c("#listaVentas");
    if(ventasEl){
      ventasEl.innerHTML="";
      if(!sales.length){ventasEl.innerHTML=`<p class="caja-empty-msg">Sin ventas.</p>`;}
      else sales.slice().reverse().forEach(s=>{
        const row=document.createElement("div");
        row.className="caja-txn-row";
        row.innerHTML=`<span class="caja-txn-time">${s.hora?s.hora.slice(0,5):""}</span><span class="caja-txn-name">${s.producto||"?"}</span><span class="caja-txn-extras">${s.notas||""}</span><span class="caja-txn-amount">${fmtC(s.total||0)}</span><span class="caja-txn-enc">${s.encargado||""}</span>`;
        ventasEl.appendChild(row);
      });
    }

    // Lista gastos
    const gastosEl=$c("#listaGastos");
    if(gastosEl){
      gastosEl.innerHTML="";
      if(!expenses.length){gastosEl.innerHTML=`<p class="caja-empty-msg">Sin gastos.</p>`;}
      else expenses.slice().reverse().forEach(g=>{
        const row=document.createElement("div");
        row.className="caja-txn-row";
        row.innerHTML=`<span class="caja-txn-time">${g.hora?g.hora.slice(0,5):""}</span><span class="caja-txn-name">${g.concepto||"?"} <small style="color:var(--ink4)">${g.categoria||""}</small></span><span class="caja-txn-extras">${g.notas||""}</span><span class="caja-txn-amount">${fmtC(g.monto)}</span><span class="caja-txn-enc">${g.encargado||""}</span>`;
        gastosEl.appendChild(row);
      });
    }
  }

  /* ══ API POST ══════════════════════ */
  async function apiPostC(payload) {
    const url=CFG.api?.saveUrl||"";
    if(!url||url.includes("PEGA"))throw new Error("Configura saveUrl en config.js");
    try {
      const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),mode:"cors"});
      const t=await r.text();
      const d=JSON.parse(t);
      if(d.ok)return d;
    } catch {}
    const form=new FormData();
    form.append("payload",JSON.stringify(payload));
    await fetch(url,{method:"POST",body:form,mode:"no-cors"});
    return{ok:true};
  }

  /* ══ TOAST ═════════════════════════ */
  function showToastC(msg,type="success",prefix="emp") {
    const id=prefix==="admin"?"adminToast":"empToast";
    const el=$c(`#${id}`);
    if(!el)return;
    el.textContent=msg;
    el.className=`caja-toast caja-toast--${type}`;
    el.classList.remove("hidden");
    clearTimeout(el._t);
    el._t=setTimeout(()=>el.classList.add("hidden"),3500);
  }

  /* ══ CARGAR DATOS Y ARRANCAR ═══════ */
  async function initCaja() {
    // Esperar a que los datos del menú estén disponibles (cargados por app.js)
    let retries=0;
    while(retries<20){
      // app.js guarda los items en window.S o en el state global
      // Intentamos acceder a los datos
      if(window._cajaItems && window._cajaItems.length>0){
        CS.items  = window._cajaItems;
        CS.extras = window._cajaExtras||[];
        break;
      }
      await new Promise(r=>setTimeout(r,300));
      retries++;
    }

    // Si no llegaron por window, los cargamos directamente
    if(CS.items.length===0){
      const {itemsCsvUrl,extrasCsvUrl}=CFG.sheets||{};
      if(itemsCsvUrl&&extrasCsvUrl){
        try{
          const [items,extras]=await Promise.all([fetchCSVC(itemsCsvUrl),fetchCSVC(extrasCsvUrl)]);
          CS.items=items.map(r=>({
            Seccion:r.Seccion||r.Categoria||"",
            Nombre:r.Nombre||r.Producto||"",
            Descripcion:r.Descripcion||"",
            Precio:r.Precio||"0",
            Activo:r.Activo||r.Disponible||"Sí",
          })).filter(it=>boolC(it.Activo,true));
          CS.extras=extras.map(r=>({
            Tipo:r.Tipo||"",
            Nombre:r.Nombre||"",
            Precio:r.Precio||"0",
            TipoPrecio:r["Tipo de precio"]||"",
            Activo:r.Activo||r.Disponible||"Sí",
          }));
        }catch(e){console.error("Caja: error cargando datos",e);}
      }
    }

    initCajaLogin();
  }

  // Arrancar cuando el DOM esté listo
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",initCaja);
  } else {
    initCaja();
  }

  // Exponer función para que app.js comparta los datos
  window._setCajaData = function(items, extras) {
    CS.items  = items;
    CS.extras = extras;
  };

})();
