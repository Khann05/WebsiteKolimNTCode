const toast = document.getElementById("kidToast");
const confettiLayer = document.getElementById("confettiLayer");
const dashboard = document.querySelector(".dashboard");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1900);
}

function launchConfetti(amount = 70) {
  const icons = ["⭐", "🚀", "💙", "🪙", "✨", "🏆"];

  for (let i = 0; i < amount; i += 1) {
    const piece = document.createElement("span");

    piece.textContent = icons[Math.floor(Math.random() * icons.length)];
    piece.style.setProperty("--x", `${Math.random() * 100}%`);
    piece.style.setProperty("--s", `${16 + Math.random() * 18}px`);
    piece.style.setProperty("--d", `${1.8 + Math.random() * 1.8}s`);

    confettiLayer.appendChild(piece);
    setTimeout(() => piece.remove(), 3800);
  }
}

function scrollToTarget(target) {
  const el = document.querySelector(target);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

document.querySelectorAll("[data-scroll]").forEach((el) => {
  el.addEventListener("click", () => scrollToTarget(el.dataset.scroll));
});

document.querySelector("[data-start]")?.addEventListener("click", () => {
  showToast("🚀 Misi belajar dimulai!");
  launchConfetti(78);
  scrollToTarget("#mission");
});

document.querySelector("[data-quiz]")?.addEventListener("click", () => {
  showToast("🏆 Arena quiz siap dimainkan!");
  launchConfetti(56);
});

document.querySelectorAll("[data-card]").forEach((card) => {
  card.addEventListener("click", () => {
    showToast(`${card.dataset.card} dibuka`);
  });
});

document.querySelectorAll("[data-mission]").forEach((node) => {
  node.addEventListener("click", () => {
    showToast(`Misi: ${node.dataset.mission}`);
    node.classList.add("clicked");

    setTimeout(() => node.classList.remove("clicked"), 450);
  });
});

document.querySelectorAll("[data-action='coin']").forEach((coin) => {
  coin.addEventListener("click", () => {
    showToast("🪙 Koin kamu: 1.250");
    launchConfetti(26);
  });
});

document.querySelectorAll(".nav-menu a").forEach((link) => {
  link.addEventListener("click", (event) => {
    document.querySelectorAll(".nav-menu a").forEach((item) => item.classList.remove("active"));
    event.currentTarget.classList.add("active");
  });
});

if (dashboard) {
  dashboard.addEventListener("pointermove", (event) => {
    const rect = dashboard.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    document.querySelectorAll(".float-asset").forEach((item, index) => {
      const depth = (index + 1) * 6;
      item.style.transform = `translate(${x * depth}px, ${y * depth}px)`;
    });

    const robot = document.querySelector(".robot-main");
    if (robot) {
      robot.style.setProperty("--mx", `${x * 10}px`);
      robot.style.setProperty("--my", `${y * 10}px`);
    }
  });

  dashboard.addEventListener("pointerleave", () => {
    document.querySelectorAll(".float-asset").forEach((item) => {
      item.style.transform = "";
    });
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },
  { threshold: 0.14 }
);

document.querySelectorAll(".feature-card, .mission-board, .quiz-arena, .student-strip").forEach((el) => {
  observer.observe(el);
});

window.addEventListener("load", () => {
  setTimeout(() => {
    document.body.classList.add("ready");
    showToast("Selamat datang di KolimNT Code!");
  }, 300);
});
