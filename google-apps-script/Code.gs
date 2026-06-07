// BSA WC2026 Predictor — Google Apps Script Backend
// Deploy as: Web App → Execute as: Me → Who has access: Anyone
//
// First-time setup after deploying:
//   1. Open this script in the Apps Script editor
//   2. Run createHourlyTrigger() once to set up auto payment sync

const SHEET_ID    = '1mwaNqjNhDIfWahhIWjjbQSRBi-n3qAjI9_euDG3VxOY';
const ENTRY_FEE   = 50;
const FIXTURES_URL = 'https://raw.githubusercontent.com/hendricksbc/bsa-wc2026-predictor/main/data/fixtures.json';

// Entries sheet columns
// A=Timestamp B=Name C=Email D=RefCode E=MatchID F=MatchName G=HomeScore H=AwayScore I=PaymentStatus J=PaidAt

// ── Spreadsheet cache ─────────────────────────────────────────────────────────

let _ss = null;
function ss() {
  if (!_ss) _ss = SpreadsheetApp.openById(SHEET_ID);
  return _ss;
}

function getSheet(name) {
  let sheet = ss().getSheetByName(name);
  if (!sheet) {
    sheet = ss().insertSheet(name);
    const headers = {
      Entries:  ['Timestamp','Name','Email','RefCode','MatchID','MatchName','HomeScore','AwayScore','PaymentStatus','PaidAt'],
      Payments: ['Timestamp','Reference','Amount','Note'],
    };
    if (headers[name]) {
      sheet.appendRow(headers[name]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers[name].length).setFontWeight('bold');
    }
  }
  return sheet;
}

// ── Fixtures from GitHub (auto-updated every 2hrs) ────────────────────────────

let _fixtures = null;
function fetchFixtures() {
  if (_fixtures) return _fixtures;
  try {
    const res  = UrlFetchApp.fetch(FIXTURES_URL, { muteHttpExceptions: true });
    _fixtures  = JSON.parse(res.getContentText());
  } catch (e) {
    _fixtures = { groups: {}, knockoutRounds: [] };
  }
  return _fixtures;
}

function getAllMatches() {
  const f = fetchFixtures();
  const matches = [];
  Object.values(f.groups || {}).forEach(g => matches.push(...g.matches));
  (f.knockoutRounds || []).forEach(r => matches.push(...(r.matches || [])));
  return matches;
}

// Build map of matchId → { homeScore, awayScore } for finished matches
function getResultMap() {
  const map = {};
  getAllMatches().forEach(m => {
    if (m.homeScore !== null && m.awayScore !== null && m.homeScore !== undefined) {
      map[String(m.id)] = { home: Number(m.homeScore), away: Number(m.awayScore) };
    }
  });
  return map;
}

// ── GET ───────────────────────────────────────────────────────────────────────

function doGet(e) {
  const action = e.parameter.action || 'stats';
  let result;
  try {
    if      (action === 'stats')          result = getStats();
    else if (action === 'leaderboard')    result = getLeaderboard();
    else if (action === 'paid_entries')   result = getPaidEntries();
    else if (action === 'my_entries')     result = getMyEntries(e.parameter.email);
    else if (action === 'sync_payments')  result = syncPayments();
    else result = { error: 'Unknown action' };
  } catch (err) {
    result = { error: err.message };
  }
  return jsonOut(result);
}

// ── POST ──────────────────────────────────────────────────────────────────────

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (_) { return jsonOut({ error: 'Invalid JSON' }); }

  let result;
  try {
    if      (body.action === 'submit')    result = submitEntry(body);
    else if (body.action === 'mark_paid') result = markPaid(body);
    else result = { error: 'Unknown action' };
  } catch (err) {
    result = { error: err.message };
  }
  return jsonOut(result);
}

function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Submit entry ──────────────────────────────────────────────────────────────
// Each submission = one match prediction = one R50 vote = one unique ref code

function submitEntry(body) {
  const { name, email, matchId, matchName, homeScore, awayScore } = body;
  if (!name || !email)            return { error: 'Name and email required' };
  if (!matchId)                   return { error: 'matchId required' };
  if (homeScore === undefined || homeScore === null || homeScore === '') return { error: 'Home score required' };
  if (awayScore === undefined || awayScore === null || awayScore === '') return { error: 'Away score required' };

  const emailNorm    = email.toLowerCase().trim();
  const entriesSheet = getSheet('Entries');
  const entriesData  = entriesSheet.getDataRange().getValues();

  // Existing codes — for uniqueness check
  const existingCodes = new Set(entriesData.slice(1).map(r => r[3]));
  const refCode = generateRefCode(existingCodes);

  entriesSheet.appendRow([
    new Date().toISOString(),
    name,
    emailNorm,
    refCode,
    String(matchId),
    matchName || '',
    Number(homeScore),
    Number(awayScore),
    'pending',
    '',
  ]);

  return { success: true, refCode };
}

// ── Payment handling ──────────────────────────────────────────────────────────

function markPaid(body) {
  const { refCode, paid } = body;
  if (!refCode) return { error: 'refCode required' };

  const code  = refCode.trim().toUpperCase();
  const sheet = getSheet('Entries');
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][3]).trim().toUpperCase() === code) {
      sheet.getRange(i + 1, 9).setValue(paid ? 'paid' : 'pending');
      sheet.getRange(i + 1, 10).setValue(paid ? new Date().toISOString() : '');
      return { success: true };
    }
  }
  return { error: `Entry not found: ${code}` };
}

function syncPayments() {
  const paymentsSheet = getSheet('Payments');
  const entriesSheet  = getSheet('Entries');

  const payments = paymentsSheet.getDataRange().getValues().slice(1);
  const entries  = entriesSheet.getDataRange().getValues();

  const paidRefs = new Set(
    payments
      .map(r => String(r[1]).trim().toUpperCase())
      .filter(r => r.startsWith('BSA-'))
  );

  if (paidRefs.size === 0) return { success: true, newlyMarked: 0 };

  const now     = new Date().toISOString();
  let matched   = 0;

  for (let i = 1; i < entries.length; i++) {
    const code   = String(entries[i][3]).trim().toUpperCase();
    const status = entries[i][8]; // col I = PaymentStatus
    if (paidRefs.has(code) && status !== 'paid') {
      entriesSheet.getRange(i + 1, 9).setValue('paid');
      entriesSheet.getRange(i + 1, 10).setValue(now);
      matched++;
    }
  }

  Logger.log(`syncPayments: ${matched} entries marked paid`);
  return { success: true, newlyMarked: matched };
}

// ── Reads ─────────────────────────────────────────────────────────────────────

function getStats() {
  const entries = getSheet('Entries').getDataRange().getValues().slice(1);
  const paid    = entries.filter(r => r[8] === 'paid').length;
  return {
    totalEntries: entries.length,
    paidEntries:  paid,
    prizePool:    paid * ENTRY_FEE,
    rafflePrize:  Math.floor(paid * ENTRY_FEE * 0.5),
  };
}

function getMyEntries(email) {
  if (!email) return [];
  const norm = email.toLowerCase().trim();
  return getSheet('Entries').getDataRange().getValues().slice(1)
    .filter(r => String(r[2]).toLowerCase() === norm)
    .map(r => ({
      refCode:    r[3],
      matchId:    r[4],
      matchName:  r[5],
      homeScore:  r[6],
      awayScore:  r[7],
      status:     r[8],
      createdAt:  r[0],
    }));
}

function getLeaderboard() {
  const entries   = getSheet('Entries').getDataRange().getValues().slice(1);
  const resultMap = getResultMap(); // from fixtures.json on GitHub

  const personMap = {};

  entries.forEach(row => {
    const email   = String(row[2]).toLowerCase();
    const name    = row[1];
    const matchId = String(row[4]);
    const ph      = Number(row[6]);
    const pa      = Number(row[7]);
    const paid    = row[8] === 'paid';
    if (!paid) return;

    if (!personMap[email]) {
      personMap[email] = { name, email, raffleEntries: 0, exactScores: 0, correctResults: 0, paidVotes: 0 };
    }
    personMap[email].paidVotes++;

    const result = resultMap[matchId];
    if (!result) return; // match not yet played

    const rh = result.home, ra = result.away;
    if (ph === rh && pa === ra) {
      personMap[email].raffleEntries += 3;
      personMap[email].exactScores++;
    } else if (Math.sign(ph - pa) === Math.sign(rh - ra)) {
      personMap[email].raffleEntries += 1;
      personMap[email].correctResults++;
    }
  });

  return Object.values(personMap)
    .sort((a, b) => b.raffleEntries - a.raffleEntries || b.exactScores - a.exactScores);
}

function getPaidEntries() {
  return getSheet('Entries').getDataRange().getValues().slice(1)
    .filter(r => r[8] === 'paid')
    .map(r => ({ name: r[1], refCode: r[3], matchName: r[5] }));
}

// ── Trigger management ────────────────────────────────────────────────────────

function createHourlyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncPayments')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('syncPayments')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('✓ Hourly syncPayments trigger created');
}

function deleteHourlyTrigger() {
  const removed = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncPayments');
  removed.forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log(`Removed ${removed.length} trigger(s)`);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚽ WC2026 Admin')
    .addItem('Sync Payments Now', 'syncPayments')
    .addItem('Setup Hourly Auto-Sync', 'createHourlyTrigger')
    .addItem('Remove Auto-Sync', 'deleteHourlyTrigger')
    .addToUi();
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function generateRefCode(existingCodes) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code, attempts = 0;
  do {
    code = 'BSA-';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    if (++attempts > 100) throw new Error('Could not generate unique ref code');
  } while (existingCodes && existingCodes.has(code));
  return code;
}
