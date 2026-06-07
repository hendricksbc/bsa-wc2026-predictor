// Replace with your deployed Google Apps Script web app URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbytGT_BjDvOcpPDY8pXo1ETElnM03G0C6Gyh9bZHWBnEFnUXb7KPFgDX4LBMMUx7Hg8/exec';

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
