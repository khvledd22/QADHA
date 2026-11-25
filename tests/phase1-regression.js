const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseUrl = process.env.QADHA_BASE_URL || "http://127.0.0.1:4173";
const chromePath = process.env.QADHA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

async function seed(page, overrides = {}, missionId = "mission-clues") {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(({ overrides, missionId }) => {
    const base = Qadha.storage.defaults();
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const state = {
      ...base,
      ...overrides,
      onboarded: true,
      adventureOnboarded: true,
      daily: { date: today, missionId, progress: 0, completed: false },
      gameLevels: { ...base.gameLevels, ...(overrides.gameLevels || {}) },
      completedLevels: { ...base.completedLevels, ...(overrides.completedLevels || {}) },
      levelScores: { ...base.levelScores, ...(overrides.levelScores || {}) },
      awardedLevels: { ...base.awardedLevels, ...(overrides.awardedLevels || {}) },
    };
    localStorage.setItem(Qadha.storage.key, JSON.stringify(state));
  }, { overrides, missionId });
  await page.reload({ waitUntil: "networkidle" });
}

async function openGame(page, world, type, level = 1) {
  await page.locator(`[data-world="${world}"]:visible`).first().click();
  await page.locator(`[data-start-main="${type}"][data-level="${level}"]`).click();
  await page.locator(".play-shell").waitFor();
}

async function state(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(Qadha.app.state)));
}

async function collectMazeClue(page) {
  const path = await page.evaluate(() => {
    const cells = [...document.querySelectorAll(".maze-cell")];
    const size = Math.sqrt(cells.length);
    const startCell = cells.find((cell) => cell.classList.contains("player"));
    const targetCell = cells.find((cell) => cell.classList.contains("clue"));
    const start = [Number(startCell.dataset.row), Number(startCell.dataset.col)];
    const target = [Number(targetCell.dataset.row), Number(targetCell.dataset.col)];
    const queue = [{ position: start, path: [] }];
    const seen = new Set([start.join(":")]);
    const directions = [["up", -1, 0], ["down", 1, 0], ["left", 0, -1], ["right", 0, 1]];
    while (queue.length) {
      const current = queue.shift();
      if (current.position[0] === target[0] && current.position[1] === target[1]) return current.path;
      for (const [name, dr, dc] of directions) {
        const row = current.position[0] + dr; const col = current.position[1] + dc;
        if (row < 0 || col < 0 || row >= size || col >= size) continue;
        const key = `${row}:${col}`;
        const cell = document.querySelector(`.maze-cell[data-row="${row}"][data-col="${col}"]`);
        if (seen.has(key) || cell.classList.contains("wall")) continue;
        seen.add(key); queue.push({ position: [row, col], path: [...current.path, name] });
      }
    }
    return [];
  });
  assert.ok(path.length > 0);
  for (const direction of path) await page.evaluate((value) => Qadha.activeEngine.move(value), direction);
  await page.locator("[data-maze-choice]").first().click();
  await page.locator("[data-maze-continue]").click();
}

async function testRunnerProgression(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar-EG" });
  const page = await context.newPage();
  await seed(page, {}, "mission-clues");
  await openGame(page, "budget", "runner");
  await page.evaluate(() => { window.__oldRunner = Qadha.activeEngine; Qadha.activeEngine.debugFail(); });
  await page.locator(".level-result").waitFor();
  let saved = await state(page);
  assert.equal(saved.gameLevels.runner, 1);
  assert.equal(Boolean(saved.completedLevels.runner[1]), false);
  assert.equal(Boolean(saved.awardedLevels.runner[1]), false);
  assert.equal(saved.xp, 0);

  await page.locator("[data-run-retry]").click();
  await page.locator("[data-runner-canvas]").waitFor();
  assert.equal(await page.evaluate(() => window.__oldRunner.destroyed && window.__oldRunner !== Qadha.activeEngine), true);
  await page.evaluate(() => Qadha.activeEngine.debugComplete());
  await page.locator(".level-result").waitFor();
  saved = await state(page);
  assert.equal(saved.gameLevels.runner, 2);
  assert.equal(saved.completedLevels.runner[1], true);
  assert.equal(saved.awardedLevels.runner[1], true);
  assert.equal(saved.xp, 50);

  await page.locator("[data-run-retry]").click();
  await page.evaluate(() => Qadha.activeEngine.debugComplete());
  await page.locator(".level-result").waitFor();
  assert.equal((await state(page)).xp, 50);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal((await state(page)).xp, 50);
  await context.close();
}

async function testMazeProgression(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar-EG" });
  const page = await context.newPage();
  await seed(page, { xp: 45 }, "mission-match");
  await openGame(page, "scam", "maze");
  await page.evaluate(() => Qadha.activeEngine.debugComplete());
  await page.locator(".level-result").waitFor();
  const saved = await state(page);
  assert.equal(saved.gameLevels.maze, 2);
  assert.equal(saved.completedLevels.maze[1], true);
  assert.equal(saved.xp, 95);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal((await state(page)).xp, 95);
  await context.close();
}

async function testMatchProgression(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar-EG" });
  const page = await context.newPage();
  await seed(page, { xp: 95 }, "mission-clues");
  await openGame(page, "savings", "match3");
  await page.evaluate(() => Qadha.activeEngine.debugFail());
  await page.locator(".level-result").waitFor();
  let saved = await state(page);
  assert.equal(saved.gameLevels.match3, 1);
  assert.equal(Boolean(saved.completedLevels.match3[1]), false);
  assert.equal(Boolean(saved.awardedLevels.match3[1]), false);
  assert.equal(saved.xp, 95);

  await page.locator("[data-match-retry]").click();
  await page.evaluate(() => Qadha.activeEngine.debugComplete());
  await page.locator(".level-result").waitFor();
  saved = await state(page);
  assert.equal(saved.gameLevels.match3, 2);
  assert.equal(saved.completedLevels.match3[1], true);
  assert.equal(saved.xp, 145);
  await context.close();
}

async function testMiniExitAndReopen(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar-EG" });
  const page = await context.newPage();
  await seed(page, { demoMode: true }, "mission-clues");
  await page.locator('[data-route="minis"]:visible').first().click();
  await page.locator('[data-mini="path"]').click();
  for (let index = 0; index < 3; index += 1) {
    await page.locator('[data-path-choice="0"]:visible').click();
    await page.waitForTimeout(720);
  }
  await page.evaluate(() => { window.__oldMini = Qadha.activeEngine; });
  await page.locator('[data-path-choice="0"]:visible').click();
  await page.locator("[data-mini-exit]").click();
  await page.waitForTimeout(800);
  let saved = await state(page);
  assert.equal(saved.completedMiniGames.includes("path"), false);
  assert.equal(saved.xp, 0);
  assert.equal(await page.evaluate(() => window.__oldMini.destroyed), true);

  await page.locator('[data-mini="path"]').click();
  assert.equal(await page.evaluate(() => window.__oldMini !== Qadha.activeEngine && !Qadha.activeEngine.destroyed), true);
  await page.locator("[data-mini-exit]").click();
  saved = await state(page);
  assert.equal(saved.completedMiniGames.includes("path"), false);
  await context.close();
}

async function testHudAcrossViewports(browser) {
  const viewports = [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ];
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, locale: "ar-EG" });
    const page = await context.newPage();
    await seed(page, { demoMode: true }, "mission-clues");
    for (const [world, type] of [["budget", "runner"], ["scam", "maze"], ["savings", "match3"]]) {
      await openGame(page, world, type);
      const layout = await page.evaluate(() => {
        const hud = document.querySelector(".play-hud").getBoundingClientRect();
        const exit = document.querySelector("[data-game-exit]").getBoundingClientRect();
        const controls = document.querySelector(".mobile-game-controls");
        const controlRect = controls && getComputedStyle(controls).display !== "none" ? controls.getBoundingClientRect() : null;
        return {
          scrollY,
          hudTop: hud.top,
          hudBottom: hud.bottom,
          exitTop: exit.top,
          exitBottom: exit.bottom,
          controlsTop: controlRect?.top ?? null,
          controlsBottom: controlRect?.bottom ?? null,
          height: innerHeight,
        };
      });
      assert.equal(layout.scrollY, 0);
      assert.ok(layout.hudTop >= 0 && layout.hudBottom <= layout.height, JSON.stringify({ viewport, world, layout }));
      assert.ok(layout.exitTop >= 0 && layout.exitBottom <= layout.height, JSON.stringify({ viewport, world, layout }));
      if (layout.controlsTop != null) assert.ok(layout.controlsTop >= 0 && layout.controlsBottom <= layout.height, JSON.stringify({ viewport, world, layout }));
      await page.locator("[data-game-exit]").click();
      const after = await page.evaluate(() => ({ overflow: getComputedStyle(document.body).overflow, scrollY }));
      assert.notEqual(after.overflow, "hidden");
      assert.equal(after.scrollY, 0);
    }
    await context.close();
  }
}

async function testDailyMissionValidation(browser) {
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await seed(page, { demoMode: true }, "mission-clues");
    await openGame(page, "savings", "match3");
    await page.evaluate(async () => Qadha.activeEngine.debugValidSwap());
    assert.equal((await state(page)).daily.progress, 0);
    await page.locator("[data-game-exit]").click();
    const xpBeforeClues = (await state(page)).xp;
    await openGame(page, "scam", "maze", 2);
    await collectMazeClue(page);
    await collectMazeClue(page);
    const saved = await state(page);
    assert.equal(saved.daily.completed, true);
    assert.equal(saved.daily.progress, 2);
    assert.equal(saved.xp, xpBeforeClues + 25);
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await seed(page, {}, "mission-term");
    await page.locator('[data-route="learn"]:visible').first().click();
    await page.locator('[data-learn-tab="glossary"]').click();
    await page.locator('[data-glossary="0"]').click();
    const saved = await state(page);
    assert.equal(saved.daily.completed, true);
    assert.equal(saved.xp, 17);
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await seed(page, {}, "mission-lesson");
    await page.locator('[data-route="learn"]:visible').first().click();
    await page.locator('[data-adventure-lesson="budget-map"]').click();
    await page.locator('[data-lesson-answer="0"]').click();
    const saved = await state(page);
    assert.equal(saved.daily.completed, true);
    assert.equal(saved.xp, 35);
    await context.close();
  }
}

async function testMatch3Rules(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar-EG" });
  const page = await context.newPage();
  await seed(page, { demoMode: true }, "mission-match");
  await openGame(page, "savings", "match3", 5);
  assert.ok(await page.evaluate(() => Qadha.activeEngine.findValidSwap()));
  const before = await page.evaluate(() => ({ moves: Qadha.activeEngine.state.moves, score: Qadha.activeEngine.state.score }));
  assert.ok(await page.evaluate(async () => Qadha.activeEngine.debugInvalidSwap()));
  const afterInvalid = await page.evaluate(() => ({ moves: Qadha.activeEngine.state.moves, score: Qadha.activeEngine.state.score }));
  assert.deepEqual(afterInvalid, before);

  for (let index = 0; index < 3 && !(await state(page)).daily.completed; index += 1) {
    await page.evaluate(async () => Qadha.activeEngine.debugValidSwap());
  }
  const afterValid = await page.evaluate(() => ({
    moves: Qadha.activeEngine.state.moves,
    score: Qadha.activeEngine.state.score,
    combo: Qadha.activeEngine.state.combo,
    remainingMatches: Qadha.activeEngine.debugFindMatches().length,
  }));
  assert.ok(afterValid.moves < before.moves);
  assert.ok(afterValid.score > 0);
  assert.ok(afterValid.combo >= 1);
  assert.equal(afterValid.remainingMatches, 0);
  assert.equal((await state(page)).daily.completed, true);
  assert.ok(await page.evaluate(() => Qadha.activeEngine.debugReshuffle()));
  await page.evaluate(() => Qadha.activeEngine.debugComplete());
  await page.locator(".level-result").waitFor();
  assert.equal((await state(page)).completedLevels.match3[5], true);
  await context.close();
}

async function testAccessibilityBasics(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
  const page = await context.newPage();
  await seed(page, { demoMode: true, reduceMotion: true }, "mission-clues");
  await page.locator('[data-route="profile"]:visible').first().click();
  const settings = page.locator('[data-action="open-settings"]');
  await settings.focus();
  await settings.click();
  await page.locator('[role="dialog"]').waitFor();
  assert.equal(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator('[role="dialog"]').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), "open-settings");

  await page.locator('[data-route="learn"]:visible').first().click();
  const tabHeights = await page.locator(".learn-tabs button").evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
  assert.ok(tabHeights.every((height) => height >= 43));
  await page.locator('[data-route="adventure"]:visible').first().click();
  await openGame(page, "budget", "runner");
  assert.equal(await page.evaluate(() => document.body.classList.contains("reduce-motion") && document.querySelector(".game-host").classList.contains("reduce-motion")), true);
  await page.locator("[data-game-exit]").click();
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const tests = [
    ["runner progression and XP", testRunnerProgression],
    ["maze progression and refresh", testMazeProgression],
    ["match-3 loss then win", testMatchProgression],
    ["mini-game exit and clean reopen", testMiniExitAndReopen],
    ["responsive HUD", testHudAcrossViewports],
    ["daily mission validation", testDailyMissionValidation],
    ["match-3 rules and completion", testMatch3Rules],
    ["accessibility interaction basics", testAccessibilityBasics],
  ];
  const results = [];
  try {
    for (const [name, test] of tests) {
      const started = Date.now();
      await test(browser);
      results.push({ name, ok: true, milliseconds: Date.now() - started });
    }
    console.log(JSON.stringify({ ok: true, results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
