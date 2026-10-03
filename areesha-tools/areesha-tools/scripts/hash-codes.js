// Hashes activation codes you already issued (e.g. shared earlier over WhatsApp).
// Usage: node scripts/hash-codes.js <codes-file>
//   - The file should list one code per line (extra text/numbering is ignored;
//     anything that looks like ADMIN-XXXX-XXXX or AREESHA-XXXX-XXXX is picked up).
//   - Prints each code -> its SHA-256 hash. Paste hashes into Vercel env vars:
//       ADMIN_CODE_HASH = hash of your admin code
//       PRO_CODE_HASHES = pro-code hashes, comma-separated
const crypto = require("crypto");
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/hash-codes.js <codes-file>");
  process.exit(1);
}
const text = fs.readFileSync(file, "utf8");
const codes = text.toUpperCase().match(/(?:ADMIN|AREESHA)-[A-Z0-9]{4}-[A-Z0-9]{4}/g) || [];
const seen = new Set();
console.log("CODE -> SHA256 (paste the hashes into Vercel Environment Variables)\n");
for (const code of codes) {
  if (seen.has(code)) continue;
  seen.add(code);
  const hash = crypto.createHash("sha256").update(code, "utf8").digest("hex");
  const kind = code.startsWith("ADMIN-") ? "ADMIN_CODE_HASH" : "PRO_CODE_HASHES (append)";
  console.log(`${code}  ->  ${hash}   [${kind}]`);
}
if (!codes.length) console.log("No codes found in file.");
