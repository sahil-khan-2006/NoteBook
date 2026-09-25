import "dotenv/config";
import pg from "pg";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

if (existsSync(join(ROOT, ".env.local"))) {
  config({ path: join(ROOT, ".env.local"), override: true });
}

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL environment variable is not defined in .env or .env.local");
  process.exit(1);
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.log("Usage: node scripts/make-admin.mjs <user-email>");
  console.log("Example: node scripts/make-admin.mjs admin@mycollege.edu");
  process.exit(1);
}

const { Client } = pg;
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const res = await db.query(
  `UPDATE users SET role = 'admin' WHERE LOWER(email) = $1 RETURNING id, full_name, email, role`,
  [email]
);

if (res.rows.length === 0) {
  console.error(`Error: No user found with email "${email}". Make sure they have registered first!`);
} else {
  console.log(`Success! User "${res.rows[0].full_name}" (${res.rows[0].email}) is now an Administrator.`);
}

await db.end();
