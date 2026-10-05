# Deploying Areesha Tools to Vercel

Takes about 10 minutes. You need a free GitHub account and a free Vercel account.

## 1. Put the code on GitHub

1. Go to **github.com** → **+** → **New repository**. Name it `areesha-tools`. Create it.
2. Click **"uploading an existing file"**, drag in **all files and folders** from the `areesha-tools/` folder
   (keep the folder structure: `api/` and `scripts/` must stay as subfolders), then **Commit changes**.

## 2. Import into Vercel

1. Go to **vercel.com** → **Add New…** → **Project** → **Import** the `areesha-tools` repository.
2. Leave all build settings as they are (no build step needed). Click **Deploy**.
3. You will get a live URL like `areesha-tools.vercel.app`. The pages work — but code redemption will fail until step 3 is done.

## 3. Add the secret environment variables (required for Pro/Admin codes)

1. In Vercel, open your project → **Settings** → **Environment Variables**.
2. Generate your hashes locally (in a terminal inside the project folder):
   - **New codes:** `npm run generate-codes` → prints plaintext codes (save privately!) and hashes.
   - **Codes you already issued:** `npm run hash-codes my-codes.txt` → prints hashes for your existing codes.
3. Add two variables (apply to **Production**):
   - `ADMIN_CODE_HASH` = the sha256 hash of your master admin code (single value).
   - `PRO_CODE_HASHES` = sha256 hashes of Pro codes, **comma-separated, no spaces**.
4. Go to **Deployments** → redeploy the latest deployment (⋯ menu → **Redeploy**) so the API picks up the variables.

## 4. Test it

1. Open your live site → **Unlock Pro** → enter your **admin code** → you should see "Admin access".
2. Enter a wrong code → it must be rejected.
3. Use a tool 4 times as a logged-out visitor → the 4th attempt should show the upgrade prompt.

## 5. Selling Pro (Rs. 500/month)

1. Customer sends Rs. 500 via **Easypaisa to 0321 4930875**.
2. Customer taps the WhatsApp button on the Pricing page and sends the payment screenshot.
3. You verify the payment, pick **one unused code** from your private list, mark it used, and send it to the customer.
4. Customer enters the code on the site → Pro activates for **30 days**.

## 6. Updating the site later

Edit files → commit to GitHub → Vercel redeploys automatically. To add a new tool later, copy one tool page as a template.

Serverless APIs in `/api/` (no env vars needed):
- `verify-code.js` — Pro/Admin code verification (needs the env vars from step 3).
- `seo-check.js` — automatic SEO checker: fetches a visitor's URL server-side and returns 10 checks + 0–100 score. Has a built-in SSRF guard (blocks localhost/private IPs) and a 10/minute/IP rate limit.

## Troubleshooting

- **"Could not reach the server"** on code entry → the API isn't deployed or env vars are missing; check step 3 and redeploy.
- **Valid code rejected** → the hash in the env var doesn't match the code (extra spaces/newlines are the usual cause); re-paste carefully.
- **Changes not live** → Vercel → Deployments → make sure the latest deployment finished.
