# BSA World Cup 2026 Predictor

Live site: https://hendricksbc.github.io/bsa-wc2026-predictor/

## Setup Checklist

### 1. Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new sheet named **BSA WC2026**
2. Copy the Sheet ID from the URL: `docs.google.com/spreadsheets/d/**SHEET_ID**/edit`
3. The Apps Script will auto-create the tabs (Entries, Predictions, Results) on first use

### 2. Deploy the Google Apps Script

1. In the sheet, go to **Extensions → Apps Script**
2. Delete any existing code and paste the contents of `google-apps-script/Code.gs`
3. Replace `YOUR_GOOGLE_SHEET_ID` with your actual Sheet ID
4. Click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Authorise the app when prompted
6. Copy the **Web app URL**

### 3. Wire up the frontend

Update two files with your real values:

**`js/sheets-client.js`** — replace `YOUR_APPS_SCRIPT_URL` with the web app URL from step 2

**`admin.html`** — replace `YOUR_GOOGLE_SHEET_ID` in the `SHEET_URL` constant

Commit and push — the site updates automatically via GitHub Pages.

### 4. football-data.org API key

1. Sign up at [football-data.org](https://www.football-data.org/client/register) (free)
2. Go to GitHub repo → **Settings → Secrets and variables → Actions**
3. Add secret: `FOOTBALL_API_KEY` = your key

The GitHub Action runs every 2 hours and updates `data/fixtures.json` with live scores.

### 5. SnapScan QR

Ask the club treasurer to create a new **payment page** in the SnapScan merchant portal named "World Cup 2026". This gives a separate QR and lets them filter all competition payments easily.

Once you have the QR image:
1. Save it as `images/snapscan-qr.png`
2. In `fixtures.html`, find `.snapscan-placeholder` and replace with:
   ```html
   <img src="images/snapscan-qr.png" style="width:160px;height:160px;border-radius:8px;">
   ```

### 6. Change the admin password

In `admin.html`, find `const ADMIN_PASSWORD = 'BSA2026ADMIN'` and change it.

---

## How it works

- Users enter name + email on the Fixtures page (no account needed)
- They fill in score predictions and click **Save & Get Payment Code**
- They get a unique reference code (e.g. `BSA-G4RK`) to use when paying
- You open the Google Sheet, find their row, mark them as paid
- Leaderboard and raffle pool update automatically

## Scoring

| Result | Points |
|--------|--------|
| Exact score | 3 pts + raffle entry |
| Correct result (win/draw) | 1 pt |
| Wrong | 0 pts |

Entry fee: R50. 50% of proceeds → raffle prize pool.  
Change `ENTRY_FEE` in `js/app.js` if the fee changes.
