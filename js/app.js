const ENTRY_FEE = 50;
const LOCK_MINUTES = 30;
const LS_USER_KEY = 'bsa_wc2026_user';

// ── Local user session (name + email stored in localStorage) ──────────────────

function getLocalUser() {
  try { return JSON.parse(localStorage.getItem(LS_USER_KEY)); } catch (_) { return null; }
}

function setLocalUser(name, email, refCode = null) {
  const existing = getLocalUser();
  const user = { name: name.trim(), email: email.trim().toLowerCase(), refCode: refCode || existing?.refCode || null };
  localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
  return user;
}

function clearLocalUser() {
  localStorage.removeItem(LS_USER_KEY);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let _fixtures = null;

async function loadFixtures() {
  if (_fixtures) return _fixtures;
  const base = window.location.hostname === 'localhost' ? '' : '/bsa-wc2026-predictor';
  const res = await fetch(`${base}/data/fixtures.json?t=${Date.now()}`);
  _fixtures = await res.json();
  return _fixtures;
}

function getAllMatches(fixtures) {
  const matches = [];
  for (const group of Object.values(fixtures.groups || {})) matches.push(...group.matches);
  for (const round of fixtures.knockoutRounds || []) matches.push(...(round.matches || []));
  return matches;
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function toSAST(utcDateStr) {
  return new Date(utcDateStr).toLocaleString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function isMatchLocked(utcDateStr) {
  return Date.now() >= new Date(utcDateStr).getTime() - LOCK_MINUTES * 60 * 1000;
}

// ── Raffle entries ────────────────────────────────────────────────────────────

function calcRaffleEntries(predHome, predAway, resHome, resAway) {
  if (resHome === null || resHome === '' || resHome === undefined) return null;
  const ph = Number(predHome), pa = Number(predAway);
  const rh = Number(resHome), ra = Number(resAway);
  if (ph === rh && pa === ra) return 3; // exact score → 3 entries
  if (Math.sign(ph - pa) === Math.sign(rh - ra)) return 1; // correct result → 1 entry
  return 0;
}

// ── Team flags — all 48 WC 2026 teams via flagcdn.com ────────────────────────

const FLAG_CODES = {
  'Algeria':            'dz',
  'Argentina':          'ar',
  'Australia':          'au',
  'Austria':            'at',
  'Belgium':            'be',
  'Bosnia-Herzegovina': 'ba',
  'Brazil':             'br',
  'Canada':             'ca',
  'Cape Verde Islands': 'cv',
  'Colombia':           'co',
  'Congo DR':           'cd',
  'Croatia':            'hr',
  'Curaçao':            'cw',
  'Czechia':            'cz',
  'Ecuador':            'ec',
  'Egypt':              'eg',
  'England':            'gb-eng',
  'France':             'fr',
  'Germany':            'de',
  'Ghana':              'gh',
  'Haiti':              'ht',
  'Iran':               'ir',
  'Iraq':               'iq',
  'Ivory Coast':        'ci',
  'Japan':              'jp',
  'Jordan':             'jo',
  'Mexico':             'mx',
  'Morocco':            'ma',
  'Netherlands':        'nl',
  'New Zealand':        'nz',
  'Norway':             'no',
  'Panama':             'pa',
  'Paraguay':           'py',
  'Portugal':           'pt',
  'Qatar':              'qa',
  'Saudi Arabia':       'sa',
  'Scotland':           'gb-sct',
  'Senegal':            'sn',
  'South Africa':       'za',
  'South Korea':        'kr',
  'Spain':              'es',
  'Sweden':             'se',
  'Switzerland':        'ch',
  'Tunisia':            'tn',
  'Turkey':             'tr',
  'United States':      'us',
  'Uruguay':            'uy',
  'Uzbekistan':         'uz',
};

function teamFlag(name) {
  const code = FLAG_CODES[name];
  if (!code) return `<div class="flag-placeholder">${name.slice(0,3).toUpperCase()}</div>`;
  return `<img src="https://flagcdn.com/w80/${code}.png" class="team-flag-img" alt="${name}" loading="lazy">`;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showToast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function avatar(name) {
  return `<div class="player-avatar">${(name || '?')[0].toUpperCase()}</div>`;
}

// ── Nav ───────────────────────────────────────────────────────────────────────

function renderNav(activeSel) {
  const user = getLocalUser();
  const el = document.getElementById('nav-auth');
  if (!el) return;
  if (user) {
    el.innerHTML = `
      <span class="nav-user"><strong>${user.name.split(' ')[0]}</strong></span>
      <button class="btn btn-outline btn-sm" onclick="handleSignOut()">Sign out</button>`;
  } else {
    el.innerHTML = `<a href="fixtures.html" class="btn btn-primary btn-sm">Enter Competition</a>`;
  }
  if (activeSel) {
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const a = document.querySelector(activeSel);
    if (a) a.classList.add('active');
  }
}

function handleSignOut() {
  if (confirm('Clear your local session? You can re-enter your email to retrieve your predictions.')) {
    clearLocalUser();
    window.location.href = 'index.html';
  }
}
