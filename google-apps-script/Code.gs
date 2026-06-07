// BSA WC2026 Predictor — Google Apps Script Backend
// Deploy as: Web App → Execute as: Me → Who has access: Anyone

const SHEET_ID = '1mwaNqjNhDIfWahhIWjjbQSRBi-n3qAjI9_euDG3VxOY';
const ENTRY_FEE = 50;

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headers = {
      'Entries':     ['Timestamp', 'Name', 'Email', 'RefCode', 'PaymentStatus', 'PaidAt'],
      'Predictions': ['RefCode', 'MatchID', 'HomeScore', 'AwayScore', 'SubmittedAt'],
      'Results':     ['MatchID', 'HomeTeam', 'AwayTeam', 'HomeScore', 'AwayScore', 'EnteredAt'],
      'Payments':    ['Timestamp', 'Reference', 'Amount', 'Note'],
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
  const action = e.parameter.action || 'stats';
  let result;
  try {
    if      (action === 'stats')         result = getStats();
    else if (action === 'leaderboard')   result = getLeaderboard();
    else if (action === 'paid_entries')  result = getPaidEntries();
    else if (action === 'results')       result = getResults();
    else if (action === 'my_entries')    result = getMyEntries(e.parameter.email);
    else if (action === 'my_predictions') result = getMyPredictions(e.parameter.refCode);
    else if (action === 'sync_payments') result = syncPayments();
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

  const emailNorm = email.toLowerCase().trim();
  const entriesSheet = getSheet('Entries');
  const predsSheet   = getSheet('Predictions');
  const entries      = entriesSheet.getDataRange().getValues();

  let rowNum   = -1;
  let code     = refCode || '';
  let isNew    = false;

  // Find existing entry by refCode if provided
  if (code) {
    for (let i = 1; i < entries.length; i++) {
      if (entries[i][3] === code) { rowNum = i + 1; break; }
    }
  }

  // Create new entry if none found
  if (rowNum === -1) {
    code  = generateRefCode();
    isNew = true;
    entriesSheet.appendRow([new Date().toISOString(), name, emailNorm, code, 'pending', '']);
  } else {
    // Update name in case it changed
    entriesSheet.getRange(rowNum, 2).setValue(name);
  }

  // Save predictions for this refCode
  if (predictions && typeof predictions === 'object') {
    const predData = predsSheet.getDataRange().getValues();
    const now      = new Date().toISOString();

    Object.entries(predictions).forEach(([matchId, scores]) => {
      if (scores.home === '' || scores.away === '' ||
          scores.home === null || scores.away === null) return;

      let predRow = -1;
      for (let i = 1; i < predData.length; i++) {
        if (predData[i][0] === code && String(predData[i][1]) === String(matchId)) {
          predRow = i + 1; break;
        }
      }

      if (predRow === -1) {
        predsSheet.appendRow([code, matchId, scores.home, scores.away, now]);
      } else {
        predsSheet.getRange(predRow, 3, 1, 3).setValues([[scores.home, scores.away, now]]);
      }
    });
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

  if (row === -1) {
    sheet.appendRow([matchId, homeTeam || '', awayTeam || '', homeScore, awayScore, new Date().toISOString()]);
  } else {
    sheet.getRange(row, 4, 1, 3).setValues([[homeScore, awayScore, new Date().toISOString()]]);
  }
  return { success: true };
}

// ── Payment matching ──────────────────────────────────────────────────────────

function markPaid(body) {
  const { refCode, paid } = body;
  if (!refCode) return { error: 'refCode required' };

  const sheet = getSheet('Entries');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === refCode) {
      sheet.getRange(i + 1, 5).setValue(paid ? 'paid' : 'pending');
      sheet.getRange(i + 1, 6).setValue(paid ? new Date().toISOString() : '');
      return { success: true };
    }
  }
  return { error: 'Entry not found' };
}

// Reads the Payments sheet and auto-marks matching entries as paid.
// Treasurer pastes SnapScan export into the Payments sheet (Reference column = col B).
function syncPayments() {
  const paymentsSheet = getSheet('Payments');
  const entriesSheet  = getSheet('Entries');

  const payments = paymentsSheet.getDataRange().getValues().slice(1);
  const entries  = entriesSheet.getDataRange().getValues();

  // Build set of reference codes in Payments sheet (col B, index 1)
  const paidRefs = new Set(
    payments
      .map(r => String(r[1]).trim().toUpperCase())
      .filter(r => r.length > 0)
  );

  let matched = 0;
  for (let i = 1; i < entries.length; i++) {
    const code   = String(entries[i][3]).trim().toUpperCase();
    const status = entries[i][4];
    if (paidRefs.has(code) && status !== 'paid') {
      entriesSheet.getRange(i + 1, 5).setValue('paid');
      entriesSheet.getRange(i + 1, 6).setValue(new Date().toISOString());
      matched++;
    }
  }
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
  const data    = getSheet('Results').getDataRange().getValues();
  const results = {};
  data.slice(1).forEach(r => {
    results[r[0]] = { homeScore: r[3], awayScore: r[4] };
  });
  return results;
}

function getMyEntries(email) {
  if (!email) return [];
  const norm    = email.toLowerCase().trim();
  const entries = getSheet('Entries').getDataRange().getValues().slice(1);
  return entries
    .filter(r => r[2].toLowerCase() === norm)
    .map(r => ({ refCode: r[3], status: r[4], createdAt: r[0] }));
}

function getMyPredictions(refCode) {
  if (!refCode) return {};
  const data  = getSheet('Predictions').getDataRange().getValues();
  const preds = {};
  data.slice(1).forEach(r => {
    if (r[0] === refCode) preds[r[1]] = { home: r[2], away: r[3] };
  });
  return preds;
}

function getLeaderboard() {
  const entries     = getSheet('Entries').getDataRange().getValues().slice(1);
  const predictions = getSheet('Predictions').getDataRange().getValues().slice(1);
  const results     = getSheet('Results').getDataRange().getValues().slice(1);

  const resultMap = {};
  results.forEach(r => { resultMap[String(r[0])] = { home: r[3], away: r[4] }; });

  const predsByRef = {};
  predictions.forEach(r => {
    const ref = r[0];
    if (!predsByRef[ref]) predsByRef[ref] = {};
    predsByRef[ref][String(r[1])] = { home: r[2], away: r[3] };
  });

  // One row per person (grouped by email), summing across all their paid entries
  const personMap = {};
  entries.forEach(row => {
    const email  = row[2].toLowerCase();
    const name   = row[1];
    const code   = row[3];
    const paid   = row[4] === 'paid';
    if (!paid) return; // only count paid entries

    if (!personMap[email]) personMap[email] = { name, email, raffleEntries: 0, exactScores: 0, correctResults: 0, paidVotes: 0 };
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
  const data = getSheet('Entries').getDataRange().getValues().slice(1);
  // One card per paid entry
  return data
    .filter(r => r[4] === 'paid')
    .map(r => ({ name: r[1], refCode: r[3] }));
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function generateRefCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'BSA-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // Ensure uniqueness
  const existing = getSheet('Entries').getDataRange().getValues().map(r => r[3]);
  return existing.includes(code) ? generateRefCode() : code;
}
