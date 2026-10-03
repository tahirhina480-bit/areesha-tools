// POST /api/verify-code
// Validates a Pro/Admin activation code against SHA-256 hashes stored in
// Vercel Environment Variables. Plaintext codes are NEVER stored here.
//
// Required env vars (Vercel → Project → Settings → Environment Variables):
//   ADMIN_CODE_HASH  - sha256 of the master admin code (single value)
//   PRO_CODE_HASHES  - sha256 hashes of Pro codes, comma-separated
//
// Request body:  { "code": "AREESHA-XXXX-XXXX" }
// Success:       200 { "ok": true, "type": "pro" | "admin" }
// Failure:       401 { "ok": false }

const crypto = require("crypto");

function sha256(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

// --- tiny in-memory rate limiter (per serverless instance) ---
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  const arr = (hits.get(ip) || []).filter((t) => t > windowStart);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear(); // safety cap
  return arr.length > 20; // max 20 attempts / minute / IP
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    (req.socket && req.socket.remoteAddress) ||
    "unknown";
  if (rateLimited(ip)) {
    return res.status(429).json({ ok: false, error: "Too many attempts. Try again in a minute." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  const code = String((body && body.code) || "").trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ ok: false, error: "No code provided." });
  }

  const hex = sha256(code);
  const adminHash = String(process.env.ADMIN_CODE_HASH || "").trim().toLowerCase();
  const proHashes = String(process.env.PRO_CODE_HASHES || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (adminHash && hex === adminHash) {
    return res.status(200).json({ ok: true, type: "admin" });
  }
  if (proHashes.includes(hex)) {
    return res.status(200).json({ ok: true, type: "pro" });
  }
  return res.status(401).json({ ok: false, error: "Invalid code." });
};
