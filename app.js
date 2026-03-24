// ═══════════════════════════════════════════════════
// Las Cremosas — Google Apps Script
// Pega este código en script.google.com
// Despliega como: "Aplicación web" → acceso "Cualquiera"
// ═══════════════════════════════════════════════════

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doPost(e) {
  // Headers CORS para permitir requests desde cualquier origen
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  try {
    // Acepta tanto JSON directo como FormData (payload field)
    let payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e.parameter && e.parameter.payload) {
      payload = JSON.parse(e.parameter.payload);
    } else {
      throw new Error("Sin datos recibidos");
    }

    const { action, data } = payload;

    if (action === "saveSale") {
      guardarVenta(data);
    } else if (action === "saveExpense") {
      guardarGasto(data);
    } else {
      throw new Error("Acción desconocida: " + action);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, message: "Guardado correctamente" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Necesario para preflight OPTIONS requests (CORS)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, status: "Las Cremosas API activa" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function guardarVenta(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("VENTAS");
  if (!hoja) throw new Error("No existe la hoja 'VENTAS'");

  const ahora = new Date();
  const fecha = Utilities.formatDate(ahora, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const hora  = Utilities.formatDate(ahora, Session.getScriptTimeZone(), "HH:mm:ss");

  hoja.appendRow([
    fecha,
    hora,
    data.producto    || "",
    data.cantidad    || 0,
    data.precio_unitario || 0,
    data.total       || 0,
    data.encargado   || "",
    data.notas       || ""
  ]);
}

function guardarGasto(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("GASTOS");
  if (!hoja) throw new Error("No existe la hoja 'GASTOS'");

  const ahora = new Date();
  const fecha = Utilities.formatDate(ahora, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const hora  = Utilities.formatDate(ahora, Session.getScriptTimeZone(), "HH:mm:ss");

  hoja.appendRow([
    fecha,
    hora,
    data.concepto    || "",
    data.categoria   || "",
    data.monto       || 0,
    data.encargado   || "",
    data.notas       || ""
  ]);
}
