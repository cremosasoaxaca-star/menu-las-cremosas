/* ══════════════════════════════════════════
   Las Cremosas — config.js
   ⚠️  Cambia cajaPin antes de publicar.
   ══════════════════════════════════════════ */
window.MENU_CONFIG = {
  businessName:       "Las Cremosas",
  currency:           "MXN",
  cajaPin:            "1234",          // ← PIN legacy (no se usa)
  pinEmpleado:        "1111",          // ← PIN del empleado (cámbialo)
  pinAdmin:           "9999",          // ← PIN del administrador (cámbialo)
  whatsappPhoneE164:  "529515903045",

  sheets: {
    // DATA_ITEMS publicada como CSV
    itemsCsvUrl:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQy9JZRyJK6kXrlBHcKonNTZ3DKs1Di5eGWtCT6GX4cndxtciJLobWVFgMmRSN3bfTYCdEhihfLgWz6/pub?gid=1994052921&single=true&output=csv",
    // DATA_EXTRAS publicada como CSV
    extrasCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQy9JZRyJK6kXrlBHcKonNTZ3DKs1Di5eGWtCT6GX4cndxtciJLobWVFgMmRSN3bfTYCdEhihfLgWz6/pub?gid=105109292&single=true&output=csv",
    // VENTAS publicada como CSV
    ventasCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlmkezaBxVTEe__UnUkc2oej9904R3a8MoH6wzyOtCA44XPnWycL71wh__DNtFqQ/pub?gid=413264831&single=true&output=csv",
    // GASTOS publicada como CSV
    gastosCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlmkezaBxVTEe__UnUkc2oej9904R3a8MoH6wzyOtCA44XPnWycL71wh__DNtFqQ/pub?gid=545924440&single=true&output=csv",
  },

  api: {
    // URL del Google Apps Script — actualiza cuando lo crees
    saveUrl: "https://script.google.com/macros/s/AKfycbyrA6lfAq07XtZ8WWUg09tMbrYzPUex_xuzbKcKFNUH3UkogHVQwiGx5cNY4YPIVvwXvA/exec",
  },
};
