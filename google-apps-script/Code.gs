// BSA WC2026 Predictor — Google Apps Script Backend
// Deploy as: Web App → Execute as: Me → Who has access: Anyone
//
// First-time setup after deploying:
//   1. Open this script in the Apps Script editor
//   2. Run createHourlyTrigger() once — this sets up auto payment sync every hour
//   3. You never need to run it again

const SHEET_ID  = '1mwaNqjNhDIfWahhIWjjbQSRBi-n3qAjI9_euDG3VxOY';
const ENTRY_FEE = 50;

// ── Spreadsheet cache (lives for the duration of one script execution) ────────

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
      Entries:     ['Timestamp', 'Name', 'Email', 'RefCode', 'PaymentStatus', 'PaidAt'],
      Predictions: ['RefCode', 'MatchID', 'HomeScore', 'AwayScore', 'SubmittedAt'],
      Results:     ['MatchID', 'HomeTeam', 'AwayTeam', 'HomeScore', 'AwayScore', 'EnteredAt'],
      Payments:    ['Timestamp', 'Reference', 'Amount', 'Note'],
    };
    if (headers[name]) {
      sheet.appendRow(headers[name]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers[name].length).setFontWeight('bold');
    }
  }
  return sheet;
}

// ── GET ───────────────────────────────────────────────────────────────────────

function doGet(e) {
  const action = (e.parameter.action || 'stats');
  let result;
  try {
    if      (action === 'stats')          result = getStats();
    else if (action === 'leaderboard')    result = getLeaderboard();
    else if (action === 'paid_entries')   result = getPaidEntries();
    else if (action === 'results')        result = getResults();
    else if (action === 'my_entries')     result = getMyEntries(e.parameter.email);
    else if (action === 'my_predictions') result = getMyPredictions(e.parameter.refCode);
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
    if      (body.action === 'submit')      result = submitEntry(body);
    else if (body.action === 'save_result') result = saveResult(body);
    else if (body.action === 'mark_paid')   result = markPaid(body);
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

function submitEntry(body) {
  const { name, email, predictions, refCode } = body;
  if (!name || !email) return { error: 'Name and email required' };

  const emailNorm     = email.toLowerCase().trim();
  const entriesSheet  = getSheet('Entries');
  const entriesData   = entriesSheet.getDataRange().getValues();

  // Build lookup map of refCode → row number (1-indexed)
  const refToRow = {};
  for (let i = 1; i < entriesData.length; i++) {
    refToRow[entriesData[i][3]] = i + 1;
  }

  let code  = (refCode || '').trim().toUpperCase();
  let isNew = false;
  let rowNum = code ? refToRow[code] : null;

  if (!rowNum) {
    // Generate unique code (pass existing codes to avoid re-reading sheet)
    const existingCodes = new Set(Object.keys(refToRow));
    code  = generateRefCode(existingCodes);
    isNew = true;
    entriesSheet.appendRow([new Date().toISOString(), name, emailNorm, code, 'pending', '']);
  } else {
    entriesSheet.getRange(rowNum, 2).setValue(name); // update name
  }

  // Batch-write predictions
  if (predictions && typeof predictions === 'object') {
    const predsSheet = getSheet('Predictions');
    const predData   = predsSheet.getDataRange().getValues();
    const now        = new Date().toISOString();

    // Build map: matchId → row number for this refCode
    const existingPredRows = {};
    for (let i = 1; i < predData.length; i++) {
      if (predData[i][0] === code) {
        existingPredRows[String(predData[i][1])] = i + 1;
      }
    }

    const toAppend = [];
    Object.entries(predictions).forEach(([matchId, scores]) => {
      if (scores.home === '' || scores.away === '' ||
          scores.home === null || scores.away === null) return;
      const existingRow = existingPredRows[String(matchId)];
      if (existingRow) {
        // Update in-place
        predsSheet.getRange(existingRow, 3, 1, 3).setValues([[scores.home, scores.away, now]]);
      } else {
        toAppend.push([code, matchId, scores.home, scores.away, now]);
      }
    });

    // Batch append all new predictions in one call
    if (toAppend.length > 0) {
      predsSheet
        .getRange(predsSheet.getLastRow() + 1, 1, toAppend.length, toAppend[0].length)
        .setValues(toAppend);
    }
  }

  return { success: true, refCode: code, isNew };
}

// ── Results ───────────────────────────────────────────────────────────────────

function saveResult(body) {
  const { matchId, homeScore, awayScore, homeTeam, awayTeam } = body;
  if (matchId === undefined || homeScore === undefined || awayScore === undefined)
    return { error: 'matchId, homeScore, awayScore required' };

  const sheet = getSheet('Results');
  const data  = sheet.getDataRange().getValues();
  let row     = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(matchId)) { row = i + 1; break; }
  }

  const ts = new Date().toISOString();
  if (row === -1) {
    sheet.appendRow([matchId, homeTeam || '', awayTeam || '', homeScore, awayScore, ts]);
  } else {
    sheet.getRange(row, 4, 1, 3).setValues([[homeScore, awayScore, ts]]);
  }
  return { success: true };
}

// ── Payment handling ──────────────────────────────────────────────────────────

function markPaid(body) {
  const { refCode, paid } = body;
  if (!refCode) return { error: 'refCode required' };

  const code  = refCode.trim().toUpperCase();
  const sheet = getSheet('Entries');
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][3].trim().toUpperCase() === code) {
      sheet.getRange(i + 1, 5).setValue(paid ? 'paid' : 'pending');
      sheet.getRange(i + 1, 6).setValue(paid ? new Date().toISOString() : '');
      return { success: true };
    }
  }
  return { error: `Entry not found: ${code}` };
}

// Called hourly by trigger AND manually via admin panel.
// Reads reference codes from the Payments sheet and marks matching
// Entries rows as paid. Treasurer just pastes SnapScan export into
// the Payments sheet — no other action needed.
function syncPayments() {
  const paymentsSheet = getSheet('Payments');
  const entriesSheet  = getSheet('Entries');

  const payments = paymentsSheet.getDataRange().getValues().slice(1);
  const entries  = entriesSheet.getDataRange().getValues();

  // Build set of all reference codes found in the Payments sheet (col B)
  const paidRefs = new Set(
    payments
      .map(r => String(r[1]).trim().toUpperCase())
      .filter(r => r.startsWith('BSA-')) // only match valid BSA codes
  );

  if (paidRefs.size === 0) return { success: true, newlyMarked: 0 };

  const now     = new Date().toISOString();
  let matched   = 0;
  const updates = []; // collect rows to batch-update

  for (let i = 1; i < entries.length; i++) {
    const code   = String(entries[i][3]).trim().toUpperCase();
    const status = entries[i][4];
    if (paidRefs.has(code) && status !== 'paid') {
      updates.push({ row: i + 1 });
      matched++;
    }
  }

  // Write in batch
  updates.forEach(({ row }) => {
    entriesSheet.getRange(row, 5).setValue('paid');
    entriesSheet.getRange(row, 6).setValue(now);
  });

  Logger.log(`syncPayments: ${matched} entries marked paid`);
  return { success: true, newlyMarked: matched };
}

// ── Reads ─────────────────────────────────────────────────────────────────────

function getStats() {
  const entries = getSheet('Entries').getDataRange().getValues().slice(1);
  const paid    = entries.filter(r => r[4] === 'paid').length;
  return {
    totalEntries: entries.length,
    paidEntries:  paid,
    prizePool:    paid * ENTRY_FEE,
    rafflePrize:  paid * ENTRY_FEE * 0.5,
  };
}

function getResults() {
  const results = {};
  getSheet('Results').getDataRange().getValues().slice(1)
    .forEach(r => { results[r[0]] = { homeScore: r[3], awayScore: r[4] }; });
  return results;
}

function getMyEntries(email) {
  if (!email) return [];
  const norm = email.toLowerCase().trim();
  return getSheet('Entries').getDataRange().getValues().slice(1)
    .filter(r => r[2].toLowerCase() === norm)
    .map(r => ({ refCode: r[3], status: r[4], createdAt: r[0] }));
}

function getMyPredictions(refCode) {
  if (!refCode) return {};
  const code  = refCode.trim().toUpperCase();
  const preds = {};
  getSheet('Predictions').getDataRange().getValues().slice(1)
    .filter(r => String(r[0]).trim().toUpperCase() === code)
    .forEach(r => { preds[r[1]] = { home: r[2], away: r[3] }; });
  return preds;
}

function getLeaderboard() {
  const entries     = getSheet('Entries').getDataRange().getValues().slice(1);
  const predictions = getSheet('Predictions').getDataRange().getValues().slice(1);
  const results     = getSheet('Results').getDataRange().getValues().slice(1);

  // Build result lookup: matchId → { home, away }
  const resultMap = {};
  results.forEach(r => { resultMap[String(r[0])] = { home: r[3], away: r[4] }; });

  // Build predictions lookup: refCode → { matchId → { home, away } }
  const predsByRef = {};
  predictions.forEach(r => {
    const ref = String(r[0]).trim().toUpperCase();
    if (!predsByRef[ref]) predsByRef[ref] = {};
    predsByRef[ref][String(r[1])] = { home: r[2], away: r[3] };
  });

  // Aggregate by person (email), summing across all their paid entries
  const personMap = {};
  entries.forEach(row => {
    const email = row[2].toLowerCase();
    const name  = row[1];
    const code  = String(row[3]).trim().toUpperCase();
    if (row[4] !== 'paid') return;

    if (!personMap[email]) {
      personMap[email] = { name, email, raffleEntries: 0, exactScores: 0, correctResults: 0, paidVotes: 0 };
    }
    personMap[email].paidVotes++;

    const preds = predsByRef[code] || {};
    Object.entries(preds).forEach(([matchId, pred]) => {
      const result = resultMap[matchId];
      if (!result || result.home === '' || result.home === null || result.home === undefined) return;
      const ph = Number(pred.home), pa = Number(pred.away);
      const rh = Number(result.home), ra = Number(result.away);
      if (ph === rh && pa === ra) {
        personMap[email].raffleEntries += 3;
        personMap[email].exactScores++;
      } else if (Math.sign(ph - pa) === Math.sign(rh - ra)) {
        personMap[email].raffleEntries += 1;
        personMap[email].correctResults++;
      }
    });
  });

  return Object.values(personMap)
    .sort((a, b) => b.raffleEntries - a.raffleEntries || b.exactScores - a.exactScores);
}

function getPaidEntries() {
  return getSheet('Entries').getDataRange().getValues().slice(1)
    .filter(r => r[4] === 'paid')
    .map(r => ({ name: r[1], refCode: r[3] }));
}

// ── Trigger management ────────────────────────────────────────────────────────

// Run this ONCE from the Apps Script editor after deploying.
// Sets up automatic hourly payment sync — no further action needed.
function createHourlyTrigger() {
  // Remove any existing syncPayments triggers first (avoid duplicates)
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncPayments')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('syncPayments')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('✓ Hourly syncPayments trigger created');
}

// Run this if you ever need to remove the hourly trigger.
function deleteHourlyTrigger() {
  const removed = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncPayments');
  removed.forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log(`Removed ${removed.length} trigger(s)`);
}

// ── Convenience menu (shows in Google Sheet UI) ───────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚽ WC2026 Admin')
    .addItem('Sync Payments Now', 'syncPayments')
    .addItem('Setup Hourly Auto-Sync', 'createHourlyTrigger')
    .addItem('Remove Auto-Sync', 'deleteHourlyTrigger')
    .addToUi();
}

// ── Utils ─────────────────────────────────────────────────────────────────────

// Pass in the set of existing codes to avoid re-reading the sheet
function generateRefCode(existingCodes) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  let attempts = 0;
  do {
    code = 'BSA-';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    attempts++;
    if (attempts > 100) throw new Error('Could not generate unique ref code');
  } while (existingCodes && existingCodes.has(code));
  return code;
}
