# BSA WC2026 Predictor — Technical Overview

**Live site:** https://hendricksbc.github.io/bsa-wc2026-predictor/  
**Repository:** https://github.com/hendricksbc/bsa-wc2026-predictor  
**Google Sheet:** https://docs.google.com/spreadsheets/d/1mwaNqjNhDIfWahhIWjjbQSRBi-n3qAjI9_euDG3VxOY  
**Admin panel:** https://hendricksbc.github.io/bsa-wc2026-predictor/admin.html  

---

## What We Built

A social club score predictor competition for the FIFA World Cup 2026, hosted on GitHub Pages for Bergvliet Hockey Club (BSA). Participants predict match scores, earn raffle entries for correct predictions, and compete for 50% of the prize pool in a weighted raffle draw after the Final.

---

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | GitHub Pages (static HTML/CSS/JS) | All user-facing pages |
| Backend | Google Apps Script (Web App) | Stores entries, processes payments, leaderboard |
| Database | Google Sheets | Entries, Payments |
| Fixture data | football-data.org API | Live match scores and results |
| Fixture sync | GitHub Actions (cron every 2hrs) | Auto-updates `data/fixtures.json` |
| Payment validation | SnapScan campaign QR + manual export | Reference code matching |
| Flag images | flagcdn.com CDN | Country flag images for all 48 teams |

---

## Pages

| Page | URL | Purpose |
|------|-----|---------|
| Home | `/index.html` | Landing page, prize pool display, how it works |
| Fixtures | `/fixtures.html` | Browse all 104 matches, submit predictions |
| Leaderboard | `/leaderboard.html` | Ranked table by raffle entries earned |
| Raffle Pool | `/raffle.html` | Visual grid of all paid entries |
| Terms & Conditions | `/terms.html` | Full competition rules and governance |
| Admin | `/admin.html` | Payment sync, raffle draw (password protected) |

---

## How It Works

### User Flow
1. User visits the Fixtures page and browses all World Cup matches
2. They enter a score prediction for a specific match and click **Submit — R50**
3. If first time: prompted for name, email, POPIA consent, and 18+ T&Cs acceptance
4. A unique **reference code** (e.g. `BSA-CYZQ`) is generated and displayed
5. User pays R50 via SnapScan using their reference code as the payment reference
6. Once payment is confirmed, their prediction becomes active
7. They can predict additional matches at R50 each — each gets its own reference code

### Prediction Rules
- **One prediction per match per R50** — each submission covers one match
- **Predictions are final once submitted** — no editing after submission
- **Locks 30 minutes before kickoff** — per match, independently
- **Competition closes 30 minutes before the FIFA World Cup 2026 Final**

### Scoring
| Outcome | Raffle Entries |
|---------|---------------|
| Exact correct score | 3 entries |
| Correct result only (right winner/draw, wrong score) | 1 entry |
| Wrong | 0 entries |

Only **paid** predictions earn raffle entries. Unpaid submissions are void.

### Prize Structure
- **50%** of all entry fees → raffle prize pool
- **50%** → BSA club funds
- Raffle draw is **weighted** — more entries = better odds
- Winner paid by EFT after the Final

---

## Data Model

### Google Sheet — Entries Tab
| Column | Header | Description |
|--------|--------|-------------|
| A | Timestamp | When prediction was submitted |
| B | Name | Participant's full name |
| C | Email | Participant's email (lowercased) |
| D | RefCode | Unique code e.g. `BSA-CYZQ` |
| E | MatchID | ID of the predicted match |
| F | MatchName | e.g. "Mexico vs South Africa" |
| G | HomeScore | Predicted home team score |
| H | AwayScore | Predicted away team score |
| I | PaymentStatus | `pending` or `paid` |
| J | PaidAt | Timestamp of payment confirmation |

### Google Sheet — Payments Tab
| Column | Header | Description |
|--------|--------|-------------|
| A | Timestamp | When row was added |
| B | Reference | BSA reference code from SnapScan export |
| C | Amount | Payment amount (R50) |
| D | Note | Optional note |

---

## Automated Systems

### Fixture Auto-Update (GitHub Actions)
- Runs every 2 hours via cron schedule
- Fetches all 104 WC2026 matches from `football-data.org` API (`/v4/competitions/WC/matches`)
- Transforms data into `data/fixtures.json`
- Commits updated file to repo → GitHub Pages serves it automatically
- **No manual action required** — match scores appear on the site within 2 hours of full time

### Payment Auto-Sync (Apps Script Trigger)
- Runs every hour via Apps Script time-based trigger
- Reads all reference codes from the Payments sheet (column B)
- Matches against Entries sheet (column D)
- Marks matched entries as `paid` in column I
- **No manual action required** once treasurer pastes SnapScan data into the Payments sheet

### Leaderboard Auto-Calculation
- Calculated in real time when the leaderboard page loads
- Apps Script fetches latest `fixtures.json` from GitHub for match results
- Calculates raffle entries per person across all their paid predictions
- Refreshes every 60 seconds on the leaderboard page

---

## Key Technical Notes

- **Apps Script cold start:** First load of leaderboard/raffle pages may take 3-8 seconds while Apps Script wakes up. Fixtures page renders immediately (from CDN) and loads user data in the background.
- **Fixture data lag:** Results appear within 2 hours of a match ending. Not real-time.
- **SnapScan reference format:** Only codes starting with `BSA-` are matched. The sync ignores all other content in the Payments sheet.
- **Multiple votes:** One person can have multiple reference codes (one per match per R50 payment). The leaderboard groups all paid votes by email.

---

## Files & Configuration

| File | Purpose |
|------|---------|
| `js/app.js` | Shared JS: user session, fixtures, flags, utilities |
| `js/sheets-client.js` | Apps Script URL config |
| `data/fixtures.json` | Auto-updated fixture and results data |
| `google-apps-script/Code.gs` | Full backend — deploy this to Apps Script |
| `.github/workflows/update-fixtures.yml` | GitHub Action for fixture sync |
| `css/styles.css` | Full site styling (dark theme, FIFA colours) |
| `images/` | Club logo, trophy, flag images |

### Key Config Values
| Value | Location | Current Setting |
|-------|----------|----------------|
| Entry fee | `js/app.js` → `ENTRY_FEE` | R50 |
| Lock time | `js/app.js` → `LOCK_MINUTES` | 30 minutes |
| Apps Script URL | `js/sheets-client.js` | Live |
| Sheet ID | `google-apps-script/Code.gs` | Live |
| Admin password | `admin.html` → `ADMIN_PASSWORD` | `BSA2026ADMIN` |
| Football API key | GitHub Secret → `FOOTBALL_API_KEY` | Live |

---

## Outstanding TODOs — Pre-Launch

### 🔴 Blocking (must be done before sharing the link)

| # | Item | Action Required |
|---|------|----------------|
| 1 | **SnapScan campaign QR** | Treasurer creates dedicated "World Cup 2026" payment page in SnapScan portal → provides QR image → drop into `images/snapscan-qr.png` and update the placeholder in `fixtures.html` |
| 2 | **Admin password** | Change `BSA2026ADMIN` in `admin.html` to a secure password known only to the organiser |
| 3 | **Organiser contact details** | Add name and email of the responsible BSA person to `terms.html` sections 1 and 8 |
| 4 | **Dispute resolution contact** | Add submission process and contact to `terms.html` section 8 |

### 🟡 Required before money is collected

| # | Item | Action Required |
|---|------|----------------|
| 5 | **Full POPIA notice** | Replace the TODO placeholder in `terms.html` section 9 with a complete POPIA compliance notice naming the Responsible Party and Information Officer |
| 6 | **Draw process document** | Write and publish a documented draw procedure — who runs it, when, how the result is recorded |
| 7 | **Winner payment process** | Document the EFT process — which BSA account funds come from, who authorises it, timeline |

### 🟢 Nice to have

| # | Item | Notes |
|---|------|-------|
| 8 | **SnapScan column mapping** | Confirm which column in the SnapScan CSV export contains the payment reference — adjust Apps Script if not column B |
| 9 | **Test full payment cycle** | End-to-end test: submit prediction → pay via SnapScan → confirm entry marks as paid → appears on leaderboard |
| 10 | **Mobile testing** | Test the full flow on a mobile browser — primary device for most participants |

---

## Governance Notes

- Competition is restricted to **BSA club members and associates** — do not post the link publicly
- Participants must be **18 years of age or older**
- **No maximum** on number of predictions per person
- **Competition closes 30 minutes before the FIFA World Cup 2026 Final**
- This is structured as a **social club sweepstake** — not a commercial gambling operation
- BSA is not affiliated with FIFA or any official World Cup body
