// Replace with your deployed Google Apps Script web app URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyxXcLPZXb16IXxlo7HRo4AwNjG5kHp-byRjBaHLMEd6CIBisxTqqvhPqMm1KiDgIrY/exec';

async function sheetsGet(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${APPS_SCRIPT_URL}?${qs}`);
  return res.json();
}

async function sheetsPost(body) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.json();
}
