(function () {
  const Q = (window.Qadha = window.Qadha || {});
  const symbols = ["🌱", "🍃", "💧", "☀️", "🏺"];
  const names = ["بذرة", "ورقة", "مياه", "شمس", "حصالة"];

  function mount(container, options) {
    const level = Q.adventure.matchLevels[options.level - 1] || Q.adventure.matchLevels[0];
    const count = level.size * level.size;
    const state = { board: [], selected: -1, moves: level.moves, score: 0, combo: 0, paused: false, complete: false, challenges: 0, stars: 0 };
    let destroyed = false;
    let completionSent = false;
    let tileEvents = new AbortController();
    let overlayEvents = new AbortController();
    const persistentEvents = new AbortController();
    const pendingWaits = new Set();

    container.innerHTML = `<section class="play-shell match-shell" aria-label="لعبة Grow Your Goal">
      <header class="play-hud"><button class="round-game-button" data-game-exit>×</button><div class="hud-level"><small>Grow Your Goal · المستوى ${level.level}</small><b>${level.name}</b></div><div class="hud-stat"><span>الحركات</span><b data-match-moves>${state.moves}</b></div><div class="hud-stat"><span>الهدف</span><b data-match-score>0 / ${level.target}</b></div><button class="round-game-button" data-match-help>?</button></header>
      <div class="match-layout"><aside class="garden-panel"><div class="garden-scene" data-garden-stage="0"><div class="garden-sun">☀</div><div class="garden-cloud one"></div><div class="garden-cloud two"></div><div class="garden-plant"><i></i><b></b><span></span><em></em></div><div class="garden-ground"></div></div><span>حديقة هدفك</span><h2 data-garden-title>أول بذرة</h2><p data-garden-message>طابقي 3 رموز جنب بعض، وخلي الهدف يكبر خطوة خطوة.</p><div class="goal-meter"><i data-goal-fill></i></div><div class="match-legend">${symbols.slice(0, 5).map((symbol, index) => `<span>${symbol} ${names[index]}</span>`).join("")}</div></aside><div class="match-board-wrap"><div class="match-board" data-match-board role="grid" aria-label="شبكة مطابقة رموز الادخار"></div><div class="game-overlay hidden" data-match-overlay></div></div></div>
    </section>`;

    const boardNode = container.querySelector("[data-match-board]");
    const overlay = container.querySelector("[data-match-overlay]");
    const movesNode = container.querySelector("[data-match-moves]");
    const scoreNode = container.querySelector("[data-match-score]");
    const goalFill = container.querySelector("[data-goal-fill]");
    const gardenScene = container.querySelector(".garden-scene");
    const gardenTitle = container.querySelector("[data-garden-title]");
    const gardenMessage = container.querySelector("[data-garden-message]");

    function randomTile() { return Math.floor(Math.random() * 5); }
    function row(index) { return Math.floor(index / level.size); }
    function col(index) { return index % level.size; }
    function adjacent(a, b) { return Math.abs(row(a) - row(b)) + Math.abs(col(a) - col(b)) === 1; }
    function swap(a, b) { [state.board[a], state.board[b]] = [state.board[b], state.board[a]]; }

    function initialize() {
      for (let attempt = 0; attempt < 500; attempt += 1) {
        const nextBoard = [];
        for (let index = 0; index < count; index += 1) {
          let value = randomTile();
          while ((col(index) >= 2 && nextBoard[index - 1] === value && nextBoard[index - 2] === value) || (row(index) >= 2 && nextBoard[index - level.size] === value && nextBoard[index - level.size * 2] === value)) value = randomTile();
          nextBoard.push(value);
        }
        state.board = nextBoard;
        if (findValidSwap()) return;
      }
      state.board = Array.from({ length: count }, (_, index) => (row(index) * 2 + col(index)) % symbols.length);
      state.board[2] = 0;
      state.board[level.size + 1] = 0;
    }

    function findMatches() {
      const matched = new Set();
      for (let r = 0; r < level.size; r += 1) {
        let start = 0;
        for (let c = 1; c <= level.size; c += 1) {
          const current = c < level.size ? state.board[r * level.size + c] : -1;
          const first = state.board[r * level.size + start];
          if (current !== first) {
            if (c - start >= 3 && first != null) for (let x = start; x < c; x += 1) matched.add(r * level.size + x);
            start = c;
          }
        }
      }
      for (let c = 0; c < level.size; c += 1) {
        let start = 0;
        for (let r = 1; r <= level.size; r += 1) {
          const current = r < level.size ? state.board[r * level.size + c] : -1;
          const first = state.board[start * level.size + c];
          if (current !== first) {
            if (r - start >= 3 && first != null) for (let y = start; y < r; y += 1) matched.add(y * level.size + c);
            start = r;
          }
        }
      }
      return [...matched];
    }

    function findValidSwap() {
      for (let index = 0; index < count; index += 1) {
        for (const next of [index + 1, index + level.size]) {
          if (next >= count || !adjacent(index, next)) continue;
          swap(index, next);
          const valid = findMatches().length > 0;
          swap(index, next);
          if (valid) return [index, next];
        }
      }
      return null;
    }

    function render(highlight = []) {
      if (destroyed) return;
      tileEvents.abort();
      tileEvents = new AbortController();
      boardNode.style.setProperty("--match-size", level.size);
      boardNode.innerHTML = state.board.map((tile, index) => `<button class="match-tile tile-${tile} ${state.selected === index ? "selected" : ""} ${highlight.includes(index) ? "matched" : ""}" data-tile="${index}" role="gridcell" aria-label="${names[tile] || "رمز مميز"}"><span>${symbols[tile]}</span></button>`).join("");
      boardNode.querySelectorAll("[data-tile]").forEach((button) => button.addEventListener("click", () => select(Number(button.dataset.tile)), { signal: tileEvents.signal }));
      movesNode.textContent = state.moves;
      scoreNode.textContent = `${state.score} / ${level.target}`;
      const percent = Math.min(100, Math.round((state.score / level.target) * 100));
      goalFill.style.width = `${percent}%`;
      const stage = Math.min(5, Math.floor(percent / 20));
      gardenScene.dataset.gardenStage = stage;
      const titles = ["أول بذرة", "جذور صغيرة", "أول ورقة", "نبتة قوية", "قربنا للهدف", "شجرة الهدف!"];
      gardenTitle.textContent = titles[stage];
    }

    async function select(index) {
      if (destroyed || state.paused || state.complete) return;
      Q.sound.click();
      if (state.selected < 0) { state.selected = index; render(); return; }
      if (state.selected === index) { state.selected = -1; render(); return; }
      if (!adjacent(state.selected, index)) { state.selected = index; render(); return; }
      const first = state.selected;
      state.selected = -1;
      swap(first, index);
      const matches = findMatches();
      if (!matches.length) {
        swap(first, index);
        Q.sound.fail();
        gardenMessage.textContent = "المبادلة دي مش عاملة تطابق. جربي رمزين جنب بعض.";
        render();
        return;
      }
      state.moves -= 1;
      state.combo = 0;
      const completedCascade = await cascade(matches);
      if (!completedCascade || destroyed) return;
      if ((level.moves - state.moves) % 4 === 0 && !state.complete) showChallenge();
      else evaluateEnd();
    }

    async function cascade(initialMatches) {
      state.paused = true;
      let matches = initialMatches;
      while (matches.length) {
        if (destroyed) return false;
        state.combo += 1;
        const bonus = matches.length >= 4 ? 80 : 0;
        state.score += matches.length * 35 * state.combo + bonus;
        if (matches.length >= 4) state.stars += 1;
        render(matches);
        Q.sound.match();
        options.onEvent?.({ type: "match", amount: 1 });
        if (!(await wait(options.reduceMotion ? 0 : 260))) return false;
        matches.forEach((index) => { state.board[index] = null; });
        for (let c = 0; c < level.size; c += 1) {
          const values = [];
          for (let r = level.size - 1; r >= 0; r -= 1) {
            const value = state.board[r * level.size + c];
            if (value != null) values.push(value);
          }
          for (let r = level.size - 1, i = 0; r >= 0; r -= 1, i += 1) state.board[r * level.size + c] = values[i] ?? randomTile();
        }
        render();
        if (!(await wait(options.reduceMotion ? 0 : 220))) return false;
        matches = findMatches();
      }
      if (destroyed) return false;
      state.paused = false;
      gardenMessage.textContent = state.combo > 1 ? `كومبو ×${state.combo}! الاستمرار الصغير بيعمل فرق كبير.` : "تطابق حلو! الحديقة كبرت خطوة.";
      if (!findValidSwap()) { initialize(); gardenMessage.textContent = "رتبنا رموز جديدة علشان المغامرة تكمل."; }
      render();
      return true;
    }

    function showChallenge() {
      if (destroyed) return;
      state.paused = true;
      overlayEvents.abort();
      overlayEvents = new AbortController();
      const scenario = Q.games.savings.scenarios[state.challenges % Q.games.savings.scenarios.length];
      state.challenges += 1;
      overlay.classList.remove("hidden");
      overlay.innerHTML = `<div class="checkpoint-card savings-checkpoint"><div class="luma-mini">${Q.lumaFace("thinking")}</div><span>لحظة تخطيط</span><h2>${scenario.title}</h2><p>${scenario.story}</p><div class="checkpoint-choices">${scenario.choices.map((choice, index) => `<button data-match-choice="${index}">${choice.text}</button>`).join("")}</div><div data-match-feedback></div></div>`;
      overlay.querySelectorAll("[data-match-choice]").forEach((button) => button.addEventListener("click", () => {
        if (destroyed) return;
        const choice = scenario.choices[Number(button.dataset.matchChoice)];
        const correct = choice.score >= 3;
        overlay.querySelectorAll("[data-match-choice]").forEach((item) => { item.disabled = true; });
        if (correct) { state.score += 150; Q.sound.success(); } else Q.sound.fail();
        overlay.querySelector("[data-match-feedback]").innerHTML = `<div class="game-feedback ${correct ? "good" : "learn"}"><b>${correct ? "قرار بيكبر الهدف" : "الخطة المرنة تستحمل التعديل"}</b><p>${choice.feedback}</p><button data-match-continue>ارجعي للحديقة ←</button></div>`;
        overlay.querySelector("[data-match-continue]").addEventListener("click", () => { if (destroyed) return; overlay.classList.add("hidden"); state.paused = false; render(); evaluateEnd(); }, { signal: overlayEvents.signal });
      }, { signal: overlayEvents.signal }));
    }

    function evaluateEnd() {
      if (state.score >= level.target) finish(true);
      else if (state.moves <= 0) finish(false);
    }

    function finish(won) {
      if (destroyed || completionSent || state.complete) return;
      completionSent = true;
      state.complete = true; state.paused = true;
      overlayEvents.abort();
      overlayEvents = new AbortController();
      const xp = won ? 45 + level.level * 5 : 10;
      overlay.classList.remove("hidden");
      overlay.innerHTML = `<div class="level-result"><div class="luma-celebrate">${Q.lumaFace(won ? "celebrate" : "encourage")}</div><span>${won ? "الحديقة كبرت!" : "الحركات خلصت"}</span><h2>${won ? "هدفك بقى أقرب" : "نجرب ترتيب مختلف؟"}</h2><div class="result-strip"><div><b>${state.score}</b><small>نقطة</small></div><div><b>${level.moves - state.moves}</b><small>حركة</small></div><div><b>${state.stars}</b><small>كومبو مميز</small></div><div><b>+${xp}</b><small>XP</small></div></div><p>${won ? "المبلغ الصغير المنتظم يساعد الهدف يكبر بهدوء." : "دوري على مجموعات قريبة وابدئي من أسفل الشبكة."}</p><div class="level-result-actions"><button data-match-retry>العبي تاني</button>${won && level.level < 5 ? `<button class="primary" data-match-next>المستوى التالي</button>` : ""}<button data-match-map>الخريطة</button></div></div>`;
      if (won) Q.sound.success(); else Q.sound.fail();
      options.onFinish({ game: "match3", won, level: level.level, score: state.score, xp, stars: state.stars });
      overlay.querySelector("[data-match-retry]").addEventListener("click", () => options.onReplay(level.level), { signal: overlayEvents.signal });
      overlay.querySelector("[data-match-next]")?.addEventListener("click", () => options.onReplay(level.level + 1), { signal: overlayEvents.signal });
      overlay.querySelector("[data-match-map]").addEventListener("click", options.onExit, { signal: overlayEvents.signal });
    }

    function wait(ms) {
      if (destroyed) return Promise.resolve(false);
      return new Promise((resolve) => {
        const entry = { id: 0, resolve };
        entry.id = setTimeout(() => { pendingWaits.delete(entry); resolve(!destroyed); }, ms);
        pendingWaits.add(entry);
      });
    }

    container.querySelector("[data-game-exit]").addEventListener("click", options.onExit, { signal: persistentEvents.signal });
    container.querySelector("[data-match-help]").addEventListener("click", () => { gardenMessage.textContent = "اختاري رمزًا ثم رمزًا ملاصقًا له. لازم المبادلة تعمل صف أو عمود من 3."; Q.sound.clue(); }, { signal: persistentEvents.signal });
    initialize();
    render();
    Q.activeEngine = {
      state,
      findValidSwap,
      debugFindMatches() { return findMatches(); },
      debugReshuffle() { if (destroyed) return null; initialize(); render(); return findValidSwap(); },
      get destroyed() { return destroyed; },
      async debugValidSwap() { const pair = findValidSwap(); if (pair) { state.selected = pair[0]; await select(pair[1]); } },
      async debugInvalidSwap() {
        for (let index = 0; index < count; index += 1) {
          for (const next of [index + 1, index + level.size]) {
            if (next >= count || !adjacent(index, next)) continue;
            swap(index, next); const valid = findMatches().length > 0; swap(index, next);
            if (!valid) { state.selected = index; await select(next); return [index, next]; }
          }
        }
        return null;
      },
      debugComplete() { if (!destroyed) { state.score = level.target; finish(true); } },
      debugFail() { if (!destroyed) { state.moves = 0; finish(false); } },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        tileEvents.abort(); overlayEvents.abort(); persistentEvents.abort();
        pendingWaits.forEach((entry) => { clearTimeout(entry.id); entry.resolve(false); });
        pendingWaits.clear();
        if (Q.activeEngine === this) Q.activeEngine = null;
      },
    };
    return Q.activeEngine;
  }
  Q.match3Game = { mount };
})();
