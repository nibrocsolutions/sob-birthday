(() => {
  const musicBtn = document.getElementById("music-btn");
  const musicLabel = document.getElementById("music-label");
  const eq = document.getElementById("music-eq");
  const player = document.getElementById("tape-player");
  const nowPlaying = document.getElementById("now-playing");
  const trackButtons = [...document.querySelectorAll("[data-track]")];
  const synthBtn = document.getElementById("synth-btn");

  if (!musicBtn || !player) return;

  const TRACKS = {
    "could-you-be-loved": {
      id: "1ti2YCFgCoI",
      label: "Bob Marley — Could You Be Loved",
    },
    "one-love": {
      id: "IN0KkGeEURw",
      label: "Bob Marley — One Love",
    },
    "run-around": {
      id: "ousaiByU1ko",
      label: "Blues Traveler — Run-Around",
    },
    hook: {
      id: "pdz5kCaCRFM",
      label: "Blues Traveler — Hook",
    },
  };

  let activeKey = null;
  let synthPlaying = false;
  let synth = null;

  const setHeroUi = (on, label) => {
    musicBtn.setAttribute("aria-pressed", on ? "true" : "false");
    musicBtn.classList.toggle("is-playing", on);
    if (eq) eq.classList.toggle("is-on", on);
    if (musicLabel) musicLabel.textContent = label;
  };

  const setActiveTrack = (key) => {
    trackButtons.forEach((btn) => {
      const on = btn.dataset.track === key;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (synthBtn) {
      synthBtn.classList.toggle("is-active", key === "synth");
      synthBtn.setAttribute("aria-pressed", key === "synth" ? "true" : "false");
    }
  };

  const stopSynth = () => {
    if (synth && synth.stop) synth.stop();
    synthPlaying = false;
  };

  const playYoutube = (key, autoplay = true) => {
    const track = TRACKS[key];
    if (!track) return;
    stopSynth();
    activeKey = key;
    const src = `https://www.youtube-nocookie.com/embed/${track.id}?rel=0&modestbranding=1${
      autoplay ? "&autoplay=1" : ""
    }`;
    player.src = src;
    player.hidden = false;
    if (nowPlaying) nowPlaying.textContent = `Now spinning · ${track.label}`;
    setActiveTrack(key);
    setHeroUi(true, "Tape rolling — open mixtape");
  };

  const playTrack = (key) => {
    if (key === "synth") {
      playSynthSide();
      return;
    }
    playYoutube(key, true);
  };

  // --- Side B: original synthwave (kept as bonus, not copyrighted audio) ---
  const createSynth = () => {
    const BPM = 104;
    const STEPS = 16;
    const stepDur = 60 / BPM / 4;
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
    let noise = null;

    const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

    const ensureCtx = async () => {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.2;
        master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") await ctx.resume();
    };

    const envGain = (t, attack, decay, sustain, release, peak = 1) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + attack + decay);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay + release);
      return g;
    };

    const noiseBuffer = () => {
      const len = ctx.sampleRate * 0.2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return buffer;
    };

    const playBass = (midi, t) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = envGain(t, 0.01, 0.12, 0.35, 0.18, 0.65);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(midiToFreq(midi), t);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(420, t);
      osc.connect(filter);
      filter.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.4);
    };

    const playArp = (midi, t) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = envGain(t, 0.005, 0.08, 0.001, 0.1, 0.2);
      osc.type = "square";
      osc.frequency.setValueAtTime(midiToFreq(midi), t);
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1400, t);
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
        const g = envGain(t, 0.2, 0.4, 0.25, 0.9, 0.07);
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(midiToFreq(midi), t);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(900, t);
        osc.connect(filter);
        filter.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 1.6);
      }
    };

    const playKick = (t) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.85, t);
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
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t);
      src.stop(t + 0.16);
    };

    const playHat = (t) => {
      if (!noise) noise = noiseBuffer();
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = noise;
      filter.type = "highpass";
      filter.frequency.value = 7000;
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t);
      src.stop(t + 0.06);
    };

    const scheduleStep = (s, t) => {
      const bass = bassPattern[s];
      if (bass != null) playBass(bass, t);
      playArp(arpPattern[s], t);
      if (s % 4 === 0) playPad(padChords[Math.floor(s / 4) % padChords.length], t);
      if (s % 4 === 0) playKick(t);
      if (s % 8 === 4) playSnare(t);
      if (s % 2 === 0) playHat(t);
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

    return {
      async start() {
        await ensureCtx();
        if (playing) return;
        playing = true;
        step = 0;
        nextTime = ctx.currentTime + 0.05;
        scheduler();
      },
      stop() {
        playing = false;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
    };
  };

  const playSynthSide = async () => {
    player.removeAttribute("src");
    player.hidden = true;
    if (!synth) synth = createSynth();
    if (synthPlaying) {
      stopSynth();
      activeKey = null;
      setActiveTrack(null);
      if (nowPlaying) nowPlaying.textContent = "Select a track · reggae, Blues Traveler, or Side B";
      setHeroUi(false, "Play Squires mixtape");
      return;
    }
    await synth.start();
    synthPlaying = true;
    activeKey = "synth";
    setActiveTrack("synth");
    if (nowPlaying) nowPlaying.textContent = "Now spinning · Side B · Original synthwave";
    setHeroUi(true, "Tape rolling — open mixtape");
  };

  trackButtons.forEach((btn) => {
    btn.addEventListener("click", () => playTrack(btn.dataset.track));
  });

  if (synthBtn) {
    synthBtn.addEventListener("click", () => playTrack("synth"));
  }

  musicBtn.addEventListener("click", () => {
    const mixtape = document.getElementById("mixtape");
    if (mixtape) mixtape.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!activeKey) playYoutube("could-you-be-loved", true);
  });

  const blastBtn = document.getElementById("blast-btn");
  if (blastBtn) {
    blastBtn.addEventListener("click", () => {
      if (!activeKey) playYoutube("run-around", true);
    });
  }

  // Prefill player poster frame without autoplay.
  playYoutube("could-you-be-loved", false);
  setHeroUi(false, "Play Squires mixtape");
  activeKey = null;
  setActiveTrack(null);
  if (nowPlaying) {
    nowPlaying.textContent = "Select a track · reggae, Blues Traveler, or Side B";
  }
})();
