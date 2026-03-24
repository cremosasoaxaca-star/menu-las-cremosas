/* ═══════════════════════════════════════════
   Las Cremosas — config.js
   ⚠️  Cambia el PIN antes de publicar.
   ═══════════════════════════════════════════ */

window.MENU_CONFIG = {
  businessName: "Las Cremosas",
  currency: "MXN",

  // PIN de acceso a la caja (solo números, cámbialo!)
  cajaPin: "1234",

  // WhatsApp — número sin + ni espacios
  whatsappPhoneE164: "529515903045",

  sheets: {
    // DATA_ITEMS publicada como CSV
    itemsCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vROnrnQup5_8IsgYh-Rk7Ahpo8ZZc-OuwIls2thA2q_vBAxzcygRjS4o38OnTdnzkR5EHSojXzWR2sn/pub?gid=1404487164&single=true&output=csv",
    // DATA_EXTRAS publicada como CSV
    extrasCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vROnrnQup5_8IsgYh-Rk7Ahpo8ZZc-OuwIls2thA2q_vBAxzcygRjS4o38OnTdnzkR5EHSojXzWR2sn/pub?gid=247763859&single=true&output=csv",
    // VENTAS publicada como CSV
    ventasCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlmkezaBxVTEe__UnUkc2oej9904R3a8MoH6wzyOtCA44XPnWycL71wh__DNtFqQ/pub?gid=413264831&single=true&output=csv",
    // GASTOS publicada como CSV
    gastosCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlmkezaBxVTEe__UnUkc2oej9904R3a8MoH6wzyOtCA44XPnWycL71wh__DNtFqQ/pub?gid=545924440&single=true&output=csv",
  },

  api: {
    // URL del Google Apps Script (guarda ventas y gastos)
    saveUrl: "https://script.google.com/macros/s/AKfycbxr1xkW5r6fbj1aazhOcfRD2IGk81CdAnIaE20ldOTCFIGhF7pP4O0BrzXEvoa4qxtS5A/exec",
  },
};
