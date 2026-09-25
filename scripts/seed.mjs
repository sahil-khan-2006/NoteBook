import "dotenv/config";
import pg from "pg";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { mkdirSync, writeFileSync, statSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const UPLOADS = join(ROOT, "uploads");
const IMAGES = join(ROOT, "public", "images");

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

/* ------------------------------ password hash ---------------------------- */
const PEPPER = process.env.AUTH_PEPPER || "bpmandal-hub-pepper-v1";
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password + PEPPER, salt, 64);
  return `scrypt$${salt}$${key.toString("hex")}`;
}
function verifyPassword(password, stored) {
  const [, salt, hash] = stored.split("$");
  const key = scryptSync(password + PEPPER, salt, 64);
  return timingSafeEqual(key, Buffer.from(hash, "hex"));
}

/* --------------------------------- prng ---------------------------------- */
let seed = 20260214;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

/* ------------------------------- pdf writer ------------------------------ */
function makePdf(filePath, title, lines) {
  const esc = (s) =>
    String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  let stream = "";
  stream += "BT /F2 20 Tf 56 786 Td (" + esc(title) + ") Tj ET\n";
  stream += "BT /F1 10 Tf 56 766 Td (B.P. Mandal College of Engineering, Madhepura - Academic Hub) Tj ET\n";
  stream += "0.11 0.30 0.86 RG 1.4 w 56 756 m 539 756 l S\n";
  let y = 732;
  for (const line of lines) {
    stream += "BT /F1 11 Tf 56 " + y + " Td (" + esc(line) + ") Tj ET\n";
    y -= 17;
    if (y < 70) break;
  }
  stream += "BT /F1 9 Tf 56 56 Td (Generated for the B.P. Mandal Academic Hub demo dataset.) Tj ET\n";

  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Length " + Buffer.byteLength(stream, "latin1") + " >>\nstream\n" + stream + "endstream",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  writeFileSync(filePath, pdf, "latin1");
}

/* --------------------------------- reset --------------------------------- */
const TABLES = [
  "notifications", "reports", "streaks", "likes", "saves", "comments",
  "follows", "post_tags", "user_subjects", "posts", "tags", "subjects", "users",
];
try {
  await db.query("SET session_replication_role = replica");
} catch {
  // Cloud providers like Neon/Supabase do not allow setting session_replication_role
}
for (const t of TABLES) {
  try {
    await db.query(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`);
  } catch (err) {
    console.warn(`Notice for table ${t}:`, err.message);
  }
}
try {
  await db.query("SET session_replication_role = origin");
} catch {
  // Ignored
}

mkdirSync(UPLOADS, { recursive: true });

/* -------------------------------- subjects ------------------------------- */
const SUBJECTS = [
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
const subjectIds = {};
for (const name of SUBJECTS) {
  const r = await db.query(
    `INSERT INTO subjects (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [name],
  );
  subjectIds[name] = r.rows[0].id;
}

/* ---------------------------------- users -------------------------------- */
const USERS = [
  { id: "11111111-1111-4111-8111-111111111101", name: "Arshan Rahman", email: "arshan@hub.dev", roll: "BCO22017", branch: "CSE AI/ML", sem: 3, year: 2024, pw: "demo1234", bio: "CSE AI/ML • 3rd semester. I share my DSA and DBMS notes before every unit test. Ask away." },
  { id: "11111111-1111-4111-8111-111111111102", name: "Rahul Verma", email: "rahul@hub.dev", roll: "BCO22003", branch: "CSE", sem: 4, year: 2023, pw: "demo1234", bio: "CSE • 4th semester. Compiler, OOPS and a lot of unanswered OS questions." },
  { id: "11111111-1111-4111-8111-111111111103", name: "Priya Singh", email: "priya@hub.dev", roll: "BCO22041", branch: "CSE AI/ML", sem: 3, year: 2024, pw: "demo1234", bio: "Collecting PYQs since first year. If it was asked between 2019 and 2024, I probably have it." },
  { id: "11111111-1111-4111-8111-111111111104", name: "Neha Kumari", email: "neha@hub.dev", roll: "BCO21009", branch: "ECE", sem: 5, year: 2023, pw: "demo1234", bio: "ECE • 5th semester. Lab manuals, viva questions and network theory." },
  { id: "11111111-1111-4111-8111-111111111105", name: "Aman Kumar", email: "aman@hub.dev", roll: "BCO23012", branch: "ME", sem: 2, year: 2024, pw: "demo1234", bio: "Mechanical • 2nd semester. Engineering maths survivor." },
  { id: "11111111-1111-4111-8111-111111111109", name: "Prof. S. K. Jha", email: "admin@bpmandal.ac.in", roll: "FAC0001", branch: "CSE", sem: 8, year: 2015, pw: "admin1234", bio: "Faculty moderator. Keeps the hub academic.", role: "admin" },
];

const FIRST = ["Aditya", "Sneha", "Karan", "Anjali", "Vivek", "Ritu", "Md. Sahil", "Ishita", "Tanmay", "Kritika", "Rohit", "Simran", "Ajay", "Fatima", "Nikhil", "Pooja", "Sagar", "Ananya", "Manish", "Riya", "Harsh", "Shreya", "Deepak", "Zoya", "Abhinav", "Meenal", "Siddharth", "Payal", "Yash", "Anushka"];
const LAST = ["Kumar", "Sharma", "Singh", "Kumari", "Raj", "Prasad", "Verma", "Mishra", "Jha", "Pandey", "Choudhary", "Sinha", "Rao", "Das", "Nanda"];
const BRANCHES = ["CSE", "CSE AI/ML", "ECE", "EE", "ME", "CE"];

for (let i = 0; i < 30; i++) {
  const name = `${FIRST[i]} ${pick(LAST)}`;
  const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");
  USERS.push({
    id: `22222222-2222-4222-8222-22222222${String(2200 + i).padStart(4, "0")}`,
    name,
    email: `${slug}${i}@hub.dev`,
    roll: `BCO${pick([21, 22, 23])}${String(100 + i)}`,
    branch: pick(BRANCHES),
    sem: int(1, 8),
    year: pick([2022, 2023, 2024, 2025]),
    pw: "demo1234",
    bio: `${pick(BRANCHES)} student at B.P. Mandal College of Engineering, Madhepura.`,
    synthetic: true,
  });
}

for (const u of USERS) {
  await db.query(
    `INSERT INTO users (id, full_name, email, password_hash, roll_number, branch, semester, admission_year, bio, role, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active', now() - ($11 || ' days')::interval)`,
    [u.id, u.name, u.email, hashPassword(u.pw), u.roll, u.branch, u.sem, u.year, u.bio, u.role || "user", String(int(10, 400))],
  );
  if (u.synthetic) continue;
  const seeds = Object.values(subjectIds).slice(0, 4);
  for (const sid of seeds) {
    await db.query(
      `INSERT INTO user_subjects (user_id, subject_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [u.id, sid],
    );
  }
}

/* --------------------------------- files --------------------------------- */
const FILES = [
  ["DSA_Unit03_Notes.pdf", "DSA Unit 03 Notes - Linked Lists, Stack & Queue", [
    "Unit 03: Linked Lists, Stacks and Queues",
    "",
    "1. Singly, doubly and circular linked representations",
    "2. Stack operations: push, pop, peek, overflow and underflow",
    "3. Queue, circular queue and dequeue",
    "4. Application: expression parsing and postfix evaluation",
    "5. Solved problems from the last four university examinations",
  ]],
  ["DBMS_PYQs_2019-2024.pdf", "DBMS Previous Year Questions (2019 - 2024)", [
    "Compiled previous year questions, semester wise",
    "",
    "2019 - Normalisation, SQL joins, transaction scheduling",
    "2020 - ER modelling, indexing, deadlock handling",
    "2021 - ACID properties, view derivation, file organisation",
    "2022 - Query optimisation, B+ trees, concurrency control",
    "2023 - NoSQL, sharding, functional dependencies",
    "2024 - Distributed transactions, snapshot isolation",
    "",
    "Each question carries its marking scheme and a marking note.",
  ]],
  ["OS_Unit03_Notes.pdf", "Operating Systems Unit 03 - Process Management", [
    "Unit 03: Process Management, Scheduling and IPC",
    "",
    "1. Process states and the PCB",
    "2. CPU scheduling algorithms with worked examples",
    "3. Inter-process communication: message passing and shared memory",
    "4. Semaphores, monitors and classic synchronisation problems",
    "5. Previous year questions with solutions",
  ]],
  ["OOPS_Unit03_Notes.pdf", "Object Oriented Programming Unit 03 Notes", [
    "Unit 03: Inheritance and Polymorphism",
    "",
    "1. Types of inheritance with C++ syntax",
    "2. Virtual functions and runtime polymorphism",
    "3. Abstract classes and interfaces",
    "4. Operator overloading",
    "5. Difference between overloading and overriding - table summary",
  ]],
  ["Mathematics_Formula_Sheet.pdf", "Engineering Mathematics Formula Sheet", [
    "Semester 3 - quick reference",
    "",
    "Differentiation, integration and standard results",
    "Laplace transforms and inverse transforms",
    "Fourier series and half range expansions",
    "Matrix rank, eigenvalues and Cayley-Hamilton",
    "Probability distributions and expectation",
  ]],
  ["Machine_Learning_Unit02_Notes.pdf", "Machine Learning Unit 02 Notes", [
    "Unit 02: Supervised Learning",
    "",
    "1. Linear and logistic regression",
    "2. Decision trees and information gain",
    "3. K-nearest neighbours",
    "4. Bias variance trade-off",
    "5. Evaluation metrics: confusion matrix, ROC, F1",
  ]],
  ["CN_Lab_Manual.pdf", "Computer Networks Lab Manual", [
    "Six experiments with aim, algorithm, program and observation",
    "",
    "1. Socket programming - echo client and server",
    "2. Subnetting and CIDR calculations",
    "3. Distance vector routing simulation",
    "4. HTTP header inspection",
    "5. File transfer over TCP",
    "6. CRC error detection",
  ]],
  ["OS_Fulfilment_Notes.pdf", "OS Unit 03 - Scheduling and IPC Summary", [
    "Shared in fulfilment of an open resource request",
    "",
    "Short, exam-focused summary of scheduling algorithms",
    "IPC primitives with comparison table",
    "Solved numericals on turnaround and waiting time",
  ]],
  ["DSA_Unit01_Notes.pdf", "DSA Unit 01 Notes - Arrays and Strings", [
    "Unit 01: Arrays, Strings and Complexity",
    "",
    "1. Static and dynamic arrays",
    "2. Two pointer and sliding window patterns",
    "3. String matching basics",
    "4. Big-O analysis of common operations",
  ]],
  ["DBMS_Unit02_Notes.pdf", "DBMS Unit 02 Notes - ER Model and Normalisation", [
    "Unit 02: Entity Modelling and Normalisation",
    "",
    "1. Entities, attributes, relationships and cardinality",
    "2. ER to relational mapping",
    "3. Functional dependencies and Armstrong axioms",
    "4. 1NF, 2NF, 3NF and BCNF with examples",
  ]],
  ["CN_PYQ_Papers.pdf", "Computer Networks Previous Year Papers", [
    "Requested through the Academic Hub",
    "",
    "Question papers for CN from 2020 to 2024",
    "Section wise marking distribution",
  ]],
  ["OOPS_Important_Questions.pdf", "OOPS Unit 03 Important Questions", [
    "Most repeated questions of Unit 03",
    "",
    "Explain runtime polymorphism with an example.",
    "Difference between abstract class and interface.",
    "Write a program demonstrating multilevel inheritance.",
    "What is the role of the virtual destructor?",
  ]],
];

const fileMeta = {};
for (const [name, title, lines] of FILES) {
  const p = join(UPLOADS, name);
  makePdf(p, title, lines);
  fileMeta[name] = { size: statSync(p).size, pages: Math.max(4, Math.min(48, lines.length * 4)) };
}

/* --------------------------------- posts --------------------------------- */
const now = Date.now();
const hoursAgo = (h) => new Date(now - h * 3600 * 1000);
const daysAgo = (d, hourOffset = 0) => new Date(now - d * 24 * 3600 * 1000 - hourOffset * 3600 * 1000);

const POSTS = [
  { id: "33333333-3333-4333-8333-333333333301", author: USERS[0], kind: "resource", title: "DSA Unit 03 Notes", desc: "Complete notes covering Linked Lists, Stack & Queue (Linked Representation). Hope it helps! 😊", branch: "CSE AI/ML", sem: 3, subject: "Data Structures & Algorithms", unit: "03", type: "Notes", file: "DSA_Unit03_Notes.pdf", thumb: "notes-dsa.jpg", tags: ["DSA", "Unit03", "LinkedList", "CSE"], at: hoursAgo(2), views: 1240, downloads: 384 },
  { id: "33333333-3333-4333-8333-333333333302", author: USERS[2], kind: "resource", title: "Previous Year Questions — DBMS (2019–2024)", desc: "All semester wise PYQs with solutions. Hope it helps for your preparations!", branch: "CSE AI/ML", sem: 3, subject: "DBMS", unit: "", type: "PYQ", file: "DBMS_PYQs_2019-2024.pdf", thumb: "dbms-pyq.jpg", tags: ["DBMS", "PYQ", "CSE", "4thSem"], at: hoursAgo(8), views: 2310, downloads: 712 },
  { id: "33333333-3333-4333-8333-333333333303", author: USERS[1], kind: "resource", title: "OOPS Unit 03 Notes", desc: "Inheritance, polymorphism and virtual functions — written the night before the unit test and rewritten after.", branch: "CSE", sem: 4, subject: "Object Oriented Programming", unit: "03", type: "Notes", file: "OOPS_Unit03_Notes.pdf", thumb: null, tags: ["OOPS", "Unit03", "Inheritance"], at: hoursAgo(26), views: 860, downloads: 241 },
  { id: "33333333-3333-4333-8333-333333333304", author: USERS[4], kind: "resource", title: "Mathematics Formula Sheet", desc: "One page of everything Unit 03 & 04 threw at us. Print it, stick it above the desk.", branch: "ME", sem: 2, subject: "Engineering Mathematics", unit: "", type: "Reference Material", file: "Mathematics_Formula_Sheet.pdf", thumb: null, tags: ["Maths", "FormulaSheet", "Sem2"], at: hoursAgo(50), views: 1980, downloads: 655 },
  { id: "33333333-3333-4333-8333-333333333305", author: USERS[2], kind: "resource", title: "Machine Learning Notes — Unit 02", desc: "Supervised learning, regression through to evaluation metrics, with the numericals we solved in class.", branch: "CSE AI/ML", sem: 5, subject: "Machine Learning", unit: "02", type: "Notes", file: "Machine_Learning_Unit02_Notes.pdf", thumb: null, tags: ["ML", "Unit02", "AI"], at: hoursAgo(74), views: 1440, downloads: 402 },
  { id: "33333333-3333-4333-8333-333333333306", author: USERS[3], kind: "resource", title: "Computer Networks Lab Manual", desc: "Six experiments — aim, algorithm, program, observation and the viva questions we were actually asked.", branch: "ECE", sem: 5, subject: "Computer Networks", unit: "", type: "Lab Manual", file: "CN_Lab_Manual.pdf", thumb: null, tags: ["CN", "LabManual", "ECE"], at: hoursAgo(96), views: 1105, downloads: 318 },
  { id: "33333333-3333-4333-8333-333333333307", author: USERS[3], kind: "resource", title: "OS Unit 03 Notes — Process Management", desc: "Fulfilled Rahul's request. Scheduling, IPC and solved numericals, all in one place.", branch: "CSE", sem: 4, subject: "Operating Systems", unit: "03", type: "Notes", file: "OS_Fulfilment_Notes.pdf", thumb: "os-notes.jpg", tags: ["OS", "Unit03", "Scheduling"], at: hoursAgo(20), views: 970, downloads: 289 },
  { id: "33333333-3333-4333-8333-333333333308", author: USERS[0], kind: "resource", title: "DSA Unit 01 Notes — Arrays & Strings", desc: "Two-pointer and sliding window patterns with the complexity table I wished I had in the first unit test.", branch: "CSE AI/ML", sem: 3, subject: "Data Structures & Algorithms", unit: "01", type: "Notes", file: "DSA_Unit01_Notes.pdf", thumb: null, tags: ["DSA", "Unit01", "Arrays"], at: daysAgo(2, 3), views: 720, downloads: 198 },
  { id: "33333333-3333-4333-8333-333333333309", author: USERS[0], kind: "resource", title: "DBMS Unit 02 Notes — ER Model & Normalisation", desc: "ER diagrams, functional dependencies and every normal form explained with one running example.", branch: "CSE AI/ML", sem: 3, subject: "DBMS", unit: "02", type: "Notes", file: "DBMS_Unit02_Notes.pdf", thumb: null, tags: ["DBMS", "Unit02", "Normalisation"], at: daysAgo(4, 5), views: 830, downloads: 233 },
];

const REQUESTS = [
  { id: "44444444-4444-4444-8444-444444444401", author: USERS[1], kind: "request", title: "Does anyone have OS Unit 03 notes?", desc: "Need notes for Operating Systems Unit 03 (Process Management, Scheduling, IPC). Please help if you have it. 🙏", branch: "CSE", sem: 3, subject: "Operating Systems", unit: "03", type: "Notes", tags: ["OS", "Unit03", "CSE"], at: hoursAgo(30), status: "fulfilled", fulfilledBy: USERS[3], fulfilledPost: "33333333-3333-4333-8333-333333333307", views: 640 },
  { id: "44444444-4444-4444-8444-444444444402", author: USERS[2], kind: "request", title: "DBMS solved PYQs for the end-sems?", desc: "Looking for solved papers, especially normalisation and concurrency control questions from 2021 onward.", branch: "CSE AI/ML", sem: 3, subject: "DBMS", unit: "", type: "PYQ", tags: ["DBMS", "PYQ", "Solved"], at: hoursAgo(11), status: "open", views: 410 },
  { id: "44444444-4444-4444-8444-444444444403", author: USERS[4], kind: "request", title: "OOPS important questions for Unit 03?", desc: "Past questions for inheritance and polymorphism. Anything with previous year answers would be a lifesaver.", branch: "ME", sem: 4, subject: "Object Oriented Programming", unit: "03", type: "Question Bank", tags: ["OOPS", "ImportantQuestions"], at: hoursAgo(44), status: "open", views: 295 },
  { id: "44444444-4444-4444-8444-444444444404", author: USERS[0], kind: "request", title: "Looking for Computer Networks previous year papers", desc: "Any branch is fine — I want the 2020 to 2024 papers for practice before the mid-sems.", branch: "CSE AI/ML", sem: 3, subject: "Computer Networks", unit: "", type: "PYQ", tags: ["CN", "PYQ"], at: daysAgo(1, 4), status: "open", views: 210 },
];

async function insertPost(p) {
  const meta = p.file ? fileMeta[p.file] : null;
  await db.query(
    `INSERT INTO posts (id, author_id, kind, title, description, branch, semester, subject, unit, resource_type, status,
        file_name, file_path, file_size, file_pages, mime_type, thumb_url, views, downloads, fulfilled_by, fulfilled_post_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
    [
      p.id, p.author.id, p.kind, p.title, p.desc, p.branch, p.sem, p.subject, p.unit || null,
      p.type || null, p.status || "open",
      p.file || null, p.file || null, meta ? meta.size : null, meta ? meta.pages : null,
      p.file ? "application/pdf" : null, p.thumb || null,
      p.views || int(80, 900), p.downloads || int(10, 260),
      p.fulfilledBy ? p.fulfilledBy.id : null, p.fulfilledPost || null, p.at.toISOString(),
    ],
  );
  for (const t of p.tags || []) {
    const r = await db.query(
      `INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [t],
    );
    await db.query(
      `INSERT INTO post_tags (post_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [p.id, r.rows[0].id],
    );
  }
}

for (const p of POSTS) await insertPost(p);
for (const p of REQUESTS) await insertPost(p);
const ALL = [...POSTS, ...REQUESTS];

/* --------------------------------- likes --------------------------------- */
const byId = Object.fromEntries(USERS.map((u) => [u.id, u]));
let likeCount = 0;
for (const post of ALL) {
  // the five featured students always engage
  const core = USERS.slice(0, 6).filter((u) => u.id !== post.author.id);
  for (const u of core) {
    if (rnd() > 0.72) continue;
    await db.query(`INSERT INTO likes (user_id, post_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [u.id, post.id, hoursAgo(int(1, 60))]);
    likeCount++;
  }
  const extra = int(6, 14);
  for (let i = 0; i < extra; i++) {
    const u = USERS[6 + ((likeCount + i * 7) % 30)];
    await db.query(`INSERT INTO likes (user_id, post_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [u.id, post.id, hoursAgo(int(1, 72))]);
    likeCount++;
  }
}

/* -------------------------------- comments ------------------------------- */
const COMMENTS = [
  ["This is really helpful. Thanks for sharing. 🙌", 0],
  ["Can someone upload the solved PYQs too?", 0],
  ["I'll upload them tomorrow.", 2],
  ["Page 12 has the derivation, in case anyone is searching for it.", 0],
  ["Printed this before the unit test. Saved my weekend.", 0],
  ["Is this the 2024 syllabus or the old one?", 1],
  ["Same syllabus, question pattern changed slightly.", 5],
  ["Finally, a clean explanation of normalisation 👏", 0],
  ["Could you share the C++ code snippets separately?", 0],
  ["Adding them as a comment image in the next post.", 8],
  ["The scheduling numericals on page 9 match exactly what came in the exam.", 0],
  ["Thank you so much, this was the one topic I was stuck on.", 0],
  ["Following you for more of these.", 0],
  ["Upvote this if the handwritten notes helped 👍", 0],
  ["Which reference book did you follow?", 1],
  ["Galvin, chapter 5 mostly.", 14],
];

let cIdx = 0;
for (const post of ALL) {
  const n = int(2, 5);
  for (let i = 0; i < n; i++) {
    const [body, _] = COMMENTS[(cIdx++) % COMMENTS.length];
    void _;
    const u = USERS[(cIdx * 3) % USERS.length];
    if (u.id === post.author.id && rnd() > 0.4) continue;
    const r = await db.query(
      `INSERT INTO comments (post_id, author_id, parent_id, body, created_at) VALUES ($1,$2,NULL,$3,$4) RETURNING id`,
      [post.id, u.id, body, hoursAgo(int(1, 70))],
    );
    if (rnd() > 0.72) {
      const repl = USERS[(cIdx * 5 + 2) % USERS.length];
      await db.query(
        `INSERT INTO comments (post_id, author_id, parent_id, body, created_at) VALUES ($1,$2,$3,$4,$5)`,
        [post.id, repl.id, r.rows[0].id, "Noted, thank you!", hoursAgo(int(1, 40))],
      );
    }
  }
}

/* --------------------------------- saves --------------------------------- */
for (const post of ALL.slice(0, 8)) {
  for (let i = 0; i < int(2, 6); i++) {
    const u = USERS[6 + ((i * 5 + post.title.length) % 30)];
    await db.query(`INSERT INTO saves (user_id, post_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [u.id, post.id, hoursAgo(int(1, 60))]);
  }
}

/* -------------------------------- follows -------------------------------- */
for (let i = 0; i < USERS.length; i++) {
  for (let k = 0; k < int(3, 9); k++) {
    const j = (i + 1 + Math.floor(rnd() * USERS.length)) % USERS.length;
    if (i === j) continue;
    await db.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [USERS[j].id, USERS[i].id],
    );
  }
}

/* ------------------------------- subject follow -------------------------- */
for (const sid of Object.values(subjectIds).slice(0, 7)) {
  for (let i = 0; i < int(4, 14); i++) {
    const u = USERS[Math.floor(rnd() * 6)];
    await db.query(`INSERT INTO user_subjects (user_id, subject_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [u.id, sid]);
  }
}

/* -------------------------------- streaks -------------------------------- */
const streakRows = [
  [USERS[0].id, 14, 21, 0],
  [USERS[1].id, 9, 12, 1],
  [USERS[2].id, 6, 15, 0],
  [USERS[3].id, 4, 7, 0],
  [USERS[4].id, 11, 11, 0],
];
for (const [uid, cur, high, offsetDays] of streakRows) {
  const d = new Date(now - offsetDays * 24 * 3600 * 1000);
  const iso = d.toISOString().slice(0, 10);
  await db.query(
    `INSERT INTO streaks (user_id, current, highest, last_post_date) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id) DO UPDATE SET current = $2, highest = $3, last_post_date = $4`,
    [uid, cur, high, iso],
  );
}

/* ----------------------------- notifications ----------------------------- */
const NOTIFS = [
  [USERS[0].id, USERS[2].id, "like", "33333333-3333-4333-8333-333333333301", "liked your Notes — DSA Unit 03 Notes", false],
  [USERS[0].id, USERS[1].id, "comment", "33333333-3333-4333-8333-333333333301", "commented on your resource — DSA Unit 03 Notes", false],
  [USERS[0].id, USERS[3].id, "follow", null, "started following you", false],
  [USERS[1].id, USERS[3].id, "fulfill", "44444444-4444-4444-8444-444444444401", "fulfilled your request — Does anyone have OS Unit 03 notes?", false],
  [USERS[1].id, USERS[4].id, "like", "33333333-3333-4333-8333-333333333303", "liked your Notes — OOPS Unit 03 Notes", true],
  [USERS[2].id, USERS[0].id, "reply", "33333333-3333-4333-8333-333333333302", "replied to your comment on Previous Year Questions — DBMS", true],
  [USERS[2].id, USERS[4].id, "request_interact", "44444444-4444-4444-8444-444444444402", "is interested in your request: DBMS solved PYQs for the end-sems?", false],
  [USERS[0].id, USERS[2].id, "new_resource", "33333333-3333-4333-8333-333333333305", "published a new resource", false],
];
for (const [uid, actor, type, pid, body, read] of NOTIFS) {
  await db.query(
    `INSERT INTO notifications (user_id, actor_id, type, post_id, body, read, created_at)
     VALUES ($1,$2,$3,$4,$5,$6, now() - ($7 || ' hours')::interval)`,
    [uid, actor, type, pid, body, read, String(int(1, 48))],
  );
}
for (let i = 0; i < 14; i++) {
  const target = USERS[i % 5];
  const actor = USERS[(i + 2) % 6];
  await db.query(
    `INSERT INTO notifications (user_id, actor_id, type, post_id, body, read, created_at)
     VALUES ($1,$2,'like',$3,$4,$5, now() - ($6 || ' hours')::interval)`,
    [target.id, actor.id, ALL[i % ALL.length].id, `liked your post — ${ALL[i % ALL.length].title}`, i % 3 !== 0, String(int(2, 90))],
  );
}

/* -------------------------------- reports -------------------------------- */
const REPORTS = [
  [USERS[5].id, "post", "33333333-3333-4333-8333-333333333306", "Duplicate of the lab manual already shared in the ECE group.", "open"],
  [USERS[6].id, "comment", null, "Off-topic reply that has nothing to do with the resource.", "open"],
  [USERS[7].id, "request", "44444444-4444-4444-8444-444444444403", "This request has been asked three times this week.", "open"],
  [USERS[8].id, "post", "33333333-3333-4333-8333-333333333304", "Formula sheet appears to be copied from a coaching institute.", "resolved"],
];
const commentRes = await db.query(`SELECT id FROM comments LIMIT 1`);
for (const [reporter, type, target, reason, status] of REPORTS) {
  const tid = target ?? commentRes.rows[0]?.id;
  if (!tid) continue;
  await db.query(
    `INSERT INTO reports (reporter_id, target_type, target_id, label, reason, status, created_at, resolver_id, resolved_at)
     VALUES ($1,$2,$3,$4,$5,$6::varchar, now() - interval '2 days', $7, CASE WHEN $6::varchar = 'open' THEN NULL ELSE now() END)`,
    [reporter, type, tid, "Reported through the feed", reason, status, status === "open" ? null : USERS[5].id],
  );
}

/* --------------------------------- stats --------------------------------- */
const counts = await db.query(`
  select (select count(*) from users) users,
         (select count(*) from posts where kind='resource') resources,
         (select count(*) from posts where kind='request') requests,
         (select count(*) from posts where kind='request' and status='fulfilled') fulfilled,
         (select count(*) from likes) likes,
         (select count(*) from comments) comments,
         (select count(*) from reports) reports
`);
console.log("Seed complete:", counts.rows[0]);

// sanity check on the password scheme
const adminHash = (await db.query(`select password_hash from users where email='admin@bpmandal.ac.in'`)).rows[0].password_hash;
console.log("Password hash verified:", verifyPassword("admin1234", adminHash));

await db.end();
void existsSync;
void IMAGES;
void byId;
