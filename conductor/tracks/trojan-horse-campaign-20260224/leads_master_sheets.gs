/**
 * 📊 BRUNELLA Lead Intelligence — Google Sheets Master Sablon
 * ==============================================================
 * HASZNÁLAT:
 *   1. Hozz létre egy új Google Sheet-et
 *   2. Extensions → Apps Script → illeszd be ezt
 *   3. Run → inicializalMasterSheet()
 *
 * Tabbok:
 *   📋 Leads_Master     — összes lead iparág szerint szűrhető
 *   🎯 Outreach_Pipeline — ügynökségek + küldési státusz
 *   📈 Dashboard        — napi összesítők, grafikonok
 *   ⚙️  Config          — Worker URL, beállítások
 */

// ============================================================================
// KONFIGURÁCIÓ — IDE ÍRD BE A WORKER URL-T DEPLOY UTÁN!
// ============================================================================

const CONFIG = {
  WORKER_URL: 'https://brunella-lead-intelligence.dd107933ac970dac857f27cee7a7ff46.workers.dev',
  AUTO_REFRESH_HOURS: 6,     // Minden 6 órában frissít
  MIN_PAIN_SCORE: 40,        // Csak 40+ score-os leadek kerülnek be
  MAX_LEADS_PER_SHEET: 500,  // Ennyi sornál több nem kell
};

// ============================================================================
// FŐ BELÉPÉSI PONT
// ============================================================================

function inicializalMasterSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log('🚀 Brunella Lead Intelligence sablon inicializálás...');

  // Tabbok létrehozása
  var tabLeads     = getOrCreate(ss, '📋 Leads_Master');
  var tabOutreach  = getOrCreate(ss, '🎯 Outreach_Pipeline');
  var tabDashboard = getOrCreate(ss, '📈 Dashboard');
  var tabConfig    = getOrCreate(ss, '⚙️ Config');

  // Alap tab törlése
  ['Sheet1', 'Munka1', '1. lap'].forEach(function(name) {
    var s = ss.getSheetByName(name);
    if (s) try { ss.deleteSheet(s); } catch(e) {}
  });

  // Feltöltés
  setupLeadsMaster(tabLeads);
  setupOutreachPipeline(tabOutreach);
  setupDashboard(tabDashboard);
  setupConfig(tabConfig);

  // Trigger beállítása automatikus frissítéshez
  setupTriggers();

  SpreadsheetApp.getUi().alert(
    '✅ BRUNELLA Lead Intelligence kész!\n\n' +
    '📋 Leads_Master: Lead adatbázis\n' +
    '🎯 Outreach_Pipeline: Ügynökség követés\n' +
    '📈 Dashboard: Statisztikák\n' +
    '⚙️  Config: Beállítások\n\n' +
    'Következő lépés: ⚙️ Config tabban állítsd be a Worker URL-t,\n' +
    'majd futtasd a frissitLeadeket() funkciót!'
  );
}

// ============================================================================
// LEADS MASTER TAB
// ============================================================================

function setupLeadsMaster(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  var headers = [
    '#', 'Cégnév', 'Iparág', 'Város', 'Cím',
    'Telefon', 'Weboldal', 'Google értékelés', 'Vélemények száma',
    'Fájdalom Score', 'Problémák', 'Státusz', 'Scraped', 'Megjegyzés'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Fejléc formázás — sötét kék
  var h = sheet.getRange(1, 1, 1, headers.length);
  h.setBackground('#1a237e');
  h.setFontColor('#ffffff');
  h.setFontWeight('bold');
  h.setHorizontalAlignment('center');
  h.setFontSize(10);

  // Oszlopszélességek
  var widths = [35, 250, 110, 90, 200, 130, 180, 110, 110, 100, 280, 90, 100, 200];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);

  // Feltételes formázás — Fájdalom Score oszlop (J = 10)
  var scoreRange = sheet.getRange('J2:J1000');
  var rules = sheet.getConditionalFormatRules();

  // 80-100: Piros (TOP célpont!)
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThanOrEqualTo(80)
    .setBackground('#ffcdd2').setFontColor('#b71c1c').setBold(true)
    .setRanges([scoreRange]).build());
  // 60-79: Narancs
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(60, 79)
    .setBackground('#ffe0b2').setFontColor('#e65100')
    .setRanges([scoreRange]).build());
  // 40-59: Sárga
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(40, 59)
    .setBackground('#fff9c4').setFontColor('#f57f17')
    .setRanges([scoreRange]).build());

  sheet.setConditionalFormatRules(rules);

  // Státusz dropdown
  var statusRange = sheet.getRange('L2:L1000');
  var validation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['🆕 new', '📨 contacted', '💬 responded', '✅ converted', '❌ rejected'], true)
    .build();
  statusRange.setDataValidation(validation);

  Logger.log('✅ Leads_Master tab kész');
}

// ============================================================================
// OUTREACH PIPELINE TAB
// ============================================================================

function setupOutreachPipeline(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  var headers = [
    '#', 'Ügynökség', 'Weboldal', 'Email', 'Fókusz',
    'Iparág csomag', 'Leadek száma', 'Email küldve',
    'Megnyitva', 'Válasz', 'Deal státusz', 'Bevétel (Ft/hó)', 'Megjegyzés'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Fejléc — zöld
  var h = sheet.getRange(1, 1, 1, headers.length);
  h.setBackground('#1b5e20');
  h.setFontColor('#ffffff');
  h.setFontWeight('bold');
  h.setHorizontalAlignment('center');

  // Meglévő 10 ügynökség feltöltve
  var agencies = [
    [1, 'Marketing21',       'marketing21.hu',       'info@marketing21.hu',       'Full-service',       'Fogorvosok (50)', 50, '2026-02-26', '', '', '🔵 Várjuk', '', ''],
    [2, 'DLX MEDIA',         'dlxmedia.hu',           'hello@dlxmedia.hu',          'Szövegírás/Videó',   'Fogorvosok (50)', 50, '2026-02-26', '', '', '🔵 Várjuk', '', ''],
    [3, 'Chiro Marketing',   'chiro.hu',              'info@chiro.hu',              'Adatvezérelt',       'Fogorvosok (50)', 50, '2026-02-26', '', '', '🔵 Várjuk', '', ''],
    [4, 'Meraki Marketing',  'meraki.hu',             'info@meraki.hu',             'SEO/Web/Videó',      'Fogorvosok (50)', 50, '2026-02-26', '', '', '🔵 Várjuk', '', ''],
    [5, 'WOIMS',             'ertekesitesfejlesztes.hu','office@woims.de',           'Értékesítés',        'Fogorvosok (50)', 50, '2026-02-26', '', '', '🔵 Várjuk', '', ''],
    [6, 'SOLID Agency',      'solidagency.hu',        'hello@solidagency.hu',       'Tényalapú',          'Fogorvosok (50)', 50, '2026-02-26', '', '', '🔵 Várjuk', '', ''],
    [7, 'Online Ügynökség',  'onlineugynokseg.hu',    'info@onlineugynokseg.hu',    'Online stratégia',   'Fogorvosok (50)', 50, '2026-02-26', '', '', '🔵 Várjuk', '', ''],
    [8, 'BDA',               'bda.hu',                'info@bda.hu',                'Kisvállalatok',      'Fogorvosok (50)', 50, '2026-02-26', '', '', '🔵 Várjuk', '', ''],
    [9, 'Vantgard Digital',  'vantgarddigital.hu',    'hello@vantgarddigital.hu',   'Mérhető online',     'Fogorvosok (50)', 50, '2026-02-26', '', '', '🔵 Várjuk', '', ''],
    [10,'Aida Media',        'aidamedia.hu',           'info@aidamedia.hu',          'KKV hirdetés',       'Fogorvosok (50)', 50, '2026-02-26', '', '', '🔵 Várjuk', '', ''],
  ];

  sheet.getRange(2, 1, agencies.length, headers.length).setValues(agencies);

  // Zebra csíkozás
  for (var r = 2; r <= agencies.length + 1; r++) {
    sheet.getRange(r, 1, 1, headers.length)
      .setBackground(r % 2 === 0 ? '#e8f5e9' : '#ffffff');
  }

  // Deal státusz dropdown
  var dealRange = sheet.getRange('K2:K200');
  var validation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['🔵 Várjuk', '👁️ Megnyitva', '💬 Válaszolt', '📞 Meeting', '💰 Ajánlat', '✅ Deal', '❌ Nem érdekli'], true)
    .build();
  dealRange.setDataValidation(validation);

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(4, 220);

  Logger.log('✅ Outreach_Pipeline tab kész');
}

// ============================================================================
// DASHBOARD TAB
// ============================================================================

function setupDashboard(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  var now = new Date().toLocaleString('hu-HU');

  var rows = [
    ['📈 BRUNELLA Lead Intelligence — Dashboard', ''],
    ['', ''],
    ['⏱️ Utolsó frissítés', now],
    ['🌐 Worker URL', CONFIG.WORKER_URL || 'Nincs beállítva'],
    ['', ''],
    ['📊 LEAD STATISZTIKA', ''],
    ['Összes lead', '=COUNTA(\'📋 Leads_Master\'!B2:B1000)'],
    ['Magas prioritás (80+)', '=COUNTIF(\'📋 Leads_Master\'!J2:J1000,">=80")'],
    ['Közepes (60-79)',       '=COUNTIFS(\'📋 Leads_Master\'!J2:J1000,">=60",\'📋 Leads_Master\'!J2:J1000,"<80")'],
    ['Alacsony (40-59)',      '=COUNTIFS(\'📋 Leads_Master\'!J2:J1000,">=40",\'📋 Leads_Master\'!J2:J1000,"<60")'],
    ['Átlag fájdalom score',  '=IFERROR(AVERAGE(\'📋 Leads_Master\'!J2:J1000),0)'],
    ['', ''],
    ['🏭 IPARÁGAK', ''],
    ['Fogorvos',    '=COUNTIF(\'📋 Leads_Master\'!C2:C1000,"fogorvos")'],
    ['Kozmetika',   '=COUNTIF(\'📋 Leads_Master\'!C2:C1000,"kozmetika")'],
    ['Fitness',     '=COUNTIF(\'📋 Leads_Master\'!C2:C1000,"fitness")'],
    ['Étterem',     '=COUNTIF(\'📋 Leads_Master\'!C2:C1000,"etterem")'],
    ['Szakiparos',  '=COUNTIF(\'📋 Leads_Master\'!C2:C1000,"szakiparos")'],
    ['', ''],
    ['📤 OUTREACH STÁTUSZ', ''],
    ['Megkeresett ügynökségek', '=COUNTA(\'🎯 Outreach_Pipeline\'!B2:B100)'],
    ['Email elküldve', '=COUNTIFS(\'🎯 Outreach_Pipeline\'!H2:H100,"<>"& "")'],
    ['Válaszolt', '=COUNTIFS(\'🎯 Outreach_Pipeline\'!K2:K100,"💬 Válaszolt")+COUNTIFS(\'🎯 Outreach_Pipeline\'!K2:K100,"📞 Meeting")+COUNTIFS(\'🎯 Outreach_Pipeline\'!K2:K100,"💰 Ajánlat")+COUNTIFS(\'🎯 Outreach_Pipeline\'!K2:K100,"✅ Deal")'],
    ['Deal kötve', '=COUNTIF(\'🎯 Outreach_Pipeline\'!K2:K100,"✅ Deal")'],
    ['Várható bevétel (Ft/hó)', '=SUM(\'🎯 Outreach_Pipeline\'!L2:L100)'],
    ['', ''],
    ['🕐 NAPI FUTÁSOK', ''],
    ['Következő auto-frissítés', 'Minden 6 órában'],
    ['Cron (Cloudflare)', 'Naponta 02:00-kor'],
  ];

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);

  // Formázás
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold').setBackground('#0d47a1').setFontColor('#ffffff');
  sheet.getRange('A1:B1').merge();

  // Szekció fejlécek
  ['A6', 'A13', 'A20', 'A27'].forEach(function(c) {
    sheet.getRange(c).setFontWeight('bold').setBackground('#e3f2fd').setFontSize(11);
  });

  // Számformátum — bevétel sor
  sheet.getRange('B25').setNumberFormat('#,##0 "Ft"');

  sheet.setColumnWidth(1, 240);
  sheet.setColumnWidth(2, 300);

  Logger.log('✅ Dashboard tab kész');
}

// ============================================================================
// CONFIG TAB
// ============================================================================

function setupConfig(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  var rows = [
    ['⚙️ BRUNELLA Lead Intelligence — Konfiguráció', ''],
    ['', ''],
    ['WORKER URL', CONFIG.WORKER_URL],
    ['Account ID', 'dd107933ac970dac857f27cee7a7ff46'],
    ['D1 Database ID', '1c4e7d00-7b09-4ddf-88b4-8df42e1123ab'],
    ['KV Namespace ID', 'b6718ab359ac401bb24da7c34c24f11b'],
    ['', ''],
    ['Auto-frissítés (óra)', CONFIG.AUTO_REFRESH_HOURS],
    ['Min fájdalom score', CONFIG.MIN_PAIN_SCORE],
    ['Max lead / sheet', CONFIG.MAX_LEADS_PER_SHEET],
    ['', ''],
    ['TÁMOGATOTT IPARÁGAK', ''],
    ['fogorvos', 'fogorvos, fogászat, dental'],
    ['kozmetika', 'kozmetikai szalon, szépségszalon, kozmetikus'],
    ['fitness', 'edzőterem, fitness, gym'],
    ['etterem', 'étterem, vendéglő, bisztró'],
    ['szakiparos', 'villanyszerelő, vízszerelő, festő'],
    ['ingatlan', 'ingatlaniroda, ingatlanközvetítő'],
    ['allatorvos', 'állatorvos, kisállat rendelő'],
    ['optika', 'optika, szemüvegkészítő'],
  ];

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);

  sheet.getRange('A1').setFontSize(13).setFontWeight('bold').setBackground('#37474f').setFontColor('#ffffff');
  sheet.getRange('A1:B1').merge();
  sheet.getRange('A12').setFontWeight('bold').setBackground('#eceff1');
  sheet.getRange('A3:A10').setFontWeight('bold');
  sheet.getRange('B3').setFontColor('#1565c0'); // Worker URL kék

  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 400);

  Logger.log('✅ Config tab kész');
}

// ============================================================================
// WORKER → SHEETS SZINKRONIZÁCIÓ
// ============================================================================

function frissitLeadeket(industry, city, minScore) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName('⚙️ Config');

  // Worker URL a Config tabból
  var workerUrl = configSheet
    ? configSheet.getRange('B3').getValue()
    : CONFIG.WORKER_URL;

  if (!workerUrl || workerUrl === 'Nincs beállítva') {
    SpreadsheetApp.getUi().alert('⚠️ Nincs Worker URL beállítva! Töltsd ki a ⚙️ Config tab B3 celláját!');
    return;
  }

  industry = industry || '';
  city = city || 'Budapest';
  minScore = minScore || 40;

  try {
    var url = workerUrl + '/leads?city=' + encodeURIComponent(city) +
              '&min_score=' + minScore +
              (industry ? '&industry=' + encodeURIComponent(industry) : '') +
              '&limit=200';

    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(response.getContentText());

    if (!data.leads || data.leads.length === 0) {
      SpreadsheetApp.getUi().alert('Nincs adat a Worker-től. Előbb indíts kutatást!');
      return;
    }

    var sheet = ss.getSheetByName('📋 Leads_Master');
    if (!sheet) return;

    // Meglévő adatok törlése (fejléc megtartása)
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 14).clearContent();

    // Adatok beírása
    var rows = data.leads.map(function(lead, i) {
      return [
        i + 1,
        lead.name,
        lead.industry,
        lead.city,
        lead.address,
        lead.phone,
        lead.website,
        lead.google_rating,
        lead.google_reviews,
        lead.pain_score,
        (lead.pain_reasons || []).join(', '),
        '🆕 new',
        lead.scraped_at ? new Date(lead.scraped_at).toLocaleDateString('hu-HU') : '',
        ''
      ];
    });

    sheet.getRange(2, 1, rows.length, 14).setValues(rows);

    // Dashboard frissítés
    var dashSheet = ss.getSheetByName('📈 Dashboard');
    if (dashSheet) {
      dashSheet.getRange('B3').setValue(new Date().toLocaleString('hu-HU'));
    }

    SpreadsheetApp.getUi().alert(
      '✅ Frissítés kész!\n\n' +
      '📊 ' + rows.length + ' lead betöltve\n' +
      '🏙️ Város: ' + city + '\n' +
      (industry ? '🏭 Iparág: ' + industry + '\n' : '') +
      '⭐ Min score: ' + minScore
    );

  } catch(e) {
    SpreadsheetApp.getUi().alert('❌ Hiba: ' + e.message + '\n\nEllenőrizd a Worker URL-t!');
  }
}

function kutatastIndit(industry, city) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName('⚙️ Config');
  var workerUrl = configSheet ? configSheet.getRange('B3').getValue() : CONFIG.WORKER_URL;

  try {
    var response = UrlFetchApp.fetch(workerUrl + '/research', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ industry: industry, city: city || 'Budapest', limit: 25 }),
      muteHttpExceptions: true,
    });

    var data = JSON.parse(response.getContentText());

    SpreadsheetApp.getUi().alert(
      '🚀 Kutatás elindítva!\n\n' +
      'Job ID: ' + (data.job_id || 'N/A') + '\n' +
      '🏭 Iparág: ' + industry + '\n' +
      '🏙️ Város: ' + (city || 'Budapest') + '\n\n' +
      '~2 perc múlva futtasd a frissitLeadeket() funkciót!'
    );
  } catch(e) {
    SpreadsheetApp.getUi().alert('❌ Hiba: ' + e.message);
  }
}

// ============================================================================
// AUTO-TRIGGER BEÁLLÍTÁS
// ============================================================================

function setupTriggers() {
  // Töröljük a régi triggereket
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'autoFrissit') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Új trigger: minden 6 órában
  ScriptApp.newTrigger('autoFrissit')
    .timeBased()
    .everyHours(6)
    .create();

  Logger.log('✅ Auto-trigger beállítva (6 óránként)');
}

function autoFrissit() {
  Logger.log('[AutoRefresh] Frissítés: ' + new Date().toISOString());
  frissitLeadeket('', 'Budapest', 40);
}

// ============================================================================
// CUSTOM MENU (ez jelenik meg a Sheets menüben)
// ============================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔍 Brunella Leads')
    .addItem('🚀 Kutatás: Kozmetika', 'menuKozmetika')
    .addItem('🚀 Kutatás: Fitness', 'menuFitness')
    .addItem('🚀 Kutatás: Étterem', 'menuEtterem')
    .addItem('🚀 Kutatás: Fogorvos', 'menuFogorvos')
    .addSeparator()
    .addItem('🔄 Frissítés (összes)', 'menuFrissitOsszes')
    .addItem('🔄 Frissítés (magas prioritás 60+)', 'menuFrissitTop')
    .addSeparator()
    .addItem('📊 Dashboard frissítés', 'menuDashboard')
    .addItem('⚙️ Konfiguráció újratöltés', 'inicializalMasterSheet')
    .addToUi();
}

function menuKozmetika()    { kutatastIndit('kozmetika', 'Budapest'); }
function menuFitness()      { kutatastIndit('fitness', 'Budapest'); }
function menuEtterem()      { kutatastIndit('etterem', 'Budapest'); }
function menuFogorvos()     { kutatastIndit('fogorvos', 'Budapest'); }
function menuFrissitOsszes(){ frissitLeadeket('', 'Budapest', 40); }
function menuFrissitTop()   { frissitLeadeket('', 'Budapest', 60); }
function menuDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var d = ss.getSheetByName('📈 Dashboard');
  if (d) d.getRange('B3').setValue(new Date().toLocaleString('hu-HU'));
}

// ============================================================================
// HELPER
// ============================================================================

function getOrCreate(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) { sheet.clearContents(); sheet.clearFormats(); }
  else sheet = ss.insertSheet(name);
  return sheet;
}
