const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseUrl = process.env.QADHA_BASE_URL || "http://127.0.0.1:4173";
const chromePath = process.env.QADHA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
let assertions = 0;

function ok(value, message) { assert.ok(value, message); assertions += 1; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); assertions += 1; }

async function clean(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
}

async function testLocalFonts(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ar-EG" });
  const page = await context.newPage();
  await clean(page);
  const result = await page.evaluate(async () => {
    await document.fonts.ready;
    const alexandria = await document.fonts.load('600 36px "Alexandria"', "قدّها");
    const noto = await document.fonts.load('500 20px "Noto Sans Arabic"', "مغامرتك المالية");
    Qadha.app.setLocale("en");
    const manrope = await document.fonts.load('700 32px "Manrope"', "QADHA Adventure");
    return {
      alexandria: alexandria.length,
      noto: noto.length,
      manrope: manrope.length,
      checks: {
        alexandria: document.fonts.check('600 36px "Alexandria"', "قدّها"),
        noto: document.fonts.check('500 20px "Noto Sans Arabic"', "مغامرتك المالية"),
        manrope: document.fonts.check('700 32px "Manrope"', "QADHA Adventure"),
      },
      resources: performance.getEntriesByType("resource").map((entry) => entry.name),
      bodyFont: getComputedStyle(document.body).fontFamily,
      headingFont: getComputedStyle(document.querySelector("h1")).fontFamily,
    };
  });
  ok(result.alexandria > 0 && result.noto > 0 && result.manrope > 0, JSON.stringify(result));
  ok(Object.values(result.checks).every(Boolean), JSON.stringify(result.checks));
  ok(result.resources.some((url) => url.includes("alexandria-arabic.woff2")));
  ok(result.resources.some((url) => url.includes("noto-sans-arabic-arabic.woff2")));
  ok(result.resources.some((url) => url.includes("manrope-latin.woff2")));
  ok(!result.resources.some((url) => /fonts\.(googleapis|gstatic)\.com/.test(url)), "Fonts must be local at runtime");
  ok(result.bodyFont.includes("Manrope"));
  ok(result.headingFont.includes("Manrope"));

  for (const name of [
    "alexandria-arabic.woff2", "alexandria-latin.woff2", "noto-sans-arabic-arabic.woff2",
    "noto-sans-arabic-latin.woff2", "manrope-latin.woff2", "manrope-latin-ext.woff2",
  ]) {
    const response = await page.request.get(`${baseUrl}/assets/fonts/${name}`);
    equal(response.status(), 200, name);
    equal((await response.body()).subarray(0, 4).toString("ascii"), "wOF2", name);
  }
  await context.close();
}

async function testLanguageControlAndPersistence(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ar-EG" });
  const page = await context.newPage();
  await clean(page);

  const group = page.locator('.language-switcher[role="group"]').first();
  await group.waitFor();
  equal(await group.getAttribute("aria-label"), "اختيار اللغة");
  equal(await page.locator('[data-switch-locale="ar-EG"]').first().getAttribute("aria-pressed"), "true");
  await page.locator('[data-switch-locale="en"]').first().click();
  let result = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    locale: Qadha.app.state.locale,
    stored: JSON.parse(localStorage.getItem(Qadha.storage.key)).locale,
    heading: document.querySelector(".welcome-copy h1").innerText,
  }));
  equal(result.lang, "en");
  equal(result.dir, "ltr");
  equal(result.locale, "en");
  equal(result.stored, "en");
  ok(result.heading.includes("Your money."));

  await page.reload({ waitUntil: "networkidle" });
  equal(await page.evaluate(() => Qadha.app.state.locale), "en");
  equal(await page.evaluate(() => document.documentElement.dir), "ltr");
  equal(await page.locator('[data-switch-locale="en"]').first().getAttribute("aria-pressed"), "true");

  await page.locator('[data-action="begin-adventure"]').click();
  ok(await page.locator(".onboarding-header .language-switcher").isVisible());
  await page.locator('[data-action="quick-demo"]').click();
  ok(await page.locator(".world-sidebar .language-switcher").isVisible());
  equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  await context.close();
}

async function testStatePreservedAcrossLanguageChange(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const state = Qadha.storage.defaults();
    Object.assign(state, {
      onboarded: true,
      adventureOnboarded: true,
      nickname: "سارة",
      xp: 275,
      collectibles: { stars: 7, tokens: 3, shields: 2, clues: 5 },
      gameLevels: { runner: 3, maze: 2, match3: 4 },
      completedLevels: { runner: { 1: true, 2: true }, maze: { 1: true }, match3: { 1: true, 2: true, 3: true } },
      awardedLevels: { runner: { 1: true, 2: true }, maze: { 1: true }, match3: { 1: true, 2: true, 3: true } },
      locale: "ar-EG",
    });
    localStorage.setItem(Qadha.storage.key, JSON.stringify(state));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-switch-locale="en"]:visible').first().click();
  await page.reload({ waitUntil: "networkidle" });
  const saved = await page.evaluate(() => ({
    nickname: Qadha.app.state.nickname,
    xp: Qadha.app.state.xp,
    collectibles: Qadha.app.state.collectibles,
    gameLevels: Qadha.app.state.gameLevels,
    completedLevels: Qadha.app.state.completedLevels,
    awardedLevels: Qadha.app.state.awardedLevels,
    locale: Qadha.app.state.locale,
  }));
  equal(saved.nickname, "سارة");
  equal(saved.xp, 275);
  equal(saved.collectibles.stars, 7);
  equal(saved.gameLevels.runner, 3);
  equal(saved.completedLevels.match3[3], true);
  equal(saved.awardedLevels.maze[1], true);
  equal(saved.locale, "en");
  await context.close();
}

async function testResponsiveShell(browser) {
  const viewports = [
    { width: 390, height: 844, mobile: true },
    { width: 768, height: 1024, mobile: true },
    { width: 1440, height: 1000, mobile: false },
  ];
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, locale: "ar-EG", isMobile: viewport.mobile, hasTouch: viewport.mobile });
    const page = await context.newPage();
    await clean(page);
    for (const locale of ["ar-EG", "en"]) {
      await page.evaluate((value) => Qadha.app.setLocale(value), locale);
      equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, JSON.stringify({ viewport, locale, screen: "welcome" }));
      await page.locator('[data-action="quick-demo"]').click();
      equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, JSON.stringify({ viewport, locale, screen: "home" }));
      if (viewport.mobile) {
        ok(await page.locator(".world-bottom-nav").isVisible());
        ok(await page.locator(".topbar-language").isVisible());
      } else {
        ok(await page.locator(".world-sidebar").isVisible());
        ok(await page.locator(".sidebar-language").isVisible());
      }
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle" });
    }
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const tests = [
    ["licensed local fonts", testLocalFonts],
    ["accessible language control and persistence", testLanguageControlAndPersistence],
    ["saved progress survives language changes", testStatePreservedAcrossLanguageChange],
    ["responsive redesigned shell", testResponsiveShell],
  ];
  const results = [];
  try {
    for (const [name, test] of tests) {
      const started = Date.now();
      await test(browser);
      results.push({ name, ok: true, milliseconds: Date.now() - started });
    }
    console.log(JSON.stringify({ ok: true, assertionsPassed: assertions, assertionsFailed: 0, results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
