// BSA WC2026 Predictor — Google Apps Script Backend
// Deploy as: Web App → Execute as: Me → Who has access: Anyone
// After deploying, copy the web app URL into js/sheets-client.js

const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID'; // Replace after creating the sheet
const ENTRY_FEE = 50;

function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Add headers
    if (name === 'Entries') {
      sheet.appendRow(['Timestamp', 'Name', 'Email', 'RefCode', 'PaymentStatus', 'PaidAt']);
      sheet.setFrozenRows(1);
    } else if (name === 'Predictions') {
      sheet.appendRow(['Email', 'MatchID', 'HomeScore', 'AwayScore', 'SubmittedAt']);
      sheet.setFrozenRows(1);
    } else if (name === 'Results') {
      sheet.appendRow(['MatchID', 'HomeTeam', 'AwayTeam', 'HomeScore', 'AwayScore', 'EnteredAt']);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

// ── GET handler ───────────────────────────────────────────────────────────────

function doGet(e) {
  const action = e.parameter.action || 'stats';
  let result;

  try {
    if (action === 'stats') result = getStats();
    else if (action === 'leaderboard') result = getLeaderboard();
    else if (action === 'paid_entries') result = getPaidEntries();
    else if (action === 'results') result = getResults();
    else if (action === 'my_predictions') result = getMyPredictions(e.parameter.email);
    else result = { error: 'Unknown action' };
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── POST handler ──────────────────────────────────────────────────────────────

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {
    return jsonResponse({ error: 'Invalid JSON' });
  }

  let result;
  try {
    if (body.action === 'submit') result = submitEntry(body);
    else if (body.action === 'save_result') result = saveResult(body);
    else if (body.action === 'mark_paid') result = markPaid(body);
    else result = { error: 'Unknown action' };
  } catch (err) {
    result = { error: err.message };
  }

  return jsonResponse(result);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Actions ───────────────────────────────────────────────────────────────────

function submitEntry(body) {
  const { name, email, predictions } = body;
  if (!name || !email) return { error: 'Name and email required' };

  const emailNorm = email.toLowerCase().trim();
  const entriesSheet = getSheet('Entries');
  const predsSheet = getSheet('Predictions');

  // Check if entry exists
  const entries = entriesSheet.getDataRange().getValues();
  let existingRow = -1;
  let refCode = '';

  for (let i = 1; i < entries.length; i++) {
    if (entries[i][2].toLowerCase() === emailNorm) {
      existingRow = i + 1; // 1-indexed
      refCode = entries[i][3];
      break;
    }
  }

  // Create entry if new
  if (existingRow === -1) {
    refCode = generateRefCode(emailNorm);
    entriesSheet.appendRow([
      new Date().toISOString(), name, emailNorm, refCode, 'pending', ''
    ]);
  } else {
    // Update name in case it changed
    entriesSheet.getRange(existingRow, 2).setValue(name);
  }

  // Save/update predictions
  if (predictions && typeof predictions === 'object') {
    const predData = predsSheet.getDataRange().getValues();
    const now = new Date().toISOString();

    Object.entries(predictions).forEach(([matchId, scores]) => {
      if (scores.home === '' || scores.away === '' || scores.home === null || scores.away === null) return;

      // Find existing prediction
      let predRow = -1;
      for (let i = 1; i < predData.length; i++) {
        if (predData[i][0].toLowerCase() === emailNorm && String(predData[i][1]) === String(matchId)) {
          predRow = i + 1;
          break;
        }
      }

      if (predRow === -1) {
        predsSheet.appendRow([emailNorm, matchId, scores.home, scores.away, now]);
      } else {
        predsSheet.getRange(predRow, 3, 1, 3).setValues([[scores.home, scores.away, now]]);
      }
    });
  }

  return { success: true, refCode, isNew: existingRow === -1 };
}

function saveResult(body) {
  const { matchId, homeScore, awayScore, homeTeam, awayTeam } = body;
  if (matchId === undefined || homeScore === undefined || awayScore === undefined) {
    return { error: 'matchId, homeScore, awayScore required' };
  }

  const sheet = getSheet('Results');
  const data = sheet.getDataRange().getValues();

  let existingRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(matchId)) { existingRow = i + 1; break; }
  }

  if (existingRow === -1) {
    sheet.appendRow([matchId, homeTeam || '', awayTeam || '', homeScore, awayScore, new Date().toISOString()]);
  } else {
    sheet.getRange(existingRow, 4, 1, 3).setValues([[homeScore, awayScore, new Date().toISOString()]]);
  }

  return { success: true };
}

function markPaid(body) {
  const { email, paid } = body;
  if (!email) return { error: 'Email required' };

  const sheet = getSheet('Entries');
  const data = sheet.getDataRange().getValues();
  const emailNorm = email.toLowerCase().trim();

  for (let i = 1; i < data.length; i++) {
    if (data[i][2].toLowerCase() === emailNorm) {
      sheet.getRange(i + 1, 5).setValue(paid ? 'paid' : 'pending');
      sheet.getRange(i + 1, 6).setValue(paid ? new Date().toISOString() : '');
      return { success: true };
    }
  }
  return { error: 'Entry not found' };
}

// ── Reads ─────────────────────────────────────────────────────────────────────

function getStats() {
  const entries = getSheet('Entries').getDataRange().getValues();
  const total = Math.max(0, entries.length - 1);
  const paid = entries.slice(1).filter(r => r[4] === 'paid').length;
  return {
    totalEntries: total,
    paidEntries: paid,
    prizePool: paid * ENTRY_FEE,
    rafflePrize: paid * ENTRY_FEE * 0.5,
  };
}

function getResults() {
  const data = getSheet('Results').getDataRange().getValues();
  const results = {};
  data.slice(1).forEach(r => {
    results[r[0]] = { homeScore: r[3], awayScore: r[4] };
  });
  return results;
}

function getMyPredictions(email) {
  if (!email) return {};
  const emailNorm = email.toLowerCase().trim();
  const data = getSheet('Predictions').getDataRange().getValues();
  const preds = {};
  data.slice(1).forEach(r => {
    if (r[0].toLowerCase() === emailNorm) {
      preds[r[1]] = { home: r[2], away: r[3] };
    }
  });
  return preds;
}

function getLeaderboard() {
  const entries = getSheet('Entries').getDataRange().getValues().slice(1);
  const predictions = getSheet('Predictions').getDataRange().getValues().slice(1);
  const results = getSheet('Results').getDataRange().getValues().slice(1);

  const resultMap = {};
  results.forEach(r => { resultMap[String(r[0])] = { home: r[3], away: r[4] }; });

  const predsByEmail = {};
  predictions.forEach(r => {
    const em = r[0].toLowerCase();
    if (!predsByEmail[em]) predsByEmail[em] = {};
    predsByEmail[em][String(r[1])] = { home: r[2], away: r[3] };
  });

  return entries.map(row => {
    const email = row[2].toLowerCase();
    const preds = predsByEmail[email] || {};
    let points = 0, exact = 0, correct = 0;

    Object.entries(preds).forEach(([matchId, pred]) => {
      const result = resultMap[matchId];
      if (!result || result.home === '' || result.home === null) return;
      const h = Number(pred.home), a = Number(pred.away);
      const rh = Number(result.home), ra = Number(result.away);
      if (h === rh && a === ra) { points += 3; exact++; correct++; }
      else if (Math.sign(h - a) === Math.sign(rh - ra)) { points += 1; correct++; }
    });

    return {
      name: row[1],
      refCode: row[3],
      paid: row[4] === 'paid',
      points,
      exact,
      correct,
    };
  }).sort((a, b) => b.points - a.points);
}

function getPaidEntries() {
  const data = getSheet('Entries').getDataRange().getValues().slice(1);
  return data
    .filter(r => r[4] === 'paid')
    .map(r => ({ name: r[1], refCode: r[3] }));
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function generateRefCode(email) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) & 0xffffffff;
  let code = 'BSA-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.abs(hash >> (i * 5)) % chars.length];
  }
  return code;
}
