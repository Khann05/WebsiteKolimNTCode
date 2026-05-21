require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { run, get, all } = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, Date.now() + "-" + safe);
  }
});

const upload = multer({ storage, limits: { fileSize: 80 * 1024 * 1024 } });
const multiUpload = upload.fields([{ name: "file", maxCount: 1 }, { name: "cover", maxCount: 1 }]);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "public")));

function requireAdmin(req, res, next) {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Admin password salah" });
  }
  next();
}

function normalizePhone(phone) {
  let n = String(phone || "").replace(/\D/g, "");
  if (n.startsWith("0")) n = "62" + n.slice(1);
  if (!n.startsWith("62")) n = "62" + n;
  return "+" + n;
}

function makeCode(name) {
  const base = (String(name || "SISWA").replace(/[^a-zA-Z]/g, "").slice(0, 5).toUpperCase() || "SISWA");
  return base + Math.floor(100 + Math.random() * 900);
}

function fileInfo(req, field) {
  const f = req.files && req.files[field] && req.files[field][0];
  if (!f) return { name: "", path: "", type: "" };
  return { name: f.originalname, path: "/uploads/" + f.filename, type: f.mimetype };
}

async function getFullStudent(id) {
  const student = await get("SELECT * FROM students WHERE id = ?", [id]);
  if (!student) return null;

  const attendances = await all("SELECT * FROM attendances WHERE student_id = ? ORDER BY date DESC, time DESC", [id]);

  const certificates = await all("SELECT * FROM certificates WHERE student_id = ? ORDER BY created_at DESC", [id]);

  const library = await all(`
    SELECT 
      lm.*,
      COALESCE(ma.is_unlocked, 0) AS is_unlocked
    FROM library_materials lm
    LEFT JOIN material_access ma ON ma.material_id = lm.id AND ma.student_id = ?
    ORDER BY lm.id ASC
  `, [id]);

  return { ...student, attendances, certificates, library };
}


async function awardProgressCertificates(studentId, progressSession) {
  // Sertifikat tidak dibuat otomatis.
  // Admin yang upload/menambahkan sertifikat secara manual.
  return;
}

async function updateProgress(studentId, nextProgress) {
  const progress = Math.max(0, Number(nextProgress || 0));
  await run("UPDATE students SET progress_session = ? WHERE id = ?", [progress, studentId]);
  await awardProgressCertificates(studentId, progress);
  return await getFullStudent(studentId);
}


app.get("/", (req, res) => res.redirect("/admin.html"));

app.post("/api/admin/login", (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) return res.json({ ok: true });
  return res.status(401).json({ error: "Password salah" });
});

app.get("/api/admin/students", requireAdmin, async (req, res) => {
  try {
    const rows = await all(`
      SELECT
        s.*,
        COUNT(DISTINCT a.id) AS attendance_count,
        COUNT(DISTINCT c.id) AS certificate_count
      FROM students s
      LEFT JOIN attendances a ON a.student_id = s.id
      LEFT JOIN certificates c ON c.student_id = s.id
      GROUP BY s.id
      ORDER BY s.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/students", requireAdmin, async (req, res) => {
  try {
    const { name, phone, level = "", description = "" } = req.body;
    let parentCode = req.body.parent_code;

    if (!name || !phone) return res.status(400).json({ error: "Nama dan nomor wajib diisi" });
    if (!parentCode || !parentCode.trim()) parentCode = makeCode(name);

    const result = await run(
      "INSERT INTO students (name, phone, level, description, parent_code) VALUES (?, ?, ?, ?, ?)",
      [name.trim(), normalizePhone(phone), level, description, String(parentCode).trim().toUpperCase()]
    );

    res.json(await getFullStudent(result.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/students/:id", requireAdmin, async (req, res) => {
  try {
    const student = await getFullStudent(req.params.id);
    if (!student) return res.status(404).json({ error: "Siswa tidak ditemukan" });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/students/:id", requireAdmin, async (req, res) => {
  try {
    const { name, phone, level = "", description = "" } = req.body;
    let parentCode = String(req.body.parent_code || "").trim().toUpperCase();

    if (!name || !phone) return res.status(400).json({ error: "Nama dan nomor wajib diisi" });
    if (!parentCode) parentCode = makeCode(name);

    await run(
      "UPDATE students SET name = ?, phone = ?, level = ?, description = ?, parent_code = ? WHERE id = ?",
      [name.trim(), normalizePhone(phone), level, description, parentCode, req.params.id]
    );

    res.json(await getFullStudent(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/students/:id", requireAdmin, async (req, res) => {
  try {
    await run("DELETE FROM students WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/students/:id/attendance", requireAdmin, async (req, res) => {
  try {
    const { date, time, session, note = "" } = req.body;
    if (!date || !time || !session) return res.status(400).json({ error: "Tanggal, jam, dan session wajib diisi" });

    await run(
      "INSERT INTO attendances (student_id, date, time, session, note) VALUES (?, ?, ?, ?, ?)",
      [req.params.id, date, time, session, note]
    );

    res.json(await getFullStudent(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/attendance/:id", requireAdmin, async (req, res) => {
  try {
    const row = await get("SELECT student_id FROM attendances WHERE id = ?", [req.params.id]);
    await run("DELETE FROM attendances WHERE id = ?", [req.params.id]);
    res.json(row ? await getFullStudent(row.student_id) : { ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/library", requireAdmin, async (req, res) => {
  try {
    const rows = await all("SELECT * FROM library_materials ORDER BY id ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/library", requireAdmin, multiUpload, async (req, res) => {
  try {
    const { title = "", category = "Beginner", note = "" } = req.body;
    const main = fileInfo(req, "file");
    const cover = fileInfo(req, "cover");

    if (!title && !main.path && !cover.path) {
      return res.status(400).json({ error: "Judul, PPT, atau cover wajib diisi" });
    }

    const result = await run(
      `INSERT INTO library_materials
        (title, category, note, file_name, file_path, file_type, cover_name, cover_path, cover_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title || main.name || "Materi", category || "Beginner", note, main.name, main.path, main.type, cover.name, cover.path, cover.type]
    );

    res.json({ ok: true, id: result.id, library: await all("SELECT * FROM library_materials ORDER BY id ASC") });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.put("/api/admin/library/:id", requireAdmin, multiUpload, async (req, res) => {
  try {
    const old = await get("SELECT * FROM library_materials WHERE id = ?", [req.params.id]);
    if (!old) return res.status(404).json({ error: "PPT tidak ditemukan" });

    const { title = "", category = "Beginner", note = "" } = req.body;
    const main = fileInfo(req, "file");
    const cover = fileInfo(req, "cover");

    const nextTitle = String(title || old.title || main.name || "Materi").trim();
    const nextCategory = String(category || old.category || "Beginner").trim();
    const nextNote = String(note || "").trim();

    await run(
      `UPDATE library_materials SET
        title = ?,
        category = ?,
        note = ?,
        file_name = ?,
        file_path = ?,
        file_type = ?,
        cover_name = ?,
        cover_path = ?,
        cover_type = ?
       WHERE id = ?`,
      [
        nextTitle,
        nextCategory || "Beginner",
        nextNote,
        main.name || old.file_name || "",
        main.path || old.file_path || "",
        main.type || old.file_type || "",
        cover.name || old.cover_name || "",
        cover.path || old.cover_path || "",
        cover.type || old.cover_type || "",
        req.params.id
      ]
    );

    res.json({ ok: true, library: await all("SELECT * FROM library_materials ORDER BY id ASC") });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/library/:id", requireAdmin, async (req, res) => {
  try {
    await run("DELETE FROM library_materials WHERE id = ?", [req.params.id]);
    res.json({ ok: true, library: await all("SELECT * FROM library_materials ORDER BY id ASC") });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/students/:studentId/library/:materialId/access", requireAdmin, async (req, res) => {
  try {
    const unlocked = req.body.is_unlocked ? 1 : 0;

    await run(
      `INSERT INTO material_access (student_id, material_id, is_unlocked, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(student_id, material_id)
       DO UPDATE SET is_unlocked = excluded.is_unlocked, updated_at = CURRENT_TIMESTAMP`,
      [req.params.studentId, req.params.materialId, unlocked]
    );

    res.json(await getFullStudent(req.params.studentId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.put("/api/admin/students/:id/progress", requireAdmin, async (req, res) => {
  try {
    const student = await get("SELECT * FROM students WHERE id = ?", [req.params.id]);
    if (!student) return res.status(404).json({ error: "Siswa tidak ditemukan" });

    let nextProgress = Number(student.progress_session || 0);

    if (req.body.mode === "add") nextProgress += 1;
    else if (req.body.mode === "minus") nextProgress -= 1;
    else if (req.body.mode === "set") nextProgress = Number(req.body.progress_session || 0);

    res.json(await updateProgress(req.params.id, nextProgress));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post("/api/admin/students/:id/certificates", requireAdmin, multiUpload, async (req, res) => {
  try {
    const { title = "" } = req.body;
    const isLocked = req.body.is_locked === "0" ? 0 : 1;
    const main = fileInfo(req, "file");
    const cover = fileInfo(req, "cover");

    if (!title && !main.path && !cover.path) {
      return res.status(400).json({ error: "Nama sertifikat, file, atau gambar wajib diisi" });
    }

    await run(
      `INSERT INTO certificates
        (student_id, title, file_name, file_path, file_type, cover_name, cover_path, cover_type, is_locked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, title || main.name || cover.name || "Sertifikat", main.name || cover.name, main.path || cover.path, main.type || cover.type, cover.name, cover.path, cover.type, isLocked]
    );

    res.json(await getFullStudent(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/certificates/:id/lock", requireAdmin, async (req, res) => {
  try {
    const row = await get("SELECT student_id FROM certificates WHERE id = ?", [req.params.id]);
    await run("UPDATE certificates SET is_locked = ? WHERE id = ?", [req.body.is_locked ? 1 : 0, req.params.id]);
    res.json(row ? await getFullStudent(row.student_id) : { ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/certificates/:id", requireAdmin, async (req, res) => {
  try {
    const row = await get("SELECT student_id FROM certificates WHERE id = ?", [req.params.id]);
    await run("DELETE FROM certificates WHERE id = ?", [req.params.id]);
    res.json(row ? await getFullStudent(row.student_id) : { ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/parent/:code", async (req, res) => {
  try {
    const student = await get("SELECT * FROM students WHERE parent_code = ?", [String(req.params.code || "").toUpperCase()]);
    if (!student) return res.status(404).json({ error: "Kode orang tua tidak ditemukan" });

    res.json(await getFullStudent(student.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
