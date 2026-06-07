# BSA World Cup 2026 Predictor

Predict FIFA World Cup 2026 scores, earn raffle entries, and win prizes.

Live site: https://hendricksbb.github.io/bsa-wc2026-predictor/

## Setup Checklist

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Go to **Authentication → Providers → Google** and enable Google OAuth
4. Go to **Project Settings → API** and copy your Project URL and anon key
5. Update `js/supabase-client.js` with those values

### 2. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials (Web application)
3. Add authorised redirect URI: `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
4. Paste Client ID and Secret into Supabase → Authentication → Providers → Google

### 3. football-data.org API Key

1. Sign up at [football-data.org](https://www.football-data.org/client/register)
2. Go to GitHub repo → **Settings → Secrets and variables → Actions**
3. Add secret: `FOOTBALL_API_KEY` = your key

The GitHub Action runs every 2 hours and auto-updates fixtures.

### 4. Admin Panel

Access at `/admin.html`. Default password: `BSA2026ADMIN` — change this in `admin.html`.

### 5. SnapScan QR

Once the club provides the campaign QR:
1. Save it as `images/snapscan-qr.png`
2. In `fixtures.html`, replace the `.snapscan-placeholder` div with:
   ```html
   <img src="images/snapscan-qr.png" style="width:160px;height:160px;border-radius:8px;">
   ```

## Scoring

| Outcome | Points |
|---------|--------|
| Exact score | 3 pts + raffle entry |
| Correct result (win/draw) | 1 pt |
| Wrong | 0 pts |

Entry fee: R50. 50% of proceeds go to the raffle prize pool.
Update `ENTRY_FEE` in `js/app.js` if this changes.
