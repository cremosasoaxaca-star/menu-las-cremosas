/* =============================================
   Las Cremosas — config.js
   Edita aquí la configuración del negocio.
   ============================================= */

window.MENU_CONFIG = {
  businessName: "Las Cremosas",
  currency: "MXN",

  // Número de WhatsApp en formato E.164 (sin + ni espacios)
  whatsappPhoneE164: "529515903045",

  sheets: {
    // Hoja de productos (DATA_ITEMS publicada como CSV)
    itemsCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vROnrnQup5_8IsgYh-Rk7Ahpo8ZZc-OuwIls2thA2q_vBAxzcygRjS4o38OnTdnzkR5EHSojXzWR2sn/pub?gid=1404487164&single=true&output=csv",

    // Hoja de extras / toppings (DATA_EXTRAS publicada como CSV)
    extrasCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vROnrnQup5_8IsgYh-Rk7Ahpo8ZZc-OuwIls2thA2q_vBAxzcygRjS4o38OnTdnzkR5EHSojXzWR2sn/pub?gid=247763859&single=true&output=csv",

    // Hoja de ventas (para el corte del día)
    ventasCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlmkezaBxVTEe__UnUkc2oej9904R3a8MoH6wzyOtCA44XPnWycL71wh__DNtFqQ/pub?gid=413264831&single=true&output=csv",

    // Hoja de gastos (para el corte del día)
    gastosCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlmkezaBxVTEe__UnUkc2oej9904R3a8MoH6wzyOtCA44XPnWycL71wh__DNtFqQ/pub?gid=545924440&single=true&output=csv",
  },

  api: {
    // URL del Google Apps Script desplegado como webapp
    saveUrl: "https://script.google.com/macros/s/AKfycbxr1xkW5r6fbj1aazhOcfRD2IGk81CdAnIaE20ldOTCFIGhF7pP4O0BrzXEvoa4qxtS5A/exec",
  },
};
