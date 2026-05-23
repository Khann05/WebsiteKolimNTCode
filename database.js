const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new sqlite3.Database(path.join(dataDir, "les-koding.db"));

function runRaw(sql) {
  db.run(sql, function () {});
}

function addColumnIfMissing(table, column, definition) {
  db.all(`PRAGMA table_info(${table})`, [], function (err, rows) {
    if (err) return;
    const exists = rows.some((row) => row.name === column);
    if (!exists) runRaw(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  });
}

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      level TEXT DEFAULT '',
      description TEXT DEFAULT '',
      progress_session INTEGER DEFAULT 0,
      parent_code TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      session TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS library_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'Beginner',
      note TEXT DEFAULT '',
      file_name TEXT DEFAULT '',
      file_path TEXT DEFAULT '',
      file_type TEXT DEFAULT '',
      cover_name TEXT DEFAULT '',
      cover_path TEXT DEFAULT '',
      cover_type TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS material_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      is_unlocked INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, material_id),
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(material_id) REFERENCES library_materials(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT DEFAULT '',
      file_path TEXT DEFAULT '',
      file_type TEXT DEFAULT '',
      cover_name TEXT DEFAULT '',
      cover_path TEXT DEFAULT '',
      cover_type TEXT DEFAULT '',
      is_locked INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `);


  db.run(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL UNIQUE,
      title TEXT DEFAULT 'Quiz',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(material_id) REFERENCES library_materials(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      question_order INTEGER DEFAULT 1,
      question TEXT NOT NULL,
      option_a TEXT DEFAULT '',
      option_b TEXT DEFAULT '',
      option_c TEXT DEFAULT '',
      option_d TEXT DEFAULT '',
      correct_answer TEXT DEFAULT 'A',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    )
  `);

  addColumnIfMissing("students", "progress_session", "INTEGER DEFAULT 0");
  addColumnIfMissing("library_materials", "category", "TEXT DEFAULT 'Beginner'");
  addColumnIfMissing("library_materials", "cover_name", "TEXT DEFAULT ''");
  addColumnIfMissing("library_materials", "cover_path", "TEXT DEFAULT ''");
  addColumnIfMissing("library_materials", "cover_type", "TEXT DEFAULT ''");
  addColumnIfMissing("certificates", "cover_name", "TEXT DEFAULT ''");
  addColumnIfMissing("certificates", "cover_path", "TEXT DEFAULT ''");
  addColumnIfMissing("certificates", "cover_type", "TEXT DEFAULT ''");
  addColumnIfMissing("certificates", "is_locked", "INTEGER DEFAULT 1");
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function (err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { db, run, get, all };
