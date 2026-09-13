const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_SECRET_IN_PRODUCTION";

const db = new Database(path.join(__dirname, "data.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','student')),
  student_id TEXT
);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  class_name TEXT,
  message TEXT,
  status TEXT DEFAULT 'Pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  section TEXT,
  roll TEXT,
  email TEXT,
  phone TEXT
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  exam TEXT NOT NULL,
  subject TEXT NOT NULL,
  marks REAL NOT NULL,
  grade TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS gallery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL
);
`);

function seed() {
  const adminExists = db.prepare("SELECT id FROM users WHERE username=?").get("admin");
  if (!adminExists) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.prepare("INSERT INTO users(username,password,role) VALUES(?,?,?)")
      .run("admin", hash, "admin");
  }

  const studentExists = db.prepare("SELECT id FROM users WHERE username=?").get("RUMC001");
  if (!studentExists) {
    const hash = bcrypt.hashSync("student123", 10);
    db.prepare("INSERT INTO users(username,password,role,student_id) VALUES(?,?,?,?)")
      .run("RUMC001", hash, "student", "RUMC001");
  }

  const student = db.prepare("SELECT id FROM students WHERE student_id=?").get("RUMC001");
  if (!student) {
    db.prepare(`
      INSERT INTO students(student_id,name,class_name,section,roll,email,phone)
      VALUES(?,?,?,?,?,?,?)
    `).run(
      "RUMC001", "Demo Student", "XII", "A", "01",
      "student@example.com", "+8801000000000"
    );
  }

  if (db.prepare("SELECT COUNT(*) c FROM notices").get().c === 0) {
    const stmt = db.prepare("INSERT INTO notices(title,body,date) VALUES(?,?,?)");
    stmt.run("Admission Information", "Admission-related information will be published here.", "2026-09-13");
    stmt.run("Academic Notice", "Academic announcements and examination information.", "2026-09-10");
    stmt.run("General Notice", "General institutional announcements.", "2026-09-05");
  }

  if (db.prepare("SELECT COUNT(*) c FROM events").get().c === 0) {
    const stmt = db.prepare("INSERT INTO events(title,event_date,description) VALUES(?,?,?)");
    stmt.run("Orientation Program", "2026-10-05", "Orientation information will be updated by the administration.");
    stmt.run("Annual Cultural Program", "2026-11-15", "A sample event entry for demonstration.");
  }

  if (db.prepare("SELECT COUNT(*) c FROM results").get().c === 0) {
    const stmt = db.prepare("INSERT INTO results(student_id,exam,subject,marks,grade) VALUES(?,?,?,?,?)");
    stmt.run("RUMC001", "Half Yearly", "English", 88, "A+");
    stmt.run("RUMC001", "Half Yearly", "Physics", 82, "A+");
    stmt.run("RUMC001", "Half Yearly", "Chemistry", 78, "A");
    stmt.run("RUMC001", "Half Yearly", "Mathematics", 91, "A+");
  }

  if (db.prepare("SELECT COUNT(*) c FROM gallery").get().c === 0) {
    const stmt = db.prepare("INSERT INTO gallery(title,image_url) VALUES(?,?)");
    stmt.run("Campus", "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=80");
    stmt.run("Library", "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=80");
    stmt.run("Classroom", "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80");
  }
}
seed();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function auth(requiredRole = null) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Authentication required." });
    try {
      const user = jwt.verify(token, JWT_SECRET);
      if (requiredRole && user.role !== requiredRole) {
        return res.status(403).json({ error: "Access denied." });
      }
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
  };
}

app.get("/api/notices", (req, res) => {
  res.json(db.prepare("SELECT * FROM notices ORDER BY date DESC, id DESC").all());
});

app.get("/api/events", (req, res) => {
  res.json(db.prepare("SELECT * FROM events ORDER BY event_date ASC, id ASC").all());
});

app.get("/api/gallery", (req, res) => {
  res.json(db.prepare("SELECT * FROM gallery ORDER BY id DESC").all());
});

app.post("/api/admissions", (req, res) => {
  const { student_name, phone, email, class_name, message } = req.body;
  if (!student_name || !phone) {
    return res.status(400).json({ error: "Student name and phone are required." });
  }
  const result = db.prepare(`
    INSERT INTO admissions(student_name,phone,email,class_name,message)
    VALUES(?,?,?,?,?)
  `).run(student_name.trim(), phone.trim(), (email || "").trim(), (class_name || "").trim(), (message || "").trim());

  res.status(201).json({ message: "Application submitted successfully.", id: result.lastInsertRowid });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!user || !bcrypt.compareSync(password || "", user.password)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, student_id: user.student_id },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
  res.json({ token, role: user.role, username: user.username, student_id: user.student_id });
});

app.get("/api/student/me", auth("student"), (req, res) => {
  const student = db.prepare("SELECT * FROM students WHERE student_id=?").get(req.user.student_id);
  if (!student) return res.status(404).json({ error: "Student record not found." });
  res.json(student);
});

app.get("/api/student/results", auth("student"), (req, res) => {
  res.json(db.prepare("SELECT * FROM results WHERE student_id=? ORDER BY id DESC").all(req.user.student_id));
});

app.get("/api/admin/dashboard", auth("admin"), (req, res) => {
  res.json({
    students: db.prepare("SELECT COUNT(*) c FROM students").get().c,
    teachers: 0,
    notices: db.prepare("SELECT COUNT(*) c FROM notices").get().c,
    admissions: db.prepare("SELECT COUNT(*) c FROM admissions").get().c,
    events: db.prepare("SELECT COUNT(*) c FROM events").get().c
  });
});

app.get("/api/admin/admissions", auth("admin"), (req, res) => {
  res.json(db.prepare("SELECT * FROM admissions ORDER BY id DESC").all());
});

app.post("/api/admin/notices", auth("admin"), (req, res) => {
  const { title, body, date } = req.body;
  if (!title || !body || !date) return res.status(400).json({ error: "Title, body and date are required." });
  const result = db.prepare("INSERT INTO notices(title,body,date) VALUES(?,?,?)").run(title, body, date);
  res.status(201).json({ id: result.lastInsertRowid });
});

app.delete("/api/admin/notices/:id", auth("admin"), (req, res) => {
  db.prepare("DELETE FROM notices WHERE id=?").run(req.params.id);
  res.json({ message: "Notice deleted." });
});

app.post("/api/admin/events", auth("admin"), (req, res) => {
  const { title, event_date, description } = req.body;
  if (!title || !event_date) return res.status(400).json({ error: "Title and date are required." });
  const result = db.prepare("INSERT INTO events(title,event_date,description) VALUES(?,?,?)")
    .run(title, event_date, description || "");
  res.status(201).json({ id: result.lastInsertRowid });
});

app.delete("/api/admin/events/:id", auth("admin"), (req, res) => {
  db.prepare("DELETE FROM events WHERE id=?").run(req.params.id);
  res.json({ message: "Event deleted." });
});

app.post("/api/admin/students", auth("admin"), (req, res) => {
  const { student_id, name, class_name, section, roll, email, phone } = req.body;
  if (!student_id || !name || !class_name) {
    return res.status(400).json({ error: "Student ID, name and class are required." });
  }
  try {
    db.prepare(`
      INSERT INTO students(student_id,name,class_name,section,roll,email,phone)
      VALUES(?,?,?,?,?,?,?)
    `).run(student_id, name, class_name, section || "", roll || "", email || "", phone || "");
    res.status(201).json({ message: "Student added." });
  } catch {
    res.status(409).json({ error: "Student ID already exists." });
  }
});

app.get("/api/admin/students", auth("admin"), (req, res) => {
  res.json(db.prepare("SELECT * FROM students ORDER BY id DESC").all());
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`RUMC website running at http://localhost:${PORT}`);
  console.log("Demo admin: admin / admin123");
  console.log("Demo student: RUMC001 / student123");
});
