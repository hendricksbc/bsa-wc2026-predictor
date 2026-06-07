# BSA WC2026 Predictor — Competition Management Guide

**For competition organisers only**  
**Site:** https://hendricksbc.github.io/bsa-wc2026-predictor/  
**Admin panel:** https://hendricksbc.github.io/bsa-wc2026-predictor/admin.html  
**Google Sheet:** https://docs.google.com/spreadsheets/d/1mwaNqjNhDIfWahhIWjjbQSRBi-n3qAjI9_euDG3VxOY  

---

## Roles & Responsibilities

| Role | Responsibilities |
|------|----------------|
| **Competition Organiser** | Admin panel access, raffle draw, winner notification, dispute resolution |
| **Treasurer** | SnapScan payment export, pasting payment data into Google Sheet |
| **IT Contact** | Any technical issues (Bevan Hendricks — bevan@silvertreebrands.com) |

---

## Before the Competition Opens

Complete every item on this checklist before sharing the link with members:

- [ ] SnapScan "World Cup 2026" campaign QR has been loaded onto the site
- [ ] Admin password has been changed from the default
- [ ] Organiser contact details are added to the Terms & Conditions page
- [ ] Dispute resolution contact is added to the Terms & Conditions page
- [ ] POPIA notice is complete on the Terms & Conditions page
- [ ] You have confirmed the SnapScan export column that contains the payment reference
- [ ] You have tested a full entry end-to-end (submit → pay → confirm paid on sheet)
- [ ] The Google Sheet is accessible to the Treasurer
- [ ] The competition link has been distributed only to BSA members and associates

---

## Sharing the Competition

**Only share the link directly with club members** — do not post it publicly on social media or public channels. The competition is structured as a members-only social sweepstake.

**Message template for members:**
> Hi [Name], Bergvliet HC is running a FIFA World Cup 2026 score predictor competition! Predict match scores for R50 per prediction and win a share of the prize pool. 18+ only. Enter here: https://hendricksbc.github.io/bsa-wc2026-predictor/ — full T&Cs on the site.

---

## User Journey — What Happens When Someone Enters

This is the complete flow from a participant's perspective. No action is required from organisers for steps 1–5.

**Step 1 — Browse fixtures**  
User visits the Fixtures page and sees all World Cup matches grouped by group (A–L) and knockout rounds.

**Step 2 — Submit a prediction**  
User clicks on a match, enters a predicted score (e.g. 2:1), clicks **Submit — R50**. On their first prediction they enter their name and email and accept the T&Cs and POPIA consent.

**Step 3 — Receive reference code**  
A unique reference code (e.g. `BSA-CYZQ`) is displayed. The user clicks to copy it.

**Step 4 — Pay**  
User opens SnapScan, scans the BSA World Cup 2026 QR code, enters R50, and types their reference code (`BSA-CYZQ`) in the payment reference field.

**Step 5 — Wait for activation**  
The prediction shows as "⏳ pending payment" until the payment is confirmed. Once activated it shows "✓ paid".

**Step 6 — Predict more matches (optional)**  
Each additional match prediction = another R50 + another reference code.

---

## Treasurer — Processing Payments

This is the only regular manual task in the competition. Do this **after each matchday** (or at least once a day during the group stage).

### Step-by-Step

**Step 1 — Export from SnapScan**
1. Log into the SnapScan merchant portal
2. Go to the **World Cup 2026** payment page (the dedicated campaign)
3. Export or view recent transactions
4. You need the **payment reference** column — this contains the BSA codes (e.g. `BSA-CYZQ`)

**Step 2 — Paste into Google Sheet**
1. Open the [Google Sheet](https://docs.google.com/spreadsheets/d/1mwaNqjNhDIfWahhIWjjbQSRBi-n3qAjI9_euDG3VxOY)
2. Click the **Payments** tab at the bottom
3. Add a new row for each successful payment:
   - Column A: Date (e.g. 11/06/2026)
   - **Column B: Reference code** (e.g. BSA-CYZQ) ← this is the critical field
   - Column C: Amount (50)
   - Column D: Optional note
4. You can paste multiple rows at once — one row per payment

> ⚠️ **Only the reference code in column B matters for matching.** The system ignores all other columns when looking for matches.

**Step 3 — Sync (optional)**
The system automatically syncs payments every hour. If you want immediate confirmation:
1. Go to [admin.html](https://hendricksbc.github.io/bsa-wc2026-predictor/admin.html)
2. Enter the admin password
3. Click **Sync Payments Now**
4. The result will show how many new payments were matched

**Step 4 — Verify (optional)**
Open the **Entries** tab in the Google Sheet. The **PaymentStatus** column (column I) should now show `paid` for matched entries.

### What if a reference code doesn't match?

If a participant paid but their entry isn't marking as paid:
1. Check the exact code they submitted (visible in the Entries tab, column D)
2. Check the code they used as their payment reference in SnapScan
3. If they differ, manually add the correct code to the Payments sheet
4. Or use **Manual Payment Override** in the admin panel — enter the reference code and click **Mark Paid**

---

## Match Results — Fully Automatic

**You do not need to enter match results.** The system fetches live scores from the football-data.org API every 2 hours via an automated job.

- Results appear on the Fixtures page within 2 hours of a match ending
- The leaderboard updates automatically once results are in and payments are confirmed
- No organiser action required

---

## Monitoring During the Tournament

### Daily checks (recommended)
1. Open the [Google Sheet](https://docs.google.com/spreadsheets/d/1mwaNqjNhDIfWahhIWjjbQSRBi-n3qAjI9_euDG3VxOY) and review new entries in the Entries tab
2. Process any SnapScan payments (see Treasurer section above)
3. Check the [Leaderboard](https://hendricksbc.github.io/bsa-wc2026-predictor/leaderboard.html) looks correct after results come in

### Things to watch for
- Entries with `pending` status that have been more than 48 hours — follow up with participant
- Any unusual duplicate names or reference codes — investigate before marking paid
- If the leaderboard looks wrong after results come in, wait another 2 hours for the fixture sync to complete

---

## Handling Disputes

Disputes must be submitted in writing within **48 hours** of the event.

| Type of dispute | How to handle |
|----------------|---------------|
| **"I paid but my entry says pending"** | Ask for SnapScan payment screenshot showing reference code and amount. Cross-check in the Payments and Entries tabs. Use Manual Override in admin panel if correct. |
| **"My score was right but I got no raffle entries"** | Check the match result in fixtures.json matches the official FIFA result. The system uses official data only — no manual overrides on results. |
| **"I submitted the wrong score"** | Predictions are final once submitted. A new prediction requires a new R50 payment. |
| **"The match was cancelled"** | Refund the R50 via EFT. Remove the entry from the Entries sheet. Contact the IT contact to mark that match as void. |

All dispute decisions by the BSA committee are final.

---

## Cancelled or Postponed Matches

If FIFA officially cancels or abandons a match:
1. Contact the IT contact (Bevan) — the match needs to be marked as void in the system
2. Identify all participants who predicted that match (filter the Entries sheet by MatchID)
3. Refund R50 to each affected participant via EFT
4. Remove those entry rows from the Entries sheet once refunds are confirmed

If a match is postponed but subsequently played, predictions remain valid.

---

## End of Tournament — Raffle Draw

Do this **after the FIFA World Cup Final result is confirmed** and all payments have been processed.

### Step-by-Step

**Step 1 — Final payment sync**
1. Do a final SnapScan export covering the entire competition period
2. Paste into the Payments sheet
3. Go to admin panel → click **Sync Payments Now**
4. Confirm all `pending` entries that should be paid are now marked `paid`

**Step 2 — Confirm the prize pool**
1. Open the admin panel
2. Note the **Collected** figure (total paid entries × R50)
3. Note the **Raffle Prize** figure (50% of collected)
4. This is the amount to be paid to the winner

**Step 3 — Run the raffle draw**
1. Open the admin panel → **Draw Winner** button
2. The draw is weighted — participants with more raffle entries have proportionally better odds
3. **Take a screenshot of the winner screen immediately** — you will need this as a record
4. Do not close the screen until you have saved the screenshot

**Step 4 — Notify the winner**
Contact the winner using the email address they registered with:

> **Subject:** 🏆 You've won the BSA FIFA World Cup 2026 Predictor!
>
> Hi [Name],
>
> Congratulations — you've been drawn as the winner of the BSA WC2026 Score Predictor competition!
>
> Your prize is **R[amount]**, which will be transferred to your bank account via EFT.
>
> Please reply to this email with your banking details (bank, account number, account holder name, branch code) within 14 days to claim your prize.
>
> Well done and thank you for participating!
>
> [Organiser name]  
> Bergvliet Hockey Club

**Step 5 — Pay the winner**
Transfer the prize amount from BSA's designated account within a reasonable time of receiving banking details.

**Step 6 — Record keeping**
Retain for at least 1 year:
- Screenshot of the raffle draw result
- Screenshot/record of the EFT payment
- Final copy of the Google Sheet (download as Excel)

---

## Admin Panel Reference

**URL:** https://hendricksbc.github.io/bsa-wc2026-predictor/admin.html

| Section | What it does |
|---------|-------------|
| **Stats** | Live totals — entries, paid, prize pool, raffle prize |
| **Sync Payments Now** | Immediately matches Payments sheet codes to Entries — use after pasting SnapScan data |
| **Manual Payment Override** | Enter a reference code to mark it paid/unpaid manually |
| **Raffle Draw** | Weighted random draw from all paid entries |
| **Open Google Sheet** | Direct link to the data sheet |
| **View T&Cs** | Direct link to the Terms & Conditions page |

---

## Emergency Contact

For any technical issues with the site, the Google Sheet, or the Apps Script:

**Bevan Hendricks**  
bevan@silvertreebrands.com

Describe the issue, include a screenshot if possible, and note the time it occurred.

---

## Quick Reference — Key URLs

| Resource | URL |
|----------|-----|
| Competition site | https://hendricksbc.github.io/bsa-wc2026-predictor/ |
| Fixtures & predictions | https://hendricksbc.github.io/bsa-wc2026-predictor/fixtures.html |
| Leaderboard | https://hendricksbc.github.io/bsa-wc2026-predictor/leaderboard.html |
| Raffle pool | https://hendricksbc.github.io/bsa-wc2026-predictor/raffle.html |
| Terms & Conditions | https://hendricksbc.github.io/bsa-wc2026-predictor/terms.html |
| Admin panel | https://hendricksbc.github.io/bsa-wc2026-predictor/admin.html |
| Google Sheet | https://docs.google.com/spreadsheets/d/1mwaNqjNhDIfWahhIWjjbQSRBi-n3qAjI9_euDG3VxOY |
