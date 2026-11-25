(function () {
  const Q = (window.Qadha = window.Qadha || {});

  function mount(container, options) {
    const level = Q.adventure.runnerLevels[options.level - 1] || Q.adventure.runnerLevels[0];
    container.innerHTML = `
      <section class="play-shell runner-shell" aria-label="لعبة Budget Dash">
        <header class="play-hud">
          <button class="round-game-button" data-game-exit aria-label="الخروج">×</button>
          <div class="hud-level"><small>Budget Dash · المستوى ${level.level}</small><b>${level.name}</b></div>
          <div class="hud-stat"><span>المسافة</span><b data-run-distance>0 / ${level.target}</b></div>
          <div class="hud-stat"><span>النقاط</span><b data-run-score>0</b></div>
          <button class="round-game-button" data-run-pause aria-label="إيقاف مؤقت">Ⅱ</button>
        </header>
        <div class="runner-stage">
          <canvas data-runner-canvas tabindex="0" aria-label="مسار جري من ثلاث حارات. استخدمي الأسهم للحركة والقفز والانزلاق."></canvas>
          <div class="runner-tip" data-run-tip><span>🦉</span><b>لوما</b><p>الأسهم للحركة · ↑ للقفز · ↓ للانزلاق</p></div>
          <div class="game-overlay hidden" data-run-overlay></div>
        </div>
        <div class="mobile-game-controls runner-controls" aria-label="أزرار التحكم">
          <button data-run-control="right" aria-label="يمين">→</button>
          <button data-run-control="jump" aria-label="قفز">↑</button>
          <button data-run-control="slide" aria-label="انزلاق">↓</button>
          <button data-run-control="left" aria-label="يسار">←</button>
        </div>
        <footer class="play-legend"><span>⭐ نجمة ادخار</span><span>🪙 اختيار ذكي</span><span>🛡️ درع طوارئ</span><span>🛒 فخ صرف</span></footer>
      </section>`;

    const canvas = container.querySelector("[data-runner-canvas]");
    const context = canvas.getContext("2d");
    const overlay = container.querySelector("[data-run-overlay]");
    const distanceNode = container.querySelector("[data-run-distance]");
    const scoreNode = container.querySelector("[data-run-score]");
    const tip = container.querySelector("[data-run-tip]");
    let width = 900;
    let height = 500;
    let raf = 0;
    let lastTime = performance.now();
    let spawnClock = 0;
    let rewardClock = 400;
    let destroyed = false;
    let running = true;
    let completionSent = false;
    let touchStart = null;
    const events = new AbortController();
    const state = {
      lane: 1,
      visualLane: 1,
      jumpY: 0,
      jumpVelocity: 0,
      sliding: 0,
      score: 0,
      distance: 0,
      lives: 3,
      paused: false,
      complete: false,
      checkpoint: 0,
      obstacles: [],
      rewards: [],
      collected: { stars: 0, tokens: 0, shields: 0 },
    };

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(600, rect.width || 900);
      height = Math.max(360, rect.height || 500);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function laneY(lane) {
      return height * 0.53 + lane * (height * 0.13);
    }

    function move(direction) {
      if (destroyed || state.paused || state.complete) return;
      if (direction === "left") state.lane = Math.min(2, state.lane + 1);
      if (direction === "right") state.lane = Math.max(0, state.lane - 1);
      if (direction === "jump" && state.jumpY === 0) state.jumpVelocity = 14;
      if (direction === "slide" && state.jumpY === 0) state.sliding = 34;
      Q.sound.move();
    }

    function spawnObstacle() {
      const types = ["cart", "bill", "barrier", "banner", "subscription"];
      state.obstacles.push({
        x: width + 70,
        lane: Math.floor(Math.random() * 3),
        type: types[Math.floor(Math.random() * types.length)],
        hit: false,
      });
    }

    function spawnReward() {
      const types = ["star", "token", "shield"];
      state.rewards.push({
        x: width + 70,
        lane: Math.floor(Math.random() * 3),
        type: types[Math.floor(Math.random() * types.length)],
        taken: false,
      });
    }

    function collision(item, isReward) {
      if (item.lane !== state.lane || item.x < width * 0.12 || item.x > width * 0.26) return false;
      if (isReward) return state.jumpY < 78;
      if (item.type === "barrier" && state.jumpY > 48) return false;
      if (item.type === "banner" && state.sliding > 0) return false;
      return state.jumpY < 70;
    }

    function update(delta) {
      if (state.paused || state.complete) return;
      const factor = Math.min(2.2, delta / 16.67);
      const speed = level.speed * factor;
      state.visualLane = options.reduceMotion ? state.lane : state.visualLane + (state.lane - state.visualLane) * 0.18 * factor;
      if (state.jumpVelocity || state.jumpY > 0) {
        state.jumpY += state.jumpVelocity * factor;
        state.jumpVelocity -= 0.78 * factor;
        if (state.jumpY <= 0) { state.jumpY = 0; state.jumpVelocity = 0; }
      }
      if (state.sliding > 0) state.sliding -= factor;
      state.distance += level.speed * 0.095 * factor;
      spawnClock += delta;
      rewardClock += delta;
      if (spawnClock > level.spawn) { spawnObstacle(); spawnClock = 0; }
      if (rewardClock > 780) { spawnReward(); rewardClock = 0; }
      state.obstacles.forEach((item) => {
        item.x -= speed * 1.65;
        if (!item.hit && collision(item, false)) {
          item.hit = true;
          state.lives -= 1;
          state.score = Math.max(0, state.score - 35);
          Q.sound.fail();
          flashTip("خدي بالك! غيري الحارة أو استخدمي الحركة المناسبة.", "warn");
        }
      });
      state.rewards.forEach((item) => {
        item.x -= speed * 1.55;
        if (!item.taken && collision(item, true)) {
          item.taken = true;
          state.score += item.type === "shield" ? 35 : 20;
          state.collected[`${item.type}s`] += 1;
          if (item.type === "shield" && state.lives < 3) state.lives += 1;
          Q.sound.collect();
        }
      });
      state.obstacles = state.obstacles.filter((item) => item.x > -90);
      state.rewards = state.rewards.filter((item) => item.x > -70);
      const nextCheckpoint = (state.checkpoint + 1) / (level.checkpoints + 1);
      if (state.checkpoint < level.checkpoints && state.distance >= level.target * nextCheckpoint) showCheckpoint();
      if (state.lives <= 0) finish(false);
      if (state.distance >= level.target) finish(true);
      distanceNode.textContent = `${Math.floor(state.distance)} / ${level.target}`;
      scoreNode.textContent = state.score;
    }

    function flashTip(message, type = "") {
      tip.className = `runner-tip show ${type}`;
      tip.querySelector("p").textContent = message;
      clearTimeout(flashTip.timer);
      flashTip.timer = setTimeout(() => tip.classList.remove("show"), 1900);
    }

    function showCheckpoint() {
      state.paused = true;
      const scenario = Q.games.budget.scenarios[state.checkpoint % Q.games.budget.scenarios.length];
      state.checkpoint += 1;
      overlay.classList.remove("hidden");
      overlay.innerHTML = `<div class="checkpoint-card"><div class="luma-mini">${lumaFace("thinking")}</div><span>نقطة قرار</span><h2>${scenario.title}</h2><p>${scenario.story}</p><div class="checkpoint-choices">${scenario.choices.map((choice, index) => `<button data-run-choice="${index}">${choice.text}</button>`).join("")}</div><div data-run-feedback></div></div>`;
      overlay.querySelectorAll("[data-run-choice]").forEach((button) => button.addEventListener("click", () => {
        if (destroyed) return;
        const choice = scenario.choices[Number(button.dataset.runChoice)];
        overlay.querySelectorAll("button").forEach((item) => { item.disabled = true; });
        if (choice.score >= 3) { state.score += 80; Q.sound.success(); } else Q.sound.fail();
        overlay.querySelector("[data-run-feedback]").innerHTML = `<div class="game-feedback ${choice.score >= 3 ? "good" : "learn"}"><b>${choice.score >= 3 ? "اختيار ذكي!" : "كل غلطة فرصة نتعلم"}</b><p>${choice.feedback}</p><button data-run-continue>كمّلي الجري ←</button></div>`;
        overlay.querySelector("[data-run-continue]").addEventListener("click", () => {
          if (destroyed) return;
          overlay.classList.add("hidden");
          state.paused = false;
          lastTime = performance.now();
        }, { signal: events.signal });
      }, { signal: events.signal }));
    }

    function finish(won) {
      if (destroyed || completionSent || state.complete) return;
      completionSent = true;
      state.complete = true;
      state.paused = true;
      running = false;
      cancelAnimationFrame(raf);
      overlay.classList.remove("hidden");
      const xp = won ? 45 + level.level * 5 : 10;
      overlay.innerHTML = `<div class="level-result"><div class="luma-celebrate">${lumaFace(won ? "celebrate" : "encourage")}</div><span>${won ? "المستوى اكتمل!" : "المحاولة خلصت"}</span><h2>${won ? "جري قدّها!" : "نجرب بخطة أهدى؟"}</h2><div class="result-strip"><div><b>${state.score}</b><small>نقطة</small></div><div><b>${Math.floor(state.distance)}</b><small>مسافة</small></div><div><b>${state.collected.stars + state.collected.tokens + state.collected.shields}</b><small>مقتنيات</small></div><div><b>+${xp}</b><small>XP</small></div></div><p>${won ? "رتّبتي اختياراتك ووصلتي لنهاية الطريق." : "استخدمي الحارات والقفز والانزلاق حسب نوع الفخ."}</p><div class="level-result-actions"><button data-run-retry>العبي تاني</button>${won && level.level < 5 ? `<button class="primary" data-run-next>المستوى التالي</button>` : ""}<button data-run-map>الخريطة</button></div></div>`;
      if (won) Q.sound.success(); else Q.sound.fail();
      const result = { game: "runner", won, level: level.level, score: state.score, xp, ...state.collected, distance: Math.floor(state.distance) };
      options.onFinish(result);
      overlay.querySelector("[data-run-retry]").addEventListener("click", () => options.onReplay(level.level), { signal: events.signal });
      overlay.querySelector("[data-run-next]")?.addEventListener("click", () => options.onReplay(level.level + 1), { signal: events.signal });
      overlay.querySelector("[data-run-map]").addEventListener("click", options.onExit, { signal: events.signal });
    }

    function drawBackground() {
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#FAF0EA";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#DDE5D8";
      context.beginPath(); context.arc(width * .12, height * .16, 85, 0, Math.PI * 2); context.fill();
      context.beginPath(); context.arc(width * .78, height * .12, 110, 0, Math.PI * 2); context.fill();
      const offset = options.reduceMotion ? 0 : (state.distance * 3.2) % 180;
      for (let x = -180 - offset; x < width + 180; x += 180) {
        const colors = ["#E8C4B8", "#A8B8A0", "#B8A99A"];
        context.fillStyle = colors[Math.abs(Math.floor(x / 180)) % colors.length];
        roundRect(context, x, height * .22, 130, height * .23, 12, true);
        context.fillStyle = "#FAF0EA";
        context.fillRect(x + 22, height * .29, 25, 35);
        context.fillRect(x + 77, height * .29, 25, 35);
        context.fillStyle = "#7A8E72";
        context.fillRect(x - 8, height * .2, 146, 14);
      }
      context.fillStyle = "#C6B8AA";
      context.fillRect(0, height * .48, width, height * .52);
      context.strokeStyle = "rgba(250,240,234,.7)";
      context.lineWidth = 2;
      for (let lane = 0; lane < 3; lane += 1) {
        context.setLineDash([22, 20]);
        context.beginPath(); context.moveTo(0, laneY(lane) + 28); context.lineTo(width, laneY(lane) + 28); context.stroke();
      }
      context.setLineDash([]);
    }

    function drawPlayer() {
      const x = width * .18;
      const y = laneY(state.visualLane) - state.jumpY;
      context.save();
      context.translate(x, y);
      if (state.sliding > 0) context.scale(1.25, .58);
      context.fillStyle = "#30362F";
      context.beginPath(); context.arc(0, -28, 20, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#E8C4B8";
      context.beginPath(); context.arc(0, -23, 15, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#7A8E72";
      roundRect(context, -18, -8, 36, 39, 11, true);
      context.fillStyle = "#30362F";
      context.fillRect(-15, 28, 11, 17); context.fillRect(5, 28, 11, 17);
      context.fillStyle = "#FAF0EA";
      context.beginPath(); context.arc(-5, -25, 2, 0, Math.PI * 2); context.arc(5, -25, 2, 0, Math.PI * 2); context.fill();
      context.restore();
      context.fillStyle = "#30362F";
      context.font = "bold 13px Segoe UI";
      context.fillText(`❤ ${state.lives}`, 24, 35);
    }

    function drawItem(item, reward) {
      const y = laneY(item.lane);
      context.save(); context.translate(item.x, y);
      context.font = `${reward ? 30 : 35}px Segoe UI Emoji`;
      context.textAlign = "center";
      const symbols = reward ? { star: "⭐", token: "🪙", shield: "🛡️" } : { cart: "🛒", bill: "🧾", barrier: "🚧", banner: "🏷️", subscription: "📺" };
      context.fillText(symbols[item.type], 0, 0);
      context.restore();
    }

    function draw() {
      drawBackground();
      state.rewards.filter((item) => !item.taken).forEach((item) => drawItem(item, true));
      state.obstacles.filter((item) => !item.hit).forEach((item) => drawItem(item, false));
      drawPlayer();
    }

    function frame(time) {
      if (destroyed || !running) return;
      const delta = time - lastTime;
      lastTime = time;
      update(delta);
      draw();
      if (!destroyed && running && !state.complete) raf = requestAnimationFrame(frame);
    }

    function keydown(event) {
      const keys = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "jump", Space: "jump", " ": "jump", ArrowDown: "slide" };
      if (keys[event.key] || keys[event.code]) {
        event.preventDefault();
        move(keys[event.key] || keys[event.code]);
      }
    }

    container.querySelectorAll("[data-run-control]").forEach((button) => button.addEventListener("pointerdown", () => move(button.dataset.runControl), { signal: events.signal }));
    container.querySelector("[data-run-pause]").addEventListener("click", (event) => {
      state.paused = !state.paused;
      event.currentTarget.textContent = state.paused ? "▶" : "Ⅱ";
      flashTip(state.paused ? "اللعبة واقفة. خدي وقتك." : "يلا نكمل!", "");
    }, { signal: events.signal });
    container.querySelector("[data-game-exit]").addEventListener("click", options.onExit, { signal: events.signal });
    canvas.addEventListener("pointerdown", (event) => { touchStart = { x: event.clientX, y: event.clientY }; }, { signal: events.signal });
    canvas.addEventListener("pointerup", (event) => {
      if (!touchStart) return;
      const dx = event.clientX - touchStart.x;
      const dy = event.clientY - touchStart.y;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 25) move(dx > 0 ? "right" : "left");
      else if (dy < -25) move("jump");
      else if (dy > 25) move("slide");
      touchStart = null;
    }, { signal: events.signal });
    window.addEventListener("keydown", keydown, { passive: false, signal: events.signal });
    window.addEventListener("resize", resize, { signal: events.signal });
    resize();
    flashTip("ابدئي بهدوء، واجمعي النجوم والاختيارات الذكية.");
    raf = requestAnimationFrame(frame);

    const api = {
      state,
      move,
      get destroyed() { return destroyed; },
      debugComplete() { if (!destroyed) state.distance = level.target; },
      debugFail() { if (!destroyed) { state.lives = 0; finish(false); } },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        running = false;
        events.abort();
        clearTimeout(flashTip.timer);
        cancelAnimationFrame(raf);
        if (Q.activeEngine === api) Q.activeEngine = null;
      },
    };
    Q.activeEngine = api;
    return api;
  }

  function roundRect(ctx, x, y, width, height, radius, fill) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    if (fill) ctx.fill();
  }

  function lumaFace(expression) {
    return `<div class="luma luma-${expression}"><i class="ear one"></i><i class="ear two"></i><div class="luma-body"><span class="eye one"><b></b></span><span class="eye two"><b></b></span><em></em><u>ق</u></div><div class="luma-bag"></div></div>`;
  }

  Q.runnerGame = { mount };
  Q.lumaFace = lumaFace;
})();
