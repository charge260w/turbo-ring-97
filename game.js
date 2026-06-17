(() => {
  "use strict";

  const WIDTH = 1280;
  const HEIGHT = 720;
  const GROUND_Y = 594;
  const LEFT_WALL = 105;
  const RIGHT_WALL = WIDTH - 105;
  const ROUND_LENGTH = 99;

  const roster = [
    {
      id: "gtr",
      name: "Nissan GT-R",
      title: "Twin Turbo King",
      paint: "#236dff",
      accent: "#37e8ff",
      shape: "coupe",
      stats: { speed: 1.1, power: 0.98, armor: 0.94, boost: 1.2 },
      special: "Skyline Surge",
    },
    {
      id: "sclass",
      name: "Mercedes S",
      title: "Executive Tank",
      paint: "#d8dde2",
      accent: "#ffbf3d",
      shape: "sedan",
      stats: { speed: 0.88, power: 1.04, armor: 1.22, boost: 0.92 },
      special: "Maybach Hammer",
    },
    {
      id: "911",
      name: "Porsche 911",
      title: "Corner Demon",
      paint: "#ff4a32",
      accent: "#fff1b8",
      shape: "sport",
      stats: { speed: 1.18, power: 0.92, armor: 0.9, boost: 1.14 },
      special: "Apex Fever",
    },
    {
      id: "supra",
      name: "Toyota Supra",
      title: "Drift Idol",
      paint: "#ff8c24",
      accent: "#55ff9a",
      shape: "coupe",
      stats: { speed: 1.04, power: 1.02, armor: 0.96, boost: 1.1 },
      special: "Neon Drift",
    },
    {
      id: "corvette",
      name: "Corvette ZR1",
      title: "V8 Thunder",
      paint: "#ffe04f",
      accent: "#ff3d2e",
      shape: "wedge",
      stats: { speed: 1.0, power: 1.18, armor: 0.98, boost: 0.98 },
      special: "Thunderline",
    },
    {
      id: "r8",
      name: "Audi R8",
      title: "Laser Quattro",
      paint: "#18c78f",
      accent: "#67f7ff",
      shape: "super",
      stats: { speed: 1.08, power: 1.0, armor: 1.02, boost: 1.04 },
      special: "Quattro Pulse",
    },
  ];

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const ui = {
    hud: document.getElementById("hud"),
    select: document.getElementById("selectScreen"),
    roster: document.getElementById("rosterGrid"),
    start: document.getElementById("startButton"),
    random: document.getElementById("randomRivalButton"),
    rival: document.getElementById("rivalSlot"),
    mode: document.getElementById("modeButton"),
    music: document.getElementById("musicButton"),
    fullscreen: document.getElementById("fullscreenButton"),
    result: document.getElementById("resultScreen"),
    resultKicker: document.getElementById("resultKicker"),
    resultTitle: document.getElementById("resultTitle"),
    resultLine: document.getElementById("resultLine"),
    rematch: document.getElementById("rematchButton"),
    change: document.getElementById("changeCarButton"),
    touch: document.getElementById("touchControls"),
    banner: document.getElementById("cinematicText"),
    bannerMain: document.querySelector("#cinematicText strong"),
    bannerSub: document.querySelector("#cinematicText span"),
    p1Tag: document.getElementById("p1Tag"),
    p2Tag: document.getElementById("p2Tag"),
    p1Name: document.getElementById("p1Name"),
    p2Name: document.getElementById("p2Name"),
    p1Health: document.getElementById("p1Health"),
    p2Health: document.getElementById("p2Health"),
    p1Boost: document.getElementById("p1Boost"),
    p2Boost: document.getElementById("p2Boost"),
    p1Special: document.getElementById("p1Special"),
    p2Special: document.getElementById("p2Special"),
    roundTime: document.getElementById("roundTime"),
  };

  const keys = new Set();
  let previousKeys = new Set();
  const virtual = Object.create(null);
  let previousVirtual = Object.create(null);

  const particles = [];
  const popups = [];
  const skyline = makeSkyline();
  let audio;

  let selectedIndex = 0;
  let rivalIndex = 2;
  let mode = "cpu";
  let fighters = [];
  let lastFrame = 0;

  const game = {
    phase: "select",
    roundTime: ROUND_LENGTH,
    elapsed: 0,
    introTime: 0,
    koTime: 0,
    shake: 0,
    flash: 0,
    hitStop: 0,
    winner: null,
    paused: false,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function sign(value) {
    return value < 0 ? -1 : 1;
  }

  function makeSkyline() {
    const buildings = [];
    for (let x = -40; x < WIDTH + 120; ) {
      const width = rand(48, 108);
      buildings.push({
        x,
        width,
        height: rand(120, 310),
        tone: Math.random() > 0.5 ? "#171b1f" : "#201817",
        windows: Math.random() > 0.28,
      });
      x += width + rand(8, 24);
    }
    return buildings;
  }

  class AudioEngine {
    constructor() {
      this.context = null;
      this.master = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.timer = null;
      this.step = 0;
      this.nextTime = 0;
      this.bpm = 148;
      this.muted = false;
      this.started = false;
    }

    ensure() {
      if (this.context) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.master.gain.value = 0.78;
      this.musicGain.gain.value = 0.38;
      this.sfxGain.gain.value = 0.62;
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.context.destination);
    }

    async start() {
      this.ensure();
      if (!this.context) return;
      if (this.context.state === "suspended") {
        await this.context.resume();
      }
      this.started = true;
      if (!this.timer) {
        this.nextTime = this.context.currentTime + 0.05;
        this.timer = window.setInterval(() => this.scheduler(), 45);
      }
      updateMusicButton();
    }

    toggle() {
      this.ensure();
      if (!this.context) return;
      this.muted = !this.muted;
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.78, this.context.currentTime, 0.035);
      updateMusicButton();
    }

    scheduler() {
      if (!this.context || this.muted) return;
      const beat = 60 / this.bpm;
      while (this.nextTime < this.context.currentTime + 0.16) {
        this.scheduleStep(this.step, this.nextTime);
        this.nextTime += beat / 4;
        this.step += 1;
      }
    }

    scheduleStep(step, time) {
      const s = step % 32;
      const bass = [55, 55, 65.4, 55, 73.4, 65.4, 55, 49, 55, 55, 82.4, 73.4, 65.4, 55, 49, 41.2];
      if (s % 4 === 0 || s === 14 || s === 30) this.kick(time);
      if (s % 8 === 4 || s === 20) this.snare(time);
      if (s % 2 === 0) this.hat(time, s % 4 === 0 ? 0.18 : 0.11);
      if (s % 2 === 0) this.tone("sawtooth", bass[(step / 2) % bass.length | 0], time, 0.11, 0.09, 620);
      if ([3, 7, 11, 15, 19, 23, 27, 31].includes(s)) {
        const lead = [330, 392, 440, 523, 494, 392, 330, 294][(step / 4) % 8 | 0];
        this.tone("square", lead, time, 0.08, 0.035, 2100);
      }
      if (s === 0 || s === 16) {
        [220, 277, 330].forEach((note, i) => this.tone("triangle", note, time + i * 0.012, 0.7, 0.025, 880));
      }
    }

    tone(type, frequency, time, duration, gainValue, filterFrequency) {
      if (!this.context) return;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      const filter = this.context.createBiquadFilter();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, time);
      if (type === "sawtooth") {
        osc.detune.setValueAtTime(-8, time);
      }
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(filterFrequency, time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + duration + 0.03);
    }

    noise(time, duration, gainValue, destination = this.sfxGain, highpass = 450) {
      if (!this.context) return;
      const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const source = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(highpass, time);
      gain.gain.setValueAtTime(gainValue, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      source.start(time);
      source.stop(time + duration);
    }

    kick(time) {
      if (!this.context) return;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
      gain.gain.setValueAtTime(0.22, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.18);
    }

    snare(time) {
      this.noise(time, 0.09, 0.08, this.musicGain, 900);
      this.tone("triangle", 180, time, 0.07, 0.035, 1200);
    }

    hat(time, amount) {
      this.noise(time, 0.035, amount, this.musicGain, 5200);
    }

    sfx(name, intensity = 1) {
      this.ensure();
      if (!this.context || this.muted) return;
      const t = this.context.currentTime;
      const amount = clamp(intensity, 0.35, 1.8);
      if (name === "select") {
        this.quickTone("square", 640, 980, t, 0.07, 0.08 * amount);
      }
      if (name === "start") {
        this.quickTone("sawtooth", 150, 520, t, 0.34, 0.09 * amount);
        this.noise(t + 0.05, 0.18, 0.09 * amount, this.sfxGain, 1800);
      }
      if (name === "attack") {
        this.noise(t, 0.07, 0.11 * amount, this.sfxGain, 1300);
        this.quickTone("triangle", 170, 95, t, 0.08, 0.08 * amount);
      }
      if (name === "hit") {
        this.noise(t, 0.12, 0.18 * amount, this.sfxGain, 760);
        this.quickTone("sawtooth", 90, 48, t, 0.16, 0.18 * amount);
      }
      if (name === "guard") {
        this.quickTone("square", 360, 210, t, 0.08, 0.08 * amount);
        this.noise(t, 0.05, 0.08 * amount, this.sfxGain, 2600);
      }
      if (name === "dash") {
        this.noise(t, 0.2, 0.13 * amount, this.sfxGain, 600);
        this.quickTone("sawtooth", 80, 170, t, 0.16, 0.06 * amount);
      }
      if (name === "special") {
        [220, 330, 440, 660].forEach((note, i) => this.quickTone("sawtooth", note, note * 1.35, t + i * 0.045, 0.18, 0.06 * amount));
        this.noise(t, 0.26, 0.18 * amount, this.sfxGain, 1600);
      }
      if (name === "ko") {
        this.quickTone("sawtooth", 220, 55, t, 0.72, 0.15 * amount);
        this.noise(t + 0.08, 0.42, 0.18 * amount, this.sfxGain, 400);
      }
    }

    quickTone(type, from, to, time, duration, gainValue) {
      if (!this.context) return;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, time);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), time + duration);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(time);
      osc.stop(time + duration + 0.04);
    }
  }

  function buildRoster() {
    ui.roster.innerHTML = "";
    roster.forEach((car, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "car-card";
      card.dataset.index = String(index);
      card.style.setProperty("--paint", car.paint);
      card.style.setProperty("--accent", car.accent);
      card.innerHTML = `
        <div class="car-model">
          <div>
            <strong>${car.name}</strong>
            <span>${car.title}</span>
          </div>
          <div class="mini-car" aria-hidden="true"></div>
        </div>
        <div class="stat-bars">
          ${statRow("速度", car.stats.speed, 1.2)}
          ${statRow("冲击", car.stats.power, 1.2)}
          ${statRow("装甲", car.stats.armor, 1.24)}
          ${statRow("氮气", car.stats.boost, 1.2)}
        </div>
      `;
      card.addEventListener("click", () => {
        selectedIndex = index;
        if (rivalIndex === selectedIndex) pickRival();
        renderSelection();
        audio.sfx("select");
      });
      ui.roster.appendChild(card);
    });
    renderSelection();
  }

  function statRow(label, value, max) {
    const width = clamp((value / max) * 100, 24, 100).toFixed(0);
    return `
      <div class="stat-row">
        <span>${label}</span>
        <div class="stat-track"><span style="--value:${width}%"></span></div>
      </div>
    `;
  }

  function renderSelection() {
    [...ui.roster.children].forEach((card, index) => {
      card.classList.toggle("active", index === selectedIndex);
      card.setAttribute("aria-pressed", index === selectedIndex ? "true" : "false");
    });
    const rival = roster[rivalIndex];
    ui.rival.querySelector("strong").textContent = rival.name;
  }

  function pickRival() {
    let next = rivalIndex;
    while (next === rivalIndex || next === selectedIndex) {
      next = Math.floor(Math.random() * roster.length);
    }
    rivalIndex = next;
    renderSelection();
  }

  function updateMusicButton() {
    ui.music.textContent = audio.muted ? "静音" : audio.started ? "音乐开" : "音乐";
  }

  function warmAudio() {
    if (!audio) return;
    audio.start().catch(() => updateMusicButton());
  }

  function bindUi() {
    ui.start.addEventListener("click", () => {
      warmAudio();
      startMatch();
    });
    ui.random.addEventListener("click", () => {
      pickRival();
      audio.sfx("select");
    });
    ui.mode.addEventListener("click", () => {
      mode = mode === "cpu" ? "versus" : "cpu";
      ui.mode.textContent = mode === "cpu" ? "CPU" : "双人";
      audio.sfx("select");
    });
    ui.music.addEventListener("click", () => {
      warmAudio();
      audio.toggle();
    });
    ui.fullscreen.addEventListener("click", () => {
      warmAudio();
      toggleFullscreen();
    });
    ui.rematch.addEventListener("click", () => {
      warmAudio();
      startMatch();
    });
    ui.change.addEventListener("click", () => {
      game.phase = "select";
      ui.select.classList.remove("hidden");
      ui.result.classList.add("hidden");
      ui.hud.hidden = true;
      ui.touch.classList.remove("battle");
      hideBanner();
    });

    document.addEventListener("keydown", (event) => {
      if (isGameKey(event.code)) event.preventDefault();
      if (event.code === "Enter" && game.phase === "select") {
        warmAudio();
        startMatch();
        return;
      }
      if (event.code === "ArrowRight" && game.phase === "select") {
        selectedIndex = (selectedIndex + 1) % roster.length;
        if (rivalIndex === selectedIndex) pickRival();
        renderSelection();
        audio.sfx("select");
      }
      if (event.code === "ArrowLeft" && game.phase === "select") {
        selectedIndex = (selectedIndex + roster.length - 1) % roster.length;
        if (rivalIndex === selectedIndex) pickRival();
        renderSelection();
        audio.sfx("select");
      }
      if (event.code === "KeyM") {
        warmAudio();
        audio.toggle();
      }
      if (event.code === "KeyR" && (game.phase === "fight" || game.phase === "ko")) {
        warmAudio();
        startMatch();
      }
      keys.add(event.code);
    });

    document.addEventListener("keyup", (event) => {
      keys.delete(event.code);
    });

    document.querySelectorAll("[data-control]").forEach((button) => {
      const action = button.getAttribute("data-control");
      const down = (event) => {
        event.preventDefault();
        warmAudio();
        virtual[action] = true;
        button.classList.add("active");
        button.setPointerCapture?.(event.pointerId);
      };
      const up = (event) => {
        event.preventDefault();
        virtual[action] = false;
        button.classList.remove("active");
      };
      button.addEventListener("pointerdown", down);
      button.addEventListener("pointerup", up);
      button.addEventListener("pointercancel", up);
      button.addEventListener("pointerleave", up);
    });
  }

  function toggleFullscreen() {
    const target = document.documentElement;
    if (!document.fullscreenElement) {
      target.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  function isGameKey(code) {
    return [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Space",
      "Enter",
      "KeyA",
      "KeyD",
      "KeyW",
      "KeyS",
      "KeyJ",
      "KeyK",
      "KeyL",
      "KeyM",
      "KeyR",
      "Digit1",
      "Digit2",
      "Digit3",
      "Numpad1",
      "Numpad2",
      "Numpad3",
    ].includes(code);
  }

  function startMatch() {
    if (rivalIndex === selectedIndex) pickRival();
    fighters = [
      createFighter(roster[selectedIndex], "p1", LEFT_WALL + 190, 1),
      createFighter(roster[rivalIndex], mode === "cpu" ? "cpu" : "p2", RIGHT_WALL - 190, -1),
    ];
    particles.length = 0;
    popups.length = 0;
    game.phase = "intro";
    game.roundTime = ROUND_LENGTH;
    game.elapsed = 0;
    game.introTime = 0;
    game.koTime = 0;
    game.winner = null;
    game.hitStop = 0;
    game.shake = 0;
    game.flash = 0;
    ui.select.classList.add("hidden");
    ui.result.classList.add("hidden");
    ui.hud.hidden = false;
    ui.touch.classList.add("battle");
    ui.p1Tag.textContent = "P1";
    ui.p2Tag.textContent = mode === "cpu" ? "CPU" : "P2";
    ui.p1Name.textContent = fighters[0].spec.name;
    ui.p2Name.textContent = fighters[1].spec.name;
    showBanner("READY", `${fighters[0].spec.name}  VS  ${fighters[1].spec.name}`, 1.1);
    audio.sfx("start");
  }

  function createFighter(spec, control, x, facing) {
    return {
      spec,
      control,
      x,
      z: 0,
      vx: 0,
      vz: 0,
      facing,
      width: spec.shape === "sedan" ? 180 : spec.shape === "wedge" ? 170 : 162,
      hp: 100,
      boost: 80,
      special: 42,
      guard: false,
      attack: null,
      attackCooldown: 0,
      dashCooldown: 0,
      dashTimer: 0,
      hitstun: 0,
      invuln: 0,
      combo: 0,
      lastHitAt: -10,
      aiThink: 0,
      aiMood: Math.random(),
      damageBlink: 0,
    };
  }

  function showBanner(main, sub = "", seconds = 0.8) {
    ui.bannerMain.textContent = main;
    ui.bannerSub.textContent = sub;
    ui.banner.classList.add("show");
    window.clearTimeout(showBanner.timer);
    showBanner.timer = window.setTimeout(hideBanner, seconds * 1000);
  }

  function hideBanner() {
    ui.banner.classList.remove("show");
  }

  function keyDown(code) {
    return keys.has(code);
  }

  function keyPressed(code) {
    return keys.has(code) && !previousKeys.has(code);
  }

  function touchDown(action) {
    return Boolean(virtual[action]);
  }

  function touchPressed(action) {
    return Boolean(virtual[action]) && !previousVirtual[action];
  }

  function inputFor(fighter, opponent, dt) {
    if (fighter.control === "cpu") return cpuInput(fighter, opponent, dt);
    if (fighter.control === "p2") {
      return {
        left: keyDown("ArrowLeft"),
        right: keyDown("ArrowRight"),
        up: keyDown("ArrowUp"),
        guard: keyDown("ArrowDown"),
        attackPressed: keyPressed("Numpad1") || keyPressed("Digit1"),
        dashPressed: keyPressed("Numpad2") || keyPressed("Digit2"),
        specialPressed: keyPressed("Numpad3") || keyPressed("Digit3"),
      };
    }
    return {
      left: keyDown("KeyA") || touchDown("left"),
      right: keyDown("KeyD") || touchDown("right"),
      up: keyDown("KeyW") || touchDown("up"),
      guard: keyDown("KeyS") || touchDown("guard"),
      attackPressed: keyPressed("KeyJ") || touchPressed("attack"),
      dashPressed: keyPressed("KeyK") || touchPressed("dash"),
      specialPressed: keyPressed("KeyL") || touchPressed("special"),
    };
  }

  function cpuInput(fighter, opponent, dt) {
    const dx = opponent.x - fighter.x;
    const distance = Math.abs(dx);
    fighter.aiThink -= dt;
    if (fighter.aiThink <= 0) {
      fighter.aiThink = rand(0.18, 0.46);
      fighter.aiMood = Math.random();
    }
    const target = fighter.aiMood > 0.26 ? 145 : 225;
    const backingOff = fighter.hp < 35 && fighter.boost < 35 && fighter.aiMood > 0.56;
    return {
      left: backingOff ? dx > 0 : dx < -target,
      right: backingOff ? dx < 0 : dx > target,
      up: distance < 170 && fighter.aiMood > 0.9,
      guard: opponent.attack && distance < 220 && fighter.aiMood > 0.48,
      attackPressed: distance < 168 && fighter.attackCooldown <= 0 && fighter.aiMood > 0.58,
      dashPressed: distance > 250 && fighter.boost > 28 && fighter.dashCooldown <= 0 && fighter.aiMood > 0.7,
      specialPressed: distance < 260 && fighter.special >= 100 && fighter.aiMood > 0.74,
    };
  }

  function loop(timestamp) {
    const dt = clamp((timestamp - lastFrame) / 1000 || 0, 0, 0.033);
    lastFrame = timestamp;
    update(dt);
    draw();
    previousKeys = new Set(keys);
    previousVirtual = { ...virtual };
    window.requestAnimationFrame(loop);
  }

  function update(dt) {
    game.elapsed += dt;
    game.shake = Math.max(0, game.shake - dt * 34);
    game.flash = Math.max(0, game.flash - dt * 2.8);

    if (game.phase === "intro") {
      game.introTime += dt;
      idleFighters(dt);
      if (game.introTime > 1.15 && game.introTime - dt <= 1.15) showBanner("BURN IT", "REDLINE ROUND", 0.72);
      if (game.introTime >= 2.0) {
        game.phase = "fight";
        showBanner("GO", "FULL BOOST", 0.45);
      }
    } else if (game.phase === "fight") {
      if (game.hitStop > 0) {
        game.hitStop = Math.max(0, game.hitStop - dt);
        updateParticles(dt * 0.42);
        updateHud();
        return;
      }
      game.roundTime = Math.max(0, game.roundTime - dt);
      updateFight(dt);
      if (game.roundTime <= 0) finishByTime();
    } else if (game.phase === "ko") {
      game.koTime += dt;
      idleFighters(dt);
      if (game.koTime > 1.0 && ui.result.classList.contains("hidden")) showResult();
    } else {
      updateDemoCars(dt);
    }
    updateParticles(dt);
    updatePopups(dt);
    updateHud();
  }

  function idleFighters(dt) {
    fighters.forEach((fighter) => {
      fighter.facing = fighters[0] === fighter ? 1 : -1;
      fighter.vx *= Math.pow(0.08, dt);
      fighter.boost = clamp(fighter.boost + 8 * dt * fighter.spec.stats.boost, 0, 100);
      updateVertical(fighter, dt);
      fighter.damageBlink = Math.max(0, fighter.damageBlink - dt);
    });
  }

  function updateDemoCars(dt) {
    if (fighters.length === 0) {
      fighters = [
        createFighter(roster[selectedIndex], "p1", LEFT_WALL + 230, 1),
        createFighter(roster[rivalIndex], "cpu", RIGHT_WALL - 230, -1),
      ];
    }
    fighters.forEach((fighter, index) => {
      fighter.x += Math.sin(game.elapsed * 1.2 + index) * dt * 12;
      fighter.z = Math.max(0, Math.sin(game.elapsed * 2 + index) * 3);
      fighter.facing = index === 0 ? 1 : -1;
    });
  }

  function updateFight(dt) {
    const [p1, p2] = fighters;
    p1.facing = p2.x >= p1.x ? 1 : -1;
    p2.facing = p1.x >= p2.x ? 1 : -1;

    const input1 = inputFor(p1, p2, dt);
    const input2 = inputFor(p2, p1, dt);
    updateFighter(p1, p2, input1, dt);
    updateFighter(p2, p1, input2, dt);
    resolveBodyCollision(p1, p2);
    updateAttack(p1, p2, dt);
    updateAttack(p2, p1, dt);
  }

  function updateFighter(fighter, opponent, input, dt) {
    fighter.damageBlink = Math.max(0, fighter.damageBlink - dt);
    fighter.hitstun = Math.max(0, fighter.hitstun - dt);
    fighter.invuln = Math.max(0, fighter.invuln - dt);
    fighter.attackCooldown = Math.max(0, fighter.attackCooldown - dt);
    fighter.dashCooldown = Math.max(0, fighter.dashCooldown - dt);
    fighter.boost = clamp(fighter.boost + 13 * dt * fighter.spec.stats.boost, 0, 100);
    fighter.special = clamp(fighter.special + 3.6 * dt, 0, 100);

    const canDrive = fighter.hitstun <= 0;
    const inAttack = Boolean(fighter.attack);
    fighter.guard = Boolean(input.guard && canDrive && !inAttack && fighter.z <= 2);

    if (canDrive && input.up && fighter.z <= 0.2 && !inAttack) {
      fighter.vz = 520 * fighter.spec.stats.speed;
      fighter.z = 1;
      spawnDust(fighter.x - fighter.facing * 50, GROUND_Y - 12, fighter.facing, 7);
    }

    if (canDrive && input.dashPressed && fighter.boost >= 18 && fighter.dashCooldown <= 0) {
      startDash(fighter, input, opponent);
    }

    if (canDrive && input.specialPressed && fighter.special >= 100 && fighter.attackCooldown <= 0) {
      startAttack(fighter, "special");
    } else if (canDrive && input.attackPressed && fighter.attackCooldown <= 0) {
      startAttack(fighter, "ram");
    }

    if (canDrive && !fighter.attack) {
      const desired = (Number(input.right) - Number(input.left)) * 318 * fighter.spec.stats.speed;
      const guardPenalty = fighter.guard ? 0.42 : 1;
      fighter.vx = lerp(fighter.vx, desired * guardPenalty, clamp(dt * 8.4, 0, 1));
    } else if (fighter.hitstun > 0) {
      fighter.vx *= Math.pow(0.52, dt);
    }

    if (fighter.dashTimer > 0) {
      fighter.dashTimer = Math.max(0, fighter.dashTimer - dt);
      if (Math.random() > 0.35) spawnDust(fighter.x - fighter.facing * 65, GROUND_Y - 16, fighter.facing, 1);
    }

    updateVertical(fighter, dt);
    fighter.x = clamp(fighter.x + fighter.vx * dt, LEFT_WALL, RIGHT_WALL);
    fighter.vx *= Math.pow(fighter.z > 0 ? 0.9 : 0.22, dt);
  }

  function updateVertical(fighter, dt) {
    if (fighter.z > 0 || fighter.vz > 0) {
      fighter.vz -= 1480 * dt;
      fighter.z += fighter.vz * dt;
      if (fighter.z <= 0) {
        fighter.z = 0;
        fighter.vz = 0;
        spawnDust(fighter.x, GROUND_Y - 10, -fighter.facing, 4);
      }
    }
  }

  function startDash(fighter, input, opponent) {
    const dir = input.left && !input.right ? -1 : input.right && !input.left ? 1 : sign(opponent.x - fighter.x);
    fighter.facing = dir;
    fighter.boost -= 18;
    fighter.dashCooldown = 0.36;
    fighter.dashTimer = 0.18;
    fighter.vx = dir * 760 * fighter.spec.stats.speed;
    game.shake = Math.max(game.shake, 2.5);
    spawnDust(fighter.x - dir * 74, GROUND_Y - 18, dir, 16);
    audio.sfx("dash", fighter.spec.stats.boost);
  }

  function startAttack(fighter, type) {
    if (type === "special") {
      fighter.special = 0;
      fighter.attackCooldown = 0.88;
      fighter.attack = {
        type,
        timer: 0,
        duration: 0.64,
        hits: [0.12, 0.28, 0.47],
        done: new Set(),
        reach: 234,
        damage: 8.1 * fighter.spec.stats.power,
        knock: 475,
        lift: 180,
      };
      fighter.vx = fighter.facing * 440 * fighter.spec.stats.speed;
      game.flash = 0.58;
      game.shake = Math.max(game.shake, 6);
      showBanner(fighter.spec.special, fighter.spec.title, 0.7);
      spawnBurst(fighter.x + fighter.facing * 74, GROUND_Y - 58 - fighter.z, fighter.spec.accent, 28);
      audio.sfx("special", 1.2);
    } else {
      fighter.attackCooldown = 0.38;
      fighter.attack = {
        type,
        timer: 0,
        duration: 0.27,
        hits: [0.11],
        done: new Set(),
        reach: 154,
        damage: 9.4 * fighter.spec.stats.power,
        knock: 355,
        lift: 80,
      };
      fighter.vx = fighter.facing * 330 * fighter.spec.stats.speed;
      audio.sfx("attack", 0.8);
    }
  }

  function updateAttack(attacker, defender, dt) {
    if (!attacker.attack) return;
    const attack = attacker.attack;
    attack.timer += dt;
    attack.hits.forEach((hitTime, index) => {
      if (attack.timer >= hitTime && !attack.done.has(index)) {
        attack.done.add(index);
        tryHit(attacker, defender, attack, index);
      }
    });
    if (attack.timer >= attack.duration) attacker.attack = null;
  }

  function tryHit(attacker, defender, attack, index) {
    if (defender.invuln > 0 || game.phase !== "fight") return;
    const dx = defender.x - attacker.x;
    const distance = Math.abs(dx);
    const frontOk = sign(dx || attacker.facing) === attacker.facing || distance < 58;
    const heightOk = Math.abs(attacker.z - defender.z) < (attack.type === "special" ? 118 : 80);
    const reach = attack.reach + attacker.width * 0.36;
    if (!frontOk || !heightOk || distance > reach) return;

    const blocking = defender.guard && defender.z <= 2 && sign(attacker.x - defender.x) === defender.facing;
    const armor = defender.spec.stats.armor;
    const cpuMercy = attacker.control === "cpu" ? 0.72 : 1;
    const rawDamage = attack.damage * (attack.type === "special" && index === 2 ? 1.25 : 1) * cpuMercy;
    const damage = blocking ? rawDamage * 0.24 : rawDamage / armor;
    defender.hp = clamp(defender.hp - damage, 0, 100);
    defender.damageBlink = 0.16;
    defender.invuln = blocking ? 0.05 : 0.1;
    defender.hitstun = blocking ? 0.1 : attack.type === "special" ? 0.28 : 0.18;
    defender.vx = attacker.facing * attack.knock * (blocking ? 0.22 : 1 / armor);
    defender.vz = blocking ? defender.vz : Math.max(defender.vz, attack.lift / armor);
    defender.z = blocking ? defender.z : Math.max(defender.z, 1);
    attacker.special = clamp(attacker.special + (blocking ? 5 : 14), 0, 100);
    defender.special = clamp(defender.special + (blocking ? 10 : 7), 0, 100);

    const hitX = defender.x - attacker.facing * 68;
    const hitY = GROUND_Y - 66 - defender.z;
    if (blocking) {
      spawnBurst(hitX, hitY, "#dfe8ef", 12);
      addPopup("BLOCK", hitX, hitY - 16, "#dfe8ef");
      game.shake = Math.max(game.shake, 3);
      audio.sfx("guard", 1);
    } else {
      const comboWindow = game.elapsed - attacker.lastHitAt < 1.45;
      attacker.combo = comboWindow ? attacker.combo + 1 : 1;
      attacker.lastHitAt = game.elapsed;
      spawnBurst(hitX, hitY, attacker.spec.accent, attack.type === "special" ? 24 : 16);
      addPopup(attacker.combo > 1 ? `${attacker.combo} HIT` : "CRASH", hitX, hitY - 22, attacker.spec.accent);
      if (attacker.combo === 3) showBanner("漂亮三连", "气势拉满", 0.62);
      if (attacker.combo === 5) showBanner("暴走连击", "全场沸腾", 0.7);
      game.shake = Math.max(game.shake, attack.type === "special" ? 8 : 5);
      game.hitStop = attack.type === "special" ? 0.045 : 0.03;
      audio.sfx("hit", attack.type === "special" ? 1.35 : 1);
    }

    if (defender.hp <= 0) finishMatch(attacker, "KO");
  }

  function resolveBodyCollision(a, b) {
    const minDistance = (a.width + b.width) * 0.34;
    const dx = b.x - a.x;
    const overlap = minDistance - Math.abs(dx);
    if (overlap <= 0) return;
    const push = overlap * 0.5 * sign(dx || 1);
    a.x = clamp(a.x - push, LEFT_WALL, RIGHT_WALL);
    b.x = clamp(b.x + push, LEFT_WALL, RIGHT_WALL);
    a.vx *= 0.72;
    b.vx *= 0.72;
  }

  function finishByTime() {
    const [p1, p2] = fighters;
    if (p1.hp === p2.hp) {
      finishMatch(null, "DRAW");
      return;
    }
    finishMatch(p1.hp > p2.hp ? p1 : p2, "TIME");
  }

  function finishMatch(winner, reason) {
    if (game.phase === "ko") return;
    game.phase = "ko";
    game.winner = winner;
    game.koTime = 0;
    game.shake = Math.max(game.shake, 12);
    game.flash = 0.9;
    const main = reason === "DRAW" ? "DRAW" : reason === "TIME" ? "TIME UP" : "K.O.";
    const sub = winner ? `${winner.spec.name}  制霸赛道` : "平分秋色";
    showBanner(main, sub, 1.2);
    audio.sfx("ko", 1.4);
  }

  function showResult() {
    const winner = game.winner;
    ui.result.classList.remove("hidden");
    if (!winner) {
      ui.resultKicker.textContent = "DRAW";
      ui.resultTitle.textContent = "势均力敌";
      ui.resultLine.textContent = "这不是结束，是下一次爆燃的铺垫。";
      return;
    }
    const playerWon = winner.control === "p1";
    ui.resultKicker.textContent = playerWon ? "VICTORY" : "RIVAL WINS";
    ui.resultTitle.textContent = playerWon ? "街头制霸" : "再点火";
    ui.resultLine.textContent = playerWon
      ? `${winner.spec.name} 把今晚开成了高光时刻。`
      : `${winner.spec.name} 暂时压过一头，下一局把场子拿回来。`;
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(p.drag, dt);
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function updatePopups(dt) {
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      const p = popups[i];
      p.life -= dt;
      p.y -= 42 * dt;
      if (p.life <= 0) popups.splice(i, 1);
    }
  }

  function spawnBurst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = rand(-Math.PI, Math.PI);
      const speed = rand(90, 520);
      particles.push({
        type: Math.random() > 0.35 ? "spark" : "dot",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(20, 120),
        gravity: 900,
        drag: 0.14,
        size: rand(2, 6),
        color,
        life: rand(0.2, 0.56),
        maxLife: 0.56,
      });
    }
  }

  function spawnDust(x, y, dir, count) {
    for (let i = 0; i < count; i += 1) {
      particles.push({
        type: "smoke",
        x: x + rand(-12, 12),
        y: y + rand(-4, 6),
        vx: -dir * rand(70, 240) + rand(-30, 30),
        vy: rand(-80, -12),
        gravity: rand(-20, 60),
        drag: 0.2,
        size: rand(9, 24),
        color: Math.random() > 0.5 ? "#c7bba3" : "#6f7474",
        life: rand(0.28, 0.62),
        maxLife: 0.62,
      });
    }
  }

  function addPopup(text, x, y, color) {
    popups.push({ text, x, y, color, life: 0.72, maxLife: 0.72 });
  }

  function updateHud() {
    if (fighters.length < 2) return;
    const [p1, p2] = fighters;
    ui.p1Health.style.transform = `scaleX(${clamp(p1.hp / 100, 0, 1)})`;
    ui.p2Health.style.transform = `scaleX(${clamp(p2.hp / 100, 0, 1)})`;
    ui.p1Boost.style.transform = `scaleX(${clamp(p1.boost / 100, 0, 1)})`;
    ui.p2Boost.style.transform = `scaleX(${clamp(p2.boost / 100, 0, 1)})`;
    ui.p1Special.style.transform = `scaleX(${clamp(p1.special / 100, 0, 1)})`;
    ui.p2Special.style.transform = `scaleX(${clamp(p2.special / 100, 0, 1)})`;
    ui.roundTime.textContent = String(Math.ceil(game.roundTime)).padStart(2, "0");
  }

  function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const sx = game.shake > 0 ? rand(-game.shake, game.shake) : 0;
    const sy = game.shake > 0 ? rand(-game.shake * 0.45, game.shake * 0.45) : 0;
    ctx.save();
    ctx.translate(sx, sy);
    drawArena();
    drawParticles("behind");
    drawFighters();
    drawParticles("front");
    drawPopups();
    ctx.restore();
    if (game.flash > 0) {
      ctx.save();
      ctx.globalAlpha = game.flash * 0.16;
      ctx.fillStyle = "#fff6c7";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.restore();
    }
  }

  function drawArena() {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#171314");
    sky.addColorStop(0.36, "#231b18");
    sky.addColorStop(0.74, "#111817");
    sky.addColorStop(1, "#0a0b0c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawMoon();
    drawSkyline();
    drawBillboards();
    drawRoad();
    drawCrowd();
  }

  function drawMoon() {
    ctx.save();
    ctx.globalAlpha = 0.9;
    const glow = ctx.createRadialGradient(1000, 92, 16, 1000, 92, 145);
    glow.addColorStop(0, "rgba(255, 207, 111, 0.62)");
    glow.addColorStop(1, "rgba(255, 207, 111, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(850, 0, 320, 240);
    ctx.fillStyle = "#ffcf6f";
    ctx.beginPath();
    ctx.arc(1002, 94, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSkyline() {
    skyline.forEach((building, index) => {
      const y = 388 - building.height;
      ctx.fillStyle = building.tone;
      ctx.fillRect(building.x, y, building.width, building.height);
      if (building.windows) {
        ctx.fillStyle = index % 3 === 0 ? "rgba(255, 191, 61, 0.46)" : "rgba(59, 231, 255, 0.32)";
        for (let wx = building.x + 10; wx < building.x + building.width - 8; wx += 20) {
          for (let wy = y + 16; wy < 372; wy += 28) {
            if ((wx + wy + index) % 5 !== 0) ctx.fillRect(wx, wy, 7, 12);
          }
        }
      }
    });
  }

  function drawBillboards() {
    drawSign(118, 164, 212, 70, "#ff3d2e", "MIDNIGHT");
    drawSign(522, 122, 180, 58, "#3be7ff", "BOOST");
    drawSign(914, 190, 220, 66, "#ffbf3d", "97 STREET");
  }

  function drawSign(x, y, w, h, color, text) {
    ctx.save();
    ctx.fillStyle = "rgba(8, 9, 10, 0.84)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = "900 23px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    ctx.restore();
  }

  function drawRoad() {
    const floor = ctx.createLinearGradient(0, 388, 0, HEIGHT);
    floor.addColorStop(0, "#24211d");
    floor.addColorStop(1, "#090a0b");
    ctx.fillStyle = floor;
    ctx.fillRect(0, 388, WIDTH, HEIGHT - 388);

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#141414";
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    ctx.lineTo(250, 408);
    ctx.lineTo(1030, 408);
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255, 191, 61, 0.62)";
    ctx.lineWidth = 4;
    ctx.setLineDash([50, 34]);
    ctx.lineDashOffset = -game.elapsed * 120;
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 426);
    ctx.lineTo(WIDTH / 2, HEIGHT);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(59, 231, 255, 0.2)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 11; i += 1) {
      const t = i / 10;
      const y = lerp(420, HEIGHT, t * t);
      ctx.beginPath();
      ctx.moveTo(lerp(250, 0, t), y);
      ctx.lineTo(lerp(1030, WIDTH, t), y);
      ctx.stroke();
    }
    ctx.restore();

    const glow = ctx.createLinearGradient(0, 470, 0, HEIGHT);
    glow.addColorStop(0, "rgba(255, 61, 46, 0)");
    glow.addColorStop(1, "rgba(255, 61, 46, 0.16)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 470, WIDTH, HEIGHT - 470);
  }

  function drawCrowd() {
    ctx.save();
    ctx.fillStyle = "rgba(3, 4, 5, 0.7)";
    for (let i = 0; i < 55; i += 1) {
      const x = i * 25 + ((i * 17) % 11);
      const h = 16 + ((i * 23) % 26);
      ctx.fillRect(x, 374 - h, 11, h);
      ctx.beginPath();
      ctx.arc(x + 5, 371 - h, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFighters() {
    const sorted = [...fighters].sort((a, b) => a.x - b.x);
    sorted.forEach(drawCarShadow);
    sorted.forEach(drawCar);
  }

  function drawCarShadow(fighter) {
    const width = fighter.width * (1 - fighter.z / 900);
    ctx.save();
    ctx.globalAlpha = clamp(0.42 - fighter.z / 700, 0.12, 0.42);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(fighter.x, GROUND_Y + 3, width * 0.48, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCar(fighter) {
    const y = GROUND_Y - fighter.z;
    const alpha = fighter.damageBlink > 0 && Math.floor(game.elapsed * 36) % 2 === 0 ? 0.62 : 1;
    ctx.save();
    ctx.translate(fighter.x, y);
    ctx.scale(fighter.facing, 1);
    ctx.globalAlpha = alpha;

    if (fighter.dashTimer > 0) drawSpeedTrail(fighter);
    if (fighter.guard) drawGuardArc(fighter);
    if (fighter.attack) drawAttackArc(fighter);

    const bodyTop = fighter.spec.shape === "sedan" ? -86 : -80;
    const bodyBottom = -24;
    const half = fighter.width / 2;

    ctx.save();
    ctx.shadowColor = fighter.spec.accent;
    ctx.shadowBlur = fighter.special >= 100 ? 24 : 10;
    const paint = ctx.createLinearGradient(-half, bodyTop, half, bodyBottom);
    paint.addColorStop(0, lighten(fighter.spec.paint, 28));
    paint.addColorStop(0.45, fighter.spec.paint);
    paint.addColorStop(1, darken(fighter.spec.paint, 35));
    ctx.fillStyle = paint;
    ctx.strokeStyle = "rgba(255,255,255,0.34)";
    ctx.lineWidth = 2;
    drawBodyShape(fighter.spec.shape, half, bodyTop, bodyBottom);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawWindows(fighter.spec.shape, half, bodyTop);
    drawLights(fighter, half);
    drawWheels(fighter, half);
    drawDecals(fighter, half);

    if (fighter.hp < 36 && Math.random() > 0.82) {
      spawnDamageSmoke(fighter);
    }

    ctx.restore();
  }

  function drawBodyShape(shape, half, top, bottom) {
    ctx.beginPath();
    if (shape === "sedan") {
      ctx.moveTo(-half + 8, bottom);
      ctx.lineTo(-half + 22, -58);
      ctx.lineTo(-half + 64, top);
      ctx.lineTo(half - 58, top + 3);
      ctx.lineTo(half - 16, -56);
      ctx.lineTo(half + 4, bottom + 2);
    } else if (shape === "wedge") {
      ctx.moveTo(-half + 4, bottom);
      ctx.lineTo(-half + 20, -54);
      ctx.lineTo(-half + 74, -76);
      ctx.lineTo(half - 18, -58);
      ctx.lineTo(half + 7, bottom + 2);
    } else if (shape === "super") {
      ctx.moveTo(-half + 2, bottom);
      ctx.lineTo(-half + 20, -50);
      ctx.lineTo(-half + 60, -74);
      ctx.lineTo(half - 76, -76);
      ctx.lineTo(half - 12, -53);
      ctx.lineTo(half + 7, bottom + 1);
    } else if (shape === "sport") {
      ctx.moveTo(-half + 5, bottom);
      ctx.lineTo(-half + 20, -50);
      ctx.quadraticCurveTo(-half + 70, -89, -12, -78);
      ctx.quadraticCurveTo(half - 40, -70, half - 8, -47);
      ctx.lineTo(half + 5, bottom + 1);
    } else {
      ctx.moveTo(-half + 4, bottom);
      ctx.lineTo(-half + 22, -56);
      ctx.lineTo(-half + 70, -80);
      ctx.lineTo(half - 58, -76);
      ctx.lineTo(half - 14, -52);
      ctx.lineTo(half + 4, bottom + 1);
    }
    ctx.closePath();
  }

  function drawWindows(shape, half, top) {
    ctx.save();
    const glass = ctx.createLinearGradient(-40, top, 60, -35);
    glass.addColorStop(0, "rgba(232, 255, 255, 0.92)");
    glass.addColorStop(1, "rgba(30, 45, 48, 0.74)");
    ctx.fillStyle = glass;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (shape === "sedan") {
      ctx.moveTo(-58, -76);
      ctx.lineTo(-22, -84);
      ctx.lineTo(38, -82);
      ctx.lineTo(64, -60);
      ctx.lineTo(-70, -59);
    } else {
      ctx.moveTo(-48, -69);
      ctx.lineTo(-12, -79);
      ctx.lineTo(54, -66);
      ctx.lineTo(70, -52);
      ctx.lineTo(-64, -53);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawLights(fighter, half) {
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = fighter.spec.accent;
    ctx.fillStyle = fighter.spec.accent;
    ctx.beginPath();
    ctx.roundRect(half - 17, -47, 22, 8, 4);
    ctx.fill();
    ctx.shadowColor = "#ff2d22";
    ctx.fillStyle = "#ff2d22";
    ctx.beginPath();
    ctx.roundRect(-half + 3, -49, 14, 10, 3);
    ctx.fill();
    ctx.restore();
  }

  function drawWheels(fighter, half) {
    [-half + 45, half - 45].forEach((x) => {
      ctx.save();
      ctx.translate(x, -17);
      ctx.fillStyle = "#070809";
      ctx.beginPath();
      ctx.arc(0, 0, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.24)";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = fighter.spec.accent;
      ctx.lineWidth = 2;
      ctx.rotate(game.elapsed * 6 * fighter.facing);
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos((Math.PI * 2 * i) / 5) * 15, Math.sin((Math.PI * 2 * i) / 5) * 15);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  function drawDecals(fighter, half) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-half + 28, -53);
    ctx.lineTo(half - 28, -55);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(-18, -50, 38, 18);
    ctx.fillStyle = "#fff8dc";
    ctx.font = "900 13px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.fillText(fighter.spec.id.toUpperCase().slice(0, 3), 1, -37);
    ctx.restore();
  }

  function drawSpeedTrail(fighter) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = fighter.spec.accent;
    ctx.lineWidth = 8;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-fighter.width * 0.55 - i * 25, -38 + i * 8);
      ctx.lineTo(-fighter.width * 0.95 - i * 44, -38 + i * 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGuardArc(fighter) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(231, 245, 255, 0.72)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(fighter.width * 0.34, -54, 70, -1.05, 1.05);
    ctx.stroke();
    ctx.restore();
  }

  function drawAttackArc(fighter) {
    const attack = fighter.attack;
    const progress = attack.timer / attack.duration;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (attack.type === "special") {
      ctx.strokeStyle = fighter.spec.accent;
      ctx.lineWidth = 9;
      for (let i = 0; i < 3; i += 1) {
        ctx.globalAlpha = clamp(1 - progress + i * 0.14, 0.2, 0.85);
        ctx.beginPath();
        ctx.arc(fighter.width * 0.5 + i * 22, -52, 62 + progress * 130 + i * 18, -0.85, 0.85);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = "#fff2bf";
      ctx.lineWidth = 7;
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.arc(fighter.width * 0.46, -50, 76 + progress * 22, -0.9, 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function spawnDamageSmoke(fighter) {
    particles.push({
      type: "smoke",
      x: fighter.x - fighter.facing * (fighter.width * 0.45),
      y: GROUND_Y - 74 - fighter.z,
      vx: -fighter.facing * rand(18, 80),
      vy: rand(-42, -12),
      gravity: -24,
      drag: 0.32,
      size: rand(12, 24),
      color: "#5b6062",
      life: rand(0.48, 0.8),
      maxLife: 0.8,
    });
  }

  function drawParticles(layer) {
    particles.forEach((p) => {
      const front = p.type !== "smoke";
      if ((layer === "front") !== front) return;
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      if (p.type === "spark") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawPopups() {
    popups.forEach((p) => {
      ctx.save();
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = "900 28px Segoe UI, Arial";
      ctx.textAlign = "center";
      ctx.lineWidth = 7;
      ctx.strokeStyle = "rgba(0,0,0,0.72)";
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    });
  }

  function lighten(hex, amount) {
    return adjustColor(hex, amount);
  }

  function darken(hex, amount) {
    return adjustColor(hex, -amount);
  }

  function adjustColor(hex, amount) {
    const raw = hex.replace("#", "");
    const value = Number.parseInt(raw, 16);
    const r = clamp((value >> 16) + amount, 0, 255);
    const g = clamp(((value >> 8) & 255) + amount, 0, 255);
    const b = clamp((value & 255) + amount, 0, 255);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function init() {
    audio = new AudioEngine();
    buildRoster();
    bindUi();
    fighters = [
      createFighter(roster[selectedIndex], "p1", LEFT_WALL + 230, 1),
      createFighter(roster[rivalIndex], "cpu", RIGHT_WALL - 230, -1),
    ];
    updateMusicButton();
    updateHud();
    window.requestAnimationFrame(loop);
    window.__turboRing97 = {
      startMatch,
      getState: () => ({
        phase: game.phase,
        roundTime: game.roundTime,
        p1: fighters[0] && { hp: fighters[0].hp, boost: fighters[0].boost, special: fighters[0].special },
        p2: fighters[1] && { hp: fighters[1].hp, boost: fighters[1].boost, special: fighters[1].special },
      }),
    };
  }

  init();
})();
