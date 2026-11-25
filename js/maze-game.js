(function () {
  const Q = (window.Qadha = window.Qadha || {});

  function seededRandom(seed) {
    let value = seed * 9301 + 49297;
    return () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  }

  function createMaze(size, seed) {
    const random = seededRandom(seed);
    const grid = Array.from({ length: size }, () => Array(size).fill(1));
    const stack = [[1, 1]];
    grid[1][1] = 0;
    while (stack.length) {
      const [row, col] = stack[stack.length - 1];
      const dirs = [[-2, 0], [2, 0], [0, -2], [0, 2]].sort(() => random() - .5);
      const next = dirs.find(([dr, dc]) => {
        const nr = row + dr; const nc = col + dc;
        return nr > 0 && nr < size - 1 && nc > 0 && nc < size - 1 && grid[nr][nc] === 1;
      });
      if (!next) { stack.pop(); continue; }
      const [dr, dc] = next;
      grid[row + dr / 2][col + dc / 2] = 0;
      grid[row + dr][col + dc] = 0;
      stack.push([row + dr, col + dc]);
    }
    return grid;
  }

  function mount(container, options) {
    const level = Q.adventure.mazeLevels[options.level - 1] || Q.adventure.mazeLevels[0];
    const grid = createMaze(level.size, level.level * 41 + 7);
    const openCells = [];
    grid.forEach((row, r) => row.forEach((cell, c) => { if (cell === 0 && !(r === 1 && c === 1)) openCells.push([r, c]); }));
    const exit = [...openCells].sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]))[0];
    const clueCells = [];
    for (let index = 0; index < level.clues; index += 1) {
      const candidate = openCells[Math.floor((openCells.length / (level.clues + 1)) * (index + 1))];
      if (candidate && candidate !== exit) clueCells.push(candidate);
    }
    const verification = openCells[Math.floor(openCells.length * .62)];
    const reward = openCells[Math.floor(openCells.length * .78)];
    const state = { row: 1, col: 1, moves: 0, clues: 0, correct: 0, stars: 0, paused: false, complete: false, found: new Set() };

    container.innerHTML = `<section class="play-shell maze-shell" aria-label="لعبة Scam Hunter">
      <header class="play-hud"><button class="round-game-button" data-game-exit>×</button><div class="hud-level"><small>Scam Hunter · المستوى ${level.level}</small><b>${level.name}</b></div><div class="hud-stat"><span>الأدلة</span><b data-maze-clues>0 / ${level.clues}</b></div><div class="hud-stat"><span>الخطوات</span><b data-maze-moves>0</b></div><button class="round-game-button" data-maze-hint>?</button></header>
      <div class="maze-layout"><aside class="maze-story"><div class="luma-guide">${Q.lumaFace("thinking")}</div><span>رسالة من لوما</span><h2>اختاري الطريق الموثّق</h2><p data-maze-message>اجمعي أدلة كفاية قبل ما تفتحي بوابة الخروج.</p><div class="clue-meter">${Array.from({ length: level.clues }, (_, index) => `<i data-clue-dot="${index}">?</i>`).join("")}</div><div class="maze-key"><span><i class="key-clue">!</i> دليل مشبوه</span><span><i class="key-safe">✓</i> محطة تحقق</span><span><i class="key-exit">◆</i> بوابة الخروج</span></div></aside><div class="maze-board-wrap"><div class="maze-board" data-maze-board role="grid" aria-label="متاهة مدينة الخداع"></div><div class="game-overlay hidden" data-maze-overlay></div></div></div>
      <div class="mobile-game-controls maze-controls"><span></span><button data-maze-move="up">↑</button><span></span><button data-maze-move="left">←</button><button data-maze-move="down">↓</button><button data-maze-move="right">→</button></div>
    </section>`;

    const board = container.querySelector("[data-maze-board]");
    const overlay = container.querySelector("[data-maze-overlay]");
    const message = container.querySelector("[data-maze-message]");
    const cluesNode = container.querySelector("[data-maze-clues]");
    const movesNode = container.querySelector("[data-maze-moves]");
    let destroyed = false;
    let completionSent = false;
    const events = new AbortController();

    function keyFor(row, col) { return `${row}:${col}`; }
    function same(cell, row, col) { return cell && cell[0] === row && cell[1] === col; }

    function render() {
      board.style.setProperty("--maze-size", level.size);
      const cells = [];
      for (let row = 0; row < level.size; row += 1) {
        for (let col = 0; col < level.size; col += 1) {
          const isPlayer = state.row === row && state.col === col;
          const clueIndex = clueCells.findIndex((cell) => same(cell, row, col));
          const found = state.found.has(keyFor(row, col));
          let type = grid[row][col] === 1 ? "wall" : "path";
          let content = "";
          if (clueIndex >= 0 && !found) { type += " clue"; content = "!"; }
          if (same(verification, row, col)) { type += " verify"; content = "✓"; }
          if (same(reward, row, col) && !found) { type += " maze-reward"; content = "★"; }
          if (same(exit, row, col)) { type += " exit"; content = state.clues >= level.clues ? "◆" : "🔒"; }
          if (isPlayer) { type += " player"; content = `<span class="maze-avatar">${options.avatarFace || "ن"}</span>`; }
          cells.push(`<div class="maze-cell ${type}" role="gridcell" data-row="${row}" data-col="${col}">${content}</div>`);
        }
      }
      board.innerHTML = cells.join("");
      cluesNode.textContent = `${state.clues} / ${level.clues}`;
      movesNode.textContent = state.moves;
      container.querySelectorAll("[data-clue-dot]").forEach((dot, index) => { dot.textContent = index < state.clues ? "✓" : "?"; dot.classList.toggle("found", index < state.clues); });
    }

    function move(direction) {
      if (destroyed || state.paused || state.complete) return;
      const dirs = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
      const [dr, dc] = dirs[direction];
      const nr = state.row + dr; const nc = state.col + dc;
      if (!grid[nr] || grid[nr][nc] !== 0) { Q.sound.fail(); message.textContent = "الطريق ده مقفول. جربي اتجاه تاني."; return; }
      state.row = nr; state.col = nc; state.moves += 1; Q.sound.move();
      const key = keyFor(nr, nc);
      if (clueCells.some((cell) => same(cell, nr, nc)) && !state.found.has(key)) inspectClue(key);
      else if (same(verification, nr, nc)) { message.textContent = "محطة موثّقة: افتحي التطبيق أو الموقع الرسمي بنفسك."; Q.sound.clue(); }
      else if (same(reward, nr, nc) && !state.found.has(key)) { state.found.add(key); state.stars += 1; message.textContent = "لقيتي نجمة أمان مخفية!"; Q.sound.collect(); }
      else if (same(exit, nr, nc)) {
        if (state.clues >= level.clues) finish();
        else { message.textContent = `البوابة محتاجة ${level.clues - state.clues} دليل كمان.`; Q.sound.fail(); }
      }
      render();
    }

    function inspectClue(key) {
      if (destroyed) return;
      state.paused = true;
      const scenario = Q.games.scam.scenarios[state.clues % Q.games.scam.scenarios.length];
      overlay.classList.remove("hidden");
      overlay.innerHTML = `<div class="checkpoint-card scam-clue-card"><span>محطة رسالة مشبوهة</span><div class="fake-message"><b>${scenario.sender}</b><p>${scenario.message}</p></div><h3>إيه التصرف الآمن؟</h3><div class="checkpoint-choices">${scenario.choices.map((choice, index) => `<button data-maze-choice="${index}">${choice.text}</button>`).join("")}</div><div data-maze-feedback></div></div>`;
      overlay.querySelectorAll("[data-maze-choice]").forEach((button) => button.addEventListener("click", () => {
        if (destroyed) return;
        const choice = scenario.choices[Number(button.dataset.mazeChoice)];
        overlay.querySelectorAll("[data-maze-choice]").forEach((item) => { item.disabled = true; });
        const correct = choice.score >= 3;
        if (correct) { state.correct += 1; Q.sound.success(); } else Q.sound.fail();
        state.clues += 1;
        state.found.add(key);
        options.onEvent?.({ type: "clue", amount: 1 });
        overlay.querySelector("[data-maze-feedback]").innerHTML = `<div class="game-feedback ${correct ? "good" : "learn"}"><b>${correct ? "شاطرة! اكتشفتي الفخ" : "الدليل اتحفظ وهنكمل نتعلم"}</b><p>${choice.feedback}</p><div class="warning-tags">${scenario.signs.map((sign) => `<span>⚑ ${sign}</span>`).join("")}</div><button data-maze-continue>افتحي الطريق ←</button></div>`;
        overlay.querySelector("[data-maze-continue]").addEventListener("click", () => { if (destroyed) return; overlay.classList.add("hidden"); state.paused = false; message.textContent = "الدليل اتسجل. كمّلي للبوابة."; render(); }, { signal: events.signal });
      }, { signal: events.signal }));
    }

    function finish() {
      if (destroyed || completionSent || state.complete) return;
      completionSent = true;
      state.complete = true; state.paused = true;
      const score = Math.max(100, level.level * 120 + state.correct * 100 + state.stars * 50 - state.moves);
      const xp = 45 + level.level * 5;
      overlay.classList.remove("hidden");
      overlay.innerHTML = `<div class="level-result"><div class="luma-celebrate">${Q.lumaFace("celebrate")}</div><span>الطريق آمن</span><h2>وصلتي بوابة التحقق!</h2><div class="result-strip"><div><b>${score}</b><small>نقطة</small></div><div><b>${state.clues}</b><small>أدلة</small></div><div><b>${state.moves}</b><small>خطوات</small></div><div><b>+${xp}</b><small>XP</small></div></div><p>افتكري: اقفلي الرسالة المشبوهة وارجعي للمصدر الرسمي بنفسك.</p><div class="level-result-actions"><button data-maze-retry>العبي تاني</button>${level.level < 5 ? `<button class="primary" data-maze-next>المستوى التالي</button>` : ""}<button data-maze-map>الخريطة</button></div></div>`;
      Q.sound.success();
      options.onFinish({ game: "maze", won: true, level: level.level, score, xp, clues: state.clues, stars: state.stars });
      overlay.querySelector("[data-maze-retry]").addEventListener("click", () => options.onReplay(level.level), { signal: events.signal });
      overlay.querySelector("[data-maze-next]")?.addEventListener("click", () => options.onReplay(level.level + 1), { signal: events.signal });
      overlay.querySelector("[data-maze-map]").addEventListener("click", options.onExit, { signal: events.signal });
    }

    function keydown(event) {
      const keys = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
      if (keys[event.key]) { event.preventDefault(); move(keys[event.key]); }
    }

    container.querySelectorAll("[data-maze-move]").forEach((button) => button.addEventListener("click", () => move(button.dataset.mazeMove), { signal: events.signal }));
    container.querySelector("[data-maze-hint]").addEventListener("click", () => { message.textContent = state.clues < level.clues ? "دوري على علامة ! وافحصي الرسالة قبل البوابة." : "الأدلة كاملة. اتجهي للرمز ◆."; Q.sound.clue(); }, { signal: events.signal });
    container.querySelector("[data-game-exit]").addEventListener("click", options.onExit, { signal: events.signal });
    window.addEventListener("keydown", keydown, { passive: false, signal: events.signal });
    render();
    Q.activeEngine = {
      state,
      move,
      get destroyed() { return destroyed; },
      debugClue() { if (!destroyed) options.onEvent?.({ type: "clue", amount: 1 }); },
      debugComplete() { if (!destroyed) { state.clues = level.clues; state.correct = level.clues; state.row = exit[0]; state.col = exit[1]; finish(); } },
      destroy() { if (destroyed) return; destroyed = true; events.abort(); if (Q.activeEngine === this) Q.activeEngine = null; },
    };
    return Q.activeEngine;
  }

  Q.mazeGame = { mount };
})();
