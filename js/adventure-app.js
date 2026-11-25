(function () {
  const Q = (window.Qadha = window.Qadha || {});
  const root = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  let state = Q.storage.load();
  Q.i18n.use(state.locale);
  let view = state.adventureOnboarded ? "home" : "welcome";
  let onboardingStep = 0;
  let chosenAvatar = state.avatarId || "noura";
  let selectedWorld = null;
  let selectedLesson = null;
  let learnTab = "lessons";
  let simTab = "budget";
  let activeEngine = null;
  let activeGame = null;
  let activeSession = null;
  let sessionSequence = 0;
  let master = null;
  let modalReturnFocus = null;
  const budgetDraft = { basics: 1800, transport: 650, food: 900, personal: 450, savings: 650, emergency: 550 };

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }
  function tr(key, variables = {}, fallback = key) { return Q.i18n.t(key, variables, fallback); }
  function format(value) { return Q.i18n.number(Math.round(Number(value) || 0)); }
  function forwardArrow() { return Q.i18n.isRtl() ? "←" : "→"; }
  function save() { Q.storage.save(state); }
  function today() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function level() { return Q.gamification.currentLevel(state.xp); }
  function levelProgress() { return Q.gamification.levelProgress(state.xp); }
  function currentAvatar() { return Q.adventure.avatars.find((item) => item.id === state.avatarId) || Q.adventure.avatars[0]; }
  function worldUnlocked(world) { return state.demoMode || state.xp >= world.unlockXp; }
  function levelName() {
    const index = Math.max(0, Q.levels.indexOf(level()));
    const names = tr("shell.levels", {}, []);
    return names[index] || level().name;
  }
  function avatarName(avatar) { return tr(`avatars.${avatar.id}`, {}, avatar.name); }
  function worldName(world) { return tr(`worlds.${world.id}.name`, {}, world.name); }
  function worldDescription(world) { return tr(`worlds.${world.id}.description`, {}, world.description); }
  function missionText(mission) { return tr(`home.missions.${mission.id}`, {}, mission.text); }
  function displayNickname() {
    if (state.nickname === "يا بطلة") return tr("home.defaultName", {}, Q.i18n.locale === "en" ? "Explorer" : "بطلة");
    return state.nickname;
  }
  function languageSwitcher(variant = "") {
    const active = Q.i18n.locale;
    return `<div class="language-switcher ${variant}" role="group" aria-label="${esc(tr("language.label"))}"><button type="button" data-switch-locale="ar-EG" lang="ar" dir="rtl" aria-pressed="${active === "ar-EG"}"><span>ع</span><b>${tr("language.arabic")}</b></button><button type="button" data-switch-locale="en" lang="en" dir="ltr" aria-pressed="${active === "en"}"><span>EN</span><b>${tr("language.english")}</b></button></div>`;
  }

  function scheduledMission() {
    return Q.adventure.dailyMissions[new Date().getDate() % Q.adventure.dailyMissions.length];
  }

  function currentMission() {
    const saved = Q.adventure.dailyMissions.find((item) => item.id === state.daily.missionId);
    return state.daily.date === today() && saved ? saved : scheduledMission();
  }

  function ensureDaily() {
    const mission = currentMission();
    if (state.daily.date === today() && state.daily.missionId === mission.id) return mission;
    if (state.daily.date === today() && state.daily.completed && !state.daily.missionId) {
      state.daily = { date: today(), missionId: mission.id, progress: mission.target, completed: true };
      save();
      return mission;
    }
    state.daily = { date: today(), missionId: mission.id, progress: 0, completed: false };
    save();
    return mission;
  }

  function recordDailyEvent(type, amount = 1) {
    const mission = ensureDaily();
    if (state.daily.completed) return false;
    const expected = { "mission-game": "level", "mission-clues": "clue", "mission-match": "match", "mission-term": "glossary", "mission-lesson": "lesson" }[mission.id];
    if (type !== expected) return false;
    state.daily.progress = Math.min(mission.target, state.daily.progress + Math.max(0, Number(amount) || 0));
    if (state.daily.progress >= mission.target) {
      state.daily.completed = true;
      Q.gamification.addXp(state, mission.xp, "مهمة النهارده");
    }
    save();
    return true;
  }

  function toast(message, kind = "info") {
    const region = document.getElementById("toast-region");
    const item = document.createElement("div");
    item.className = `adventure-toast ${kind}`;
    item.innerHTML = `<span>${kind === "success" ? "✦" : kind === "warn" ? "!" : "🦉"}</span><b>${esc(message)}</b>`;
    region.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 250); }, 3000);
  }

  function brand(theme = "light") {
    const name = Q.i18n.locale === "en" ? "QADHA" : "قدّها";
    const source = theme === "dark" ? "assets/brand/Logo_07_White_Transparent.svg" : "assets/brand/Logo_02_Green_Transparent.svg";
    return `<div class="adventure-brand brand-${theme}"><img class="official-brand-logo" src="${source}" alt="${esc(tr("brand.alt"))}"><span><strong>${name}</strong><small>${tr("brand.subtitle")}</small></span></div>`;
  }

  function avatarArt(id = state.avatarId, size = "normal") {
    const avatar = Q.adventure.avatars.find((item) => item.id === id) || Q.adventure.avatars[0];
    const accessory = id === state.avatarId ? (state.accessory || avatar.accessory) : avatar.accessory;
    return `<div class="toon-avatar avatar-${size} skin-${avatar.skin} hair-${avatar.hair} outfit-${state.outfit || avatar.outfit}"><div class="avatar-hair"></div><div class="avatar-head"><i class="eye one"></i><i class="eye two"></i><b class="smile"></b></div><div class="avatar-neck"></div><div class="avatar-outfit"></div><span class="avatar-accessory accessory-${accessory}">${accessory === "glasses" ? "⌐" : accessory === "flower" ? "✿" : accessory === "pin" ? "◆" : "★"}</span></div>`;
  }

  function welcomePage() {
    return `<main class="adventure-welcome">
      <header>${brand()}<div class="welcome-header-actions">${languageSwitcher("welcome-language")}<button class="cozy-link" data-action="about-adventure">${tr("welcome.about")}</button></div></header>
      <section class="welcome-adventure-hero">
        <div class="welcome-copy"><span class="cozy-kicker welcome-eyebrow">${tr("welcome.kicker")}</span><h1>${tr("welcome.line1")}<br><em>${tr("welcome.line2")}</em><br>${tr("welcome.line3")}</h1><p>${tr("welcome.description")}</p><div class="welcome-buttons"><button class="cozy-button primary big" data-action="begin-adventure">${tr("welcome.start")} <span>${forwardArrow()}</span></button><button class="cozy-button secondary big" data-action="quick-demo">${tr("welcome.demo")}</button></div><div class="cozy-trust"><span>🎮 ${tr("welcome.trustGames")}</span><span>🌿 ${tr("welcome.trustWorld")}</span><span>💰 ${tr("welcome.trustVirtual")}</span></div></div>
        <div class="welcome-visual"><div class="welcome-visual-head"><span>${tr("welcome.kicker")}</span><b>QADHA WORLD · 01</b></div><div class="welcome-world"><div class="welcome-hill back"></div><div class="welcome-hill front"></div><div class="welcome-tree one">🌳</div><div class="welcome-tree two">🌲</div><div class="welcome-house">🏡</div><div class="welcome-garden">🌻</div><div class="welcome-luma">${Q.lumaFace("celebrate")}<span>${tr("welcome.luma")} ✦</span></div><div class="welcome-player">${avatarArt("noura", "large")}</div><i class="float-star one">✦</i><i class="float-star two">★</i><i class="float-coin">ق</i></div><div class="welcome-visual-foot"><span>01 · Budget Dash</span><span>02 · Scam Hunter</span><span>03 · Grow Your Goal</span></div></div>
      </section>
      <section class="adventure-features" id="adventure-about"><article><span>🏃‍♀️</span><h3>${tr("welcome.featureRunTitle")}</h3><p>${tr("welcome.featureRunText")}</p></article><article><span>🕵️</span><h3>${tr("welcome.featureMysteryTitle")}</h3><p>${tr("welcome.featureMysteryText")}</p></article><article><span>🌱</span><h3>${tr("welcome.featureGoalTitle")}</h3><p>${tr("welcome.featureGoalText")}</p></article></section>
      <footer>${tr("welcome.disclaimer")}</footer>
    </main>`;
  }

  function onboardingPage() {
    const onboardingHeader = `<header class="onboarding-header">${brand()}${languageSwitcher("onboarding-language")}</header>`;
    if (onboardingStep === 0) return `<main class="story-onboarding">${onboardingHeader}<section class="story-card guide-story"><button class="skip-story" data-action="quick-demo">${tr("onboarding.skip")}</button><div class="story-step-mark"><span>01</span><i></i><b>03</b></div><div class="story-scene"><div class="big-luma">${Q.lumaFace("happy")}</div><div class="speech-bubble"><span>${tr("onboarding.hello")}</span><h2>${tr("onboarding.guideTitle")}</h2><p>${tr("onboarding.guideText")}</p></div></div><div class="story-actions"><div class="story-dots"><i class="active"></i><i></i><i></i></div><button class="cozy-button primary" data-action="onboarding-next">${tr("onboarding.meetHero")} ${forwardArrow()}</button></div></section></main>`;
    if (onboardingStep === 1) return `<main class="story-onboarding">${onboardingHeader}<section class="story-card avatar-story"><div class="story-step-mark"><span>02</span><i></i><b>03</b></div><span class="cozy-kicker">${tr("onboarding.chooseKicker")}</span><h1>${tr("onboarding.chooseTitle")}</h1><p>${tr("onboarding.chooseText")}</p><div class="avatar-choice-grid">${Q.adventure.avatars.map((avatar) => `<button class="avatar-choice ${chosenAvatar === avatar.id ? "selected" : ""}" data-choose-avatar="${avatar.id}">${avatarArt(avatar.id, "large")}<b>${avatarName(avatar)}</b><span>${chosenAvatar === avatar.id ? tr("onboarding.selected") : tr("onboarding.choose")}</span></button>`).join("")}</div><div class="story-actions"><div class="story-dots"><i></i><i class="active"></i><i></i></div><button class="cozy-button primary" data-action="onboarding-next">${tr("onboarding.continue")} ${forwardArrow()}</button></div></section></main>`;
    const goals = tr("onboarding.goals", {}, []);
    return `<main class="story-onboarding">${onboardingHeader}<form class="story-card final-story" id="adventure-profile"><div class="story-step-mark"><span>03</span><i></i><b>03</b></div><div class="final-avatar">${avatarArt(chosenAvatar, "hero")}<div class="mini-luma-side">${Q.lumaFace("celebrate")}</div></div><span class="cozy-kicker">${tr("onboarding.finalKicker")}</span><h1>${tr("onboarding.finalTitle")}</h1><p>${tr("onboarding.finalText")}</p><label class="cozy-field"><span>${tr("onboarding.nickname")}</span><input name="nickname" maxlength="18" value="${state.nickname === "يا بطلة" ? "" : esc(state.nickname)}" placeholder="${tr("onboarding.nicknameExample")}" required></label><label class="cozy-field"><span>${tr("onboarding.goal")}</span><select name="goal">${goals.map((goal) => `<option>${goal}</option>`).join("")}</select></label><div class="story-actions"><div class="story-dots"><i></i><i></i><i class="active"></i></div><button class="cozy-button primary" type="submit">${tr("onboarding.openMap")} ✦</button></div></form></main>`;
  }

  function navigationItems() {
    return [
      ["home", "⌂", tr("nav.home")], ["adventure", "🗺️", tr("nav.adventure")], ["minis", "🎲", tr("nav.minis")],
      ["learn", "📚", tr("nav.learn")], ["progress", "🏆", tr("nav.progress")], ["profile", "◉", tr("nav.profile")],
    ];
  }

  function shell(content) {
    const info = levelProgress();
    const navItems = navigationItems();
    const routeLabel = navItems.find(([id]) => id === view)?.[2] || tr("nav.home");
    const navigation = navItems.map(([id, icon, label]) => `<button class="${view === id ? "active" : ""}" data-route="${id}" ${view === id ? 'aria-current="page"' : ""}><span>${icon}</span><b>${label}</b></button>`).join("");
    return `<div class="qadha-world-app ${state.reduceMotion ? "reduce-motion" : ""}"><aside class="world-sidebar"><div class="sidebar-brand">${brand("dark")}</div><nav aria-label="${esc(tr("shell.navigation"))}">${navigation}</nav><section class="shell-level-card" aria-label="${esc(tr("shell.levelProgress"))}"><span>${level().icon} ${levelName()}</span><strong>${format(state.xp)} XP</strong><i><b style="width:${info.percent}%"></b></i><small>${info.next ? tr("shell.remaining", { count: format(info.remaining) }) : tr("shell.maximum")}</small></section><div class="sidebar-footer">${languageSwitcher("sidebar-language")}<button class="sidebar-profile" data-route="profile" aria-label="${esc(tr("shell.profile"))}">${avatarArt(state.avatarId, "tiny")}<span><b>${esc(displayNickname())}</b><small>${levelName()}</small></span></button></div></aside><section class="world-stage"><header class="world-topbar"><div class="mobile-shell-brand">${brand()}</div><div class="shell-page-label"><span>${tr("brand.subtitle")}</span><strong>${routeLabel}</strong></div><div class="top-resources">${languageSwitcher("topbar-language")}<span title="${tr("shell.stars")}">⭐ <b>${format(state.collectibles.stars)}</b></span><span title="${tr("shell.xp")}">✦ <b>${format(state.xp)}</b></span><button data-route="profile" aria-label="${tr("shell.profile")}">${avatarArt(state.avatarId, "tiny")}</button></div></header><main class="world-content">${content}</main></section><nav class="world-bottom-nav" aria-label="${esc(tr("shell.navigation"))}">${navItems.slice(0, 5).map(([id, icon, label]) => `<button class="${view === id ? "active" : ""}" data-route="${id}" ${view === id ? 'aria-current="page"' : ""}><span>${icon}</span><b>${label}</b></button>`).join("")}</nav><div class="global-level-bar"><span>${level().icon} ${levelName()}</span><i><b style="width:${info.percent}%"></b></i><em>${info.next ? `${format(info.remaining)} XP` : tr("shell.maximum")}</em></div></div>`;
  }

  function pageTitle(kicker, title, text, action = "") {
    return `<header class="cozy-page-title"><div><span>${kicker}</span><h1>${title}</h1><p>${text}</p></div>${action}</header>`;
  }

  function homePage() {
    const mission = ensureDaily();
    const dailyDone = state.daily.completed;
    const dailyProgress = `${format(state.daily.progress || 0)} / ${format(mission.target)}`;
    const firstPlayable = Q.adventure.worlds.find((world) => worldUnlocked(world) && ["budget", "scam", "savings"].includes(world.id));
    const openWorlds = Q.adventure.worlds.filter(worldUnlocked).length;
    return `<section class="home-command"><div class="home-greeting"><span>${tr("home.kicker")}</span><h1>${tr("home.greeting", { name: esc(displayNickname()) })}</h1><p>${tr("home.intro")}</p></div><div class="home-overview" aria-label="${esc(tr("home.overview"))}"><span><b>${format(state.xp)}</b><small>${tr("home.xpLabel")}</small></span><span><b>${format(state.collectibles.stars)}</b><small>${tr("home.starsLabel")}</small></span><span><b>${format(openWorlds)}</b><small>${tr("home.worldsLabel")}</small></span><button class="sound-quick ${state.sound ? "on" : ""}" data-action="toggle-sound" aria-label="${esc(tr("settings.sound"))}">${state.sound ? "♪" : "♪̸"}</button></div></section>
      <section class="home-adventure-grid"><article class="daily-quest cozy-card"><div class="quest-luma">${Q.lumaFace(dailyDone ? "celebrate" : "excited")}</div><div class="quest-copy"><span>${tr("home.dailyKicker", { xp: format(mission.xp) })}</span><h2>${missionText(mission)}</h2><p>${dailyDone ? tr("home.dailyDone") : tr("home.dailyProgress", { progress: dailyProgress })}</p><button class="cozy-button ${dailyDone ? "secondary" : "primary"}" data-action="start-daily" ${dailyDone ? "disabled" : ""}>${dailyDone ? tr("home.missionDone") : tr("home.startMission")}</button></div></article><article class="continue-card cozy-card"><span>${tr("home.continueKicker")}</span><h2>${firstPlayable?.game || tr("home.continueDefaultTitle")}</h2><p>${firstPlayable ? worldDescription(firstPlayable) : tr("home.continueDefaultText")}</p><button class="cozy-button secondary" data-world="${firstPlayable?.id || "budget"}">${tr("home.openWorld")} ${forwardArrow()}</button><div class="continue-art">${firstPlayable?.icon || "🏘️"}</div></article></section>
      <section class="map-section"><div class="section-title"><div><span>${tr("home.mapKicker")}</span><h2>${tr("home.mapTitle")}</h2></div><button class="cozy-link" data-route="adventure">${tr("home.fullMap")} ${forwardArrow()}</button></div>${worldMap(false)}</section>
      <section class="quick-adventures"><div class="section-title"><div><span>${tr("home.quickKicker")}</span><h2>${tr("home.quickTitle")}</h2></div></div><div class="quick-grid"><button data-route="minis"><span>🎲</span><b>${tr("home.minisTitle")}</b><small>${tr("home.minisText")}</small></button><button data-route="learn"><span>📚</span><b>${tr("home.learnTitle")}</b><small>${tr("home.learnText")}</small></button><button data-route="simulators"><span>🧮</span><b>${tr("home.labTitle")}</b><small>${tr("home.labText")}</small></button><button data-route="progress"><span>🏆</span><b>${tr("home.progressTitle")}</b><small>${tr("home.progressText", { badges: format(state.unlockedBadges.length), stars: format(state.collectibles.stars) })}</small></button></div></section>`;
  }

  function worldMap(full = true) {
    return `<div class="world-map ${full ? "full" : "compact"}"><div class="map-cloud one"></div><div class="map-cloud two"></div><div class="map-river"></div><div class="map-path"></div>${Q.adventure.worlds.map((world) => { const unlocked = worldUnlocked(world); const completed = world.id === "budget" ? Object.keys(state.completedLevels.runner).length : world.id === "scam" ? Object.keys(state.completedLevels.maze).length : world.id === "savings" ? Object.keys(state.completedLevels.match3).length : state.completedGames[world.id] ? 1 : 0; const name = worldName(world); const status = unlocked ? (completed ? tr("worlds.completed", { count: format(completed) }) : tr("worlds.ready")) : tr("worlds.locked", { xp: format(world.unlockXp) }); return `<button class="world-node ${world.position} world-${world.color} ${unlocked ? "unlocked" : "locked"}" data-world="${world.id}" aria-label="${esc(name)}${unlocked ? "" : ` · ${esc(tr("worlds.lockedLabel", { xp: format(world.unlockXp) }))}`}"><span class="world-building">${world.icon}</span><strong>${name}</strong><small>${status}</small><i>${unlocked ? (completed ? "✓" : world.order) : "🔒"}</i></button>`; }).join("")}<div class="map-player">${avatarArt(state.avatarId, "small")}<span>${esc(displayNickname())}</span></div><div class="map-luma">${Q.lumaFace("happy")}</div></div>`;
  }

  function adventurePage() {
    return `${pageTitle("العالم الكبير", "خريطة المغامرة", "كل منطقة بتعلم مهارة مختلفة. كمّلي المستويات علشان تفتحي طرق جديدة.")}<section class="full-map-wrap">${worldMap(true)}<div class="map-legend"><span>✓ منطقة مفتوحة</span><span>🔒 محتاجة XP</span><span>⭐ مرحلة مكتملة</span></div></section>`;
  }

  function worldPage() {
    const world = Q.adventure.worlds.find((item) => item.id === selectedWorld) || Q.adventure.worlds[0];
    if (!worldUnlocked(world)) return `${pageTitle("طريق مقفول", world.name, `اجمعي ${Math.max(0, world.unlockXp - state.xp)} XP كمان علشان تفتحي المنطقة.`)}<div class="locked-world cozy-card"><div>${world.icon}</div><h2>لوما محتاجة مساعدتك في مناطق قبلها</h2><p>كمّلي مستوى أو درس أو لعبة صغيرة، وكل خطوة هتقربك من الطريق ده.</p><button class="cozy-button primary" data-route="adventure">ارجعي للخريطة</button></div>`;
    if (world.id === "plaza") return plazaPage(world);
    if (world.id === "island") return islandPage(world);
    const type = world.id === "budget" ? "runner" : world.id === "scam" ? "maze" : "match3";
    const configs = type === "runner" ? Q.adventure.runnerLevels : type === "maze" ? Q.adventure.mazeLevels : Q.adventure.matchLevels;
    const current = state.gameLevels[type] || 1;
    return `<button class="cozy-back" data-route="adventure">→ رجوع للخريطة</button><section class="world-hero world-hero-${world.color}"><div><span>${world.english}</span><h1>${world.name}</h1><p>${world.description}</p><div class="world-skill-tags"><i>5 مستويات</i><i>كيبورد ولمس</i><i>مكافآت تعليمية</i></div></div><div class="world-mascot"><span>${world.icon}</span>${Q.lumaFace("excited")}</div></section><section class="levels-section"><div class="section-title"><div><span>${world.game}</span><h2>مراحل المنطقة</h2></div></div><div class="level-cards">${configs.map((config) => { const unlocked = state.demoMode || config.level <= current; const completed = Boolean(state.completedLevels[type][config.level]); const score = completed ? Number(state.levelScores[type][config.level] || 0) : 0; return `<article class="adventure-level ${unlocked ? "" : "locked"}"><div><span>${completed ? "⭐" : unlocked ? config.level : "🔒"}</span><small>المستوى ${config.level}</small></div><h3>${config.name}</h3><p>${type === "runner" ? `مسافة ${config.target} · سرعة ${config.speed}` : type === "maze" ? `متاهة ${config.size}×${config.size} · ${config.clues} أدلة` : `${config.moves} حركة · هدف ${config.target}`}</p>${completed ? `<b>أفضل نتيجة ${score}</b>` : `<b>${unlocked ? "مستعدة" : "كمّلي المرحلة السابقة"}</b>`}<button class="cozy-button ${unlocked ? "primary" : "secondary"}" data-start-main="${type}" data-level="${config.level}" ${unlocked ? "" : "disabled"}>${completed ? "العبي تاني" : unlocked ? "ابدئي" : "مقفولة"}</button></article>`; }).join("")}</div></section>`;
  }

  function plazaPage(world) {
    const stations = [
      ["wallet", "📱", "كشك المحفظة", "راجعي الرسوم وحدود الاستخدام من القناة الرسمية."],
      ["compare", "⚖️", "محطة المقارنة", "قارني احتياجك والرسوم والشروط وطريقة الشكاوى."],
      ["receipt", "🧾", "مكتب السجل", "احتفظي برقم مرجعي للعمليات المهمة."],
      ["help", "☎️", "بوابة المساعدة", "استخدمي رقمًا أو تطبيقًا رسميًا مستقلًا."],
    ];
    const visited = state.plazaVisited || [];
    return `<button class="cozy-back" data-route="adventure">→ رجوع للخريطة</button><section class="world-hero world-hero-linen"><div><span>${world.english}</span><h1>${world.name}</h1><p>${world.description}</p></div><div class="world-mascot"><span>${world.icon}</span>${Q.lumaFace("thinking")}</div></section><div class="plaza-stations">${stations.map(([id, icon, name, tip]) => `<button class="plaza-station ${visited.includes(id) ? "visited" : ""}" data-station="${id}"><span>${icon}</span><h3>${name}</h3><p>${tip}</p><b>${visited.includes(id) ? "تمت الزيارة ✓" : "زوري المحطة ←"}</b></button>`).join("")}</div><div class="plaza-progress cozy-card"><span>جولة المستكشفة</span><i><b style="width:${(visited.length / stations.length) * 100}%"></b></i><strong>${visited.length} / ${stations.length}</strong></div>`;
  }

  function islandPage(world) {
    return `<button class="cozy-back" data-route="adventure">→ رجوع للخريطة</button><section class="island-hero"><div class="island-scene"><span>🏝️</span><i>🗝️</i><b>✦</b></div><div><span>${world.english}</span><h1>${world.name}</h1><p>خمس مواقف سريعة تجمع الميزانية والادخار والأمان. كل إجابة تفتح قطعة من صندوق الجزيرة.</p><button class="cozy-button primary big" data-action="start-master">ابدئي التحدي النهائي</button></div></section>${state.completedGames.island ? `<div class="island-complete cozy-card">🏆 فتحتي صندوق الجزيرة قبل كده. تقدري تعيدي المهمة وتحسّني النتيجة.</div>` : ""}`;
  }

  function minisPage() {
    return `${pageTitle("مهام قصيرة", "الألعاب الصغيرة", "كل لعبة دقيقة أو دقيقتين، ومهارة مالية واحدة واضحة.")}<div class="mini-game-grid">${Q.miniGames.games.map((game) => `<button class="mini-game-card ${state.completedMiniGames.includes(game.id) ? "completed" : ""}" data-mini="${game.id}"><span>${game.icon}</span><div><small>${game.english}</small><h2>${game.name}</h2><p>${game.description}</p><b>${state.completedMiniGames.includes(game.id) ? "اكتملت ✓" : "+20 XP"}</b></div><i>←</i></button>`).join("")}</div>`;
  }

  function learnPage() {
    return `${pageTitle("مكتبة لوما", "المعرفة في حكايات صغيرة", "بطاقات سريعة وتفاعل بسيط تقدري ترجعي له في أي وقت.")}<div class="learn-tabs"><button class="${learnTab === "lessons" ? "active" : ""}" data-learn-tab="lessons">الحكايات والدروس</button><button class="${learnTab === "glossary" ? "active" : ""}" data-learn-tab="glossary">قاموس الفلوس · 15 مصطلح</button></div>${learnTab === "lessons" ? `<div class="adventure-lessons">${Q.adventure.lessons.map((lesson, index) => `<button class="adventure-lesson-card ${state.completedLessons.includes(lesson.id) ? "done" : ""}" data-adventure-lesson="${lesson.id}"><span>${lesson.icon}</span><small>${lesson.category} · ${index + 1}</small><h3>${lesson.title}</h3><p>${lesson.summary}</p><b>${state.completedLessons.includes(lesson.id) ? "راجعي الحكاية ✓" : "افتحي الحكاية ←"}</b></button>`).join("")}</div>` : glossaryPage()}`;
  }

  function glossaryPage() {
    return `<div class="glossary-grid">${Q.adventure.glossary.map(([term, meaning], index) => `<button class="glossary-card ${state.glossarySeen.includes(index) ? "seen" : ""}" data-glossary="${index}"><span>${String(index + 1).padStart(2, "0")}</span><h3>${term}</h3><p>${state.glossarySeen.includes(index) ? meaning : "اضغطي علشان تكتشفي المعنى"}</p><b>${state.glossarySeen.includes(index) ? "اتعلمتيه ✓" : "+2 XP"}</b></button>`).join("")}</div>`;
  }

  function lessonPage() {
    const lesson = Q.adventure.lessons.find((item) => item.id === selectedLesson);
    if (!lesson) { view = "learn"; return learnPage(); }
    const done = state.completedLessons.includes(lesson.id);
    return `<button class="cozy-back" data-route="learn">→ رجوع للمكتبة</button><article class="story-lesson"><header><div class="lesson-illustration"><span>${lesson.icon}</span>${Q.lumaFace("thinking")}</div><div><small>${lesson.category}</small><h1>${lesson.title}</h1><p>${lesson.summary}</p></div></header><section><span>الحكاية ببساطة</span><p>${lesson.text}</p></section><aside><b>من الحياة</b><p>${lesson.example}</p></aside><section><span>تفتكري إيه؟</span><p>${lesson.takeaway}</p></section><div class="lesson-activity"><span>سؤال لوما</span><h2>${lesson.question}</h2><div>${lesson.answers.map((answer, index) => `<button data-lesson-answer="${index}">${answer}</button>`).join("")}</div><p data-lesson-feedback></p></div>${done ? `<div class="lesson-done">✓ الحكاية دي محفوظة في رحلتك</div>` : ""}</article>`;
  }

  function progressPage() {
    const accuracy = state.stats.questionsAnswered ? Math.round(state.stats.correctAnswers / state.stats.questionsAnswered * 100) : 0;
    const info = levelProgress();
    const completedLevels = Object.keys(state.completedLevels.runner).length + Object.keys(state.completedLevels.maze).length + Object.keys(state.completedLevels.match3).length;
    return `${pageTitle("دفتر الرحلة", "تقدمك وكنوزك", "كل نجمة ووسام هنا نتيجة حاجة لعبتيها أو اتعلمتيها.")}<section class="progress-hero cozy-card"><div class="progress-avatar">${avatarArt(state.avatarId, "hero")}<span>${level().icon}</span></div><div><small>رتبتك الحالية</small><h1>${level().name}</h1><p>${level().description}</p><div class="xp-road"><span>${state.xp} XP</span><i><b style="width:${info.percent}%"></b></i><em>${info.next ? `${info.remaining} للمستوى الجاي` : "وصلتي للقمة"}</em></div></div><div class="progress-luma">${Q.lumaFace("celebrate")}</div></section><div class="adventure-stats"><article><span>✦</span><strong>${state.xp}</strong><small>XP</small></article><article><span>⭐</span><strong>${state.collectibles.stars}</strong><small>نجوم</small></article><article><span>🗺️</span><strong>${completedLevels}</strong><small>مراحل</small></article><article><span>✓</span><strong>${accuracy}٪</strong><small>دقة القرارات</small></article><article><span>📚</span><strong>${state.completedLessons.length}</strong><small>حكايات</small></article></div><section class="treasure-section"><div class="section-title"><div><span>صندوق الأوسمة</span><h2>إنجازات الرحلة</h2></div></div><div class="cozy-badges">${Q.badges.map((badge) => { const unlocked = state.unlockedBadges.includes(badge.id); return `<article class="${unlocked ? "unlocked" : "locked"}"><span>${badge.icon}</span><h3>${badge.name}</h3><p>${badge.rule}</p><b>${unlocked ? "اتفتح ✓" : "لسه مخفي"}</b></article>`; }).join("")}</div></section>`;
  }

  function profilePage() {
    const avatar = currentAvatar();
    const accessories = [["star", "★", 0], ["glasses", "⌐", 150], ["flower", "✿", 350], ["pin", "◆", 650]];
    return `${pageTitle("خيمتك", "حساب البطلة", "غيري الشخصية والملابس والصوت، وكل تقدمك هيفضل محفوظ على الجهاز.", `<button class="cozy-button secondary" data-action="open-settings">الإعدادات ⚙</button>`)}<section class="profile-camp"><div class="camp-scene"><div class="camp-tent">⛺</div>${avatarArt(state.avatarId, "hero")}<div class="camp-luma">${Q.lumaFace("happy")}</div></div><div class="profile-copy"><span>${level().name}</span><h1>${esc(state.nickname)}</h1><p>هدف الرحلة · ${esc(state.learningGoal)}</p><label class="cozy-field"><span>عدّلي الاسم المستعار</span><input value="${esc(state.nickname)}" maxlength="18" data-profile-name></label><button class="cozy-button primary" data-action="save-name">حفظ الاسم</button></div></section><section class="customization"><div class="section-title"><div><span>اختاري شكل بطلتك</span><h2>الشخصية</h2></div></div><div class="avatar-choice-grid profile-choices">${Q.adventure.avatars.map((item) => `<button class="avatar-choice ${state.avatarId === item.id ? "selected" : ""}" data-profile-avatar="${item.id}">${avatarArt(item.id, "large")}<b>${item.name}</b></button>`).join("")}</div><div class="section-title outfit-title"><div><span>تفصيلة جديدة</span><h2>لون اللبس</h2></div></div><div class="outfit-options">${["sage", "blush", "taupe", "linen"].map((color) => `<button class="outfit-${color} ${state.outfit === color ? "selected" : ""}" data-outfit="${color}"><i></i><span>${{ sage: "سيج", blush: "بلَش", taupe: "تاوب", linen: "لينن" }[color]}</span></button>`).join("")}</div><div class="section-title outfit-title"><div><span>مكافآت بتتفتح مع XP</span><h2>الإكسسوارات</h2></div></div><div class="accessory-options">${accessories.map(([id, symbol, threshold]) => { const unlocked = state.demoMode || state.xp >= threshold; return `<button class="${state.accessory === id ? "selected" : ""} ${unlocked ? "" : "locked"}" data-accessory="${id}" data-threshold="${threshold}" ${unlocked ? "" : "disabled"}><i>${unlocked ? symbol : "🔒"}</i><span>${unlocked ? (id === "star" ? "نجمة" : id === "glasses" ? "نظارة" : id === "flower" ? "وردة" : "دبوس") : `${threshold} XP`}</span></button>`; }).join("")}</div></section>`;
  }

  function settingsModal() {
    modal(`<button class="modal-x" data-action="close-modal" aria-label="${tr("settings.close")}">×</button><div class="settings-luma">${Q.lumaFace("thinking")}</div><span class="cozy-kicker">${tr("settings.kicker")}</span><h2>${tr("settings.title")}</h2><div class="settings-language">${languageSwitcher("modal-language")}</div><label class="setting-line"><span><b>${tr("settings.sound")}</b><small>${tr("settings.soundHint")}</small></span><input type="checkbox" data-setting="sound" ${state.sound ? "checked" : ""}></label><label class="setting-line"><span><b>${tr("settings.music")}</b><small>${tr("settings.musicHint")}</small></span><input type="checkbox" data-setting="music" ${state.music ? "checked" : ""}></label><label class="volume-line"><span>${tr("settings.volume")}</span><input type="range" min="0" max="1" step="0.05" value="${state.volume}" data-setting-range="volume"></label><label class="setting-line"><span><b>${tr("settings.reduceMotion")}</b><small>${tr("settings.reduceMotionHint")}</small></span><input type="checkbox" data-setting="reduceMotion" ${state.reduceMotion ? "checked" : ""}></label><button class="reset-adventure" data-action="reset-adventure">↻ ${tr("settings.reset")}</button>`);
  }

  function simulatorsPage() {
    return `${pageTitle("مختبر التخطيط", "جربي الأرقام من غير مخاطرة", "كل المبالغ افتراضية، والنتائج للتعلم فقط.")}<div class="sim-tabs"><button class="${simTab === "budget" ? "active" : ""}" data-sim-tab="budget">مخطط الميزانية</button><button class="${simTab === "goal" ? "active" : ""}" data-sim-tab="goal">هدف الادخار</button><button class="${simTab === "gameya" ? "active" : ""}" data-sim-tab="gameya">الجمعية الذكية</button></div><div class="sim-content">${simTab === "budget" ? budgetSimulator() : simTab === "goal" ? goalSimulator() : gameyaSimulator()}</div>`;
  }

  function budgetSimulator() {
    const total = Object.values(budgetDraft).reduce((sum, value) => sum + Number(value), 0);
    const remaining = 5000 - total;
    const labels = { basics: "أساسيات", transport: "مواصلات", food: "أكل", personal: "شخصي", savings: "ادخار", emergency: "طوارئ" };
    return `<section class="budget-lab"><div class="lab-summary"><span>ميزانية افتراضية</span><h2>5,000 ج.م</h2><div class="budget-donut" data-budget-donut style="--saving:${Math.round((budgetDraft.savings / 5000) * 100)}"><b data-budget-remaining>${remaining}</b><small>متبقي</small></div><p data-budget-note class="${remaining < 0 ? "warn" : ""}">${remaining < 0 ? "التوزيع أكبر من الميزانية" : `نسبة الادخار ${Math.round((budgetDraft.savings / 5000) * 100)}٪`}</p></div><div class="budget-controls">${Object.entries(labels).map(([id, label]) => `<label><span>${label}<b data-budget-value="${id}">${budgetDraft[id]} ج.م</b></span><input type="range" min="0" max="2200" step="50" value="${budgetDraft[id]}" data-budget-input="${id}"></label>`).join("")}</div></section>`;
  }

  function goalSimulator() {
    const goal = state.savingsGoal;
    const remaining = Math.max(0, goal.target - goal.saved);
    const periods = Math.ceil(remaining / Math.max(1, goal.periodic));
    const months = goal.frequency === "أسبوعي" ? Math.ceil(periods / 4.345) : periods;
    const percent = Math.min(100, Math.round(goal.saved / goal.target * 100));
    return `<form class="goal-lab" id="goal-simulator"><div class="goal-garden"><div class="sim-plant stage-${Math.floor(percent / 20)}">🌱</div><span>${percent}٪</span><h2>${esc(goal.name)}</h2><i><b style="width:${percent}%"></b></i><p>حوالي ${months} شهر للوصول إذا استمرت المساهمة.</p></div><div class="goal-fields"><label class="cozy-field"><span>اسم الهدف</span><input name="name" value="${esc(goal.name)}" required></label><label class="cozy-field"><span>سعر الهدف</span><input type="number" name="target" min="500" step="100" value="${goal.target}" required></label><label class="cozy-field"><span>المبلغ الحالي</span><input type="number" name="saved" min="0" step="100" value="${goal.saved}" required></label><label class="cozy-field"><span>المساهمة</span><input type="number" name="periodic" min="50" step="50" value="${goal.periodic}" required></label><label class="cozy-field"><span>التكرار</span><select name="frequency"><option ${goal.frequency === "شهري" ? "selected" : ""}>شهري</option><option ${goal.frequency === "أسبوعي" ? "selected" : ""}>أسبوعي</option></select></label><button class="cozy-button primary" type="submit">حدّثي الخطة</button></div></form>`;
  }

  function gameyaSimulator() {
    const base = 8500 + state.group.contributed;
    const percent = Math.min(100, Math.round(base / 12000 * 100));
    return `<section class="gameya-lab"><div class="simulation-banner">محاكاة تعليمية فقط — لا توجد أموال حقيقية أو تحويلات مالية.</div><div class="gameya-house"><span>🏡</span><div><small>هدف جماعي افتراضي</small><h2>كورس المستقبل</h2><p>5 مشاركات · مساهمة مقترحة 500 ج.م شهريًا</p></div></div><div class="gameya-meter"><strong>${format(base)} ج.م</strong><span>من 12,000 ج.م</span><i><b style="width:${percent}%"></b></i></div><div class="gameya-people">${["مريم", "سلمى", "نور", "رانيا", state.nickname].map((name, index) => `<span>${avatarArt(Q.adventure.avatars[index % 4].id, "tiny")}<b>${esc(name)}</b></span>`).join("")}</div>${state.group.joined ? `<button class="cozy-button primary" data-action="gameya-contribute">ضيفي 250 ج.م افتراضية</button><p>مساهمتك الحالية ${format(state.group.contributed)} ج.م افتراضية.</p>` : `<button class="cozy-button primary" data-action="gameya-join">انضمي للمحاكاة</button>`}</section>`;
  }

  function render() {
    Q.i18n.use(state.locale);
    document.body.className = "adventure-body";
    if (view === "welcome") root.innerHTML = welcomePage();
    else if (view === "onboarding") root.innerHTML = onboardingPage();
    else if (view === "game") return;
    else {
      const pages = { home: homePage, adventure: adventurePage, world: worldPage, minis: minisPage, learn: learnPage, lesson: lessonPage, progress: progressPage, profile: profilePage, simulators: simulatorsPage };
      root.innerHTML = shell((pages[view] || homePage)());
    }
    window.scrollTo({ top: 0, behavior: state.reduceMotion ? "auto" : "smooth" });
  }

  function resetScrollPosition() {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function modal(content) {
    if (!modalRoot.firstElementChild) modalReturnFocus = document.activeElement;
    modalRoot.innerHTML = `<div class="cozy-modal-backdrop"><div class="cozy-modal" role="dialog" aria-modal="true" tabindex="-1">${content}</div></div>`;
    const focusDialog = () => {
      const dialog = modalRoot.querySelector("[role='dialog']");
      const focusable = dialog?.querySelector("button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])");
      (focusable || dialog)?.focus();
    };
    focusDialog();
    requestAnimationFrame(focusDialog);
  }

  function closeModal() {
    modalRoot.innerHTML = "";
    if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
    modalReturnFocus = null;
  }

  function createSession(meta) {
    if (activeSession) activeSession.active = false;
    activeSession = { id: ++sessionSequence, active: true, completionHandled: false, meta };
    return activeSession;
  }

  function leaveGame(nextView, session = activeSession) {
    if (session && activeSession && session !== activeSession) return;
    if (activeSession) activeSession.active = false;
    activeEngine?.destroy?.();
    activeEngine = null;
    activeSession = null;
    activeGame = null;
    Q.activeEngine = null;
    view = nextView;
    render();
    resetScrollPosition();
  }

  function startMainGame(type, levelNumber) {
    activeEngine?.destroy?.();
    if (activeSession) activeSession.active = false;
    resetScrollPosition();
    activeGame = { type, level: levelNumber };
    const session = createSession(activeGame);
    view = "game";
    root.innerHTML = `<div id="game-host" class="game-host ${state.reduceMotion ? "reduce-motion" : ""}"></div>`;
    document.body.className = `adventure-body active-game ${state.reduceMotion ? "reduce-motion" : ""}`;
    resetScrollPosition();
    const host = document.getElementById("game-host");
    const common = {
      level: levelNumber,
      avatarFace: currentAvatar().name[0],
      reduceMotion: state.reduceMotion,
      onFinish: (result) => handleGameFinish(result, session),
      onEvent: (event) => handleGameEvent(event, session),
      onReplay: (next) => { if (session.active) startMainGame(type, next); },
      onExit: () => leaveGame("adventure", session),
    };
    activeEngine = type === "runner" ? Q.runnerGame.mount(host, common) : type === "maze" ? Q.mazeGame.mount(host, common) : Q.match3Game.mount(host, common);
  }

  function startMini(id) {
    activeEngine?.destroy?.();
    if (activeSession) activeSession.active = false;
    resetScrollPosition();
    view = "game";
    activeGame = { type: "mini", id };
    const session = createSession(activeGame);
    root.innerHTML = `<div id="game-host" class="game-host ${state.reduceMotion ? "reduce-motion" : ""}"></div>`;
    document.body.className = `adventure-body active-game ${state.reduceMotion ? "reduce-motion" : ""}`;
    resetScrollPosition();
    activeEngine = Q.miniGames.mount(document.getElementById("game-host"), id, {
      reduceMotion: state.reduceMotion,
      onFinish: (result) => handleGameFinish(result, session),
      onReplay: () => { if (session.active) startMini(id); },
      onExit: () => leaveGame("minis", session),
    });
  }

  function exitGame() { leaveGame("adventure"); }

  function handleGameEvent(event, session) {
    if (!session?.active || session !== activeSession || session.completionHandled) return;
    recordDailyEvent(event.type, event.amount || 1);
  }

  function handleGameFinish(result, session) {
    if (!session?.active || session !== activeSession || session.completionHandled) return;
    session.completionHandled = true;
    if (result.game.startsWith("mini-")) {
      if (!state.completedMiniGames.includes(result.id)) { state.completedMiniGames.push(result.id); Q.gamification.addXp(state, result.xp, "لعبة صغيرة"); }
    } else {
      if (result.won) {
        const prior = Number(state.levelScores[result.game][result.level] || 0);
        const firstSuccess = !state.completedLevels[result.game][result.level];
        const firstReward = !state.awardedLevels[result.game][result.level];
        const completedId = result.game === "runner" ? "budget" : result.game === "maze" ? "scam" : "savings";
        state.completedLevels[result.game][result.level] = true;
        state.levelScores[result.game][result.level] = Math.max(prior, result.score);
        state.completedGames[completedId] = true;
        state.gameScores[completedId] = Math.max(state.gameScores[completedId] || 0, result.score);
        state.gameLevels[result.game] = Math.max(state.gameLevels[result.game], Math.min(5, result.level + 1));
        if (firstSuccess) state.stats.gamesCompleted += 1;
        if (firstReward) {
          state.awardedLevels[result.game][result.level] = true;
          Q.gamification.addXp(state, result.xp, "إكمال مستوى");
        } else Q.gamification.unlockBadges(state);
        recordDailyEvent("level", 1);
      }
      state.collectibles.stars += Number(result.stars || 0);
      state.collectibles.tokens += Number(result.tokens || 0);
      state.collectibles.shields += Number(result.shields || 0);
      state.collectibles.clues += Number(result.clues || 0);
      state.stats.questionsAnswered += 1;
      if (result.won) state.stats.correctAnswers += 1;
    }
    save();
  }

  function startMaster() {
    const questions = [Q.games.budget.scenarios[3], Q.games.scam.scenarios[1], Q.games.savings.scenarios[3], Q.games.scam.scenarios[2], Q.games.budget.scenarios[4]];
    master = { index: 0, score: 0, questions };
    modal(masterQuestion());
  }

  function masterQuestion(feedback = "") {
    const item = master.questions[master.index];
    const title = item.title || item.sender;
    const text = item.story || item.message;
    return `<button class="modal-x" data-action="close-modal">×</button><div class="master-head"><span>قطعة المفتاح ${master.index + 1} / ${master.questions.length}</span><i>${"◆".repeat(master.index)}${"◇".repeat(master.questions.length - master.index)}</i></div><h2>${title}</h2><p>${text}</p><div class="master-choices">${item.choices.map((choice, index) => `<button data-master-answer="${index}" ${feedback ? "disabled" : ""}>${choice.text}</button>`).join("")}</div>${feedback}`;
  }

  function finishMaster() {
    const first = !state.completedGames.island;
    state.completedGames.island = true;
    if (first) Q.gamification.addXp(state, 80, "تحدي الجزيرة");
    state.gameScores.island = Math.max(state.gameScores.island || 0, Math.round(master.score / 15 * 100));
    save(); Q.sound.success();
    modal(`<button class="modal-x" data-action="close-modal">×</button><div class="island-reward">🏆</div><span class="cozy-kicker">الصندوق اتفتح!</span><h2>بطلة قدّها وصلت الجزيرة</h2><p>جمعتي ${master.score} من 15 نقطة في قرارات متنوعة.</p><button class="cozy-button primary" data-action="close-modal">خدي الكنز وارجعي</button>`);
  }

  document.addEventListener("click", (event) => {
    if (event.target.classList.contains("cozy-modal-backdrop")) { closeModal(); return; }
    const localeChoice = event.target.closest("[data-switch-locale]")?.dataset.switchLocale;
    if (localeChoice) {
      const fromSettings = Boolean(event.target.closest(".settings-language"));
      if (setLocale(localeChoice)) {
        if (fromSettings) settingsModal();
        requestAnimationFrame(() => document.querySelector(`[data-switch-locale="${localeChoice}"]`)?.focus());
      }
      return;
    }
    const route = event.target.closest("[data-route]")?.dataset.route;
    if (route) {
      if (activeSession) activeSession.active = false;
      activeEngine?.destroy?.(); activeEngine = null; activeSession = null; activeGame = null; Q.activeEngine = null;
      view = route; selectedLesson = null; Q.sound.click(); render();
      requestAnimationFrame(() => [...document.querySelectorAll(`[data-route="${route}"]`)].find((item) => item.offsetParent !== null)?.focus());
      return;
    }
    const worldId = event.target.closest("[data-world]")?.dataset.world;
    if (worldId) { selectedWorld = worldId; view = "world"; Q.sound.click(); render(); return; }
    const mainStart = event.target.closest("[data-start-main]");
    if (mainStart) { startMainGame(mainStart.dataset.startMain, Number(mainStart.dataset.level)); return; }
    const miniId = event.target.closest("[data-mini]")?.dataset.mini;
    if (miniId) { startMini(miniId); return; }
    const avatarChoice = event.target.closest("[data-choose-avatar]")?.dataset.chooseAvatar;
    if (avatarChoice) { chosenAvatar = avatarChoice; Q.sound.click(); render(); return; }
    const profileAvatar = event.target.closest("[data-profile-avatar]")?.dataset.profileAvatar;
    if (profileAvatar) { state.avatarId = profileAvatar; state.avatar = (Q.adventure.avatars.find((item) => item.id === profileAvatar)?.name || "ن")[0]; save(); Q.sound.collect(); render(); return; }
    const outfit = event.target.closest("[data-outfit]")?.dataset.outfit;
    if (outfit) { state.outfit = outfit; save(); Q.sound.click(); render(); return; }
    const accessory = event.target.closest("[data-accessory]")?.dataset.accessory;
    if (accessory) { state.accessory = accessory; if (!state.unlockedAccessories.includes(accessory)) state.unlockedAccessories.push(accessory); save(); Q.sound.collect(); render(); return; }
    const tab = event.target.closest("[data-learn-tab]")?.dataset.learnTab;
    if (tab) { learnTab = tab; Q.sound.click(); render(); return; }
    const lesson = event.target.closest("[data-adventure-lesson]")?.dataset.adventureLesson;
    if (lesson) { selectedLesson = lesson; view = "lesson"; Q.sound.click(); render(); return; }
    const glossary = event.target.closest("[data-glossary]")?.dataset.glossary;
    if (glossary != null) { const index = Number(glossary); if (!state.glossarySeen.includes(index)) { state.glossarySeen.push(index); Q.gamification.addXp(state, 2, "مصطلح جديد"); } recordDailyEvent("glossary", 1); save(); Q.sound.clue(); render(); return; }
    const sim = event.target.closest("[data-sim-tab]")?.dataset.simTab;
    if (sim) { simTab = sim; Q.sound.click(); render(); return; }
    const station = event.target.closest("[data-station]")?.dataset.station;
    if (station) {
      state.plazaVisited = state.plazaVisited || [];
      if (!state.plazaVisited.includes(station)) { state.plazaVisited.push(station); Q.gamification.addXp(state, 8, "اكتشاف محطة"); if (state.plazaVisited.length === 4 && !state.completedGames.plaza) { state.completedGames.plaza = true; Q.gamification.addXp(state, 35, "إكمال ساحة الخدمات"); Q.sound.success(); } else Q.sound.clue(); save(); }
      render(); return;
    }
    const answer = event.target.closest("[data-lesson-answer]");
    if (answer) {
      const current = Q.adventure.lessons.find((item) => item.id === selectedLesson);
      const index = Number(answer.dataset.lessonAnswer);
      const feedback = document.querySelector("[data-lesson-feedback]");
      if (index === current.correct) {
        feedback.textContent = `شاطرة! ${current.takeaway}`; feedback.className = "good"; Q.sound.success();
        if (!state.completedLessons.includes(current.id)) { state.completedLessons.push(current.id); state.stats.lessonsCompleted = state.completedLessons.length; Q.gamification.addXp(state, 15, "حكاية معرفة"); }
        recordDailyEvent("lesson", 1); save();
      } else { feedback.textContent = "قريبة! ارجعي للمثال وجربي اختيار تاني."; feedback.className = "learn"; Q.sound.fail(); }
      return;
    }
    const masterAnswer = event.target.closest("[data-master-answer]");
    if (masterAnswer) {
      const item = master.questions[master.index]; const choice = item.choices[Number(masterAnswer.dataset.masterAnswer)]; const good = choice.score >= 3; master.score += choice.score; if (good) Q.sound.success(); else Q.sound.fail();
      modal(masterQuestion(`<div class="game-feedback ${good ? "good" : "learn"}"><b>${good ? "قطعة مفتاح جديدة!" : "لوما حفظت الدرس"}</b><p>${choice.feedback}</p><button data-action="master-next">${master.index === master.questions.length - 1 ? "افتحي الصندوق" : "القطعة اللي بعدها"} ←</button></div>`));
      return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "about-adventure") document.getElementById("adventure-about")?.scrollIntoView({ behavior: "smooth" });
    if (action === "begin-adventure") { view = "onboarding"; onboardingStep = 0; render(); }
    if (action === "onboarding-next") { onboardingStep = Math.min(2, onboardingStep + 1); render(); }
    if (action === "quick-demo") { state.adventureOnboarded = true; state.onboarded = true; state.demoMode = true; state.nickname = Q.i18n.locale === "en" ? "Noor" : "نور"; state.avatarId = chosenAvatar; state.avatar = Q.i18n.locale === "en" ? "N" : "ن"; save(); view = "home"; render(); }
    if (action === "start-daily") {
      const mission = ensureDaily();
      if (mission.id === "mission-clues") { selectedWorld = "scam"; view = "world"; }
      else if (mission.id === "mission-match") { selectedWorld = "savings"; view = "world"; }
      else if (mission.id === "mission-term") { learnTab = "glossary"; view = "learn"; }
      else if (mission.id === "mission-lesson") { learnTab = "lessons"; view = "learn"; }
      else view = "adventure";
      render();
    }
    if (action === "toggle-sound") { state.sound = !state.sound; if (!state.sound) Q.sound.stopMusic(); save(); render(); }
    if (action === "open-settings") settingsModal();
    if (action === "close-modal") closeModal();
    if (action === "save-name") { const input = document.querySelector("[data-profile-name]"); state.nickname = input.value.trim().slice(0, 18) || state.nickname; save(); toast("الاسم اتحفظ", "success"); render(); }
    if (action === "gameya-join") { state.group.joined = true; save(); Q.sound.success(); render(); }
    if (action === "gameya-contribute") { state.group.contributed = Math.min(3500, state.group.contributed + 250); save(); Q.sound.collect(); render(); }
    if (action === "start-master") startMaster();
    if (action === "master-next") { master.index += 1; if (master.index >= master.questions.length) finishMaster(); else modal(masterQuestion()); }
    if (action === "reset-adventure") modal(`<button class="modal-x" data-action="close-modal">×</button><div class="settings-luma">${Q.lumaFace("encourage")}</div><h2>نرجع لأول المغامرة؟</h2><p>هيمسح الاسم والنجوم والمراحل من المتصفح ويرجع شاشة البداية.</p><div class="confirm-actions"><button class="cozy-button danger" data-action="confirm-reset-adventure">امسحي بيانات العرض</button><button class="cozy-button secondary" data-action="close-modal">إلغاء</button></div>`);
    if (action === "confirm-reset-adventure") { state = Q.storage.reset(); activeEngine?.destroy?.(); activeEngine = null; closeModal(); view = "welcome"; onboardingStep = 0; render(); toast("بدأنا عالم قدّها من جديد"); }
  });

  document.addEventListener("input", (event) => {
    const budgetKey = event.target.dataset.budgetInput;
    if (budgetKey) {
      budgetDraft[budgetKey] = Number(event.target.value);
      document.querySelector(`[data-budget-value="${budgetKey}"]`).textContent = `${budgetDraft[budgetKey]} ج.م`;
      const total = Object.values(budgetDraft).reduce((sum, value) => sum + Number(value), 0);
      const remaining = 5000 - total;
      document.querySelector("[data-budget-remaining]").textContent = remaining;
      const note = document.querySelector("[data-budget-note]");
      note.textContent = remaining < 0 ? "التوزيع أكبر من الميزانية" : `نسبة الادخار ${Math.round((budgetDraft.savings / 5000) * 100)}٪`;
      note.classList.toggle("warn", remaining < 0);
      document.querySelector("[data-budget-donut]").style.setProperty("--saving", Math.round((budgetDraft.savings / 5000) * 100));
    }
    const settingRange = event.target.dataset.settingRange;
    if (settingRange) { state[settingRange] = Number(event.target.value); save(); }
  });

  document.addEventListener("change", (event) => {
    const setting = event.target.dataset.setting;
    if (!setting) return;
    state[setting] = event.target.checked;
    if (setting === "music") state.music ? Q.sound.startMusic() : Q.sound.stopMusic();
    if (setting === "sound" && !state.sound) Q.sound.stopMusic();
    if (setting === "reduceMotion") {
      document.querySelector(".qadha-world-app")?.classList.toggle("reduce-motion", state.reduceMotion);
      document.body.classList.toggle("reduce-motion", state.reduceMotion);
    }
    save();
  });

  document.addEventListener("keydown", (event) => {
    const dialog = modalRoot.querySelector("[role='dialog']");
    if (!dialog) return;
    if (event.key === "Escape") { event.preventDefault(); closeModal(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])")].filter((item) => item.offsetParent !== null);
    if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "adventure-profile") {
      event.preventDefault(); const data = new FormData(event.target);
      const defaultNickname = Q.i18n.locale === "en" ? "Noor" : "نور";
      state.nickname = String(data.get("nickname") || defaultNickname).trim().slice(0, 18) || defaultNickname;
      state.learningGoal = String(data.get("goal")); state.avatarId = chosenAvatar; state.avatar = currentAvatar().name?.[0] || "ن"; state.adventureOnboarded = true; state.onboarded = true; save(); Q.sound.success(); view = "home"; render();
    }
    if (event.target.id === "goal-simulator") {
      event.preventDefault(); const data = new FormData(event.target); const target = Math.max(500, Number(data.get("target"))); const saved = Math.min(target, Math.max(0, Number(data.get("saved"))));
      state.savingsGoal = { name: String(data.get("name")), target, saved, periodic: Math.max(50, Number(data.get("periodic"))), frequency: String(data.get("frequency")) }; save(); Q.sound.success(); toast("الخطة الافتراضية اتحدثت", "success"); render();
    }
  });

  Q.ui = { toast };
  function setLocale(locale) {
    if (!Q.i18n.available().includes(locale) || activeGame) return false;
    state.locale = Q.i18n.use(locale);
    save();
    render();
    return true;
  }

  Q.app = { get state() { return state; }, render, setLocale, startMainGame, recordDailyEvent, currentMission };
  render();
})();
