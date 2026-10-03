# Areesha Tools

Free online tools for Pakistani small businesses — WhatsApp Link Generator, Website SEO Checker (lite), and QR Code Generator. Each tool page includes SEO-optimized explanatory content so the site ranks on Google.

**Live model:** Free = 3 uses per tool per day · Pro = Rs. 500/month (unlimited) · Admin = permanent unlimited access.

## Project structure

```
areesha-tools/
├── index.html                  # Home: hero, tool cards, how-it-works, pricing teaser, FAQ
├── whatsapp-link-generator.html
├── seo-checker.html
├── qr-generator.html
├── pricing.html                # Free vs Pro, Easypaisa payment steps, code entry form
├── style.css
├── app.js                      # Tools, paywall (localStorage), code redemption via API
├── api/
│   └── verify-code.js          # Vercel serverless function: validates codes (POST /api/verify-code)
├── scripts/
│   ├── generate-codes.js       # Creates new codes + hashes
│   └── hash-codes.js           # Hashes codes you already issued
├── .env.example                # Env var template (NO real secrets — see DEPLOY.md)
├── package.json
├── README.md
└── DEPLOY.md                   # Step-by-step Vercel deployment guide
```

## How access control works

- **Free:** 3 uses per tool per calendar day, tracked in the visitor's browser (`localStorage`). No sign-up.
- **Pro:** visitor pays Rs. 500/month via Easypaisa, sends the screenshot on WhatsApp, receives a Pro code, enters it on the site → unlimited access for **30 days** from activation.
- **Admin:** master code → permanent unlimited access, forever.
- **Security:** codes are validated **server-side** by `api/verify-code.js` against SHA-256 hashes stored in Vercel Environment Variables. No plaintext codes and no hashes of real codes exist anywhere in this source. Basic per-IP rate limiting (20 attempts/minute) is built into the API.

> Note: this is a pragmatic MVP. A technically skilled user could clear their own browser storage; true cross-device single-use enforcement would need a database later.

## Local development

Any static server works for the pages, but code redemption needs the API — use the Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

Create a local `.env` (git-ignored) with `ADMIN_CODE_HASH` and `PRO_CODE_HASHES` for testing.

## Generating codes

```bash
# Brand-new batch (50 Pro codes + 1 admin code):
npm run generate-codes

# Hash codes you already issued (paste from your private list):
npm run hash-codes my-codes.txt
```

Save plaintext codes privately (password manager / notebook). Mark each Pro code as used once given to a customer.
