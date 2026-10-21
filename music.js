(() => {
  const musicBtn = document.getElementById("music-btn");
  const musicLabel = document.getElementById("music-label");
  const eq = document.getElementById("music-eq");
  if (!musicBtn) return;

  const BPM = 104;
  const STEPS = 16;
  const stepDur = 60 / BPM / 4;

  // A minor synthwave loop — original Web Audio composition (no samples).
  const bassPattern = [
    45, null, 45, null, 48, null, 45, null, 41, null, 41, null, 43, null, 43, 41,
  ];
  const arpPattern = [
    57, 60, 64, 60, 57, 60, 64, 67, 53, 57, 60, 57, 55, 59, 62, 59,
  ];
  const padChords = [
    [57, 60, 64],
    [53, 57, 60],
    [55, 59, 62],
    [52, 55, 59],
  ];

  let ctx = null;
  let master = null;
  let playing = false;
  let timer = null;
  let step = 0;
  let nextTime = 0;

  const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

  const ensureCtx = async () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.22;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 18;
      comp.ratio.value = 3;
      comp.attack.value = 0.01;
      comp.release.value = 0.2;
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === "suspended") await ctx.resume();
    return ctx;
  };

  const envGain = (t, attack, decay, sustain, release, peak = 1) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + attack + decay);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay + release);
    return g;
  };

  const playBass = (midi, t) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = envGain(t, 0.01, 0.12, 0.35, 0.18, 0.7);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(midiToFreq(midi), t);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, t);
    filter.Q.value = 6;
    osc.connect(filter);
    filter.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.4);
  };

  const playArp = (midi, t) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = envGain(t, 0.005, 0.08, 0.001, 0.1, 0.22);
    osc.type = "square";
    osc.frequency.setValueAtTime(midiToFreq(midi), t);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.value = 2;
    osc.connect(filter);
    filter.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.25);
  };

  const playPad = (chord, t) => {
    for (const midi of chord) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = envGain(t, 0.2, 0.4, 0.25, 0.9, 0.08);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(midiToFreq(midi), t);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(900, t);
      filter.frequency.linearRampToValueAtTime(1400, t + 1.2);
      osc.connect(filter);
      filter.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 1.6);
    }
  };

  const noiseBuffer = () => {
    const len = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  };

  let noise = null;

  const playKick = (t) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.3);
  };

  const playSnare = (t) => {
    if (!noise) noise = noiseBuffer();
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noise;
    filter.type = "highpass";
    filter.frequency.value = 1200;
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + 0.16);
  };

  const playHat = (t, open = false) => {
    if (!noise) noise = noiseBuffer();
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noise;
    filter.type = "highpass";
    filter.frequency.value = 7000;
    g.gain.setValueAtTime(open ? 0.12 : 0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.18 : 0.05));
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + (open ? 0.2 : 0.06));
  };

  const scheduleStep = (s, t) => {
    const bass = bassPattern[s];
    if (bass != null) playBass(bass, t);
    playArp(arpPattern[s], t);
    if (s % 4 === 0) playPad(padChords[Math.floor(s / 4) % padChords.length], t);
    if (s % 4 === 0) playKick(t);
    if (s % 8 === 4) playSnare(t);
    if (s % 2 === 0) playHat(t, s % 8 === 6);
  };

  const scheduler = () => {
    if (!playing || !ctx) return;
    const horizon = ctx.currentTime + 0.15;
    while (nextTime < horizon) {
      scheduleStep(step, nextTime);
      nextTime += stepDur;
      step = (step + 1) % STEPS;
    }
    timer = window.setTimeout(scheduler, 40);
  };

  const setUi = (on) => {
    musicBtn.setAttribute("aria-pressed", on ? "true" : "false");
    musicBtn.classList.toggle("is-playing", on);
    musicLabel.textContent = on ? "Tape rolling — tap to pause" : "Play Squires mixtape";
    if (eq) eq.classList.toggle("is-on", on);
  };

  const start = async () => {
    await ensureCtx();
    if (playing) return;
    playing = true;
    step = 0;
    nextTime = ctx.currentTime + 0.05;
    scheduler();
    setUi(true);
  };

  const stop = () => {
    playing = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    setUi(false);
  };

  const toggle = async () => {
    if (playing) stop();
    else await start();
  };

  musicBtn.addEventListener("click", () => {
    toggle().catch(() => {
      stop();
    });
  });

  // Birthday blast also drops the needle if the tape is stopped.
  const blastBtn = document.getElementById("blast-btn");
  if (blastBtn) {
    blastBtn.addEventListener("click", () => {
      if (!playing) start().catch(() => {});
    });
  }

  window.SquiresMixtape = { start, stop, toggle };
})();
