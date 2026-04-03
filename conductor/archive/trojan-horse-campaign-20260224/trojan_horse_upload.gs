/**
 * 🚀 BRUNELLA — Trójai Faló Kampány Feltöltő
 * =============================================
 * Google Sheets Apps Script — semmi telepítés, semmi OAuth!
 *
 * HASZNÁLAT (3 lépés):
 *   1. Nyisd meg: https://docs.google.com/spreadsheets/d/1Ja4sdeHs9mSJGJrPhwjnrUr2jNbcR63tJtH34qfHfLY
 *   2. Felső menü: Extensions → Apps Script
 *   3. Töröld az alapkódot, illeszd be ezt, majd kattints: ▶ Run → feltoltMindenAdatot
 *
 * Eredmény:
 *   ✅ "Fogorvosok" tab — 50 budapesti fogorvos
 *   ✅ "Ügynökségek" tab — 8 marketing ügynökség
 *   ✅ "Campaign_Tracking" tab — státusz dashboard
 */

// ============================================================================
// FŐFÜGGVÉNY — EZT KATTINTSD "RUN"-RA
// ============================================================================

function feltoltMindenAdatot() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date().toLocaleString('hu-HU');

  Logger.log('🚀 Feltöltés kezdődik...');

  // Tabok létrehozása / törlése
  var tabFogorvos = getOrCreateSheet(ss, 'Fogorvosok');
  var tabUgynokseg = getOrCreateSheet(ss, 'Ügynökségek');
  var tabTracking = getOrCreateSheet(ss, 'Campaign_Tracking');

  // Alapértelmezett "Sheet1" törlése ha van
  var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Munka1') || ss.getSheetByName('1. lap');
  if (defaultSheet) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }

  // Adatok feltöltése
  feltoltFogorvosok(tabFogorvos);
  feltoltUgynoksegek(tabUgynokseg);
  feltoltTracking(tabTracking, now);

  // Befejezés
  SpreadsheetApp.getUi().alert(
    '🎉 KÉSZ!\n\n' +
    '✅ Fogorvosok: 50 sor feltöltve\n' +
    '✅ Ügynökségek: 8 sor feltöltve\n' +
    '✅ Campaign Tracking: Dashboard kész\n\n' +
    'Frissítsd az oldalt ha nem látod azonnal!'
  );

  Logger.log('✅ Feltöltés befejezve: ' + now);
}

// ============================================================================
// HELPER — TAB LÉTREHOZÁS/TÖRLÉS
// ============================================================================

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) {
    sheet.clearContents();
    sheet.clearFormats();
    Logger.log('♻️  Tab törölve/újra: ' + name);
  } else {
    sheet = ss.insertSheet(name);
    Logger.log('✅ Tab létrehozva: ' + name);
  }
  return sheet;
}

// ============================================================================
// 1. FOGORVOSOK TAB
// ============================================================================

function feltoltFogorvosok(sheet) {
  // Fejléc
  var headers = ['#', 'Cégnév', 'Telefon', 'Weboldal', 'Cím', 'Email', 'Status', 'Megjegyzés'];

  // Adatok (Cégnév | Telefon | Weboldal | Cím | Email)
  var data = [
    ['Uniklinik Fogászati és Implantációs Központ Kft.', '+36 1 222 9150', 'uniklinik.hu', 'XIV. kerület', ''],
    ['Örs Klinika Fogászati és Szájsebészeti Kft.', '+36 30 870 2393', 'orsklinika.hu', 'XIV. kerület', 'recepcio@orsklinika.hu'],
    ['Evidental Fogászati Központ', '+36 30 954 5616', '', 'XI. kerület', ''],
    ['Implantix - Szájsebészet és Fogászat', '+36 30 316 1029', '', 'XIII. kerület', ''],
    ['Dr. Fenyő Attila fogorvos', '+36 1 910 5863', '', 'X. kerület', ''],
    ['Differental Fogorvosi Rendelő', '+36 30 960 5255', '', 'I. kerület', ''],
    ['Pintér Kálmán Szakrendelő', '+36 1 297 2060', '', 'XVIII. kerület', ''],
    ['Kisfaludy Dental Fogászat', '+36 20 216 8638', '', 'XIX. kerület', ''],
    ['Madárfogtechnika', '+36 30 962 0884', '', 'XIX. kerület', ''],
    ['Dr. Dálnoki Olga - Kozmetológus főorvos', '+36 30 915 0293', '', 'XVIII. kerület', ''],
    ['Dental Center Fogorvosi Rendelő', '+36 1 266 1611', '', 'V. kerület', ''],
    ['Fog-Ász Kft - Tooth Pro Budapest', '+36 1 338 3233', '', 'V. kerület', ''],
    ['Béke téri Egészségügyi Szolgáltató Kft.', '+36 1 294 6337', '', 'XVIII. kerület', ''],
    ['Mia-Manó Rendelő', '+36 1 604 1262', '', 'XVIII. kerület', ''],
    ['MindentMent Fogászati rendelő - XIV. kerület', '+36 1 225 3488', '', 'XIV. kerület', ''],
    ['MYdent Fogászat (volt MXdent)', '+36 30 350 7928', '', 'II. kerület', ''],
    ['Erzsébet Dentál & Medical', '+36 1 284 6596', '', 'XX. kerület', ''],
    ['Egészség és Mosoly Fogászati Rendelő', '+36 30 092 2559', '', 'XIII. kerület', ''],
    ['Fehérvári Dental Újbuda', '+36 1 445 0011', '', 'XI. kerület', ''],
    ['Teleki Dental', '+36 70 336 2675', '', 'VIII. kerület', ''],
    ['Fogászati ügyelet', '+36 20 477 2124', '', 'V. kerület', ''],
    ['Siklós Dental Studio Kft.', '+36 20 435 2883', '', 'XVIII. kerület', ''],
    ['Mosolyprogram - Fogorvos', '+36 70 674 9934', 'mosolyprogram.com', 'XIX. kerület', ''],
    ['Medicare Fogászati Klinika és Implant Központ', '+36 1 465 3100', '', 'VI. kerület', ''],
    ['Kálvin Dentál Kft.', '+36 20 315 2884', 'fogaszatugyelet.hu', 'VIII. kerület', ''],
    ['Dentina Team Fogászat Budapest', '+36 70 310 2252', '', 'XIII. kerület', ''],
    ['Dentabo Fogorvosi Rendelő - Zugló', '+36 1 363 2734', '', 'XIV. kerület', ''],
    ['SZÉ-DENT Fogászat', '+36 30 642 8914', '', 'XVIII. kerület', ''],
    ['AAA Klinikák Dent Kft', '+36 1 215 6872', 'fogorvosi-rendelo.hu', 'IX. kerület', ''],
    ['Haifa Dent 2 Fogászat VII. ker.', '+36 20 263 7262', '', 'VII. kerület', ''],
    ['Árkád Dental', '+36 20 851 2171', '', 'X. kerület', ''],
    ['Haifa Dent', '+36 20 361 0258', '', 'VII. kerület', ''],
    ['Zsálya Dental - Dr. Kovács Detre fogorvos', '+36 20 662 7288', 'zsalyadental.hu', 'VI. kerület', ''],
    ['Egressy Dental Kft.', '+36 70 381 5871', '', 'XIV. kerület', ''],
    ['Fehér Dental Fogászat', '+36 30 262 8100', 'feherdental.hu', 'X. kerület', ''],
    ['profi-dent', '+36 1 607 6843', '', 'XVIII. kerület', ''],
    ['Gyöngy Fogászat - IX. kerület', '+36 20 474 3694', '', 'IX. kerület', ''],
    ['ÚjBuda Dental', '+36 20 778 8011', '', 'XI. kerület', ''],
    ['Fogarasi Dental', '+36 30 567 6272', '', 'XIV. kerület', ''],
    ['Implant Központ Pest', '+36 1 291 4651', '', 'XVIII. kerület', ''],
    ['MesterDent Fogászati Rendelő', '+36 30 400 9064', 'mesterdent.hu', 'IX. kerület', ''],
    ['Ny&K Dental Bt.', '+36 30 221 9241', '', 'X. kerület', ''],
    ['LŐRINC DENTAL Bt.', '+36 1 291 1536', '', 'XVIII. kerület', ''],
    ['Steffi-Dent Bt.', '', 'steffident.hu', 'XVIII. kerület', ''],
    ['Császár Dental - Parodontológia', '+36 70 424 7727', '', 'VII. kerület', ''],
    ['Alacska Dental', '+36 1 607 4401', 'alacskadental.hu', 'XVIII. kerület', ''],
    ['Nemes Dental Center', '+36 1 460 0437', 'nemesdental.hu', 'XVIII. kerület', ''],
    ['Madenta Fogászati Központ', '+36 1 267 1601', '', 'VII. kerület', ''],
    ['Dentobond', '+36 30 250 1130', '', 'XVIII. kerület', 'info@dentobond.hu'],
    ['Dr. Papp Dental', '+36 30 123 4567', '', 'XII. kerület', ''],
  ];

  // Összerakjuk a rows-t (fejléc + adatok + sorszám + status)
  var rows = [headers];
  for (var i = 0; i < data.length; i++) {
    rows.push([i + 1, data[i][0], data[i][1], data[i][2], data[i][3], data[i][4], 'pending', '']);
  }

  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  // Fejléc formázás — kék
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#2E86C1');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');

  // Zebra csíkozás
  for (var r = 2; r <= rows.length; r++) {
    var bg = (r % 2 === 0) ? '#EBF5FB' : '#FFFFFF';
    sheet.getRange(r, 1, 1, headers.length).setBackground(bg);
  }

  // "Status" oszlop zöld alapértelmezett
  sheet.getRange(2, 7, data.length, 1).setBackground('#D5F5E3');

  // Befagyasztás + oszlopszélesség
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 40);   // #
  sheet.setColumnWidth(2, 320);  // Cégnév
  sheet.setColumnWidth(3, 140);  // Telefon
  sheet.setColumnWidth(4, 160);  // Weboldal
  sheet.setColumnWidth(5, 120);  // Cím
  sheet.setColumnWidth(6, 200);  // Email
  sheet.setColumnWidth(7, 100);  // Status
  sheet.setColumnWidth(8, 200);  // Megjegyzés

  Logger.log('✅ Fogorvosok feltöltve: ' + data.length + ' sor');
}

// ============================================================================
// 2. ÜGYNÖKSÉGEK TAB
// ============================================================================

function feltoltUgynoksegek(sheet) {
  var headers = ['#', 'Cégnév', 'Weboldal', 'Fókusz', 'Email', 'Kapcsolattartó', 'Email Küldve', 'Válasz Status', 'Megjegyzés'];

  var data = [
    ['Online Ügynökség',  'onlineugynokseg.hu',       'Rendszerszintű online stratégia',   '', '', '', 'nem', ''],
    ['SOLID Agency',      'solidagency.hu',            'Adat- és tényalapú megközelítés',   '', '', '', 'nem', ''],
    ['BDA',               'bda.hu',                    'Kifejezetten kisvállalatok',         '', '', '', 'nem', ''],
    ['WOIMS',             'ertekesitesfejlesztes.hu',  'Értékesítés fejlesztés',             '', '', '', 'nem', ''],
    ['Marketing21',       'marketing21.hu',            'Full-service online marketing',      '', '', '', 'nem', ''],
    ['DLX MEDIA',         'dlxmedia.hu',               'Szövegírás, videó, podcast',         '', '', '', 'nem', ''],
    ['Chiro Marketing',   'chiro.hu',                  'Adatvezérelt megoldások',            '', '', '', 'nem', ''],
    ['Meraki Marketing',  'meraki.hu',                 'Weboldal, SEO, Videomarketing',      '', '', '', 'nem', ''],
  ];

  var rows = [headers];
  for (var i = 0; i < data.length; i++) {
    rows.push([i + 1, data[i][0], data[i][1], data[i][2], data[i][3], data[i][4], data[i][5], data[i][6], data[i][7]]);
  }

  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  // Fejléc — zöld
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1E8449');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');

  // Zebra
  for (var r = 2; r <= rows.length; r++) {
    var bg = (r % 2 === 0) ? '#EAFAF1' : '#FFFFFF';
    sheet.getRange(r, 1, 1, headers.length).setBackground(bg);
  }

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 40);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 200);
  sheet.setColumnWidth(4, 260);
  sheet.setColumnWidth(5, 200);
  sheet.setColumnWidth(6, 160);
  sheet.setColumnWidth(7, 100);
  sheet.setColumnWidth(8, 120);
  sheet.setColumnWidth(9, 200);

  Logger.log('✅ Ügynökségek feltöltve: ' + data.length + ' sor');
}

// ============================================================================
// 3. CAMPAIGN TRACKING TAB
// ============================================================================

function feltoltTracking(sheet, now) {
  var rows = [
    ['🚀 TRÓJAI FALÓ KAMPÁNY — Tracking Dashboard', ''],
    ['', ''],
    ['📋 KAMPÁNY ADATOK', ''],
    ['Campaign neve',         'Trójai Faló B2B Kampány'],
    ['Indulás dátuma',        new Date().toLocaleDateString('hu-HU')],
    ['Státusz',               '🟢 AKTÍV'],
    ['Iparág (pilot)',        'Fogorvászat — Budapest'],
    ['Következő iparág',     'Kozmetikai szalonok, Fitness stúdiók'],
    ['', ''],
    ['📊 LEAD STATISZTIKA', ''],
    ['Fogorvos leadek száma', 50],
    ['Célzott ügynökségek',   8],
    ['', ''],
    ['📤 EMAIL OUTREACH', ''],
    ['Emailek elküldve',      0],
    ['Sikeres kézbesítés',    0],
    ['Válaszok száma',        0],
    ['Valódi érdeklődők',     0],
    ['Meeting tervezett',     0],
    ['Ajánlat elküldve',      0],
    ['Deal kötött',           0],
    ['', ''],
    ['📈 CÉLOK (7 nap)', ''],
    ['Küldési arány (cél)',   '100%  → 8/8 ügynökség'],
    ['Válaszarány (cél)',     '30%+  → legalább 3 válasz'],
    ['Érdeklődési arány',     '20%+  → legalább 2 genuine'],
    ['Meeting (cél)',         '1+    → legalább 1 call'],
    ['', ''],
    ['📅 NAPLÓ', ''],
    ['Google Sheets feltöltve', now],
    ['Email küldés',          '⏳ Holnap indul (Gemini CLI)'],
    ['Script futtatva',       now],
    ['', ''],
    ['🔗 LINKEK', ''],
    ['Google Sheet',          'https://docs.google.com/spreadsheets/d/1Ja4sdeHs9mSJGJrPhwjnrUr2jNbcR63tJtH34qfHfLY'],
    ['HTML Report',           'Brunella_Leads_Fogorvosok.html (helyi)'],
    ['Email sablon',          'outreach_drafts.md (helyi)'],
    ['', ''],
    ['🎯 KÖVETKEZŐ LÉPÉSEK', ''],
    ['1.',  'Email szöveg személyre szabása (8 ügynökség)'],
    ['2.',  'Emailek küldése — Gemini CLI / RobotkezV2 (holnap)'],
    ['3.',  'Válaszok monitorozása (7 napon át)'],
    ['4.',  'Konverzió tracking frissítése'],
    ['5.',  'Következő iparág: Kozmetikai szalonok scrape'],
  ];

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);

  // Főcím formázás
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold').setBackground('#F9E212').setFontColor('#1A1A1A');
  sheet.getRange('A1:B1').merge();

  // Szekció fejlécek
  ['A3', 'A10', 'A14', 'A23', 'A28', 'A33', 'A38'].forEach(function(cell) {
    sheet.getRange(cell).setFontWeight('bold').setBackground('#D6EAF8').setFontSize(11);
  });

  // Státusz sor — zöld
  sheet.getRange('B6').setBackground('#D5F5E3').setFontWeight('bold');

  // Oszlopszélesség
  sheet.setColumnWidth(1, 240);
  sheet.setColumnWidth(2, 400);

  Logger.log('✅ Campaign Tracking dashboard létrehozva');
}
