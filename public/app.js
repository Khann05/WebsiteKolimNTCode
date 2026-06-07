const API = "";
const START_YEAR = 2026;
const START_MONTH = 3; // April, karena index JS mulai dari 0
const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const colors = ["#4f46e5","#10b981","#f97316","#ec4899","#0ea5e9","#8b5cf6","#14b8a6","#64748b"];

let adminPassword = localStorage.getItem("adminPassword") || "";
let students = [];
let selectedStudentId = null;
let selectedStudent = null;
let editingId = null;
let selectedDate = "2026-05-01";
let activeTab = "calendar";
let library = [];
let editingLibraryMaterialId = null;
let adminSectionExpanded = { access:false, library:false, projectFiles:false, certificates:false, sessions:false };
let pptSortMode = "smart";
let currentQuizMaterialId = null;
let currentQuizQuestions = [];


const currentDate = new Date();
let currentMonth = currentDate.getFullYear() < START_YEAR || (currentDate.getFullYear() === START_YEAR && currentDate.getMonth() < START_MONTH) ? START_MONTH : currentDate.getMonth();
let currentYear = currentDate.getFullYear() < START_YEAR || (currentDate.getFullYear() === START_YEAR && currentDate.getMonth() < START_MONTH) ? START_YEAR : currentDate.getFullYear();

function $(id){ return document.getElementById(id); }
function safe(v){ return String(v || "").replace(/[&<>"]/g, function(m){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]; }); }
function digits(v){ return String(v || "").replace(/\D/g, ""); }
function initials(n){ return String(n || "?").trim().split(/\s+/).slice(0,2).map(function(x){ return x[0]; }).join("").toUpperCase(); }
function formatDate(iso){ return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {day:"2-digit",month:"long",year:"numeric"}); }
function norm(v,min,max){ let n = parseInt(digits(v),10); if(Number.isNaN(n)) n = 0; n = Math.max(min, Math.min(max,n)); return String(n).padStart(2,"0"); }
function isBeforeStart(y,m){ return y < START_YEAR || (y === START_YEAR && m < START_MONTH); }
function sessionCount(s){ return (s && s.attendances ? s.attendances : []).length; }
function certCount(s){ return (s && s.certificates ? s.certificates : []).length; }

function svg(name){
  const icons = {
    student:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    cert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M8 13l-2 8 6-3 6 3-2-8"/></svg>',
    lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
  };
  return icons[name] || icons.folder;
}

function initIcons(){
  const map = { iconStudent:"student", iconCalendar:"calendar", iconFolder:"folder", iconCertificate:"cert", iconQuiz:"help-circle" };
  Object.keys(map).forEach(function(id){ if($(id)) $(id).innerHTML = svg(map[id]); });
}


function showSavedNotice(message){
  const old = document.querySelector(".saved-notice");
  if(old) old.remove();

  const el = document.createElement("div");
  el.className = "saved-notice";
  el.innerHTML = `
    <div class="saved-check">✓</div>
    <div>
      <strong>${safe(message || "Berhasil disimpan")}</strong>
      <small>Perubahan sudah tersimpan.</small>
    </div>
  `;

  document.body.appendChild(el);
  setTimeout(function(){
    el.classList.add("hide");
    setTimeout(function(){ if(el) el.remove(); }, 300);
  }, 1800);
}


function forceCloseOverlay(id){
  const el = $(id);
  if(!el) return;
  el.style.display = "none";
  el.classList.remove("show");
  el.classList.add("hidden");
}

function forceOpenOverlay(id){
  const el = $(id);
  if(!el) return;
  el.style.display = "flex";
  el.classList.remove("hidden");
  el.classList.add("show");
}

function toast(msg,type){
  const old = document.querySelector(".toast");
  if(old) old.remove();
  const el = document.createElement("div");
  el.className = "toast " + (type || "success");
  el.innerHTML = '<span class="toast-dot"></span><span>' + safe(msg) + '</span>';
  document.body.appendChild(el);
  setTimeout(function(){ el.remove(); },2500);
}

function openOverlay(id){ forceOpenOverlay(id); }
function closeOverlay(id){ forceCloseOverlay(id); }

function cacheBustUrl(url){
  if(!url) return "";
  const sep = String(url).includes("?") ? "&" : "?";
  return url + sep + "v=" + Date.now();
}

function cacheBustUrl(url){
  if(!url) return "";
  const sep = String(url).includes("?") ? "&" : "?";
  return url + sep + "v=" + Date.now();
}

function coverHTML(item, locked){
  let content = "";
  if(item.cover_path) content = `<img class="cover ${locked ? "locked-cover" : ""}" src="${safe(cacheBustUrl(item.cover_path))}">`;
  else if(item.file_type && item.file_type.indexOf("image/") === 0 && item.file_path) content = `<img class="cover ${locked ? "locked-cover" : ""}" src="${safe(cacheBustUrl(item.file_path))}">`;
  else content = `<div class="cover-placeholder ${locked ? "locked-cover" : ""}">${svg(locked ? "lock" : "folder")}</div>`;

  if(!locked) return content;
  return `<div class="cover-wrap">${content}<div class="lock-layer">LOCKED</div></div>`;
}

function progressValue(){
  return Number((selectedStudent && selectedStudent.progress_session) || 0);
}

function stageInfo(progress){
  if(progress < 14){
    return {
      name:"Beginner",
      current:progress,
      target:14,
      percent:Math.min(100, (progress / 14) * 100),
      note:"Target Beginner sampai session 14. Intermediate masih terkunci sebelum Beginner selesai."
    };
  }

  return {
    name:"Intermediate",
    current:progress,
    target:31,
    percent:Math.min(100, ((progress - 14) / (31 - 14)) * 100),
    note: progress >= 31 ? "Intermediate selesai. Sertifikat Intermediate otomatis diberikan." : "Intermediate terbuka karena Beginner sudah selesai. Target Intermediate sampai session 31."
  };
}



function progressLevel(){
  const progress = progressValue();

  // Intermediate baru tampil setelah progress masuk session 15.
  // Session 14 masih dianggap akhir Beginner.
  if(progress >= 15) return "intermediate";

  return "beginner";
}

function progressMilestoneNotice(){
  const progress = progressValue();
  const level = progressLevel();

  if(level === "beginner" && progress >= 14){
    return `
      <div class="notif" style="margin-top:12px">
        <div class="notif-icon">${svg("cert")}</div>
        <div>
          <strong>Notif: Beginner sudah tercapai</strong>
          <div class="subtitle">Siswa sudah sampai session 14. Intermediate akan terbuka saat progress masuk session 15.</div>
        </div>
      </div>
    `;
  }

  if(level === "intermediate" && progress >= 31){
    return `
      <div class="notif" style="margin-top:12px">
        <div class="notif-icon">${svg("cert")}</div>
        <div>
          <strong>Notif: Intermediate sudah tercapai</strong>
          <div class="subtitle">Siswa sudah sampai session 31. Sertifikat Intermediate bisa kamu upload manual.</div>
        </div>
      </div>
    `;
  }

  return "";
}


function progressFillByNodes(progress, nodes){
  if(progress <= nodes[0]) return 0;
  const last = nodes.length - 1;
  if(progress >= nodes[last]) return 100;

  for(let i = 0; i < last; i++){
    const start = nodes[i];
    const end = nodes[i + 1];

    if(progress >= start && progress <= end){
      const startPercent = (i / last) * 100;
      const endPercent = ((i + 1) / last) * 100;
      const local = (progress - start) / (end - start);
      return startPercent + ((endPercent - startPercent) * local);
    }
  }

  return 0;
}

function renderProgressBox(){
  const progress = progressValue();
  const level = progressLevel();

  if(level !== "intermediate"){
    const target = 14;
    const fill = progressFillByNodes(progress, [0, 4, 8, 14]);

    return `
      <div class="progress-box">
        <div class="panel-head" style="margin-bottom:8px">
          <div>
            <div class="title">Progress Perjalanan Les</div>
            <div class="subtitle">Session sekarang: <b>${progress}</b> • Level: <b>Beginner</b></div>
          </div>
        </div>

        <div class="progress-track">
          <div class="progress-fill" style="width:${fill}%"></div>
          <div class="progress-node done">0</div>
          <div class="progress-node ${progress >= 4 ? "done" : ""}">4</div>
          <div class="progress-node ${progress >= 8 ? "done" : ""}">8</div>
          <div class="progress-node ${progress >= 14 ? "done" : ""}">
            14
            <div class="flag">Beginner</div>
          </div>
        </div>

        <div class="progress-note">
          Beginner berjalan. Target Beginner sampai session 14. Intermediate terbuka mulai session 15.
        </div>

        ${progressMilestoneNotice()}

        <div class="progress-actions">
          <button class="btn btn-green" onclick="addProgressSession()">+ Tambah Progress Session</button>
          <button class="btn btn-light" onclick="minusProgressSession()">- Kurangi</button>
          <button class="btn btn-purple" onclick="setProgressSession()">Set Manual</button>
        </div>
      </div>
    `;
  }

  const target = 31;
  const start = 15;
  const fill = progressFillByNodes(progress, [15, 20, 26, 31]);

  return `
    <div class="progress-box">
      <div class="panel-head" style="margin-bottom:8px">
        <div>
          <div class="title">Progress Perjalanan Les</div>
          <div class="subtitle">Session sekarang: <b>${progress}</b> • Level: <b>Intermediate</b></div>
        </div>
      </div>

      <div class="progress-track">
        <div class="progress-fill" style="width:${fill}%"></div>
        <div class="progress-node done">15</div>
        <div class="progress-node ${progress >= 20 ? "done" : ""}">20</div>
        <div class="progress-node ${progress >= 26 ? "done" : ""}">26</div>
        <div class="progress-node ${progress >= 31 ? "done" : ""}">
          31
          <div class="flag">Intermediate</div>
        </div>
      </div>

      <div class="progress-note">
        Intermediate berjalan. Target Intermediate sampai session 31.
      </div>

      ${progressMilestoneNotice()}

      <div class="progress-actions">
        <button class="btn btn-green" onclick="addProgressSession()">+ Tambah Progress Session</button>
        <button class="btn btn-light" onclick="minusProgressSession()">- Kurangi</button>
        <button class="btn btn-purple" onclick="setProgressSession()">Set Manual</button>
      </div>
    </div>
  `;
}


async function updateProgress(mode, value){
  try{
    const body = { mode };
    if(mode === "set") body.progress_session = value;
    selectedStudent = await api("/api/admin/students/" + selectedStudent.id + "/progress", {
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body)
    });
    await loadStudents();
    renderAll();
    toast("Progress diperbarui");
  }catch(e){
    toast(e.message,"error");
  }
}

function addProgressSession(){
  if(!selectedStudent) return;
  updateProgress("add");
}

function minusProgressSession(){
  if(!selectedStudent) return;
  updateProgress("minus");
}

function setProgressSession(){
  if(!selectedStudent) return;
  const value = prompt("Masukkan session progress sekarang:", progressValue());
  if(value === null) return;
  const n = Number(value);
  if(Number.isNaN(n) || n < 0){
    toast("Angka progress tidak valid","error");
    return;
  }
  updateProgress("set", n);
}


async function api(url, options = {}){
  const headers = options.headers || {};
  headers["x-admin-password"] = adminPassword;
  options.headers = headers;
  const res = await fetch(API + url, options);
  const data = await res.json().catch(function(){ return {}; });
  if(!res.ok) throw new Error(data.error || ("Request gagal (" + res.status + ") - " + url));
  return data;
}

async function loginAdmin(){
  const password = $("adminPassword").value.trim();
  const res = await fetch("/api/admin/login", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({password})
  });

  if(!res.ok){ toast("Password admin salah","error"); return; }

  adminPassword = password;
  localStorage.setItem("adminPassword", password);
  $("loginBox").classList.add("hidden");
  $("mainApp").classList.remove("hidden");
  await loadStudents();
}

async function loadStudents(){
  try{
    students = await api("/api/admin/students");
    library = await api("/api/admin/library");
    if(!selectedStudentId && students.length) selectedStudentId = students[0].id;
    if(selectedStudentId) await loadSelectedStudent(selectedStudentId, false);
    renderAll();
  }catch(e){
    $("loginBox").classList.remove("hidden");
    $("mainApp").classList.add("hidden");
    localStorage.removeItem("adminPassword");
    adminPassword = "";
  }
}

async function loadSelectedStudent(id, rerender){
  selectedStudentId = id;
  selectedStudent = await api("/api/admin/students/" + id);
  if(rerender !== false) renderAll();
}

function clearSearch(){ $("searchInput").value = ""; renderAll(); }

function openStudentModal(id){
  editingId = id || null;
  if(id){
    const s = students.find(function(x){ return x.id === id; }) || selectedStudent;
    $("studentTitle").textContent = "Edit Siswa";
    $("studentName").value = s.name || "";
    $("studentPhone").value = s.phone || "";
    $("studentLevel").value = s.level || "";
    $("studentDesc").value = s.description || "";
    $("studentCode").value = s.parent_code || "";
  }else{
    $("studentTitle").textContent = "Tambah Siswa";
    ["studentName","studentPhone","studentLevel","studentDesc","studentCode"].forEach(function(id){ $(id).value = ""; });
  }
  openOverlay("studentOverlay");
}

async function saveStudent(){
  try{
    const body = {
      name:$("studentName").value.trim(),
      phone:$("studentPhone").value.trim(),
      level:$("studentLevel").value.trim(),
      description:$("studentDesc").value.trim(),
      parent_code:$("studentCode").value.trim()
    };

    if(!body.name || !body.phone){ toast("Nama dan nomor wajib diisi","error"); return; }

    if(editingId){
      await api("/api/admin/students/" + editingId, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      toast("Data siswa diperbarui");
    }else{
      const created = await api("/api/admin/students", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      selectedStudentId = created.id;
      toast("Siswa berhasil ditambahkan");
    }

    closeOverlay("studentOverlay");
    await loadStudents();
  }catch(e){ toast(e.message,"error"); }
}

async function selectStudent(id){
  activeTab = "calendar";
  await loadSelectedStudent(id, true);
}


function lessonCycleText(total){
  const n = Number(total || 0);
  if(n <= 0) return "0/4";
  const mod = n % 4;
  const current = mod === 0 ? 4 : mod;
  return current + "/4";
}
function lessonCycleNumber(total){
  const n = Number(total || 0);
  if(n <= 0) return 0;
  const mod = n % 4;
  return mod === 0 ? 4 : mod;
}

function buildWAProgressText(totalMeetings){
  return lessonCycleText(totalMeetings);
}

function sendWA(){
  if(!selectedStudent){
    toast("Pilih siswa dulu","error");
    return;
  }

  const totalMeetings = sessionCount(selectedStudent);
  const cycle = lessonCycleText(totalMeetings);
  const parentUrl = "https://websitekolimntcode-production.up.railway.app/parent.html";

  const msg =
    "Halo Orang Tua " + selectedStudent.name + "%0A%0A" +
    "Progress pertemuan les coding saat ini: " + cycle + ".%0A" +
    "Total riwayat pertemuan tercatat: " + totalMeetings + "x.%0A%0A" +
    "Silakan lihat PPT/Materi, Quiz, kalender, dan sertifikat melalui Parent Portal:%0A" +
    parentUrl + "%0A%0A" +
    "Kode akses parent: " + selectedStudent.parent_code;

  window.open("https://wa.me/" + digits(selectedStudent.phone) + "?text=" + msg, "_blank");
}
function changeMonth(step){
  currentMonth += step;
  if(currentMonth < 0){ currentMonth = 11; currentYear--; }
  if(currentMonth > 11){ currentMonth = 0; currentYear++; }
  if(isBeforeStart(currentYear,currentMonth)){
    currentMonth = START_MONTH;
    currentYear = START_YEAR;
    toast("Kalender mulai dari Mei 2026","error");
  }
  renderDetail();
}

function openAttendanceModal(date){
  if(!selectedStudent){ toast("Pilih siswa dulu","error"); return; }
  selectedDate = date;
  $("attendanceDateText").textContent = "Tanggal: " + formatDate(date) + " • " + selectedStudent.name;
  ["attendanceHour","attendanceMinute","attendanceSession","attendanceNote"].forEach(function(id){ $(id).value = ""; });
  openOverlay("attendanceOverlay");
}


function buildAttendanceWAMessage(student, attendance){
  const totalPertemuan = student && student.attendances ? student.attendances.length : 0;

  return (
    "Halo\n\n" +
    "Absensi les coding untuk " + (student.name || "-") + " sudah berhasil dicatat.\n\n" +
    "Level saat ini: " + (student.level || "Beginner") + "\n" +
    "Tanggal: " + formatDate(attendance.date) + "\n" +
    "Jam: " + attendance.time + "\n" +
    "Session: " + attendance.session + "\n" +
    "Total pertemuan: " + totalPertemuan + " / 4 sesi\n\n" +
    "Password / Kode Parent: " + (student.parent_code || "-") + "\n\n" +
    "Untuk melihat progress lengkap, materi, quiz, sertifikat, dan informasi lainnya, silakan kunjungi Parent Portal berikut:\n\n" +
    "https://websitekolimntcode-production.up.railway.app/parent.html\n\n" +
    "Terima kasih"
  );
}

function openAttendanceWA(student, attendance){
  if(!student || !student.phone) return;
  const message = buildAttendanceWAMessage(student, attendance);
  window.open("https://wa.me/" + digits(student.phone) + "?text=" + encodeURIComponent(message), "_blank");
}


async function saveAttendance(){
  try{
    const session = $("attendanceSession").value.trim();
    if(!session){ toast("Session wajib diisi","error"); return; }

    const body = {
      date:selectedDate,
      time: norm($("attendanceHour").value,0,23) + ":" + norm($("attendanceMinute").value,0,59),
      session,
      note:$("attendanceNote").value.trim()
    };

    selectedStudent = await api("/api/admin/students/" + selectedStudent.id + "/attendance", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body)
    });

    closeOverlay("attendanceOverlay");
    await loadStudents();
    toast("Absen berhasil ditambahkan. WhatsApp dibuka otomatis.");

    openAttendanceWA(selectedStudent, body);
  }catch(e){ toast(e.message,"error"); }
}


function materialKind(item){
  return (item && item.material_type === "file") ? "file" : "ppt";
}
function isProjectFile(item){ return materialKind(item) === "file"; }
function isPPTMaterial(item){ return !isProjectFile(item); }
function materialLabel(item){
  return isProjectFile(item) ? "File Project" : "PPT";
}
function fileProjectBadgeHTML(item){
  if(!isProjectFile(item)) return "";
  return '<div class="project-file-badge">File / APK / ZIP / Project</div>';
}
function sectionCountText(list, label){
  return (list || []).length + " " + label;
}


function resetLibraryFileInput(id){
  const old = $(id);
  if(!old) return null;

  const clone = old.cloneNode(true);
  clone.value = "";
  clone.dataset.userPicked = "0";
  clone.addEventListener("change", function(){
    clone.dataset.userPicked = clone.files && clone.files.length ? "1" : "0";
  });

  old.parentNode.replaceChild(clone, old);
  return clone;
}

function resetLibraryUploadInputs(){
  resetLibraryFileInput("libraryFile");
  resetLibraryFileInput("libraryCover");
}

function isLibraryFilePicked(id){
  const input = $(id);
  return !!(input && input.dataset.userPicked === "1" && input.files && input.files[0]);
}


function setLibrarySaveMode(editId){
  const btn = $("librarySaveBtn");
  if(!btn) return;
  if(editId){
    btn.dataset.mode = "edit";
    btn.dataset.editId = String(editId);
    btn.onclick = function(){ saveLibraryMaterial(editId); };
  }else{
    btn.dataset.mode = "insert";
    btn.dataset.editId = "";
    btn.onclick = function(){ saveLibraryMaterial(); };
  }
}

function openLibraryModal(type){
  type = type === "file" ? "file" : "ppt";
  editingLibraryMaterialId = null;
  window.__editingLibraryMaterialId = null;
  if($("libraryEditId")) $("libraryEditId").value = "";
  if(typeof setLibrarySaveMode === "function") setLibrarySaveMode(null);

  if($("libraryTitle")) $("libraryTitle").value = "";
  if($("libraryNote")) $("libraryNote").value = "";
  if($("libraryCategory")) $("libraryCategory").value = type === "file" ? "Project Files" : "Beginner";
  if($("libraryMaterialType")) $("libraryMaterialType").value = type;
  if($("libraryFile")) $("libraryFile").value = "";
  if($("libraryCover")) $("libraryCover").value = "";

  if($("libraryModalTitle")) $("libraryModalTitle").textContent = type === "file" ? "Upload File / Project Global" : "Upload PPT Global";
  if($("libraryModalSub")) $("libraryModalSub").textContent = type === "file"
    ? "Upload APK, ZIP project, folder project ZIP, source code, atau file lain. Default locked sampai kamu unlock per siswa."
    : "File ini akan masuk library PPT dan tampil di parent semua siswa. Default tetap locked sampai kamu unlock per siswa.";
  if($("libraryTitleLabel")) $("libraryTitleLabel").textContent = type === "file" ? "Nama File / Project" : "Judul PPT";
  if($("libraryCategoryLabel")) $("libraryCategoryLabel").textContent = type === "file" ? "Kategori File" : "Kategori";
  if($("libraryFileLabel")) $("libraryFileLabel").textContent = type === "file" ? "Upload APK / ZIP / Project / File" : "Upload PPT / file";
  if($("librarySaveBtn")) $("librarySaveBtn").textContent = type === "file" ? "Simpan File Project" : "Simpan PPT";
  openOverlay("libraryOverlay");
}

function openEditMaterialModal(id){
  const item = (library || []).find(function(x){ return Number(x.id) === Number(id); });
  if(!item){
    toast("File/PPT tidak ditemukan. Refresh admin dulu.", "error");
    return;
  }

  const type = item.material_type === "file" ? "file" : "ppt";
  const editId = Number(item.id);

  editingLibraryMaterialId = editId;
  window.__editingLibraryMaterialId = editId;
  if($("libraryEditId")) $("libraryEditId").value = String(editId);
  if(typeof setLibrarySaveMode === "function") setLibrarySaveMode(editId);

  if($("libraryMaterialType")) $("libraryMaterialType").value = type;
  if($("libraryTitle")) $("libraryTitle").value = item.title || "";
  if($("libraryCategory")) $("libraryCategory").value = item.category || (type === "file" ? "Project Files" : "Beginner");
  if($("libraryNote")) $("libraryNote").value = item.note || "";
  if($("libraryFile")) $("libraryFile").value = "";
  if($("libraryCover")) $("libraryCover").value = "";

  if($("libraryModalTitle")) $("libraryModalTitle").textContent = type === "file" ? "Edit File / Project" : "Edit PPT";
  if($("libraryModalSub")){
    $("libraryModalSub").innerHTML =
      '<div class="edit-current-file-box edit-mode-on">' +
      '<b>MODE EDIT AKTIF — UPDATE DATA LAMA</b><br>' +
      'ID data: <b>' + safe(editId) + '</b><br>' +
      'File saat ini: <b>' + safe(item.file_name || "-") + '</b><br>' +
      'Cover saat ini: <b>' + safe(item.cover_name || "-") + '</b><br>' +
      '<span>Kalau pilih file/cover baru, yang lama diganti. Server juga dikunci supaya tidak membuat item duplikat.</span>' +
      '</div>';
  }
  if($("libraryTitleLabel")) $("libraryTitleLabel").textContent = type === "file" ? "Nama File / Project" : "Judul PPT";
  if($("libraryCategoryLabel")) $("libraryCategoryLabel").textContent = type === "file" ? "Kategori File" : "Kategori";
  if($("libraryFileLabel")) $("libraryFileLabel").textContent = type === "file" ? "Ganti file utama baru" : "Ganti PPT/file utama baru";
  if($("librarySaveBtn")) $("librarySaveBtn").textContent = type === "file" ? "UPDATE FILE INI" : "UPDATE PPT INI";

  openOverlay("libraryOverlay");
}

async function saveLibraryMaterial(forcedEditId){
  try{
    const hiddenEditId = $("libraryEditId") ? $("libraryEditId").value : "";
    const buttonEditId = $("librarySaveBtn") ? $("librarySaveBtn").dataset.editId : "";
    const globalEditId = editingLibraryMaterialId || window.__editingLibraryMaterialId || "";
    const editId = forcedEditId || globalEditId || buttonEditId || hiddenEditId || "";
    const isEdit = !!editId;

    const form = new FormData();
    form.append("title", $("libraryTitle").value.trim());
    form.append("category", $("libraryCategory").value.trim() || (($("libraryMaterialType") && $("libraryMaterialType").value === "file") ? "Project Files" : "Beginner"));
    form.append("note", $("libraryNote").value.trim());
    form.append("material_type", $("libraryMaterialType") ? $("libraryMaterialType").value : "ppt");

    if(isEdit){
      form.append("edit_id", String(editId));
      form.append("force_update", "1");
    }

    if($("libraryFile") && $("libraryFile").files[0]) form.append("file", $("libraryFile").files[0]);
    if($("libraryCover") && $("libraryCover").files[0]) form.append("cover", $("libraryCover").files[0]);

    if(!form.get("title")){
      toast("Nama/Judul tidak boleh kosong", "error");
      return;
    }

    if(!isEdit && (!$("libraryFile") || !$("libraryFile").files[0]) && (!$("libraryCover") || !$("libraryCover").files[0])){
      toast((($("libraryMaterialType") && $("libraryMaterialType").value === "file") ? "Upload file project atau cover dulu" : "Upload PPT/file atau cover dulu"), "error");
      return;
    }

    const result = await api("/api/admin/library", {
      method: "POST",
      body: form
    });

    library = result.library || [];
    closeOverlay("libraryOverlay");

    editingLibraryMaterialId = null;
    window.__editingLibraryMaterialId = null;
    if($("libraryEditId")) $("libraryEditId").value = "";
    if(typeof setLibrarySaveMode === "function") setLibrarySaveMode(null);
    if($("libraryFile")) $("libraryFile").value = "";
    if($("libraryCover")) $("libraryCover").value = "";

    await loadStudents();
    activeTab = "library";
    renderAll();

    toast(result.mode === "update" || isEdit ? "Berhasil UPDATE data lama. Tidak membuat item baru." : "Data baru berhasil dibuat.");
  }catch(e){
    toast(e.message || "Request gagal", "error");
  }
}

async function deleteLibraryMaterial(id){
  if(!confirm("Hapus PPT dari library?")) return;
  const result = await api("/api/admin/library/" + id, { method:"DELETE" });
  library = result.library || [];
  await loadStudents();
  activeTab = "library";
  renderAll();
  toast("PPT dihapus","error");
}

async function toggleMaterialAccess(materialId, isUnlocked){
  try{
    if(!selectedStudent) return;
    selectedStudent = await api("/api/admin/students/" + selectedStudent.id + "/library/" + materialId + "/access", {
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({is_unlocked:isUnlocked ? 0 : 1})
    });
    await loadStudents();
    renderAll();
    toast(isUnlocked ? "PPT dikunci untuk siswa ini" : "PPT dibuka untuk siswa ini");
  }catch(e){ toast(e.message,"error"); }
}

function openCertificateModal(){
  if(!selectedStudent){ toast("Pilih siswa dulu","error"); return; }
  $("certificateTitle").value = "";
  $("certificateLocked").value = "1";
  $("certificateFile").value = "";
  $("certificateCover").value = "";
  openOverlay("certificateOverlay");
}

async function saveCertificate(){
  try{
    const form = new FormData();
    form.append("title", $("certificateTitle").value.trim());
    form.append("is_locked", $("certificateLocked").value);
    if($("certificateFile").files[0]) form.append("file", $("certificateFile").files[0]);
    if($("certificateCover").files[0]) form.append("cover", $("certificateCover").files[0]);

    if(!form.get("title") && !$("certificateFile").files[0] && !$("certificateCover").files[0]){
      toast("Isi nama, file, atau gambar","error");
      return;
    }

    selectedStudent = await api("/api/admin/students/" + selectedStudent.id + "/certificates", { method:"POST", body:form });
    closeOverlay("certificateOverlay");
    await loadStudents();
    activeTab = "certificates";
    renderAll();
    toast("Sertifikat disimpan");
  }catch(e){ toast(e.message,"error"); }
}

async function toggleCertificateLock(id,isLocked){
  try{
    selectedStudent = await api("/api/admin/certificates/" + id + "/lock", {
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({is_locked:isLocked ? 0 : 1})
    });
    await loadStudents();
    renderAll();
    toast(isLocked ? "Sertifikat di-unlock" : "Sertifikat di-lock");
  }catch(e){ toast(e.message,"error"); }
}

async function deleteItem(type,id){
  try{
    let url = "";
    if(type === "attendance") url = "/api/admin/attendance/" + id;
    if(type === "certificate") url = "/api/admin/certificates/" + id;

    selectedStudent = await api(url, { method:"DELETE" });
    await loadStudents();
    renderAll();
    toast("Data dihapus","error");
  }catch(e){ toast(e.message,"error"); }
}


function toggleAdminSection(section){
  adminSectionExpanded[section] = !adminSectionExpanded[section];
  renderDetail();
}
function sliceAdminItems(section, items){
  const arr = Array.isArray(items) ? items : [];
  return adminSectionExpanded[section] ? arr : arr.slice(0,4);
}
function adminSeeAllButton(section, total, visible){
  const hidden = Math.max(0, total - visible);
  return '<button class="btn btn-light" onclick="toggleAdminSection(&quot;' + section + '&quot;)">' +
    (adminSectionExpanded[section] ? "Show Less" : "See All" + (hidden ? " (" + hidden + ")" : "")) +
    '</button>';
}

function renderStats(){
  let sessions = 0, cert = 0;
  students.forEach(function(s){
    sessions += Number(s.attendance_count || 0);
    cert += Number(s.certificate_count || 0);
  });

  const quizTotal = (library || []).filter(x => Number(x.quiz_question_count || 0) > 0).length;

  $("totalStudents").textContent = students.length;
  $("totalSessions").textContent = sessions;
  $("totalFiles").textContent = library.length;
  $("totalCertificates").textContent = cert;
  if($("totalQuizzes")) $("totalQuizzes").textContent = quizTotal;
}

function renderStudents(){
  const q = $("searchInput").value.trim().toLowerCase();
  const filtered = students.filter(function(s){
    return [s.name,s.phone,s.description,s.level].some(function(v){ return String(v || "").toLowerCase().includes(q); });
  });

  const box = $("studentList");
  if(!filtered.length){ box.innerHTML = '<div class="empty">Belum ada siswa.</div>'; return; }

  box.innerHTML = filtered.map(function(s){
    return `
      <div class="student-card ${s.id === selectedStudentId ? "active" : ""}" onclick="selectStudent(${s.id})">
        <div class="student-main">
          <div class="avatar">${safe(initials(s.name))}</div>
          <div><div class="student-name">${safe(s.name)}</div><div class="phone">${safe(s.phone)}</div></div>
        </div>
        <div class="desc">${safe(s.description || "Belum ada deskripsi.")}</div>
        <div class="tags">
          <span class="tag">${safe(s.level || "No level")}</span>
          <span class="tag">${s.attendance_count || 0}x pertemuan</span>
          <span class="tag">Progress ${s.progress_session || 0}</span><span class="tag">${s.certificate_count || 0} sertifikat</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderDetail(){
  const panel = $("detailPanel"), s = selectedStudent;
  if(!s){ panel.innerHTML = '<div class="empty">Pilih siswa dulu.</div>'; return; }

  panel.innerHTML = `
    <div class="detail-hero">
      <div>
        <div class="detail-name">${safe(s.name)}</div>
        <div class="subtitle">
          ${safe(s.phone)} • Level: <b>${safe(s.level || "Belum diisi")}</b><br>
          ${safe(s.description || "Belum ada deskripsi.")}<br>
          Kode orang tua: <b>${safe(s.parent_code)}</b>
        </div>
        <div class="tags">
          <span class="tag">${sessionCount(s)} pertemuan</span>
          <span class="tag">${(s.library || []).filter(x=>x.is_unlocked).length}/${library.length} PPT unlocked</span>
          <span class="tag">${certCount(s)} sertifikat</span>
        </div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-blue" onclick="sendWA()">WhatsApp</button>
        <button class="btn btn-orange" onclick="openStudentModal(${s.id})">Edit</button>
        <button class="btn btn-green" onclick="openLibraryModal('ppt')">Upload PPT Global</button>
        <button class="btn btn-blue" onclick="openLibraryModal('file')">Upload File Project</button>
        <button class="btn btn-purple" onclick="openCertificateModal()">Upload Sertifikat</button>
        <button class="btn btn-red" onclick="deleteSelectedStudent()">Hapus</button>
      </div>
    </div>
    ${renderProgressBox()}
    <div class="tabs">
      <button class="tab ${activeTab === "calendar" ? "active" : ""}" onclick="activeTab='calendar';renderDetail()">Kalender</button>
      <button class="tab ${activeTab === "access" ? "active" : ""}" onclick="activeTab='access';renderDetail()">Unlock PPT Siswa</button>
      <button class="tab ${activeTab === "library" ? "active" : ""}" onclick="activeTab='library';renderDetail()">Library Global</button>
      <button class="tab ${activeTab === "certificates" ? "active" : ""}" onclick="activeTab='certificates';renderDetail()">Sertifikat</button>
    </div>
    <div id="tabContent"></div>
  `;

  if(activeTab === "calendar") renderCalendar();
  if(activeTab === "access") renderAccess();
  if(activeTab === "library") renderLibrary();
  if(activeTab === "certificates") renderCertificates();
}

function renderCalendar(){
  const s = selectedStudent;
  const first = new Date(currentYear,currentMonth,1).getDay();
  const total = new Date(currentYear,currentMonth+1,0).getDate();
  const today = new Date().toISOString().slice(0,10);

  let html = `
    <div class="calendar-title">
      <button class="circle" onclick="changeMonth(-1)">‹</button>
      <div><strong>${months[currentMonth]} ${currentYear}</strong><div class="subtitle">Klik tanggal untuk tambah absen siswa ini.</div></div>
      <button class="circle" onclick="changeMonth(1)">›</button>
    </div>
    <div class="calendar-grid">
  `;

  ["Min","Sen","Sel","Rab","Kam","Jum","Sab"].forEach(function(d){ html += `<div class="day-name">${d}</div>`; });
  for(let i=0;i<first;i++) html += "<div></div>";

  for(let day=1; day<=total; day++){
    const date = currentYear + "-" + String(currentMonth+1).padStart(2,"0") + "-" + String(day).padStart(2,"0");
    const sessions = (s.attendances || []).filter(function(x){ return x.date === date; });
    html += `<div class="day ${today === date ? "today" : ""}" onclick="openAttendanceModal('${date}')"><div class="day-number">${day}</div>`;
    sessions.slice(0,4).forEach(function(sess,i){
      html += `<div class="chip" style="background:${colors[i%colors.length]}">Session ${safe(sess.session)}<span>${safe(sess.time)}</span></div>`;
    });
    html += "</div>";
  }

  html += `</div><div style="margin-top:16px" class="file-grid">${renderSessionsList(s)}</div>`;
  $("tabContent").innerHTML = html;
}

function renderSessionsList(s){
  const allSessions = s.attendances || [];
  const visible = sliceAdminItems("sessions", allSessions);
  let html =
    '<div class="section-toolbar">' +
      '<div><div class="title">Riwayat Absen</div><div class="subtitle">Awalnya tampil 4 data agar dashboard tetap rapi.</div></div>' +
      '<div class="section-actions">' + "" + '</div>' +
    '</div>';

  if(!allSessions.length) return html + '<div class="empty">Belum ada absen.</div>';

  html += '<div class="file-grid compact-grid">';
  html += visible.map(function(sess){
    return `
      <div class="file-card">
        <strong>${safe(formatDate(sess.date))} • ${safe(sess.time)} • Session ${safe(sess.session)}</strong>
        <small>${safe(sess.note || "Tanpa catatan")}</small>
        <div class="row-actions"><button class="btn btn-red" onclick="deleteItem('attendance',${sess.id})">Hapus</button></div>
      </div>
    `;
  }).join("");
  html += '</div>';
  if(allSessions.length > 4){
    html += '<div class="see-all-bottom">' + adminSeeAllButton("sessions", allSessions.length, visible.length) + '</div>';
  }
  return html;
}

function groupByCategory(items){
  const groups = {};
  items.forEach(function(item){
    const cat = item.category || "Beginner";
    if(!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });
  return groups;
}


function getUploadOrder(item){
  return Number(item.id || item.library_id || item.material_id || 0);
}

function sortPPTItems(items){
  const arr = Array.isArray(items) ? items.slice() : [];

  if(pptSortMode === "all"){
    return arr.sort(function(a,b){
      return getUploadOrder(a) - getUploadOrder(b);
    });
  }

  return arr.sort(function(a,b){
    const aLocked = a.is_unlocked ? 0 : 1;
    const bLocked = b.is_unlocked ? 0 : 1;

    if(aLocked !== bLocked) return aLocked - bLocked;
    return getUploadOrder(a) - getUploadOrder(b);
  });
}

function sortLibraryItems(items){
  return (Array.isArray(items) ? items.slice() : []).sort(function(a,b){
    return getUploadOrder(a) - getUploadOrder(b);
  });
}

function setPPTSortMode(mode){
  pptSortMode = mode === "all" ? "all" : "smart";
  renderDetail();
}



function getMaterialTitleById(materialId){
  const id = Number(materialId);
  const fromLibrary = (library || []).find(x => Number(x.id) === id);
  if(fromLibrary) return fromLibrary.title || fromLibrary.file_name || "Materi";

  if(selectedStudent && selectedStudent.library){
    const fromStudent = selectedStudent.library.find(x => Number(x.id) === id);
    if(fromStudent) return fromStudent.title || fromStudent.file_name || "Materi";
  }

  return "Materi";
}

function normalizeQuizText(text){
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}

function parseQuizText(raw){
  const text = normalizeQuizText(raw);
  const questions = [];

  // Ambil blok soal berdasarkan nomor: 1. ... 2. ... dst
  const matches = Array.from(text.matchAll(/(?:^|\n)\s*(\d{1,2})[\.\)]\s+([\s\S]*?)(?=\n\s*\d{1,2}[\.\)]\s+|$)/g));

  matches.forEach(function(match){
    if(questions.length >= 10) return;

    let block = (match[2] || "").trim();
    if(!block) return;

    const ansMatch = block.match(/(?:^|\n)\s*(?:\*\*)?\s*Jawaban\s*:\s*([A-D])\s*(?:\*\*)?\s*$/im);
    const correct = ansMatch ? ansMatch[1].toUpperCase() : "A";

    // Hapus baris jawaban dulu SEBELUM ambil opsi A-D
    block = block
      .replace(/(?:^|\n)\s*(?:\*\*)?\s*Jawaban\s*:\s*[A-D]\s*(?:\*\*)?\s*$/gim, "")
      .replace(/\n-{3,}\s*$/g, "")
      .trim();

    const options = { A:"", B:"", C:"", D:"" };

    // Ambil option dari huruf A-D. Stop sebelum option berikutnya atau akhir blok.
    const optRegex = /(?:^|\n)\s*([A-D])[\.\)]\s*([\s\S]*?)(?=\n\s*[A-D][\.\)]\s+|$)/gi;
    const optMatches = Array.from(block.matchAll(optRegex));

    optMatches.forEach(function(opt){
      const letter = opt[1].toUpperCase();
      let value = (opt[2] || "").trim();

      // Pengaman tambahan: kalau ada sisa "Jawaban: X" tetap dipotong
      value = value
        .replace(/\s*(?:\*\*)?\s*Jawaban\s*:\s*[A-D]\s*(?:\*\*)?\s*$/i, "")
        .replace(/\n-{3,}\s*$/g, "")
        .trim();

      options[letter] = value;
    });

    let question = block.split(/\n\s*A[\.\)]\s+/i)[0].trim().replace(/\n+/g, " ");

    if(question && options.A && options.B && options.C && options.D){
      questions.push({
        question,
        option_a: options.A,
        option_b: options.B,
        option_c: options.C,
        option_d: options.D,
        correct_answer: ["A","B","C","D"].includes(correct) ? correct : "A"
      });
    }
  });

  return questions.slice(0,10);
}


function renderQuizPreview(){
  const wrap = $("quizPreview");
  if(!wrap) return;

  if(!currentQuizQuestions.length){
    wrap.innerHTML = '<div class="empty quiz-empty">Belum ada soal. Paste format soal lalu klik Parse / Generate Quiz.</div>';
    return;
  }

  wrap.innerHTML =
    '<div class="quiz-count-badge">Total soal: ' + currentQuizQuestions.length + ' / 10</div>' +
    currentQuizQuestions.map(function(q, i){
      return `
        <div class="quiz-editor-card">
          <div class="quiz-editor-head">
            <strong>Soal ${i + 1}</strong>
            <button class="btn btn-red" onclick="removeQuizQuestion(${i})">Hapus</button>
          </div>

          <label>Pertanyaan</label>
          <textarea onchange="updateQuizQuestion(${i}, 'question', this.value)">${safe(q.question)}</textarea>

          <div class="quiz-options-grid">
            <label>A <input value="${safe(q.option_a)}" onchange="updateQuizQuestion(${i}, 'option_a', this.value)"></label>
            <label>B <input value="${safe(q.option_b)}" onchange="updateQuizQuestion(${i}, 'option_b', this.value)"></label>
            <label>C <input value="${safe(q.option_c)}" onchange="updateQuizQuestion(${i}, 'option_c', this.value)"></label>
            <label>D <input value="${safe(q.option_d)}" onchange="updateQuizQuestion(${i}, 'option_d', this.value)"></label>
          </div>

          <label>Jawaban Benar</label>
          <select onchange="updateQuizQuestion(${i}, 'correct_answer', this.value)">
            <option value="A" ${q.correct_answer === "A" ? "selected" : ""}>A</option>
            <option value="B" ${q.correct_answer === "B" ? "selected" : ""}>B</option>
            <option value="C" ${q.correct_answer === "C" ? "selected" : ""}>C</option>
            <option value="D" ${q.correct_answer === "D" ? "selected" : ""}>D</option>
          </select>
        </div>
      `;
    }).join("");
}

function updateQuizQuestion(index, key, value){
  if(!currentQuizQuestions[index]) return;
  currentQuizQuestions[index][key] = value;
}

function removeQuizQuestion(index){
  currentQuizQuestions.splice(index, 1);
  renderQuizPreview();
}

function parseQuizFromInput(){
  const parsed = parseQuizText($("quizRawInput").value);
  if(!parsed.length){
    toast("Format belum terbaca. Pakai: 1. Pertanyaan, A-D, Jawaban: B", "error");
    return;
  }
  currentQuizQuestions = parsed;
  renderQuizPreview();
  toast("Quiz berhasil diparse: " + parsed.length + " soal");
}

function clearQuizBuilder(){
  $("quizRawInput").value = "";
  currentQuizQuestions = [];
  renderQuizPreview();
}

async function openQuizModal(materialId){
  currentQuizMaterialId = materialId;
  currentQuizQuestions = [];
  $("quizRawInput").value = "";
  const defaultTitle = "Quizz " + getMaterialTitleById(materialId);
  $("quizTitle").value = defaultTitle;

  try{
    const quiz = await api("/api/admin/materials/" + materialId + "/quiz");
    if(quiz && quiz.questions && quiz.questions.length){
      $("quizTitle").value = quiz.title || defaultTitle;
      currentQuizQuestions = quiz.questions.map(function(q){
        return {
          question:q.question || "",
          option_a:q.option_a || "",
          option_b:q.option_b || "",
          option_c:q.option_c || "",
          option_d:q.option_d || "",
          correct_answer:q.correct_answer || "A"
        };
      });
    }
  }catch(e){}

  renderQuizPreview();
  openOverlay("quizOverlay");
}

async function saveQuiz(){
  if(!currentQuizMaterialId) return;

  const clean = currentQuizQuestions.slice(0,10).filter(function(q){
    return q.question && q.option_a && q.option_b && q.option_c && q.option_d;
  }).map(function(q){
    return {
      question:q.question,
      option_a:q.option_a,
      option_b:q.option_b,
      option_c:q.option_c,
      option_d:q.option_d,
      correct_answer:String(q.correct_answer || "A").toUpperCase()
    };
  });

  if(!clean.length){
    toast("Quiz kosong atau format belum lengkap","error");
    return;
  }

  try{
    await api("/api/admin/materials/" + currentQuizMaterialId + "/quiz", {
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        title:$("quizTitle").value || ("Quizz " + getMaterialTitleById(currentQuizMaterialId)),
        questions:clean
      })
    });

    // Tutup modal langsung setelah data berhasil tersimpan
    forceCloseOverlay("quizOverlay");
    showSavedNotice("Quiz berhasil disimpan");

    // Refresh data di belakang layar
    await loadLibrary();
    if(selectedStudent){
      selectedStudent = await api("/api/admin/students/" + selectedStudent.id);
    }
    renderAll();

    toast("Quiz berhasil disimpan: " + clean.length + " soal");
  }catch(e){
    toast(e.message || "Gagal menyimpan quiz", "error");
  }
}

async function deleteQuiz(){
  if(!currentQuizMaterialId) return;
  if(!confirm("Hapus quiz untuk materi ini?")) return;
  await api("/api/admin/materials/" + currentQuizMaterialId + "/quiz", { method:"DELETE" });
  await loadLibrary();
  if(selectedStudent){ selectedStudent = await api("/api/admin/students/" + selectedStudent.id); }
  currentQuizQuestions = [];
  closeOverlay("quizOverlay");
  renderAll();
  toast("Quiz berhasil dihapus");
}

function quizBadgeHTML(item){
  const count = Number(item.quiz_question_count || 0);

  if(!item.quiz_id || count <= 0){
    return `
      <div class="quiz-mini-row quiz-empty-row">
        <div>
          <strong>Quiz belum ditambahkan</strong>
          <small>Buat quiz untuk materi ini.</small>
        </div>
        <button type="button" class="btn btn-purple btn-quiz-action" onclick="event.stopPropagation(); openQuizModal(${item.id})">Add Quiz</button>
      </div>
    `;
  }

  return `
    <div class="quiz-mini-row">
      <div>
        <strong>${safe(item.quiz_title || ("Quizz " + (item.title || item.file_name || "Materi")))}</strong>
        <small>${count} soal pilihan ganda</small>
      </div>
      <button type="button" class="btn btn-purple btn-quiz-action" onclick="event.stopPropagation(); openQuizModal(${item.id})">Edit Quiz</button>
    </div>
  `;
}




function renderAccess(){
  const allItems = selectedStudent.library || [];
  const pptList = sortPPTItems(allItems.filter(isPPTMaterial));
  const fileList = sortPPTItems(allItems.filter(isProjectFile));

  function renderAccessSection(title, subtitle, list, sectionKey, emptyText){
    const visible = sliceAdminItems(sectionKey, list);
    if(!list.length) return '<div class="section-toolbar"><div><div class="title">' + title + '</div><div class="subtitle">' + emptyText + '</div></div></div>';

    const groups = groupByCategory(visible);
    let html = `
      <div class="section-toolbar">
        <div><div class="title">${title}</div><div class="subtitle">${subtitle}</div></div>
        <div class="section-actions">
          <button class="btn ${pptSortMode === "smart" ? "btn-primary" : "btn-light"}" onclick="setPPTSortMode('smart')">Default</button>
          <button class="btn ${pptSortMode === "all" ? "btn-primary" : "btn-light"}" onclick="setPPTSortMode('all')">Sort All</button>
        </div>
      </div>`;

    Object.keys(groups).forEach(function(cat){
      html += `<div class="title category-title">${safe(cat)}</div><div class="file-grid compact-grid">`;
      html += groups[cat].map(function(item){
        const locked = !item.is_unlocked;
        const label = materialLabel(item);
        return `
          <div class="file-card ${isProjectFile(item) ? "project-file-card" : ""}">
            ${coverHTML(item, locked)}
            ${fileProjectBadgeHTML(item)}
            <strong>${safe(item.title || item.file_name || label)}</strong>
            <small>Kategori: ${safe(item.category || "-")}<br>Status siswa ini: ${locked ? "Locked" : "Unlocked"}<br>File: ${safe(item.file_name || "-")}</small>
            ${isPPTMaterial(item) ? quizBadgeHTML(item) : ""}
            <div class="row-actions">
              <button class="btn ${locked ? "btn-green" : "btn-orange"}" onclick="toggleMaterialAccess(${item.id},${item.is_unlocked})">${locked ? "Unlock untuk siswa ini" : "Lock lagi"}</button>
              ${item.file_path ? `<a class="btn btn-blue" href="${safe(item.file_path)}" download>Download Admin</a>` : ""}
            </div>
          </div>`;
      }).join("");
      html += "</div>";
    });
    if(list.length > 4){
      html += '<div class="see-all-bottom">' + adminSeeAllButton(sectionKey, list.length, visible.length) + '</div>';
    }
    return html;
  }

  if(!allItems.length){
    $("tabContent").innerHTML = '<div class="empty">Library masih kosong. Upload PPT atau File Project dulu.</div>';
    return;
  }

  $("tabContent").innerHTML =
    renderAccessSection("Unlock PPT untuk " + safe(selectedStudent.name), "PPT/Materi pembelajaran. Default: unlocked di atas, locked otomatis ke bawah.", pptList, "access", "Belum ada PPT di library.") +
    '<div style="height:22px"></div>' +
    renderAccessSection("Unlock File / APK / ZIP Project untuk " + safe(selectedStudent.name), "File tambahan seperti APK, ZIP project, folder project ZIP, source code, dan file lain. Tampil tepat di bawah PPT pada parent.", fileList, "projectFiles", "Belum ada file project di library.");
}

function renderLibrary(){
  const allItems = library || [];
  const pptList = sortLibraryItems(allItems.filter(isPPTMaterial));
  const fileList = sortLibraryItems(allItems.filter(isProjectFile));

  function renderLibrarySection(title, subtitle, list, sectionKey, uploadType, emptyText){
    const visible = sliceAdminItems(sectionKey, list);
    let html = `
      <div class="section-toolbar">
        <div><div class="title">${title}</div><div class="subtitle">${subtitle}</div></div>
        <div class="section-actions">
          <button class="btn ${uploadType === "file" ? "btn-blue" : "btn-green"}" onclick="openLibraryModal('${uploadType}')">${uploadType === "file" ? "Upload File Project" : "Upload PPT Global"}</button>
        </div>
      </div>`;
    if(!list.length) return html + '<div class="empty">' + emptyText + '</div>';

    const groups = groupByCategory(visible);
    Object.keys(groups).forEach(function(cat){
      html += `<div class="title category-title">${safe(cat)}</div><div class="file-grid compact-grid">`;
      html += groups[cat].map(function(item){
        const label = materialLabel(item);
        return `
          <div class="file-card ${isProjectFile(item) ? "project-file-card" : ""}">
            ${coverHTML(item, false)}
            ${fileProjectBadgeHTML(item)}
            <strong>${safe(item.title || item.file_name || label)}</strong>
            <small>Kategori: ${safe(item.category || "-")}<br>Jenis: ${safe(label)}<br>File: ${safe(item.file_name || "-")}</small>
            ${isPPTMaterial(item) ? quizBadgeHTML(item) : ""}
            <div class="row-actions">
              <button type="button" class="btn btn-gold" onclick="event.stopPropagation(); openEditMaterialModal(${item.id})">${isProjectFile(item) ? "Edit File" : "Edit PPT"}</button>
              ${item.file_path ? `<a class="btn btn-blue" href="${safe(item.file_path)}" download>Download</a>` : ""}
              <button class="btn btn-red" onclick="deleteLibraryMaterial(${item.id})">Hapus dari Library</button>
            </div>
          </div>`;
      }).join("");
      html += "</div>";
    });
    if(list.length > 4){
      html += '<div class="see-all-bottom">' + adminSeeAllButton(sectionKey, list.length, visible.length) + '</div>';
    }
    return html;
  }

  $("tabContent").innerHTML =
    renderLibrarySection("Library PPT Global", "Master PPT untuk semua siswa. File project ada tepat di bawah bagian ini.", pptList, "library", "ppt", "Belum ada PPT global. Klik Upload PPT Global.") +
    '<div style="height:22px"></div>' +
    renderLibrarySection("Library File / APK / ZIP Project", "Upload APK, ZIP project, folder project ZIP, source code, atau file lain. Sistem unlock/lock sama seperti PPT.", fileList, "projectFiles", "file", "Belum ada file project. Klik Upload File Project.");
}

function renderCertificates(){
  const s = selectedStudent;
  const list = s.certificates || [];
  const visible = sliceAdminItems("certificates", list);
  let html = `
    <div class="section-toolbar">
      <div><div class="title">Sertifikat Digital ${safe(s.name)}</div><div class="subtitle">Sertifikat khusus siswa ini. Awalnya tampil 4 data agar lebih rapi.</div></div>
      <div class="section-actions">
        <button class="btn btn-purple" onclick="openCertificateModal()">Upload Sertifikat</button>
        
      </div>
    </div>`;
  if(!list.length){
    html += '<div class="empty">Belum ada sertifikat.</div>';
  }else{
    html += '<div class="file-grid compact-grid">';
    html += visible.map(function(item){
      const locked = !!item.is_locked;
      return `
        <div class="file-card">
          ${coverHTML(item, locked)}
          <strong>${safe(item.title || item.file_name || "Sertifikat")}</strong>
          <small>Status: ${locked ? "Locked" : "Unlocked"}<br>File: ${safe(item.file_name || "-")}</small>
          <div class="row-actions">
            ${item.file_path ? `<a class="btn btn-blue" href="${safe(item.file_path)}" download>Download Admin</a>` : ""}
            <button class="btn btn-orange" onclick="toggleCertificateLock(${item.id},${item.is_locked})">${locked ? "Unlock" : "Lock"}</button>
            <button class="btn btn-red" onclick="deleteItem('certificate',${item.id})">Hapus</button>
          </div>
        </div>`;
    }).join("");
    html += '</div>';
  }
  if(list.length > 4){
    html += '<div class="see-all-bottom">' + adminSeeAllButton("certificates", list.length, visible.length) + '</div>';
  }

  $("tabContent").innerHTML = html;
}

function renderAll(){
  renderStats();
  renderStudents();
  renderDetail();
  initIcons();
}

if(adminPassword){
  $("loginBox").classList.add("hidden");
  $("mainApp").classList.remove("hidden");
  loadStudents();
}
initIcons();


function toggleAdminQuickInfo(){
  const box = document.getElementById("adminQuickInfo");
  if(box) box.classList.toggle("show");
}

document.addEventListener("click", function(e){
  const btn = document.getElementById("adminQuickInfoBtn");
  const box = document.getElementById("adminQuickInfo");
  if(!btn || !box) return;
  if(!btn.contains(e.target) && !box.contains(e.target)){
    box.classList.remove("show");
  }
});
