(() => {
  const clock = document.getElementById("vhs-clock");
  const blastBtn = document.getElementById("blast-btn");
  const canvas = document.getElementById("confetti");
  const ctx = canvas.getContext("2d");

  const pad = (n) => String(n).padStart(2, "0");

  const tickClock = () => {
    const now = new Date();
    clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;
  };

  tickClock();
  setInterval(tickClock, 1000);

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  resize();
  window.addEventListener("resize", resize);

  const colors = ["#ff2a7a", "#24f0ff", "#ffe14a", "#e8eef7", "#ff6a3d"];
  let pieces = [];
  let raf = null;

  const spawn = (count = 140) => {
    pieces = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.35,
      w: 6 + Math.random() * 8,
      h: 8 + Math.random() * 12,
      vx: -2 + Math.random() * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: -0.2 + Math.random() * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  };

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.045;
      p.rot += p.vr;

      if (p.y < canvas.height + 40) alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (alive) {
      raf = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      raf = null;
    }
  };

  const blast = () => {
    blastBtn.classList.remove("is-live");
    void blastBtn.offsetWidth;
    blastBtn.classList.add("is-live");
    if (raf) cancelAnimationFrame(raf);
    spawn();
    raf = requestAnimationFrame(draw);
  };

  blastBtn.addEventListener("click", blast);
})();
