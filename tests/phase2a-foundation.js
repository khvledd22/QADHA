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

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function contrast(rgbA, rgbB) {
  const luminance = ([red, green, blue]) => 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
  const a = luminance(rgbA); const b = luminance(rgbB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function testBrandFoundation(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ar-EG" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await clean(page);

  const result = await page.evaluate(() => {
    const logo = document.querySelector(".official-brand-logo");
    const primary = getComputedStyle(document.querySelector(".cozy-button.primary")).backgroundColor;
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      logoSource: logo?.getAttribute("src"),
      logoLoaded: Boolean(logo?.complete && logo.naturalWidth),
      forest: getComputedStyle(document.documentElement).getPropertyValue("--qadha-forest").trim(),
      primary,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      stylesheets: [...document.styleSheets].map((sheet) => new URL(sheet.href).pathname.split("/").pop()),
    };
  });

  equal(result.lang, "ar");
  equal(result.dir, "rtl");
  equal(result.logoSource, "assets/brand/Logo_02_Green_Transparent.svg");
  equal(result.logoLoaded, true);
  equal(result.forest, "#1F4A36");
  equal(result.primary, "rgb(31, 74, 54)");
  ok(contrast([31, 74, 54], [255, 255, 255]) >= 4.5, "Primary action must meet text contrast");
  equal(result.overflow, 0);
  ok(result.stylesheets.includes("tokens.css") && result.stylesheets.includes("foundation.css"));
  ok(!result.stylesheets.includes("styles.css") && !result.stylesheets.includes("responsive.css"));
  equal(errors.length, 0, errors.join("\n"));
  await context.close();
}

async function testOfficialAssets(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const names = [
    "Logo_01_Green_on_White.svg", "Logo_02_Green_Transparent.svg", "Logo_03_Green_on_OffWhite.svg",
    "Logo_04_Black_on_White.svg", "Logo_05_Black_Transparent.svg", "Logo_06_White_on_Black.svg",
    "Logo_07_White_Transparent.svg", "Logo_08_White_on_Green.svg",
  ];
  for (const name of names) {
    const response = await page.request.get(`${baseUrl}/assets/brand/${name}`);
    equal(response.status(), 200, name);
    ok((await response.text()).includes("<svg"), `${name} must remain SVG`);
  }
  equal((await page.request.get(`${baseUrl}/css/styles.css`)).status(), 200, "Legacy CSS remains preserved");
  await context.close();
}

async function testLocaleFoundation(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await clean(page);

  equal(await page.evaluate(() => Qadha.app.setLocale("en")), true);
  let result = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    locale: Qadha.i18n.locale,
    title: document.querySelector(".welcome-copy h1").innerText,
    documentTitle: document.title,
    arrow: document.querySelector('[data-action="begin-adventure"] span').textContent,
    stored: JSON.parse(localStorage.getItem(Qadha.storage.key)).locale,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  equal(result.lang, "en");
  equal(result.dir, "ltr");
  equal(result.locale, "en");
  ok(result.title.includes("Your money."));
  equal(result.documentTitle, "QADHA | The Financial Adventure World");
  equal(result.arrow, "→");
  equal(result.stored, "en");
  equal(result.overflow, 0);

  await page.locator('[data-action="begin-adventure"]').click();
  ok((await page.locator(".speech-bubble h2").textContent()).includes("LUMA"));
  await page.locator('[data-action="quick-demo"]').click();
  equal((await page.locator('[data-route="home"]:visible').first().textContent()).trim().includes("Home"), true);
  await page.locator('[data-route="profile"]:visible').first().click();
  await page.locator('[data-action="open-settings"]').click();
  equal((await page.locator('[role="dialog"] h2').textContent()).trim(), "Make the adventure work for you");

  await page.reload({ waitUntil: "networkidle" });
  equal(await page.evaluate(() => Qadha.i18n.locale), "en");
  equal(await page.evaluate(() => document.documentElement.dir), "ltr");
  await context.close();
}

async function testResponsiveFoundation(browser) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await clean(page);
    for (const locale of ["ar-EG", "en"]) {
      await page.evaluate((value) => Qadha.app.setLocale(value), locale);
      const metrics = await page.evaluate(() => {
        const logo = document.querySelector(".official-brand-logo").getBoundingClientRect();
        const start = document.querySelector('[data-action="begin-adventure"]').getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          logoVisible: logo.width > 0 && logo.height > 0,
          startWidth: start.width,
          startHeight: start.height,
        };
      });
      equal(metrics.overflow, 0, JSON.stringify({ viewport, locale, metrics }));
      equal(metrics.logoVisible, true);
      ok(metrics.startWidth >= 44 && metrics.startHeight >= 44);
    }
    await context.close();
  }
}

async function testStorageLocaleMigration(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem(Qadha.storage.key, JSON.stringify({ xp: 75, locale: "fr" })));
  await page.reload({ waitUntil: "networkidle" });
  equal(await page.evaluate(() => Qadha.app.state.xp), 75);
  equal(await page.evaluate(() => Qadha.app.state.locale), "ar-EG");
  equal(await page.evaluate(() => document.documentElement.dir), "rtl");
  equal(await page.evaluate(() => Qadha.app.setLocale("fr")), false);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const tests = [
    ["official brand and design foundation", testBrandFoundation],
    ["official SVG asset set", testOfficialAssets],
    ["Arabic and English locale foundation", testLocaleFoundation],
    ["responsive RTL/LTR foundation", testResponsiveFoundation],
    ["saved locale normalization", testStorageLocaleMigration],
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

