const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('raw_matches.json', 'utf8'));
const existing = JSON.parse(fs.readFileSync('data/fixtures.json', 'utf8'));

const statusMap = {
  SCHEDULED: 'SCHEDULED',
  TIMED: 'SCHEDULED',
  IN_PLAY: 'LIVE',
  PAUSED: 'LIVE',
  FINISHED: 'FINISHED',
  SUSPENDED: 'SCHEDULED',
  POSTPONED: 'SCHEDULED',
  CANCELLED: 'SCHEDULED',
  AWARDED: 'FINISHED',
};

function buildMatch(m) {
  return {
    id: m.id,
    homeTeam: m.homeTeam.name,
    awayTeam: m.awayTeam.name,
    utcDate: m.utcDate,
    status: statusMap[m.status] || m.status,
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
    venue: m.venue || '',
    stage: m.stage,
    group: m.group,
  };
}

const groups = {};
const knockoutRounds = [];

(raw.matches || []).forEach(m => {
  const match = buildMatch(m);
  if (m.stage === 'GROUP_STAGE' && m.group) {
    const key = m.group.replace('GROUP_', '');
    if (!groups[key]) groups[key] = { teams: [], matches: [] };
    groups[key].matches.push(match);

    // Collect unique teams
    [m.homeTeam.name, m.awayTeam.name].forEach(t => {
      if (!groups[key].teams.includes(t)) groups[key].teams.push(t);
    });
  } else {
    // Knockout — group by stage
    let round = knockoutRounds.find(r => r.stage === m.stage);
    if (!round) {
      round = { stage: m.stage, name: formatStageName(m.stage), matches: [] };
      knockoutRounds.push(round);
    }
    round.matches.push(match);
  }
});

function formatStageName(stage) {
  const names = {
    ROUND_OF_32: 'Round of 32',
    ROUND_OF_16: 'Round of 16',
    QUARTER_FINALS: 'Quarter-Finals',
    SEMI_FINALS: 'Semi-Finals',
    THIRD_PLACE: 'Third Place',
    FINAL: 'Final',
  };
  return names[stage] || stage;
}

// Sort groups alphabetically, sort matches by date
const sortedGroups = {};
Object.keys(groups).sort().forEach(k => {
  groups[k].matches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  sortedGroups[k] = groups[k];
});

knockoutRounds.sort((a, b) => {
  const order = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];
  return order.indexOf(a.stage) - order.indexOf(b.stage);
});

const output = {
  lastUpdated: new Date().toISOString(),
  competition: existing.competition,
  entryFee: existing.entryFee,
  groups: Object.keys(sortedGroups).length > 0 ? sortedGroups : existing.groups,
  knockoutRounds: knockoutRounds.length > 0 ? knockoutRounds : existing.knockoutRounds,
};

fs.writeFileSync('data/fixtures.json', JSON.stringify(output, null, 2));
console.log(`Updated fixtures.json — ${(raw.matches || []).length} matches processed.`);
