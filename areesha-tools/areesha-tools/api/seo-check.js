// POST /api/seo-check
// Fetches a public website URL server-side and runs 10 automatic SEO checks.
// No questions asked — the visitor just enters their website address.
//
// Request body:  { "url": "example.com" }   (protocol optional)
// Success:       200 { ok:true, host, score, grade, fetchedMs, sizeKb, checks:[...] }
// Failure:       400 { ok:false, error }  |  422 { ok:false, error } (could not fetch/analyze)
//
// Security: http/https only, blocks localhost & private IPs (SSRF guard),
// 10s timeout, 1.5MB body cap, tiny per-IP rate limiter. No env vars needed.

const BLOCKED_HOST = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.0\.0\.0|::1|\[::1\])/i;
const BLOCKED_SUFFIX = /\.(local|localhost|internal|intranet)$/i;
const MAX_BYTES = 1500 * 1024;
const TIMEOUT_MS = 10000;

// --- tiny in-memory rate limiter (per serverless instance) ---
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => t > now - 60 * 1000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 10; // max 10 checks / minute / IP
}

function clean(s) {
  return (s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}
function firstMatch(re, html) {
  const m = html.match(re);
  return m ? m[1] : "";
}
function attr(tag, name) {
  // handles quoted AND unquoted attribute values (<meta name=viewport>)
  const m = tag.match(new RegExp(name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', "i"));
  if (!m) return "";
  return (m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]).trim();
}

async function fetchHtml(target) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(target, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "AreeshaTools-SEOChecker/1.0 (+https://areesha-tools.vercel.app)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en",
      },
    });
    const ms = Date.now() - started;
    if (!res.ok) throw new Error("HTTP " + res.status);
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!/text\/html|application\/xhtml/i.test(ct)) throw new Error("NOT_HTML");
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) { try { reader.cancel(); } catch (e) {} throw new Error("TOO_BIG"); }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { html: buf.toString("utf8"), ms, bytes: total, finalUrl: res.url };
  } finally {
    clearTimeout(t);
  }
}

function analyze(html, urlObj, ms, bytes) {
  const checks = [];
  const kb = Math.round(bytes / 1024);

  function add(id, label, status, detail, tip) {
    checks.push({ id, label, status, detail, tip: status === "pass" ? "" : (tip || "") });
  }

  // 1. HTTPS
  if (urlObj.protocol === "https:") add("https", "HTTPS secure", "pass", "Your site loads over HTTPS — visitors see the padlock, not a warning.");
  else add("https", "HTTPS secure", "fail", "Your site does not use HTTPS — browsers warn visitors away.", "Get a free SSL certificate (most hosts offer one-click SSL, e.g. Let's Encrypt).");

  // 2. Title tag
  const title = clean(firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, html));
  if (!title) add("title", "Title tag", "fail", "No <title> tag found — Google shows this as your headline in search results.", "Add a unique title to every page (30–60 characters) with your service + city, e.g. 'Best Dental Clinic in Lahore | Smile Care'.");
  else if (title.length < 15) add("title", "Title tag", "warn", 'Title found but very short (' + title.length + ' characters): "' + title.slice(0, 60) + '"', "Expand it to 30–60 characters and include your main keyword and city.");
  else if (title.length > 70) add("title", "Title tag", "warn", "Title found but too long (" + title.length + " characters) — Google cuts it off.", "Shorten it to under 60 characters; put the most important words first.");
  else add("title", "Title tag", "pass", 'Good title (' + title.length + ' characters): "' + (title.length > 60 ? title.slice(0, 60) + "…" : title) + '"');

  // 3. Meta description
  const metaTags = html.match(/<meta[^>]*>/gi) || [];
  let desc = "";
  for (const tag of metaTags) {
    if (/name\s*=\s*["']?description["']?/i.test(tag)) { desc = clean(attr(tag, "content")); break; }
  }
  if (!desc) add("desc", "Meta description", "fail", "No meta description found — Google invents the snippet under your title.", "Write a 120–160 character summary with your service, city and a call to action like 'Book on WhatsApp'.");
  else if (desc.length < 50) add("desc", "Meta description", "warn", "Meta description is very short (" + desc.length + " characters).", "Expand it to 120–160 characters so it fills the Google snippet nicely.");
  else if (desc.length > 170) add("desc", "Meta description", "warn", "Meta description is long (" + desc.length + " characters) — Google truncates it.", "Trim it to 120–160 characters.");
  else add("desc", "Meta description", "pass", "Good meta description (" + desc.length + " characters).");

  // 4. Mobile viewport
  if (metaTags.some((t) => /name\s*=\s*["']?viewport["']?/i.test(t))) add("mobile", "Mobile-friendly", "pass", "Viewport meta tag found — the page is set up to scale on phones.");
  else add("mobile", "Mobile-friendly", "fail", "No viewport meta tag — the site likely looks broken on phones.", "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> and test the site on your own phone.");

  // 5. H1 heading
  const h1s = html.match(/<h1[\s>]/gi) || [];
  if (h1s.length === 1) add("h1", "Main heading (H1)", "pass", "Exactly one H1 heading found — clear main topic for Google.");
  else if (h1s.length === 0) add("h1", "Main heading (H1)", "fail", "No H1 heading found.", "Add one H1 per page describing the page, e.g. 'Dental Implants in DHA Lahore'.");
  else add("h1", "Main heading (H1)", "warn", h1s.length + " H1 headings found — Google expects one main heading per page.", "Keep a single H1; use H2/H3 for sub-headings.");

  // 6. Image alt text
  const imgs = html.match(/<img[^>]*>/gi) || [];
  if (!imgs.length) add("alt", "Image descriptions", "warn", "No images found on the homepage.", "Add real photos of your business, products and team — with descriptive alt text.");
  else {
    const withAlt = imgs.filter((t) => { const a = attr(t, "alt"); return a.length > 0; }).length;
    const pct = Math.round((withAlt / imgs.length) * 100);
    if (pct >= 80) add("alt", "Image descriptions", "pass", pct + "% of images (" + withAlt + "/" + imgs.length + ") have alt text.");
    else if (pct >= 40) add("alt", "Image descriptions", "warn", "Only " + pct + "% of images have alt text.", "Add short descriptive alt text to every image — it helps Google Images send you customers.");
    else add("alt", "Image descriptions", "fail", "Only " + pct + "% of images have alt text (" + withAlt + "/" + imgs.length + ").", "Add short descriptive alt text to every image — it helps Google Images send you customers.");
  }

  // 7. WhatsApp button
  if (/wa\.me|api\.whatsapp\.com|whatsapp\.com/i.test(html)) add("whatsapp", "WhatsApp button", "pass", "A WhatsApp chat link was found on the page.");
  else add("whatsapp", "WhatsApp button", "fail", "No WhatsApp link found.", "Add a floating WhatsApp button — it is the #1 way Pakistani customers contact small businesses.");

  // 8. Contact info
  const hasTel = /href\s*=\s*["']?tel:/i.test(html);
  const hasPkPhone = /(\+?92|0)?\s*3\d{2}[\s-]?\d{7}/.test(html.replace(/<[^>]*>/g, " "));
  if (hasTel || hasPkPhone) add("contact", "Contact info visible", "pass", "A phone number was found on the page.");
  else add("contact", "Contact info visible", "fail", "No phone number detected on the homepage.", "Put your phone number in the header (as a clickable tel: link) and your full address on the contact page.");

  // 9. Social links
  const socials = ["facebook.com", "instagram.com", "tiktok.com", "youtube.com", "linkedin.com"].filter((s) => html.toLowerCase().includes(s));
  if (socials.length) add("social", "Social media links", "pass", "Found links to: " + socials.map((s) => s.split(".")[0]).join(", ") + ".");
  else add("social", "Social media links", "fail", "No social media links found.", "Link your active Facebook/Instagram/TikTok pages — keep business name and phone identical everywhere.");

  // 10. Page speed (size + response time)
  const speedNote = "Page is " + kb + " KB and responded in " + (ms / 1000).toFixed(1) + "s.";
  if (kb <= 500 && ms <= 3000) add("speed", "Fast loading", "pass", speedNote + " Nice and light.");
  else if (kb <= 1500 && ms <= 6000) add("speed", "Fast loading", "warn", speedNote + " A bit heavy.", "Compress images before uploading and avoid heavy sliders — a slow site loses customers to competitors.");
  else add("speed", "Fast loading", "fail", speedNote + " Too slow — visitors leave.", "Compress images, remove heavy sliders/animations, and ask your host about caching.");

  const score = checks.reduce((s, c) => s + (c.status === "pass" ? 10 : c.status === "warn" ? 5 : 0), 0);
  return { checks, score, kb, ms };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST." });
  }
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ ok: false, error: "Too many checks — please wait a minute and try again." });

  let raw = "";
  try { raw = (req.body && req.body.url ? String(req.body.url) : "").trim(); }
  catch (e) { raw = ""; }
  if (!raw) return res.status(400).json({ ok: false, error: "Please enter a website address." });
  if (raw.length > 200) return res.status(400).json({ ok: false, error: "That address looks too long." });

  const withProto = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
  let urlObj;
  try { urlObj = new URL(withProto); }
  catch (e) { return res.status(400).json({ ok: false, error: "That doesn't look like a valid website address." }); }
  if (!/^https?:$/.test(urlObj.protocol)) return res.status(400).json({ ok: false, error: "Only http and https websites can be checked." });
  const host = urlObj.hostname.toLowerCase();
  if (BLOCKED_HOST.test(host) || BLOCKED_SUFFIX.test(host) || /^[0-9a-f:.]+$/i.test(host) && host.includes(":")) {
    return res.status(400).json({ ok: false, error: "That address can't be checked." });
  }
  // block raw IP literals entirely (businesses use domains)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return res.status(400).json({ ok: false, error: "Please enter a domain name (like example.com), not an IP address." });
  }

  let fetched = null;
  const tried = [urlObj.toString()];
  try {
    fetched = await fetchHtml(urlObj.toString());
  } catch (e) {
    // If the user typed a bare domain, retry once over plain http (no-SSL sites)
    if (!/^https?:\/\//i.test(raw) && urlObj.protocol === "https:" && (e.message.startsWith("HTTP") || /abort|fetch failed|ENOTFOUND/i.test(e.message))) {
      try {
        const httpUrl = "http://" + host + urlObj.pathname + urlObj.search;
        tried.push(httpUrl);
        fetched = await fetchHtml(httpUrl);
        urlObj = new URL(httpUrl);
      } catch (e2) { /* fall through to error below */ }
    }
    if (!fetched) {
      const msg = e.message === "NOT_HTML" ? "That address didn't return a web page."
        : e.message === "TOO_BIG" ? "That page is too large to analyze."
        : /abort/i.test(e.message) ? "The site took too long to respond (over 10 seconds)."
        : "Could not reach that website. Check the address and try again.";
      return res.status(422).json({ ok: false, error: msg });
    }
  }

  const { checks, score, kb, ms } = analyze(fetched.html, urlObj, fetched.ms, fetched.bytes);
  const grade = score >= 90 ? "Excellent 🌟" : score >= 70 ? "Good 👍" : score >= 50 ? "Needs Work 🔧" : "Needs Urgent Attention 🚨";

  return res.status(200).json({
    ok: true,
    host: host.replace(/^www\./, ""),
    score, grade,
    fetchedMs: Math.round(fetched.ms),
    sizeKb: kb,
    checks,
  });
};
