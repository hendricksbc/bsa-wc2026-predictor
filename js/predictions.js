// Load all predictions for the current user
async function loadUserPredictions(userId) {
  const { data } = await sb
    .from('predictions')
    .select('*')
    .eq('user_id', userId);
  const map = {};
  (data || []).forEach(p => { map[p.match_id] = p; });
  return map;
}

// Load actual results
async function loadResults() {
  const { data } = await sb.from('match_results').select('*');
  const map = {};
  (data || []).forEach(r => { map[r.match_id] = r; });
  return map;
}

// Save a single prediction (upsert)
async function savePrediction(userId, matchId, homeScore, awayScore) {
  const { error } = await sb.from('predictions').upsert({
    user_id: userId,
    match_id: matchId,
    home_score: homeScore,
    away_score: awayScore,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,match_id' });
  return !error;
}

// Compute leaderboard from all predictions + results
async function computeLeaderboard() {
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, full_name, avatar_url, reference_code, payment_status');

  const { data: predictions } = await sb
    .from('predictions')
    .select('user_id, match_id, home_score, away_score');

  const { data: results } = await sb
    .from('match_results')
    .select('match_id, home_score, away_score');

  const resultMap = {};
  (results || []).forEach(r => { resultMap[r.match_id] = r; });

  const predsByUser = {};
  (predictions || []).forEach(p => {
    if (!predsByUser[p.user_id]) predsByUser[p.user_id] = [];
    predsByUser[p.user_id].push(p);
  });

  return (profiles || []).map(profile => {
    const preds = predsByUser[profile.id] || [];
    let points = 0, exact = 0, correct = 0;

    preds.forEach(pred => {
      const result = resultMap[pred.match_id];
      if (!result || result.home_score === null) return;
      const pts = calcPoints(pred, { homeScore: result.home_score, awayScore: result.away_score });
      if (pts === 3) { points += 3; exact++; correct++; }
      else if (pts === 1) { points += 1; correct++; }
    });

    return { ...profile, points, exact, correct };
  }).sort((a, b) => b.points - a.points);
}

// Get all paid entries for raffle display
async function getPaidEntries() {
  const { data } = await sb
    .from('profiles')
    .select('id, full_name, avatar_url, reference_code')
    .eq('payment_status', 'paid');
  return data || [];
}
