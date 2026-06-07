const ENTRY_FEE = 50;
const LOCK_MINUTES = 60;

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getUser() {
  const { data: { session } } = await sb.auth.getSession();
  return session?.user ?? null;
}

async function signInWithGoogle() {
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
}

async function signOut() {
  await sb.auth.signOut();
  window.location.reload();
}

// ── Profile ───────────────────────────────────────────────────────────────────

async function getOrCreateProfile(user) {
  let { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    const refCode = generateReferenceCode(user.id);
    const { data } = await sb.from('profiles').insert({
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email,
      avatar_url: user.user_metadata?.avatar_url || null,
      reference_code: refCode,
    }).select().single();
    profile = data;
  }
  return profile;
}

// ── Reference code ────────────────────────────────────────────────────────────

function generateReferenceCode(userId) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'BSA-';
  // Use userId characters as seed for determinism
  for (let i = 0; i < 4; i++) {
    const charCode = userId.charCodeAt(i % userId.length) + i * 7;
    code += chars[charCode % chars.length];
  }
  return code;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let _fixtures = null;

async function loadFixtures() {
  if (_fixtures) return _fixtures;
  const res = await fetch('/bsa-wc2026-predictor/data/fixtures.json?t=' + Date.now());
  _fixtures = await res.json();
  return _fixtures;
}

function getAllMatches(fixtures) {
  const matches = [];
  for (const group of Object.values(fixtures.groups)) {
    matches.push(...group.matches);
  }
  for (const round of fixtures.knockoutRounds || []) {
    matches.push(...(round.matches || []));
  }
  return matches;
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function toSAST(utcDateStr) {
  const d = new Date(utcDateStr);
  return d.toLocaleString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });
}

function isMatchLocked(utcDateStr) {
  const kickoff = new Date(utcDateStr).getTime();
  const now = Date.now();
  return now >= kickoff - LOCK_MINUTES * 60 * 1000;
}

// ── Points ────────────────────────────────────────────────────────────────────

function calcPoints(pred, result) {
  if (result.homeScore === null) return null;
  if (pred.home_score === result.homeScore && pred.away_score === result.awayScore) return 3;
  const predResult = Math.sign(pred.home_score - pred.away_score);
  const actualResult = Math.sign(result.homeScore - result.awayScore);
  if (predResult === actualResult) return 1;
  return 0;
}

// ── Prize pool ────────────────────────────────────────────────────────────────

async function getPrizePool() {
  const { count } = await sb
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('payment_status', 'paid');
  return (count || 0) * ENTRY_FEE;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showToast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function setActive(selector) {
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const el = document.querySelector(selector);
  if (el) el.classList.add('active');
}

// ── Nav render ────────────────────────────────────────────────────────────────

async function renderNav(activeLink) {
  const user = await getUser();
  const navAuth = document.getElementById('nav-auth');
  if (!navAuth) return;

  if (user) {
    const profile = await getOrCreateProfile(user);
    const name = profile.full_name?.split(' ')[0] || 'You';
    const avatar = profile.avatar_url
      ? `<img src="${profile.avatar_url}" alt="${name}">`
      : `<div style="width:28px;height:28px;border-radius:50%;background:var(--navy-mid);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--gold)">${name[0]}</div>`;
    navAuth.innerHTML = `
      <div class="nav-user">${avatar}<span>${name}</span></div>
      <button class="btn btn-outline btn-sm" onclick="signOut()">Sign out</button>
    `;
  } else {
    navAuth.innerHTML = `<button class="btn btn-primary btn-sm" onclick="signInWithGoogle()">Sign in</button>`;
  }

  if (activeLink) setActive(activeLink);
}

function teamFlag(name) {
  const flags = {
    'USA': '🇺🇸', 'Panama': '🇵🇦', 'Albania': '🇦🇱', 'Ukraine': '🇺🇦',
    'Mexico': '🇲🇽', 'Jamaica': '🇯🇲', 'Cameroon': '🇨🇲', 'New Zealand': '🇳🇿',
    'Canada': '🇨🇦', 'Venezuela': '🇻🇪', 'Morocco': '🇲🇦', 'Belgium': '🇧🇪',
    'Brazil': '🇧🇷', 'Croatia': '🇭🇷', 'Algeria': '🇩🇿', 'Australia': '🇦🇺',
    'Spain': '🇪🇸', 'Serbia': '🇷🇸', 'South Korea': '🇰🇷', 'Senegal': '🇸🇳',
    'Portugal': '🇵🇹', 'Czech Republic': '🇨🇿', 'Nigeria': '🇳🇬', 'Uruguay': '🇺🇾',
    'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Slovenia': '🇸🇮', "Côte d'Ivoire": '🇨🇮', 'Ecuador': '🇪🇨',
    'France': '🇫🇷', 'Poland': '🇵🇱', 'Saudi Arabia': '🇸🇦', 'Paraguay': '🇵🇾',
    'Argentina': '🇦🇷', 'Chile': '🇨🇱', 'Japan': '🇯🇵', 'Zambia': '🇿🇲',
    'Germany': '🇩🇪', 'Colombia': '🇨🇴', 'Denmark': '🇩🇰', 'China': '🇨🇳',
    'Netherlands': '🇳🇱', 'Peru': '🇵🇪', 'Qatar': '🇶🇦',
    'Turkey': '🇹🇷', 'Bolivia': '🇧🇴', 'Indonesia': '🇮🇩', 'Burkina Faso': '🇧🇫',
  };
  return flags[name] || '🏳️';
}
