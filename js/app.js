(function () {
  const Q = (window.Qadha = window.Qadha || {});
  const root = document.getElementById("app");
  let state = Q.storage.load();
  let welcomeMode = state.onboarded ? null : "welcome";
  let onboardingStep = 0;
  let activeGame = null;
  let gameStage = "intro";
  let session = null;
  let activeLesson = null;
  let lessonAnswered = false;
  let dailyFeedback = null;

  const icons = {
    home: "⌂",
    games: "◈",
    learn: "▤",
    achievements: "✦",
    profile: "◉",
    group: "♧",
    settings: "⚙",
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function money(value) {
    return `${new Intl.NumberFormat("ar-EG").format(Math.round(value || 0))} ج.م`;
  }

  function save() {
    Q.gamification.unlockBadges(state);
    Q.storage.save(state);
  }

  function toast(message, type = "info") {
    const region = document.getElementById("toast-region");
    const item = document.createElement("div");
    item.className = `toast toast-${type}`;
    item.textContent = message;
    region.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => {
      item.classList.remove("show");
      setTimeout(() => item.remove(), 250);
    }, 3200);
  }

  function progress(value, label = "") {
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    return `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${safe}" aria-label="${escapeHtml(label)}"><span style="width:${safe}%"></span></div>`;
  }

  function brand(size = "normal") {
    return `<div class="brand brand-${size}"><span class="brand-mark" aria-hidden="true"><i></i></span><span><strong>قدّها</strong><small>QADHA</small></span></div>`;
  }

  function welcome() {
    return `<main class="welcome-page">
      <header class="welcome-top">${brand()}<button class="text-button" data-action="about">اعرفي أكتر</button></header>
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">تعلّم مالي بطريقة مختلفة</span>
          <h1>فلوسك<br><em>قرارك.</em></h1>
          <p>العبي مواقف من الحياة، افهمي أثر اختياراتك، وابني ثقة مالية خطوة بخطوة.</p>
          <div class="hero-actions">
            <button class="button primary large" data-action="start-onboarding">ابدئي رحلتك <span>←</span></button>
            <button class="button ghost large" data-action="try-demo">دخول سريع للعرض</button>
          </div>
          <div class="trust-row"><span>✓ من غير بيانات شخصية</span><span>✓ فلوس افتراضية</span><span>✓ تقدم محفوظ</span></div>
        </div>
        <div class="hero-visual" aria-label="تصور بصري للنمو المالي والتعلم">
          <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
          <div class="visual-card card-balance"><small>قرار ذكي</small><strong>+10 XP</strong><span>اختيار مناسب لميزانيتك</span></div>
          <div class="visual-card card-goal"><span class="sprout">♧</span><small>هدفك</small><strong>30٪</strong>${progress(30, "تقدم هدف الادخار")}</div>
          <div class="visual-card card-safe"><span class="shield">✓</span><strong>مصدر موثّق</strong><small>اتأكدي قبل ما تضغطي</small></div>
          <div class="coin coin-a">ق</div><div class="coin coin-b">✦</div>
        </div>
      </section>
      <section class="welcome-value" id="about">
        <article><span>01</span><h3>مواقف قريبة منك</h3><p>ميزانية، ادخار وأمان رقمي من تفاصيل الحياة اليومية.</p></article>
        <article><span>02</span><h3>تتعلمي من القرار</h3><p>كل اختيار له نتيجة وشرح بسيط يساعدك تفهمي ليه.</p></article>
        <article><span>03</span><h3>تشوفي تقدمك</h3><p>نقاط ومستويات وأوسمة تخلي كل خطوة واضحة ومشجعة.</p></article>
      </section>
      <footer class="welcome-footer">قدّها منصة تعليمية تجريبية. المحتوى للتوعية والتعلم فقط.</footer>
    </main>`;
  }

  const onboardingSlides = [
    { icon: "✦", tag: "أهلاً بيكي", title: "رحلة صغيرة لقرارات أذكى", text: "قدّها بتبسط المعرفة المالية من خلال مواقف تختاري فيها وتشوفي أثر القرار فورًا." },
    { icon: "◈", tag: "العبي واتعلمي", title: "3 ألعاب من الحياة اليومية", text: "نظمي ميزانية، اكتشفي الاحتيال، وابني خطة لهدف مهم ليكي." },
    { icon: "◎", tag: "تقدّم واضح", title: "كل خطوة بتتحسب", text: "اكسبي XP، ارفعي مستواكي، وافتحي أوسمة مع كل نشاط تكمليه." },
  ];

  function onboarding() {
    const total = 4;
    if (onboardingStep < 3) {
      const slide = onboardingSlides[onboardingStep];
      return `<main class="onboarding-page">
        <div class="onboarding-card">
          <div class="onboarding-head">${brand("small")}<button class="text-button muted" data-action="skip-onboarding">تخطي</button></div>
          <div class="onboarding-art art-${onboardingStep}"><span>${slide.icon}</span><i></i><b></b></div>
          <div class="slide-count">${onboardingStep + 1} / ${total}</div>
          <span class="eyebrow">${slide.tag}</span><h2>${slide.title}</h2><p>${slide.text}</p>
          <div class="onboarding-foot"><div class="dots">${[0, 1, 2, 3].map((n) => `<i class="${n === onboardingStep ? "active" : ""}"></i>`).join("")}</div><button class="button primary circle" data-action="next-onboarding" aria-label="التالي">←</button></div>
        </div>
      </main>`;
    }
    return `<main class="onboarding-page"><form class="onboarding-card setup-card" id="profile-setup">
      <div class="onboarding-head">${brand("small")}<span class="slide-count">4 / 4</span></div>
      <span class="eyebrow">خلّي التجربة شبهك</span><h2>نندهلك بإيه؟</h2><p>اسم مستعار كفاية. مش بنطلب أي بيانات شخصية أو مالية.</p>
      <label class="field"><span>الاسم اللي تحبيه</span><input name="nickname" maxlength="20" value="${state.nickname === "يا بطلة" ? "" : escapeHtml(state.nickname)}" placeholder="مثال: نور" required /></label>
      <fieldset class="avatar-picker"><legend>اختاري رمزك</legend>${["ن", "س", "م", "ر", "✦"].map((a) => `<label><input type="radio" name="avatar" value="${a}" ${state.avatar === a ? "checked" : ""}><span>${a}</span></label>`).join("")}</fieldset>
      <label class="field"><span>هدفك الأول</span><select name="goal"><option>تنظيم المصاريف</option><option>تعلم الادخار</option><option>اكتشاف الاحتيال</option><option>فهم الخدمات المالية</option></select></label>
      <button class="button primary wide large" type="submit">يلا نبدأ <span>←</span></button>
      <button class="text-button muted center" type="button" data-action="quick-setup">كمّلي بإعدادات العرض</button>
    </form></main>`;
  }

  function navItem(route, label) {
    const active = Q.navigation.getRoute() === route;
    return `<button class="nav-item ${active ? "active" : ""}" data-route="${route}" ${active ? 'aria-current="page"' : ""}><span>${icons[route]}</span><b>${label}</b></button>`;
  }

  function appShell(content) {
    return `<div class="app-layout ${state.reduceMotion ? "reduce-motion" : ""}">
      <aside class="sidebar">
        ${brand()}
        <nav aria-label="التنقل الرئيسي">${navItem("home", "الرئيسية")}${navItem("games", "الألعاب")}${navItem("learn", "تعلمي")}${navItem("achievements", "إنجازاتي")}${navItem("profile", "حسابي")}</nav>
        <button class="group-promo" data-route="group"><span>♧</span><div><b>الجمعية الذكية</b><small>محاكاة ادخار جماعي</small></div><i>←</i></button>
        <div class="sidebar-foot"><button data-route="settings"><span>⚙</span> الإعدادات</button><small>نسخة العرض الجامعي · v1.0</small></div>
      </aside>
      <div class="app-main">
        <div class="mobile-top">${brand("small")}<button class="avatar small" data-route="profile">${escapeHtml(state.avatar)}</button></div>
        <main class="screen">${content}</main>
        <nav class="bottom-nav" aria-label="التنقل الرئيسي">${navItem("home", "الرئيسية")}${navItem("games", "الألعاب")}${navItem("learn", "تعلمي")}${navItem("achievements", "إنجازاتي")}${navItem("profile", "حسابي")}</nav>
      </div>
    </div>`;
  }

  function pageHeader(title, subtitle, actions = "") {
    return `<header class="page-header"><div><h1>${title}</h1><p>${subtitle}</p></div>${actions}</header>`;
  }

  function levelCard() {
    const level = Q.gamification.currentLevel(state.xp);
    const info = Q.gamification.levelProgress(state.xp);
    return `<article class="level-card card dark-card">
      <div class="level-top"><div class="level-badge">${level.icon}</div><div><small>مستواكي الحالي</small><h3>${level.name}</h3></div><strong>${state.xp} <small>XP</small></strong></div>
      <div class="level-progress"><div><span>${info.next ? `${info.remaining} XP للمستوى الجاي` : "وصلتي لأعلى مستوى"}</span><b>${info.percent}٪</b></div>${progress(info.percent, "التقدم للمستوى التالي")}</div>
      <div class="mini-stats"><span><i>↗</i><b>${state.streak}</b><small>أيام متتالية</small></span><span><i>✦</i><b>${state.unlockedBadges.length}</b><small>أوسمة</small></span><span><i>✓</i><b>${state.stats.gamesCompleted}</b><small>ألعاب مكتملة</small></span></div>
    </article>`;
  }

  function dailyCard() {
    const challenge = getDaily();
    return `<article class="daily-card card">
      <div class="card-title"><span class="icon-chip amber">⚡</span><div><small>تحدي النهارده · +20 XP</small><h3>${challenge.title}</h3></div></div>
      <p>${challenge.prompt}</p>
      ${dailyFeedback ? `<div class="feedback ${dailyFeedback.correct ? "correct" : "wrong"}"><b>${dailyFeedback.correct ? "إجابة ممتازة" : "خلينا نفكر فيها سوا"}</b><p>${challenge.explanation}</p><button class="button small primary" data-action="close-daily">تمام</button></div>` : state.daily.completed ? `<div class="completed-note">✓ خلصتي تحدي النهارده. ارجعي بكرة لتحدي جديد.</div>` : `<div class="daily-options">${challenge.answers.map((answer, index) => `<button data-action="answer-daily" data-index="${index}">${answer}</button>`).join("")}</div>`}
    </article>`;
  }

  function gameCard(game) {
    const complete = state.completedGames[game.id];
    const score = state.gameScores[game.id] || 0;
    return `<article class="game-card ${game.color}"><div class="game-card-top"><span class="game-icon">${game.icon}</span>${complete ? `<span class="status-pill">✓ ${score}٪</span>` : `<span class="status-pill neutral">جديدة</span>`}</div><h3>${game.title}</h3><p>${game.subtitle}</p><div class="game-meta"><span>${game.difficulty}</span><span>◷ ${game.duration}</span></div>${progress(complete ? 100 : 0, `تقدم ${game.title}`)}<button class="button card-button" data-start-game="${game.id}">${complete ? "العبي تاني" : "ابدئي اللعبة"} <span>←</span></button></article>`;
  }

  function savingsMiniCard() {
    const goal = state.savingsGoal;
    const percent = Math.min(100, Math.round((goal.saved / goal.target) * 100));
    return `<article class="card saving-mini"><div class="card-title"><span class="icon-chip mint">♧</span><div><small>هدف الادخار الافتراضي</small><h3>${escapeHtml(goal.name)}</h3></div><button class="icon-button" data-start-game="savings" aria-label="تعديل الهدف">↗</button></div><div class="saving-numbers"><strong>${money(goal.saved)}</strong><span>من ${money(goal.target)}</span></div>${progress(percent, "تقدم هدف الادخار")}<div class="saving-foot"><span>${percent}٪ اتحقق</span><span>${money(goal.target - goal.saved)} باقي</span></div></article>`;
  }

  function home() {
    const completedLessons = state.completedLessons.length;
    return `${pageHeader(`صباح الخير يا ${escapeHtml(state.nickname)} ✦`, "كل قرار صغير النهارده بيقربك من ثقة مالية أكبر.", `<button class="notification-button" data-action="notification" aria-label="الإشعارات"><span>♢</span><i></i></button><button class="avatar" data-route="profile">${escapeHtml(state.avatar)}</button>`)}
      <div class="dashboard-grid"><div>${levelCard()}</div><div>${dailyCard()}</div></div>
      <section class="section-block"><div class="section-heading"><div><span class="eyebrow">اختاري تحديك</span><h2>اتعلمي باللعب</h2></div><button class="text-button" data-route="games">كل الألعاب ←</button></div><div class="game-grid">${Object.values(Q.games).map(gameCard).join("")}</div></section>
      <section class="two-column"><div><div class="section-heading compact"><div><span class="eyebrow">دقيقة معرفة</span><h2>كمّلي تعلّمك</h2></div><button class="text-button" data-route="learn">المكتبة ←</button></div><div class="lesson-list">${Q.lessons.slice(0, 3).map((lesson) => lessonRow(lesson)).join("")}</div><div class="library-progress"><span>تقدم المكتبة</span><b>${completedLessons} من ${Q.lessons.length}</b>${progress((completedLessons / Q.lessons.length) * 100, "تقدم المكتبة")}</div></div><div class="stacked-cards">${savingsMiniCard()}${groupMiniCard()}</div></section>
      <p class="disclaimer">قدّها منصة تعليمية تجريبية. المحتوى للتوعية والتعلم فقط، ولا يمثل نصيحة مالية أو استثمارية أو بديلاً عن التواصل مع الجهات المالية الرسمية.</p>`;
  }

  function gamesPage() {
    return `${pageHeader("الألعاب", "مواقف قصيرة، اختيارات واقعية، وشرح يساعدك تفهمي أثر كل قرار.")}<div class="game-grid large-grid">${Object.values(Q.games).map(gameCard).join("")}</div><section class="how-it-works card"><div><span class="eyebrow">طريقة اللعب</span><h2>قرار، نتيجة، ثم معرفة</h2><p>مفيش ضغط إنك تجيبي الدرجة الكاملة. كل محاولة بتوريكي أثر القرار وبتديكي فرصة تحسّني نتيجتك.</p></div><ol><li><b>1</b><span>اقرئي الموقف</span></li><li><b>2</b><span>اختاري التصرف</span></li><li><b>3</b><span>افهمي النتيجة</span></li></ol></section>`;
  }

  function lessonRow(lesson) {
    const complete = state.completedLessons.includes(lesson.id);
    return `<button class="lesson-row" data-lesson="${lesson.id}"><span class="lesson-icon">${lesson.icon}</span><span><small>${lesson.category}</small><b>${lesson.title}</b></span><em>${complete ? "✓ مكتمل" : lesson.duration}</em><i>←</i></button>`;
  }

  function learnPage() {
    const cats = Q.lessonLogic.categories();
    return `${pageHeader("مكتبة قدّها", "محتوى خفيف وعملي تقدري تطبقيه في قراراتك اليومية.")}<div class="category-chips">${cats.map((cat) => `<span>${cat}</span>`).join("")}</div><div class="lesson-cards">${Q.lessons.map((lesson) => `<article class="lesson-card"><div><span class="lesson-icon large">${lesson.icon}</span><span class="lesson-state ${state.completedLessons.includes(lesson.id) ? "done" : ""}">${state.completedLessons.includes(lesson.id) ? "✓ مكتمل" : lesson.duration}</span></div><small>${lesson.category}</small><h3>${lesson.title}</h3><p>${lesson.text}</p><button class="button ghost wide" data-lesson="${lesson.id}">${state.completedLessons.includes(lesson.id) ? "راجعي الدرس" : "ابدئي الدرس"} <span>←</span></button></article>`).join("")}</div>`;
  }

  function lessonView() {
    const lesson = Q.lessonLogic.find(activeLesson);
    if (!lesson) return learnPage();
    const complete = state.completedLessons.includes(lesson.id);
    return `<button class="back-button" data-action="close-lesson">→ رجوع للمكتبة</button><article class="lesson-detail card"><header><span class="lesson-icon hero-icon">${lesson.icon}</span><div><small>${lesson.category} · ${lesson.duration}</small><h1>${lesson.title}</h1></div></header><section><h3>الفكرة ببساطة</h3><p>${lesson.text}</p></section><aside><b>مثال من الحياة</b><p>${lesson.example}</p></aside><section><h3>الخلاصة</h3><p>${lesson.takeaway}</p></section><div class="mini-quiz"><span class="eyebrow">سؤال سريع</span><h3>${lesson.quiz.question}</h3>${lessonAnswered ? `<div class="feedback correct"><b>تمام كده</b><p>${lesson.takeaway}</p></div>` : `<div class="quiz-options">${lesson.quiz.answers.map((answer, index) => `<button data-action="answer-lesson" data-index="${index}">${answer}</button>`).join("")}</div>`}</div>${lessonAnswered || complete ? `<button class="button primary" data-action="close-lesson">${complete ? "ارجعي للمكتبة" : "كمّلي"}</button>` : ""}</article>`;
  }

  function achievementsPage() {
    const accuracy = state.stats.questionsAnswered ? Math.round((state.stats.correctAnswers / state.stats.questionsAnswered) * 100) : 0;
    const level = Q.gamification.currentLevel(state.xp);
    return `${pageHeader("إنجازاتك", "كل وسام هنا بيمثل خطوة حقيقية في رحلة تعلّمك.")}<div class="stats-grid"><article class="stat-card"><span>XP</span><strong>${state.xp}</strong><small>إجمالي النقاط</small></article><article class="stat-card"><span>◈</span><strong>${state.stats.gamesCompleted}</strong><small>ألعاب مكتملة</small></article><article class="stat-card"><span>✓</span><strong>${accuracy}٪</strong><small>دقة الإجابات</small></article><article class="stat-card"><span>▤</span><strong>${state.stats.lessonsCompleted}</strong><small>دروس مكتملة</small></article></div><section class="section-block"><div class="section-heading"><div><span class="eyebrow">مستواكي</span><h2>${level.name}</h2></div><b>${state.xp} XP</b></div>${levelCard()}</section><section class="section-block"><div class="section-heading"><div><span class="eyebrow">مجموعة الأوسمة</span><h2>${state.unlockedBadges.length} من ${Q.badges.length} اتفتحوا</h2></div></div><div class="badge-grid">${Q.badges.map((badge) => { const unlocked = state.unlockedBadges.includes(badge.id); return `<article class="badge-card ${unlocked ? "unlocked" : "locked"}"><span>${badge.icon}</span><h3>${badge.name}</h3><p>${badge.rule}</p><small>${unlocked ? "اتفتح ✓" : "لسه قدامك خطوة"}</small></article>`; }).join("")}</div></section>`;
  }

  function profilePage() {
    const level = Q.gamification.currentLevel(state.xp);
    return `${pageHeader("حسابي", "عدّلي شكل تجربتك وشوفي ملخص رحلتك.", `<button class="button ghost" data-route="settings">الإعدادات ⚙</button>`)}<section class="profile-hero card"><div class="avatar xl">${escapeHtml(state.avatar)}</div><div><small>${level.name}</small><h2>${escapeHtml(state.nickname)}</h2><p>هدف التعلّم · ${escapeHtml(state.learningGoal)}</p></div><button class="button ghost" data-action="edit-profile">تعديل</button></section><div class="profile-grid"><article class="card"><span class="eyebrow">ملخص التقدم</span><div class="profile-stats"><span><strong>${state.xp}</strong><small>XP</small></span><span><strong>${state.stats.gamesCompleted}</strong><small>ألعاب</small></span><span><strong>${state.stats.lessonsCompleted}</strong><small>دروس</small></span><span><strong>${state.unlockedBadges.length}</strong><small>أوسمة</small></span></div></article><article class="card"><span class="eyebrow">أفضل النتائج</span>${Object.values(Q.games).map((game) => `<div class="score-row"><span>${game.title}</span><b>${state.gameScores[game.id] || 0}٪</b></div>`).join("")}</article></div>`;
  }

  function groupMiniCard() {
    const base = 8500 + state.group.contributed;
    const percent = Math.round((base / 12000) * 100);
    return `<article class="card group-mini"><div class="card-title"><span class="icon-chip violet">♧</span><div><small>محاكاة تعليمية</small><h3>جمعية كورس المستقبل</h3></div></div><div class="participant-row"><div><i>م</i><i>س</i><i>ن</i><i>ر</i><i>${escapeHtml(state.avatar)}</i></div><span>5 مشاركات</span></div>${progress(percent, "تقدم الجمعية الذكية")}<button class="button ghost wide" data-route="group">شوفي التفاصيل ←</button></article>`;
  }

  function groupPage() {
    const total = 8500 + state.group.contributed;
    const percent = Math.min(100, Math.round((total / 12000) * 100));
    const members = [{ name: "مريم", amount: 2000 }, { name: "سلمى", amount: 1800 }, { name: "نور", amount: 1700 }, { name: "رانيا", amount: 3000 }, { name: state.nickname, amount: state.group.contributed }];
    return `${pageHeader("الجمعية الذكية", "تجربة تعليمية لتنسيق هدف جماعي من غير أي تحويلات أو التزامات حقيقية.")}<div class="simulation-note">محاكاة تعليمية فقط — لا توجد أموال حقيقية أو تحويلات مالية.</div><div class="group-layout"><article class="card group-main"><div class="group-cover"><span>♧</span><div><small>هدف جماعي</small><h2>كورس المستقبل</h2><p>نشاط تعليمي مشترك لخمس مشاركات</p></div></div><div class="big-progress"><strong>${percent}٪</strong><span>${money(total)} من ${money(12000)}</span>${progress(percent, "تقدم هدف المجموعة")}</div><div class="schedule"><div><small>المساهمة المقترحة</small><b>500 ج.م شهريًا</b></div><div><small>الميعاد التجريبي</small><b>أول كل شهر</b></div><div><small>المشاركات</small><b>5</b></div></div>${state.group.joined ? `<div class="contribute-box"><p>مساهمتك الافتراضية الحالية <b>${money(state.group.contributed)}</b></p><button class="button primary" data-action="contribute-group">ضيفي 250 ج.م افتراضية</button></div>` : `<button class="button primary wide" data-action="join-group">انضمي للمحاكاة</button>`}</article><aside class="card member-list"><span class="eyebrow">المشاركات</span><h3>تقدم المجموعة</h3>${members.map((member) => `<div><span class="avatar tiny">${escapeHtml(member.name[0])}</span><b>${escapeHtml(member.name)}</b><em>${money(member.amount)}</em></div>`).join("")}<div class="group-achievement"><span>✦</span><p><b>إنجاز جماعي</b><small>المجموعة عدّت 50٪ من الهدف</small></p></div></aside></div>`;
  }

  function settingsPage() {
    return `${pageHeader("الإعدادات والمساعدة", "تحكّمي في تجربة العرض وبياناتها المحلية.")}<div class="settings-list card"><label><span><b>الإشعارات داخل التجربة</b><small>تذكير بالتحديات والإنجازات داخل التطبيق</small></span><input type="checkbox" data-setting="notifications" ${state.notifications ? "checked" : ""}></label><label><span><b>تقليل الحركة</b><small>يقلل الانتقالات والرسوم المتحركة</small></span><input type="checkbox" data-setting="reduceMotion" ${state.reduceMotion ? "checked" : ""}></label><button data-action="show-help"><span><b>مساعدة سريعة</b><small>إزاي تستخدمي الألعاب وتحفظي تقدمك</small></span><i>←</i></button><button class="danger-row" data-action="reset-demo"><span><b>إعادة التجربة</b><small>مسح التقدم المحلي والرجوع للبداية</small></span><i>↻</i></button></div><article class="card privacy-card"><span class="icon-chip mint">✓</span><div><h3>خصوصيتك جزء من التصميم</h3><p>التجربة لا تطلب اسمًا حقيقيًا أو رقم هاتف أو حسابًا بنكيًا. التقدم محفوظ في المتصفح على الجهاز فقط.</p></div></article><article class="card help-card"><h3>محتاجة مساعدة؟</h3><p>ابدئي من الرئيسية، اختاري أي لعبة، واقرئي التوضيح بعد كل قرار. تقدري تعيدي اللعبة لتحسّني أفضل نتيجة.</p><button class="button ghost" data-route="home">ارجعي للرئيسية</button></article>`;
  }

  function getDaily() {
    const index = new Date().getDate() % Q.dailyChallenges.length;
    const today = new Date().toISOString().slice(0, 10);
    if (state.daily.date !== today) state.daily = { date: today, completed: false };
    return Q.dailyChallenges[index];
  }

  function renderRoute() {
    if (activeGame) return gameView();
    if (activeLesson) return lessonView();
    const route = Q.navigation.getRoute();
    const pages = { home, games: gamesPage, learn: learnPage, achievements: achievementsPage, profile: profilePage, group: groupPage, settings: settingsPage };
    return (pages[route] || home)();
  }

  function gameView() {
    const game = Q.games[activeGame];
    if (gameStage === "intro") return gameIntro(game);
    if (gameStage === "setup") return activeGame === "budget" ? budgetSetup(game) : savingsSetup(game);
    if (gameStage === "play") return gameQuestion(game);
    return gameResults(game);
  }

  function gameIntro(game) {
    const skills = activeGame === "budget" ? ["ترتيب الأولويات", "احتياطي الطوارئ", "احتياج ورغبة"] : activeGame === "scam" ? ["الروابط المشبوهة", "حماية OTP", "التحقق الرسمي"] : ["هدف واقعي", "خطة مرنة", "استمرارية الادخار"];
    return `<button class="back-button" data-action="exit-game">→ رجوع للألعاب</button><section class="game-intro ${game.color}"><div class="game-intro-copy"><span class="game-icon huge">${game.icon}</span><span class="eyebrow">${game.difficulty} · ${game.duration} · 5 مواقف</span><h1>${game.title}</h1><p>${game.subtitle}</p><div class="skill-chips">${skills.map((skill) => `<span>✓ ${skill}</span>`).join("")}</div><button class="button primary large" data-action="begin-game">جاهزة للتحدي؟ <span>←</span></button><small>كل الأرصدة والمبالغ افتراضية للتجربة التعليمية.</small></div><div class="intro-poster"><div class="poster-orbit"></div><span>${game.icon}</span><i>+10 XP</i><b>قرارك يصنع الفرق</b></div></section>`;
  }

  function budgetSetup(game) {
    const total = Q.gameLogic.sumAllocations(session.allocations);
    const remaining = game.budget - total;
    const labels = { basics: "مصروفات أساسية", transport: "مواصلات", food: "أكل", personal: "مصروف شخصي", savings: "ادخار", emergency: "احتياطي طوارئ" };
    return `<button class="back-button" data-action="game-back-intro">→ التعليمات</button><section class="game-workspace"><header class="game-header"><div><span class="eyebrow">الخطوة الأولى</span><h1>وزّعي ميزانيتك</h1><p>ميزانية افتراضية للتجربة · الإجمالي ${money(game.budget)}</p></div><div class="budget-ring ${remaining < 0 ? "danger" : ""}"><strong>${money(Math.max(0, remaining))}</strong><small>متبقي</small></div></header><div class="allocation-grid">${Object.entries(session.allocations).map(([key, value]) => `<label class="allocation-card"><span>${labels[key]}</span><div><input type="number" min="0" max="${game.budget}" step="50" value="${value}" data-allocation="${key}"><b>ج.م</b></div><input type="range" min="0" max="2000" step="50" value="${Math.min(2000, value)}" data-allocation-range="${key}"></label>`).join("")}</div><div class="budget-summary card"><div><span>تم توزيعه</span><b>${money(total)}</b></div><div><span>الادخار والطوارئ</span><b>${money(session.allocations.savings + session.allocations.emergency)}</b></div><div class="${remaining < 0 ? "danger-text" : ""}"><span>المتبقي</span><b>${money(remaining)}</b></div></div>${remaining < 0 ? `<p class="inline-error">المبلغ الموزع أكبر من الميزانية. قللي ${money(Math.abs(remaining))} علشان تكملي.</p>` : ""}<button class="button primary large wide" data-action="start-scenarios" ${remaining < 0 ? "disabled" : ""}>ابدئي المواقف <span>←</span></button></section>`;
  }

  function savingsSetup() {
    const goal = state.savingsGoal;
    const projection = Q.gameLogic.savingsProjection({ target: goal.target, current: goal.saved, contribution: goal.periodic, frequency: goal.frequency === "أسبوعي" ? "weekly" : "monthly" });
    return `<button class="back-button" data-action="game-back-intro">→ التعليمات</button><section class="game-workspace"><header class="game-header"><div><span class="eyebrow">اعملي الخطة</span><h1>ازرعي هدفك</h1><p>اختاري أرقامًا افتراضية وشوفي الوقت المتوقع.</p></div><span class="game-icon huge mint-icon">♧</span></header><form id="savings-setup" class="savings-form"><label class="field"><span>اسم الهدف</span><select name="name"><option ${goal.name === "لابتوب للتعلم" ? "selected" : ""}>لابتوب للتعلم</option><option>موبايل جديد</option><option>كورس تعليمي</option><option>رحلة</option><option>حاجة شخصية</option></select></label><div class="form-grid"><label class="field"><span>سعر الهدف</span><input type="number" name="target" min="500" step="100" value="${goal.target}" required><em>ج.م افتراضية</em></label><label class="field"><span>المبلغ الموجود</span><input type="number" name="saved" min="0" step="100" value="${goal.saved}" required><em>ج.م افتراضية</em></label><label class="field"><span>مساهمة منتظمة</span><input type="number" name="periodic" min="50" step="50" value="${goal.periodic}" required><em>ج.م</em></label><label class="field"><span>كل</span><select name="frequency"><option ${goal.frequency === "شهري" ? "selected" : ""}>شهري</option><option ${goal.frequency === "أسبوعي" ? "selected" : ""}>أسبوعي</option></select></label></div><div class="projection-card"><div><small>الوصول المتوقع</small><strong>${projection.dateLabel}</strong><span>حوالي ${projection.months} شهر</span></div><div class="projection-plant"><i style="height:${Math.max(12, projection.percent)}%"></i><span>♧</span></div></div><button class="button primary large wide" type="submit">ثبتي الخطة وابدئي <span>←</span></button></form></section>`;
  }

  function gameQuestion(game) {
    const item = game.scenarios[session.index];
    const isScam = activeGame === "scam";
    const selected = session.selected;
    return `<section class="question-page"><header class="question-top"><button class="back-button" data-action="exit-game">× خروج</button><div><span>${session.index + 1} من ${game.scenarios.length}</span>${progress(((session.index + (session.answered ? 1 : 0)) / game.scenarios.length) * 100, "تقدم اللعبة")}</div><strong>${session.score} نقطة</strong></header><article class="scenario-card ${isScam ? "message-scenario" : ""}">${isScam ? `<div class="message-head"><span class="avatar tiny">؟</span><div><b>${item.sender}</b><small>رسالة واردة الآن</small></div></div><p>${item.message}</p>` : `<span class="eyebrow">${item.title}</span><h1>${item.story}</h1>`}</article><div class="choices"><h3>إيه القرار الأنسب؟</h3>${item.choices.map((choice, index) => `<button class="choice ${selected === index ? (choice.score >= 3 ? "correct" : "wrong") : ""} ${session.answered && selected !== index && choice.score >= 3 ? "best" : ""}" data-answer-game="${index}" ${session.answered ? "disabled" : ""}><span>${String.fromCharCode(65 + index)}</span><b>${choice.text}</b>${session.answered && selected === index ? `<i>${choice.score >= 3 ? "✓" : "×"}</i>` : ""}</button>`).join("")}</div>${session.answered ? `<aside class="answer-feedback ${item.choices[selected].score >= 3 ? "correct" : "wrong"}"><div><span>${item.choices[selected].score >= 3 ? "✓" : "!"}</span><div><b>${item.choices[selected].score >= 3 ? "قرار ممتاز" : "خلينا نفكر فيها سوا"}</b><p>${item.choices[selected].feedback}</p>${isScam ? `<div class="signs">${item.signs.map((sign) => `<span>⚑ ${sign}</span>`).join("")}</div>` : ""}</div></div><button class="button primary" data-action="next-question">${session.index === game.scenarios.length - 1 ? "شوفي النتيجة" : "الموقف اللي بعده"} ←</button></aside>` : ""}</section>`;
  }

  function gameResults(game) {
    const max = game.scenarios.length * 3;
    const percent = Math.round((session.score / max) * 100);
    const label = percent >= 80 ? "أداء قدّها!" : percent >= 60 ? "خطوة قوية" : "كل محاولة بتعلّمك";
    const insights = activeGame === "budget" ? ["رتّبي الاحتياجات قبل الرغبات", "احتياطي الطوارئ يحمي الخطة", "راجعي أثر القرار على باقي الشهر"] : activeGame === "scam" ? ["OTP وPIN وكلمات السر لا تُشارك", "افتحي القناة الرسمية بنفسك", "الاستعجال والعائد المضمون علامات خطر"] : ["الخطة المرنة أسهل في الاستمرار", "عدّلي الوقت أو المبلغ عند الحاجة", "الطوارئ لا تعني فشل الهدف"];
    const extra = activeGame === "budget" ? `<div><small>الرصيد الافتراضي</small><b>${money(Math.max(0, session.balance))}</b></div><div><small>نسبة الادخار الأولية</small><b>${Math.round((session.allocations.savings / game.budget) * 100)}٪</b></div>` : activeGame === "savings" ? `<div><small>إجمالي ادخار افتراضي</small><b>${money(state.savingsGoal.saved)}</b></div><div><small>المتبقي للهدف</small><b>${money(Math.max(0, state.savingsGoal.target - state.savingsGoal.saved))}</b></div>` : `<div><small>علامات اكتشفتيها</small><b>${session.correct * 3}</b></div><div><small>قرارات آمنة</small><b>${session.correct} من 5</b></div>`;
    return `<section class="results-page"><div class="confetti"><i></i><i></i><i></i><i></i></div><span class="game-icon result-icon">${game.icon}</span><span class="eyebrow">النتيجة النهائية</span><h1>${label}</h1><p>كمّلتي ${game.title} وفهمتي أثر 5 قرارات مالية.</p><div class="score-circle" style="--score:${percent}"><div><strong>${percent}٪</strong><small>درجة الوعي</small></div></div><div class="result-stats">${extra}</div><article class="insights card"><h3>3 حاجات تاخديها معاكي</h3>${insights.map((insight, index) => `<p><span>${index + 1}</span>${insight}</p>`).join("")}</article><div class="result-actions"><button class="button primary large" data-action="exit-game">ارجعي للرئيسية</button><button class="button ghost large" data-action="replay-game">العبي تاني ↻</button></div><small>النقاط بتتحسب مرة واحدة لأفضل نتيجة، علشان التقدم يفضل عادل.</small></section>`;
  }

  function render() {
    if (!state.onboarded) root.innerHTML = welcomeMode === "onboarding" ? onboarding() : welcome();
    else root.innerHTML = appShell(renderRoute());
    document.body.classList.toggle("no-scroll", Boolean(activeGame && gameStage === "play"));
  }

  function startGame(id) {
    activeGame = id;
    gameStage = "intro";
    session = Q.gameLogic.startSession(id);
    render();
  }

  function exitGame(toGames = false) {
    activeGame = null;
    gameStage = "intro";
    session = null;
    Q.navigation.go(toGames ? "games" : "home");
  }

  function completeGame() {
    const game = Q.games[activeGame];
    const percent = Math.round((session.score / (game.scenarios.length * 3)) * 100);
    Q.gamification.awardGame(state, activeGame, percent, session.correct, game.scenarios.length);
    if (activeGame === "savings") {
      state.stats.savingsRuns += 1;
      state.savingsGoal.saved = Math.min(state.savingsGoal.target, Math.max(0, state.savingsGoal.saved + session.saved));
    }
    save();
    gameStage = "results";
    render();
  }

  function modal(content) {
    document.getElementById("modal-root").innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${content}</div></div>`;
  }

  function closeModal() {
    document.getElementById("modal-root").innerHTML = "";
  }

  document.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) {
      closeModal();
      return;
    }
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) {
      activeLesson = null;
      Q.navigation.go(routeButton.dataset.route);
      return;
    }
    const gameButton = event.target.closest("[data-start-game]");
    if (gameButton) return startGame(gameButton.dataset.startGame);
    const lessonButton = event.target.closest("[data-lesson]");
    if (lessonButton) {
      activeLesson = lessonButton.dataset.lesson;
      lessonAnswered = false;
      render();
      window.scrollTo(0, 0);
      return;
    }
    const answerButton = event.target.closest("[data-answer-game]");
    if (answerButton && !session.answered) {
      const index = Number(answerButton.dataset.answerGame);
      const choice = Q.games[activeGame].scenarios[session.index].choices[index];
      session.selected = index;
      session.answered = true;
      session.score += choice.score;
      if (choice.score >= 3) session.correct += 1;
      if (activeGame === "budget") session.balance += choice.impact || 0;
      if (activeGame === "savings") session.saved += choice.effect || 0;
      render();
      return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "about") document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
    if (action === "start-onboarding") { welcomeMode = "onboarding"; onboardingStep = 0; render(); }
    if (action === "next-onboarding") { onboardingStep = Math.min(3, onboardingStep + 1); render(); }
    if (action === "skip-onboarding") { onboardingStep = 3; render(); }
    if (action === "try-demo" || action === "quick-setup") { state.onboarded = true; state.nickname = "نور"; state.avatar = "ن"; save(); location.hash = "home"; render(); }
    if (action === "notification") toast("مفيش إشعارات جديدة. تحدي النهارده مستنيكي!", "info");
    if (action === "begin-game") { gameStage = activeGame === "scam" ? "play" : "setup"; render(); }
    if (action === "game-back-intro") { gameStage = "intro"; render(); }
    if (action === "start-scenarios") { gameStage = "play"; session.balance = Q.games.budget.budget; render(); }
    if (action === "next-question") {
      if (session.index >= Q.games[activeGame].scenarios.length - 1) completeGame();
      else { session.index += 1; session.answered = false; session.selected = null; render(); }
    }
    if (action === "exit-game") exitGame(false);
    if (action === "replay-game") startGame(activeGame);
    if (action === "close-lesson") { activeLesson = null; lessonAnswered = false; render(); }
    if (action === "answer-lesson") {
      const lesson = Q.lessonLogic.find(activeLesson);
      const index = Number(event.target.closest("[data-index]").dataset.index);
      if (index === lesson.quiz.correct) {
        lessonAnswered = true;
        Q.lessonLogic.complete(state, lesson.id);
        save();
        render();
      } else toast("قريبة! جرّبي اختيار تاني وراجعي المثال.", "warning");
    }
    if (action === "answer-daily") {
      const challenge = getDaily();
      const index = Number(event.target.closest("[data-index]").dataset.index);
      dailyFeedback = { correct: index === challenge.correct };
      if (dailyFeedback.correct) {
        state.daily.completed = true;
        Q.gamification.addXp(state, 20, "تحدي النهارده");
        save();
      }
      render();
    }
    if (action === "close-daily") { dailyFeedback = null; render(); }
    if (action === "join-group") { state.group.joined = true; save(); toast("انضمّيتي للمحاكاة بنجاح", "success"); render(); }
    if (action === "contribute-group") { state.group.contributed = Math.min(1000, state.group.contributed + 250); save(); toast("اتضافت مساهمة افتراضية 250 ج.م", "success"); render(); }
    if (action === "edit-profile") modal(`<button class="modal-close" data-action="close-modal">×</button><h2>عدّلي حسابك</h2><form id="profile-edit"><label class="field"><span>الاسم المستعار</span><input name="nickname" maxlength="20" value="${escapeHtml(state.nickname)}" required></label><fieldset class="avatar-picker"><legend>الرمز</legend>${["ن", "س", "م", "ر", "✦"].map((a) => `<label><input type="radio" name="avatar" value="${a}" ${state.avatar === a ? "checked" : ""}><span>${a}</span></label>`).join("")}</fieldset><button class="button primary wide" type="submit">حفظ التعديل</button></form>`);
    if (action === "show-help") modal(`<button class="modal-close" data-action="close-modal">×</button><span class="icon-chip violet">?</span><h2>مساعدة سريعة</h2><p>ابدئي من الرئيسية واختاري لعبة أو درس. بعد كل إجابة هتشوفي شرحًا للقرار. تقدمك بيتحفظ تلقائيًا على المتصفح.</p><button class="button primary wide" data-action="close-modal">فهمت</button>`);
    if (action === "reset-demo") modal(`<button class="modal-close" data-action="close-modal">×</button><span class="icon-chip coral">↻</span><h2>نبدأ من الأول؟</h2><p>ده هيمسح الاسم والنقاط والنتائج المحفوظة على المتصفح ويرجع شاشة البداية.</p><div class="modal-actions"><button class="button danger" data-action="confirm-reset">امسحي بيانات العرض</button><button class="button ghost" data-action="close-modal">إلغاء</button></div>`);
    if (action === "confirm-reset") { state = Q.storage.reset(); welcomeMode = "welcome"; onboardingStep = 0; activeGame = null; activeLesson = null; closeModal(); history.replaceState(null, "", location.pathname); render(); toast("رجعنا تجربة قدّها للبداية", "info"); }
    if (action === "close-modal") closeModal();
  });

  document.addEventListener("input", (event) => {
    const key = event.target.dataset.allocation || event.target.dataset.allocationRange;
    if (!key || !session) return;
    const value = Math.max(0, Math.min(5000, Number(event.target.value) || 0));
    session.allocations[key] = value;
    render();
  });

  document.addEventListener("change", (event) => {
    const setting = event.target.dataset.setting;
    if (!setting) return;
    state[setting] = event.target.checked;
    save();
    render();
    toast("اتحفظ الإعداد", "success");
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "profile-setup") {
      event.preventDefault();
      const data = new FormData(event.target);
      state.nickname = String(data.get("nickname") || "يا بطلة").trim().slice(0, 20) || "يا بطلة";
      state.avatar = String(data.get("avatar") || "ن");
      state.learningGoal = String(data.get("goal") || "تنظيم المصاريف");
      state.onboarded = true;
      save();
      location.hash = "home";
      render();
    }
    if (event.target.id === "savings-setup") {
      event.preventDefault();
      const data = new FormData(event.target);
      const target = Math.max(500, Number(data.get("target")) || 500);
      const saved = Math.max(0, Math.min(target, Number(data.get("saved")) || 0));
      const periodic = Math.max(50, Number(data.get("periodic")) || 50);
      state.savingsGoal = { name: String(data.get("name")), target, saved, periodic, frequency: String(data.get("frequency")) };
      session.saved = 0;
      save();
      gameStage = "play";
      render();
    }
    if (event.target.id === "profile-edit") {
      event.preventDefault();
      const data = new FormData(event.target);
      state.nickname = String(data.get("nickname") || state.nickname).trim().slice(0, 20);
      state.avatar = String(data.get("avatar") || state.avatar);
      save();
      closeModal();
      render();
      toast("اتحفظت تعديلات الحساب", "success");
    }
  });

  Q.ui = { toast };
  Q.app = { get state() { return state; }, render };
  Q.navigation.init();
  getDaily();
  render();
})();
