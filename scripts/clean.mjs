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

const { Client } = pg;
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

console.log("Cleaning all test and demo data from database...");

const TABLES = [
  "notifications",
  "reports",
  "streaks",
  "likes",
  "saves",
  "comments",
  "follows",
  "post_tags",
  "user_subjects",
  "posts",
  "tags",
  "users",
];

for (const t of TABLES) {
  try {
    await db.query(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`);
    console.log(`✓ Cleaned table: ${t}`);
  } catch (err) {
    console.warn(`Notice for table ${t}:`, err.message);
  }
}

// Ensure standard academic subjects exist so students can tag and follow subjects
const DEFAULT_SUBJECTS = [
  "Data Structures & Algorithms",
  "Operating Systems",
  "DBMS",
  "Object Oriented Programming",
  "Machine Learning",
  "Engineering Mathematics",
  "Computer Networks",
  "Digital Logic Design",
  "Electrical Machines",
  "Thermodynamics",
];

for (const name of DEFAULT_SUBJECTS) {
  await db.query(
    `INSERT INTO subjects (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
    [name]
  );
}
console.log("✓ Core academic subjects verified.");

const counts = await db.query(`
  SELECT
    (SELECT count(*) FROM users) as users,
    (SELECT count(*) FROM posts) as posts,
    (SELECT count(*) FROM comments) as comments,
    (SELECT count(*) FROM subjects) as subjects
`);

console.log("Cleanup complete! Current database status:", counts.rows[0]);
await db.end();
