/**
 * 🌊 WAVE 2 OUTREACH — Hozzáadás az Outreach_Pipeline tabhoz
 * ==============================================================
 * HASZNÁLAT:
 *   1. Google Sheets → Extensions → Apps Script
 *   2. Másold be ezt a kódot egy új fájlba (pl. wave2_addon.gs)
 *   3. Futtasd: addWave2ToOutreachPipeline()
 *   4. Ellenőrizd a 🎯 Outreach_Pipeline tabot — 15 új sor megjelent
 *
 * FIGYELEM: Csak egyszer fusd le! Duplikáció elkerülése végett
 *           ellenőrzi, hogy "Webdesign.hu" már szerepel-e a listában.
 */

function addWave2ToOutreachPipeline() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('🎯 Outreach_Pipeline');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ Nem találom a 🎯 Outreach_Pipeline tabot! Futtasd előbb az inicializalLeadIntelligence() funkciót.');
    return;
  }

  // Duplikáció ellenőrzés
  var existing = sheet.getRange('B2:B200').getValues().flat().map(String);
  if (existing.indexOf('Webdesign.hu') > -1) {
    SpreadsheetApp.getUi().alert('⚠️ Wave 2 már hozzá lett adva! (Webdesign.hu már szerepel a listában)');
    return;
  }

  // Wave 2 adatok — 15 kontakt
  var wave2 = [
    // Webdesign kategória
    [11, 'Webdesign.hu',       'webdesign.hu',         'info@webdesign.hu',         'Webdesign (prémium)', 'Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — Webdesign'],
    [12, '2B Digital',         '2bdigital.hu',          'hello@2bdigital.hu',         'Digitális ügynökség','Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — Webdesign'],
    [13, 'WEBerfolg',          'weberfolg.hu',          'info@weberfolg.hu',          'KKV webdesign',      'Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — Webdesign'],
    [14, 'Netfoglalo',         'netfoglalo.hu',         'info@netfoglalo.hu',         'Web + foglalórendszer','Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — Webdesign'],
    [15, 'Progresszív Studio', 'progressziv.hu',        'info@progressziv.hu',        'Modern weboldalak',  'Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — Webdesign'],
    // SEO/PPC kategória
    [16, 'Ranking.hu',         'ranking.hu',            'hello@ranking.hu',           'Keresőoptimalizálás','Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — SEO/PPC'],
    [17, 'Growww Digital',     'growww.hu',             'hello@growww.hu',            'Performance marketing','Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — SEO/PPC'],
    [18, 'Adsolutions',        'adsolutions.hu',        'info@adsolutions.hu',        'Google Ads',         'Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — SEO/PPC'],
    [19, 'Klixio',             'klixio.hu',             'hello@klixio.hu',            'PPC + SEO',          'Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — SEO/PPC'],
    [20, 'iSEO',               'iseo.hu',               'info@iseo.hu',               'SEO szakértők',      'Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — SEO/PPC'],
    // PR kategória
    [21, 'PR Herald',          'prherald.hu',           'info@prherald.hu',           'PR + kommunikáció',  'Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — PR'],
    [22, 'Kreativ PR',         'kreativpr.hu',          'hello@kreativpr.hu',         'Kreatív PR',         'Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — PR'],
    [23, 'Meditor',            'meditor.hu',            'info@meditor.hu',            'Médiakapcsolatok',   'Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — PR'],
    [24, 'BIG',                'big.hu',                'info@big.hu',                'Integrated komm.',   'Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — PR'],
    [25, 'Pulse Communications','pulse.hu',             'hello@pulse.hu',             'Digital PR',         'Fogorvosok (50)', 50, '2026-02-27', '', '', '🔵 Várjuk', '', 'Wave 2 — PR'],
  ];

  // Hozzáfűzés az utolsó sor után
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, wave2.length, wave2[0].length).setValues(wave2);

  // Zebra csíkozás az új sorokra
  for (var r = lastRow + 1; r <= lastRow + wave2.length; r++) {
    sheet.getRange(r, 1, 1, wave2[0].length)
      .setBackground(r % 2 === 0 ? '#e8f5e9' : '#ffffff');
  }

  // Wave 2 szekció vizuális elválasztó — a 11. sor (első Wave 2) felső kerettel
  sheet.getRange(lastRow + 1, 1, 1, wave2[0].length)
    .setBorder(true, false, false, false, false, false, '#1b5e20', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Wave 2 kategória jelölők
  var categories = {11: 'Webdesign', 16: 'SEO/PPC', 21: 'PR'};
  Object.keys(categories).forEach(function(rowNum) {
    var sheetRow = lastRow + (parseInt(rowNum) - 10);
    sheet.getRange(sheetRow, 1, 1, wave2[0].length)
      .setBackground('#fff3e0');  // narancssárga háttér kategória-kezdő soroknak
  });

  // Dashboard frissítése — Wave 2 küldési dátum megjegyzés
  var dashSheet = ss.getSheetByName('📈 Dashboard');
  if (dashSheet) {
    var lastDashRow = dashSheet.getLastRow();
    dashSheet.getRange(lastDashRow + 2, 1).setValue('🌊 Wave 2 kiküldve');
    dashSheet.getRange(lastDashRow + 2, 2).setValue('2026-02-27 — 15 kontakt (Webdesign + SEO/PPC + PR)');
    dashSheet.getRange(lastDashRow + 2, 1, 1, 2)
      .setBackground('#fff8e1')
      .setFontWeight('bold');
  }

  SpreadsheetApp.getUi().alert(
    '✅ Wave 2 sikeresen hozzáadva!\n\n' +
    '15 új kontakt a 🎯 Outreach_Pipeline tabban:\n' +
    '  • 5 Webdesign stúdió (#11-15)\n' +
    '  • 5 SEO/PPC ügynökség (#16-20)\n' +
    '  • 5 PR iroda (#21-25)\n\n' +
    'Email küldési dátum: 2026-02-27\n' +
    'Státusz: 🔵 Várjuk\n\n' +
    'Pro tip: A Deal státusz oszlopban (K) kövessed a válaszokat!'
  );

  Logger.log('✅ Wave 2 (15 kontakt) hozzáadva az Outreach_Pipeline tabhoz');
}
