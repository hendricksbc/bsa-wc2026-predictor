// Replace with your deployed Google Apps Script web app URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz4aLyhNxCFiS_QZ2Y4PWx4xSLTIlYTFBOT2lDECmWg1vUgdURMhkZ3oq4kTsX5l7E6/exec';

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
