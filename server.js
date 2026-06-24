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

const dataDirSafe = path.join(__dirname, "data");
const uploadDirSafe = path.join(__dirname, "uploads");
if (!fs.existsSync(dataDirSafe)) fs.mkdirSync(dataDirSafe, { recursive: true });
if (!fs.existsSync(uploadDirSafe)) fs.mkdirSync(uploadDirSafe, { recursive: true });




const uploadDir = uploadDirSafe;
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, Date.now() + "-" + safe);
  }
});

const upload = multer({ storage, limits: { fileSize: 300 * 1024 * 1024 } });
const multiUpload = upload.fields([{ name: "file", maxCount: 1 }, { name: "cover", maxCount: 1 }]);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= ABSOLUTE UNLOCK MATERIAL ACCESS FIX =================
// Test route: buka http://localhost:3000/api/admin/material-access-test
// Kalau masih 404, server.js ini belum terganti atau npm start menjalankan folder lain.
app.get("/api/admin/material-access-test", (req, res) => {
  res.json({ ok: true, route: "material-access aktif" });
});

async function absoluteUpdateMaterialAccess(req, res) {
  try {
    if (typeof ADMIN_PASSWORD !== "undefined") {
      const sentPassword = req.headers["x-admin-password"];
      if (sentPassword !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Admin password salah" });
      }
    }

    const body = req.body || {};
    const studentId = Number(body.student_id || req.params.id);
    const materialId = Number(body.material_id || req.params.materialId);

    if (!studentId || !materialId) {
      return res.status(400).json({ error: "ID siswa atau PPT tidak valid" });
    }

    const raw = body.is_unlocked;
    const isUnlocked = (
      raw === true ||
      raw === 1 ||
      raw === "1" ||
      raw === "true"
    ) ? 1 : 0;

    const student = await get("SELECT id FROM students WHERE id = ?", [studentId]);
    if (!student) return res.status(404).json({ error: "Siswa tidak ditemukan" });

    const material = await get("SELECT id FROM library_materials WHERE id = ?", [materialId]);
    if (!material) return res.status(404).json({ error: "PPT/Materi tidak ditemukan" });

    const existing = await get(
      "SELECT id FROM material_access WHERE student_id = ? AND material_id = ?",
      [studentId, materialId]
    );

    if (existing) {
      await run(
        "UPDATE material_access SET is_unlocked = ?, updated_at = CURRENT_TIMESTAMP WHERE student_id = ? AND material_id = ?",
        [isUnlocked, studentId, materialId]
      );
    } else {
      await run(
        "INSERT INTO material_access (student_id, material_id, is_unlocked, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        [studentId, materialId, isUnlocked]
      );
    }

    return res.json(await getFullStudent(studentId));
  } catch (err) {
    return res.status(500).json({ error: err.message || "Gagal update unlock PPT" });
  }
}

app.post("/api/admin/material-access", absoluteUpdateMaterialAccess);
app.put("/api/admin/material-access", absoluteUpdateMaterialAccess);
app.all("/api/admin/material-access", absoluteUpdateMaterialAccess);

// Alias lama supaya kalau browser/cache masih manggil route lama, tetap tidak 404.
app.post("/api/admin/students/:id/library/:materialId/access", absoluteUpdateMaterialAccess);
app.put("/api/admin/students/:id/library/:materialId/access", absoluteUpdateMaterialAccess);
app.all("/api/admin/students/:id/library/:materialId/access", absoluteUpdateMaterialAccess);

app.post("/api/admin/students/:id/materials/:materialId/access", absoluteUpdateMaterialAccess);
app.put("/api/admin/students/:id/materials/:materialId/access", absoluteUpdateMaterialAccess);
app.all("/api/admin/students/:id/materials/:materialId/access", absoluteUpdateMaterialAccess);
// ================= END ABSOLUTE UNLOCK MATERIAL ACCESS FIX =================


app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "public")));


async function ensurePaymentColumnsRuntime() {
  try { await run("ALTER TABLE students ADD COLUMN payment_warning_disabled INTEGER DEFAULT 0"); } catch(e) {}
}

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


function deleteUploadByPublicPath(publicPath) {
  try {
    if (!publicPath || typeof publicPath !== "string") return;
    if (!publicPath.startsWith("/uploads/")) return;
    const filename = path.basename(publicPath);
    const target = path.join(uploadDir, filename);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch (err) {
    console.warn("Gagal hapus file lama:", err.message);
  }
}












function computePaymentState(student, attendances) {
  const total = Array.isArray(attendances) ? attendances.length : Number((student && student.attendance_count) || 0);
  const cycleNo = total <= 0 ? 0 : (total % 4 === 0 ? 4 : total % 4);
  const disabled = Number((student && student.payment_warning_disabled) || 0) === 1;

  const on = cycleNo === 4 && !disabled;
  const off = cycleNo === 4 && disabled;

  return {
    lesson_total: total,
    lesson_cycle_number: cycleNo,
    lesson_cycle_text: cycleNo ? (cycleNo + " / 4 sesi") : "0 / 4 sesi",
    payment_warning_disabled: disabled ? 1 : 0,
    payment_warning_on: on ? 1 : 0,
    payment_should_warn: on ? 1 : 0,
    payment_status: on ? "on" : (off ? "off" : "inactive"),
    payment_status_label: on ? "NYALA" : (off ? "MATI" : "BELUM AKTIF")
  };
}

async function getFullStudent(id) {
  await ensurePaymentColumnsRuntime();

  const student = await get("SELECT * FROM students WHERE id = ?", [id]);
  if (!student) return null;

  const attendances = await all("SELECT * FROM attendances WHERE student_id = ? ORDER BY date DESC, time DESC", [id]);
  const certificates = await all("SELECT * FROM certificates WHERE student_id = ? ORDER BY created_at DESC", [id]);

  const library = await all(`
    SELECT 
      lm.*,
      COALESCE(ma.is_unlocked, 0) AS is_unlocked,
      ma.updated_at AS unlocked_at,
      q.id AS quiz_id,
      q.title AS quiz_title,
      (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS quiz_question_count
    FROM library_materials lm
    LEFT JOIN material_access ma ON ma.material_id = lm.id AND ma.student_id = ?
    LEFT JOIN quizzes q ON q.material_id = lm.id
    ORDER BY lm.id ASC
  `, [id]);

  const paymentState = computePaymentState(student, attendances);
  return { ...student, ...paymentState, attendances, certificates, library };
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



function lessonCycleNumberServer(total) {
  const n = Number(total || 0);
  if (n <= 0) return 0;
  const mod = n % 4;
  return mod === 0 ? 4 : mod;
}

app.get("/", (req, res) => res.redirect("/admin.html"));

app.post("/api/admin/login", (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) return res.json({ ok: true });
  return res.status(401).json({ error: "Password salah" });
});

app.get("/api/admin/students", requireAdmin, async (req, res) => {
  try {
    await ensurePaymentColumnsRuntime();

    const rows = await all(`
      SELECT
        s.*,
        COUNT(DISTINCT a.id) AS attendance_count,
        COUNT(DISTINCT c.id) AS certificate_count,
        (SELECT COUNT(*) FROM quizzes) AS quiz_count
      FROM students s
      LEFT JOIN attendances a ON a.student_id = s.id
      LEFT JOIN certificates c ON c.student_id = s.id
      GROUP BY s.id
      ORDER BY s.id DESC
    `);

    const normalized = rows.map((row) => ({
      ...row,
      ...computePaymentState(row, { length: Number(row.attendance_count || 0) })
    }));

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/students", requireAdmin, async (req, res) => {
  try {
    const { name, phone, level = "", description = "" } = req.body;
    let parentCode = req.body.parent_code;
    const paymentPaid = req.body.payment_paid ? 1 : 0;

    if (!name || !phone) return res.status(400).json({ error: "Nama dan nomor wajib diisi" });
    if (!parentCode || !parentCode.trim()) parentCode = makeCode(name);

    const result = await run(
      "INSERT INTO students (name, phone, level, description, parent_code, payment_paid, payment_warning_disabled, payment_paid_package) VALUES (?, ?, ?, ?, ?, ?, 0, 0)",
      [name.trim(), normalizePhone(phone), level, description, String(parentCode).trim().toUpperCase(), paymentPaid]
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

    // payment_paid harus eksplisit:
    // true  = sudah bayar
    // false = belum bayar
    const paymentPaid = req.body.payment_paid === true || req.body.payment_paid === 1 || req.body.payment_paid === "1" ? 1 : 0;

    if (!name || !phone) return res.status(400).json({ error: "Nama dan nomor wajib diisi" });
    if (!parentCode) parentCode = makeCode(name);

    await run(
      "UPDATE students SET name = ?, phone = ?, level = ?, description = ?, parent_code = ?, payment_paid = ? WHERE id = ?",
      [name.trim(), normalizePhone(phone), level, description, parentCode, paymentPaid, req.params.id]
    );
res.json(await getFullStudent(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});















app.all("/api/admin/students/:id/payment", requireAdmin, async (req, res) => {
  try {
    await ensurePaymentColumnsRuntime();

    const studentId = Number(req.params.id);
    const body = req.body || {};

    if (!Object.prototype.hasOwnProperty.call(body, "warning_enabled")) {
      const current = await getFullStudent(studentId);
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  return res.json(current);
    }

    const warningEnabled = body.warning_enabled === true || body.warning_enabled === 1 || body.warning_enabled === "1";
    const disabledValue = warningEnabled ? 0 : 1;

    await run(
      "UPDATE students SET payment_warning_disabled = ? WHERE id = ?",
      [disabledValue, studentId]
    );

    const fresh = await getFullStudent(studentId);
    fresh.__payment_warning_saved = true;
    fresh.__requested_warning_enabled = warningEnabled ? 1 : 0;
    fresh.__saved_payment_warning_disabled = disabledValue;

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.json(fresh);
  } catch (err) {
    res.status(500).json({ error: err.message || "Gagal update tombol pembayaran" });
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

    const countRow = await get("SELECT COUNT(*) AS total FROM attendances WHERE student_id = ?", [req.params.id]);
    const total = Number(countRow && countRow.total ? countRow.total : 0);

    // Setiap paket baru mulai di 1/4, status pembayaran otomatis kembali belum dibayar.
    if (lessonCycleNumberServer(total) === 1) {
      // Pembayaran tidak direset otomatis; status merah 4/4 dikontrol tombol admin.
    }
const paymentStateAfterAttendance = await getFullStudent(req.params.id);
    if (Number(paymentStateAfterAttendance.lesson_cycle_number || 0) === 4) {
      await run("UPDATE students SET payment_warning_disabled = 0 WHERE id = ?", [req.params.id]);
    }

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
    const rows = await all(`
      SELECT
        lm.*,
        q.id AS quiz_id,
        q.title AS quiz_title,
        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS quiz_question_count
      FROM library_materials lm
      LEFT JOIN quizzes q ON q.material_id = lm.id
      ORDER BY lm.id ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


async function cleanupDuplicateLibraryMaterials(preferredId = null) {
  const rows = await all("SELECT * FROM library_materials ORDER BY id ASC");
  const groups = new Map();

  rows.forEach((row) => {
    const key = [
      String(row.title || "").trim().toLowerCase(),
      String(row.category || "").trim().toLowerCase(),
      String(row.material_type || "ppt").trim().toLowerCase()
    ].join("||");

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    let keep = null;

    if (preferredId) {
      keep = group.find((row) => Number(row.id) === Number(preferredId));
    }

    if (!keep) {
      // Kalau tidak ada preferredId, simpan data paling lama agar link/akses siswa tidak berubah.
      keep = group[0];
    }

    for (const row of group) {
      if (Number(row.id) === Number(keep.id)) continue;

      // Jangan hapus file fisik kalau path-nya sama dengan data yang disimpan.
      if (row.file_path && row.file_path !== keep.file_path) {
        deleteUploadByPublicPath(row.file_path);
      }
      if (row.cover_path && row.cover_path !== keep.cover_path) {
        deleteUploadByPublicPath(row.cover_path);
      }

      // Bersihkan relasi agar tidak ada sisa data yatim.
      await run("DELETE FROM material_access WHERE material_id = ?", [row.id]);
      await run("DELETE FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE material_id = ?)", [row.id]);
      await run("DELETE FROM quizzes WHERE material_id = ?", [row.id]);
      await run("DELETE FROM library_materials WHERE id = ?", [row.id]);
    }
  }
}

app.post("/api/admin/library", requireAdmin, multiUpload, async (req, res) => {
  try {
    const { title = "", category = "", note = "", edit_id = "", force_update = "" } = req.body;
    const requestedType = req.body.material_type === "file" ? "file" : "ppt";
    const finalCategory = category || (requestedType === "file" ? "Project Files" : "Beginner");

    const main = fileInfo(req, "file");
    const cover = fileInfo(req, "cover");

    let mode = "insert";
    let targetId = edit_id && String(edit_id).trim() !== "" ? Number(edit_id) : null;
    let existing = null;

    if (targetId) {
      existing = await get("SELECT * FROM library_materials WHERE id = ?", [targetId]);
      if (!existing) {
        return res.status(404).json({ error: "Data edit tidak ditemukan. Refresh admin lalu klik Edit lagi." });
      }
    }

    // Anti-duplikat: kalau edit_id hilang, cari data lama berdasarkan title + category + type.
    if (!existing && title) {
      existing = await get(
        `SELECT * FROM library_materials
         WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))
           AND LOWER(TRIM(category)) = LOWER(TRIM(?))
           AND material_type = ?
         ORDER BY id ASC
         LIMIT 1`,
        [title, finalCategory, requestedType]
      );
      if (existing) targetId = existing.id;
    }

    if (!existing && force_update === "1") {
      return res.status(400).json({ error: "Mode edit aktif, tapi data lama tidak ditemukan. Refresh admin lalu klik Edit lagi." });
    }

    if (existing) {
      mode = "update";

      const hasNewMain = !!main.path;
      const hasNewCover = !!cover.path;

      const nextFileName = hasNewMain ? main.name : existing.file_name;
      const nextFilePath = hasNewMain ? main.path : existing.file_path;
      const nextFileType = hasNewMain ? main.type : existing.file_type;

      const nextCoverName = hasNewCover ? cover.name : existing.cover_name;
      const nextCoverPath = hasNewCover ? cover.path : existing.cover_path;
      const nextCoverType = hasNewCover ? cover.type : existing.cover_type;

      await run(
        `UPDATE library_materials
         SET title = ?,
             category = ?,
             material_type = ?,
             note = ?,
             file_name = ?,
             file_path = ?,
             file_type = ?,
             cover_name = ?,
             cover_path = ?,
             cover_type = ?
         WHERE id = ?`,
        [
          title || existing.title,
          finalCategory || existing.category,
          existing.material_type || requestedType,
          note,
          nextFileName,
          nextFilePath,
          nextFileType,
          nextCoverName,
          nextCoverPath,
          nextCoverType,
          targetId
        ]
      );

      if (hasNewMain && existing.file_path && existing.file_path !== nextFilePath) {
        deleteUploadByPublicPath(existing.file_path);
      }
      if (hasNewCover && existing.cover_path && existing.cover_path !== nextCoverPath) {
        deleteUploadByPublicPath(existing.cover_path);
      }

      // Bersihkan duplikat hasil bug lama atau request dobel.
      await cleanupDuplicateLibraryMaterials(targetId);
    } else {
      if (!main.path && !cover.path) {
        return res.status(400).json({ error: "Upload file atau cover terlebih dahulu" });
      }

      await run(
        `INSERT INTO library_materials
         (title, category, material_type, note, file_name, file_path, file_type, cover_name, cover_path, cover_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title || main.name || cover.name || "Materi",
          finalCategory,
          requestedType,
          note,
          main.name,
          main.path,
          main.type,
          cover.name,
          cover.path,
          cover.type
        ]
      );

      // Kalau ternyata insert menciptakan duplikat dengan data lama, langsung bersihkan.
      await cleanupDuplicateLibraryMaterials(null);
    }

    const rows = await all(`
      SELECT
        lm.*,
        q.id AS quiz_id,
        q.title AS quiz_title,
        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS quiz_question_count
      FROM library_materials lm
      LEFT JOIN quizzes q ON q.material_id = lm.id
      ORDER BY lm.id ASC
    `);

    res.json({ ok: true, mode, edited_id: targetId, library: rows });
  } catch (err) {
    res.status(500).json({ error: err.message || "Request gagal saat menyimpan library" });
  }
});




async function updateLibraryMaterialById(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await get("SELECT * FROM library_materials WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ error: "Materi/File tidak ditemukan. Cek ID library." });

    const { title = "", category = "", note = "" } = req.body;
    const materialType = req.body.material_type === "file" ? "file" : (req.body.material_type === "ppt" ? "ppt" : (existing.material_type || "ppt"));

    const main = fileInfo(req, "file");
    const cover = fileInfo(req, "cover");

    const nextFileName = main.path ? main.name : existing.file_name;
    const nextFilePath = main.path ? main.path : existing.file_path;
    const nextFileType = main.path ? main.type : existing.file_type;

    const nextCoverName = cover.path ? cover.name : existing.cover_name;
    const nextCoverPath = cover.path ? cover.path : existing.cover_path;
    const nextCoverType = cover.path ? cover.type : existing.cover_type;

    await run(
      `UPDATE library_materials
       SET title = ?,
           category = ?,
           material_type = ?,
           note = ?,
           file_name = ?,
           file_path = ?,
           file_type = ?,
           cover_name = ?,
           cover_path = ?,
           cover_type = ?
       WHERE id = ?`,
      [
        title || existing.title,
        category || existing.category,
        materialType,
        note,
        nextFileName,
        nextFilePath,
        nextFileType,
        nextCoverName,
        nextCoverPath,
        nextCoverType,
        id
      ]
    );

    res.json({ ok: true, library: await all(`
        SELECT
          lm.*,
          q.id AS quiz_id,
          q.title AS quiz_title,
          (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS quiz_question_count
        FROM library_materials lm
        LEFT JOIN quizzes q ON q.material_id = lm.id
        ORDER BY lm.id ASC
      `) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Request gagal saat edit library" });
  }
}




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


app.get("/api/parent/student/:code", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  const student = await get("SELECT * FROM students WHERE parent_code = ?", [String(req.params.code || "").toUpperCase()]);
    if (!student) return res.status(404).json({ error: "Kode orang tua tidak ditemukan" });
    res.json(await getFullStudent(student.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/parent/:code", async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  try {
    const student = await get("SELECT * FROM students WHERE parent_code = ?", [String(req.params.code || "").toUpperCase()]);
    if (!student) return res.status(404).json({ error: "Kode orang tua tidak ditemukan" });

    res.json(await getFullStudent(student.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


async function getMaterialQuiz(materialId) {
  const quiz = await get("SELECT * FROM quizzes WHERE material_id = ? LIMIT 1", [materialId]);
  if (!quiz) return null;

  const questions = await all(`
    SELECT id, question_order, question, option_a, option_b, option_c, option_d, correct_answer
    FROM quiz_questions
    WHERE quiz_id = ?
    ORDER BY question_order ASC, id ASC
  `, [quiz.id]);

  return { ...quiz, questions };
}

app.get("/api/admin/materials/:id/quiz", requireAdmin, async (req, res) => {
  try {
    const quiz = await getMaterialQuiz(req.params.id);
    res.json(quiz || { material_id: Number(req.params.id), title: "Quiz", questions: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/materials/:id/quiz", requireAdmin, async (req, res) => {
  try {
    const materialId = req.params.id;
    const title = String(req.body.title || "Quiz").trim() || "Quiz";
    const questions = Array.isArray(req.body.questions) ? req.body.questions.slice(0, 10) : [];

    await run("DELETE FROM quizzes WHERE material_id = ?", [materialId]);

    if (!questions.length) {
      return res.json({ material_id: Number(materialId), title, questions: [] });
    }

    const quizResult = await run(
      "INSERT INTO quizzes (material_id, title, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
      [materialId, title]
    );

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i] || {};
      const correct = String(q.correct_answer || "A").trim().toUpperCase();
      await run(`
        INSERT INTO quiz_questions
        (quiz_id, question_order, question, option_a, option_b, option_c, option_d, correct_answer)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        quizResult.id,
        i + 1,
        String(q.question || "").trim(),
        String(q.option_a || "").trim(),
        String(q.option_b || "").trim(),
        String(q.option_c || "").trim(),
        String(q.option_d || "").trim(),
        ["A","B","C","D"].includes(correct) ? correct : "A"
      ]);
    }

    res.json(await getMaterialQuiz(materialId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/materials/:id/quiz", requireAdmin, async (req, res) => {
  try {
    await run("DELETE FROM quizzes WHERE material_id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/parent/materials/:id/quiz", async (req, res) => {
  try {
    const quiz = await getMaterialQuiz(req.params.id);
    res.json(quiz || { material_id: Number(req.params.id), title: "Quiz", questions: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



async function updateLibraryMaterialById(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await get("SELECT * FROM library_materials WHERE id = ?", [id]);

    if (!existing) {
      return res.status(404).json({
        error: "Materi/File tidak ditemukan di database. Refresh admin lalu coba edit lagi."
      });
    }

    const { title = "", category = "", note = "" } = req.body;
    const materialType =
      req.body.material_type === "file" ? "file" :
      req.body.material_type === "ppt" ? "ppt" :
      (existing.material_type || "ppt");

    const main = fileInfo(req, "file");
    const cover = fileInfo(req, "cover");

    // File baru OPSIONAL. Kalau kosong, file lama tetap dipakai.
    const nextFileName = main.path ? main.name : existing.file_name;
    const nextFilePath = main.path ? main.path : existing.file_path;
    const nextFileType = main.path ? main.type : existing.file_type;

    // Cover baru OPSIONAL. Kalau kosong, cover lama tetap dipakai.
    const nextCoverName = cover.path ? cover.name : existing.cover_name;
    const nextCoverPath = cover.path ? cover.path : existing.cover_path;
    const nextCoverType = cover.path ? cover.type : existing.cover_type;

    await run(
      `UPDATE library_materials
       SET title = ?,
           category = ?,
           material_type = ?,
           note = ?,
           file_name = ?,
           file_path = ?,
           file_type = ?,
           cover_name = ?,
           cover_path = ?,
           cover_type = ?
       WHERE id = ?`,
      [
        title || existing.title,
        category || existing.category,
        materialType,
        note,
        nextFileName,
        nextFilePath,
        nextFileType,
        nextCoverName,
        nextCoverPath,
        nextCoverType,
        id
      ]
    );

    const rows = await all(`
      SELECT
        lm.*,
        q.id AS quiz_id,
        q.title AS quiz_title,
        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS quiz_question_count
      FROM library_materials lm
      LEFT JOIN quizzes q ON q.material_id = lm.id
      ORDER BY lm.id ASC
    `);

    res.json({ ok: true, library: rows });
  } catch (err) {
    res.status(500).json({ error: err.message || "Request gagal saat edit library" });
  }
}

// Route edit library HARUS sebelum app.listen.


async function updateLibraryMaterialById(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await get("SELECT * FROM library_materials WHERE id = ?", [id]);

    if (!existing) {
      return res.status(404).json({
        error: "Materi/File tidak ditemukan di database. Refresh admin lalu coba edit lagi."
      });
    }

    const { title = "", category = "", note = "" } = req.body;
    const materialType =
      req.body.material_type === "file" ? "file" :
      req.body.material_type === "ppt" ? "ppt" :
      (existing.material_type || "ppt");

    const main = fileInfo(req, "file");
    const cover = fileInfo(req, "cover");

    // Kalau admin tidak upload file baru, file lama tetap dipakai.
    const nextFileName = main.path ? main.name : existing.file_name;
    const nextFilePath = main.path ? main.path : existing.file_path;
    const nextFileType = main.path ? main.type : existing.file_type;

    // Kalau admin tidak upload cover baru, cover lama tetap dipakai.
    const nextCoverName = cover.path ? cover.name : existing.cover_name;
    const nextCoverPath = cover.path ? cover.path : existing.cover_path;
    const nextCoverType = cover.path ? cover.type : existing.cover_type;

    await run(
      `UPDATE library_materials
       SET title = ?,
           category = ?,
           material_type = ?,
           note = ?,
           file_name = ?,
           file_path = ?,
           file_type = ?,
           cover_name = ?,
           cover_path = ?,
           cover_type = ?
       WHERE id = ?`,
      [
        title || existing.title,
        category || existing.category,
        materialType,
        note,
        nextFileName,
        nextFilePath,
        nextFileType,
        nextCoverName,
        nextCoverPath,
        nextCoverType,
        id
      ]
    );

    const rows = await all(`
      SELECT
        lm.*,
        q.id AS quiz_id,
        q.title AS quiz_title,
        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS quiz_question_count
      FROM library_materials lm
      LEFT JOIN quizzes q ON q.material_id = lm.id
      ORDER BY lm.id ASC
    `);

    res.json({ ok: true, library: rows });
  } catch (err) {
    res.status(500).json({ error: err.message || "Request gagal saat edit library" });
  }
}

// Edit route dibuat all + put supaya aman di localhost, Railway, dan browser cache lama.
app.all("/api/admin/library/:id/edit", requireAdmin, multiUpload, updateLibraryMaterialById);
app.put("/api/admin/library/:id", requireAdmin, multiUpload, updateLibraryMaterialById);



// Start server
app.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});
