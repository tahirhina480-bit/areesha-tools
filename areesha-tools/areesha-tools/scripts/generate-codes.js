// Generates brand-new activation codes + their SHA-256 hashes.
// Usage: node scripts/generate-codes.js [count]
//   - Prints PLAINTEXT codes (give these to customers / keep the admin one secret).
//   - Prints HASHES (paste these into Vercel Environment Variables).
// Plaintext codes are only ever shown in this terminal output — never saved here.
const crypto = require("crypto");

const count = Math.max(1, parseInt(process.argv[2] || "50", 10));

function rand(n) {
  return crypto.randomBytes(n).toString("hex").toUpperCase();
}
function sha256(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

const admin = "ADMIN-" + rand(2) + "-" + rand(2);
console.log("=== MASTER ADMIN CODE (permanent access — keep secret, never share) ===");
console.log(admin);
console.log("ADMIN_CODE_HASH=" + sha256(admin));
console.log("");
console.log(`=== ${count} PRO CODES (30 days each — one per paying customer) ===`);
const hashes = [];
for (let i = 0; i < count; i++) {
  const code = "AREESHA-" + rand(2) + "-" + rand(2);
  hashes.push(sha256(code));
  console.log(`${String(i + 1).padStart(3)}. ${code}`);
}
console.log("");
console.log("=== PRO_CODE_HASHES (paste into Vercel env var, comma-separated) ===");
console.log(hashes.join(","));
