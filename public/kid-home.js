const toast = document.getElementById("toast");
const confetti = document.getElementById("confetti");

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove("show"), 1800);
}

function burst() {
  const icons = ["⭐","🪙","🚀","✨","💙"];
  for (let i = 0; i < 46; i++) {
    const el = document.createElement("span");
    el.textContent = icons[Math.floor(Math.random() * icons.length)];
    el.style.setProperty("--x", `${Math.random() * 100}%`);
    el.style.setProperty("--s", `${14 + Math.random() * 18}px`);
    el.style.setProperty("--d", `${1.8 + Math.random() * 1.5}s`);
    confetti.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }
}

document.querySelectorAll("[data-toast]").forEach(el => {
  el.addEventListener("click", () => {
    showToast(el.dataset.toast);
    if (el.hasAttribute("data-confetti")) burst();
  });
});

document.querySelectorAll("[data-scroll]").forEach(el => {
  el.addEventListener("click", () => {
    const target = document.querySelector(el.dataset.scroll);
    if (target) target.scrollIntoView({behavior:"smooth", block:"center"});
  });
});

setTimeout(() => showToast("Selamat datang di KolimNT Code!"), 350);
