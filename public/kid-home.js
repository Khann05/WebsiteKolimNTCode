const state = {
  coins: 1250,
  streak: 7,
  stars: 48,
  xp: 320,
  xpMax: 600
};

const toast = document.getElementById("toast");
const confettiLayer = document.getElementById("confettiLayer");

function showToast(message){
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function showRobo(message){
  const card = document.getElementById("roboCard");
  const text = document.getElementById("roboText");
  text.textContent = message;
  card.classList.remove("robo-pop");
  void card.offsetWidth;
  card.classList.add("robo-pop");
}

function addCoin(){
  state.coins += 25;
  document.getElementById("coinValue").textContent = state.coins;
  showToast("🪙 +25 koin berhasil dikumpulkan!");
  smallConfetti(["🪙","✨"]);
}

function boostStreak(){
  state.streak += 1;
  document.getElementById("streakValue").textContent = state.streak;
  document.getElementById("miniStreak").textContent = state.streak;
  showToast("🔥 Streak belajar naik!");
  showRobo("Mantap! Jaga streak kamu setiap hari ya 🔥");
}

function collectStar(){
  state.stars += 1;
  document.getElementById("starValue").textContent = state.stars;
  document.getElementById("miniStar").textContent = state.stars;
  showToast("⭐ Kamu mendapat 1 bintang!");
  smallConfetti(["⭐","✨"]);
}

function startLearning(){
  showToast("🚀 Misi belajar dimulai!");
  showRobo("Aku akan menemani kamu belajar coding step by step. Yuk mulai dari Level 2!");
  updateXP(60);
  smallConfetti(["🚀","⭐","✨","💎"]);
  document.querySelector(".adventure-panel").scrollIntoView({behavior:"smooth", block:"center"});
}

function openFeature(name){
  const messages = {
    Quiz: "Quiz Arena akan berisi soal-soal coding seperti game. Pilih jawaban dan dapatkan XP!",
    Progress: "Progress kamu tersimpan dari misi, quiz, streak, dan reward.",
    Reward: "Kumpulkan koin lalu tukar dengan hadiah di toko reward.",
    Misi: "Misi adalah petualangan belajar bertahap. Selesaikan untuk buka level baru!"
  };
  showToast(`${name} dibuka`);
  showRobo(messages[name] || "Fitur siap dibuka!");
  updateXP(20);
}

function showAllLevels(){
  showToast("🗺️ Semua level ditampilkan!");
  showRobo("Level 3 masih terkunci. Selesaikan Level 2 dulu untuk membukanya.");
}

function selectLevel(level){
  if(level === 1){
    showToast("✅ Level 1 sudah selesai");
    showRobo("Level 1 sudah kamu selesaikan. Keren!");
  }else{
    showToast("🚀 Level 2 dipilih");
    showRobo("Level 2: Logika Program. Siap lanjut?");
    updateXP(35);
  }
}

function lockedLevel(){
  showToast("🔒 Level masih terkunci");
  showRobo("Level ini akan terbuka setelah kamu menyelesaikan misi sebelumnya.");
}

function openChest(){
  state.coins += 100;
  state.stars += 3;
  document.getElementById("coinValue").textContent = state.coins;
  document.getElementById("starValue").textContent = state.stars;
  document.getElementById("miniStar").textContent = state.stars;
  showToast("🎁 Peti dibuka: +100 koin, +3 bintang!");
  updateXP(80);
  smallConfetti(["🎁","🪙","⭐","💎","✨"]);
  showRobo("Hadiah berhasil didapat! Kamu makin dekat ke level berikutnya.");
}

function navClick(event, menu){
  event.preventDefault();
  document.querySelectorAll(".bottom-nav a").forEach(a => a.classList.remove("active"));
  event.currentTarget.classList.add("active");
  showToast(`${menu} dipilih`);
  showRobo(`Menu ${menu} siap. Nanti bagian ini bisa disambungkan ke halaman asli.`);
}

function updateXP(amount){
  state.xp = Math.min(state.xpMax, state.xp + amount);
  const percent = Math.round(state.xp / state.xpMax * 100);
  document.getElementById("xpTrack").style.width = `${percent}%`;
  document.getElementById("xpText").textContent = `${state.xp} / ${state.xpMax} XP`;
  if(state.xp >= state.xpMax){
    showToast("🏆 Level up siap dibuka!");
  }
}

function smallConfetti(items = ["⭐","✨"]){
  const rect = confettiLayer.getBoundingClientRect();
  for(let i=0;i<28;i++){
    const el = document.createElement("span");
    el.className = "confetti";
    el.textContent = items[Math.floor(Math.random()*items.length)];
    el.style.left = `${45 + Math.random()*10}%`;
    el.style.top = `${35 + Math.random()*25}%`;
    el.style.setProperty("--x", `${Math.random()*260 - 130}px`);
    el.style.setProperty("--y", `${Math.random()*-260 - 90}px`);
    confettiLayer.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
}

function idleRobotTalk(){
  const lines = [
    "Klik Mulai Belajar untuk lanjut misi coding.",
    "Jangan lupa ambil reward harian kamu!",
    "Streak belajar bikin progress makin cepat.",
    "Quiz singkat bisa menambah XP dan bintang."
  ];
  const random = lines[Math.floor(Math.random()*lines.length)];
  showRobo(random);
}

setInterval(() => {
  if(Math.random() > 0.58) idleRobotTalk();
}, 9000);

document.addEventListener("DOMContentLoaded", () => {
  showToast("Selamat datang di KolimNT Code!");
});
