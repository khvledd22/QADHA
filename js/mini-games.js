(function () {
  const Q = (window.Qadha = window.Qadha || {});
  const games = [
    { id: "sort", name: "رتّبي المصروف", english: "Spend Sort", icon: "🗂️", description: "حطي كل كارت في مكانه المناسب." },
    { id: "shop", name: "تسوّق بذكاء", english: "Smart Shopping", icon: "🛍️", description: "كمّلي القائمة من غير ما تتعدي الميزانية." },
    { id: "spot", name: "اكتشفي الفخ", english: "Spot the Scam", icon: "🕵️", description: "المسي العلامات المشبوهة داخل الرسالة." },
    { id: "path", name: "طريق الادخار", english: "The Savings Path", icon: "🛤️", description: "اختيارات متفرعة تغيّر طريق الهدف." },
    { id: "memory", name: "ذاكرة الفلوس", english: "Money Memory", icon: "🧠", description: "طابقي المصطلح مع معناه البسيط." },
  ];

  function createLifecycle() {
    let destroyed = false;
    let completed = false;
    const events = new AbortController();
    const timers = new Set();
    return {
      get destroyed() { return destroyed; },
      listen(target, type, handler, options = {}) { target?.addEventListener(type, handler, { ...options, signal: events.signal }); },
      later(handler, delay) {
        if (destroyed || completed) return null;
        const timer = setTimeout(() => { timers.delete(timer); if (!destroyed && !completed) handler(); }, delay);
        timers.add(timer);
        return timer;
      },
      complete() {
        if (destroyed || completed) return false;
        completed = true;
        timers.forEach(clearTimeout); timers.clear();
        return true;
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        events.abort();
        timers.forEach(clearTimeout); timers.clear();
      },
    };
  }

  function shell(game, content) {
    return `<section class="mini-play"><header><button class="round-game-button" data-mini-exit>×</button><div><small>${game.english}</small><h1>${game.name}</h1></div><span>${game.icon}</span></header><div class="mini-stage">${content}</div></section>`;
  }

  function finish(container, game, options, life, score, message) {
    if (!life.complete()) return;
    Q.sound.success();
    container.querySelector(".mini-stage").innerHTML = `<div class="mini-result"><div>${Q.lumaFace("celebrate")}</div><span>مهمة صغيرة اكتملت</span><h2>${message}</h2><strong>${score} نقطة</strong><p>+20 XP لأول مرة تكملي فيها اللعبة.</p><div><button class="primary" data-mini-replay>العبي تاني</button><button data-mini-back>الألعاب الصغيرة</button></div></div>`;
    options.onFinish({ game: `mini-${game.id}`, id: game.id, score, xp: 20 });
    life.listen(container.querySelector("[data-mini-replay]"), "click", () => options.onReplay?.());
    life.listen(container.querySelector("[data-mini-back]"), "click", options.onExit);
  }

  function spendSort(container, game, options, life) {
    const cards = [
      ["دواء ضروري", "needs"], ["خروجة إضافية", "wants"], ["مبلغ لهدف اللابتوب", "saving"], ["إصلاح مفاجئ", "emergency"],
      ["مواصلات الدراسة", "needs"], ["إكسسوار جديد", "wants"], ["مساهمة أسبوعية", "saving"], ["كشف طبي عاجل", "emergency"],
    ].sort(() => Math.random() - .5);
    const labels = { needs: "احتياجات", wants: "رغبات", saving: "ادخار", emergency: "طوارئ" };
    let index = 0; let score = 0; let busy = false;
    container.innerHTML = shell(game, `<div class="sort-game"><div class="sort-progress"><span data-sort-count>1 / ${cards.length}</span><i><b data-sort-fill></b></i></div><div class="expense-card" draggable="true" data-expense-card><span>مصروف افتراضي</span><h2 data-sort-card>${cards[0][0]}</h2><p>اختاري التصنيف الأقرب. بعض المصروفات ممكن تختلف حسب ظروف كل شخص.</p></div><div class="sort-bins">${Object.entries(labels).map(([id, label]) => `<button data-sort-bin="${id}"><span>${id === "needs" ? "🏠" : id === "wants" ? "🎈" : id === "saving" ? "🌱" : "🛡️"}</span><b>${label}</b></button>`).join("")}</div><p class="mini-feedback" data-sort-feedback></p></div>`);
    const next = (choice) => {
      if (life.destroyed || busy) return;
      busy = true;
      const correct = choice === cards[index][1];
      if (correct) { score += 100; Q.sound.collect(); } else Q.sound.fail();
      const feedback = container.querySelector("[data-sort-feedback]");
      feedback.textContent = correct ? "صح! التصنيف مناسب للسياق ده." : `في المثال ده الأقرب هو «${labels[cards[index][1]]}».`;
      feedback.className = `mini-feedback show ${correct ? "good" : "learn"}`;
      life.later(() => {
        index += 1;
        if (index >= cards.length) return finish(container, game, options, life, score, "رتبتي المصروفات بوعي");
        container.querySelector("[data-sort-card]").textContent = cards[index][0];
        container.querySelector("[data-sort-count]").textContent = `${index + 1} / ${cards.length}`;
        container.querySelector("[data-sort-fill]").style.width = `${(index / cards.length) * 100}%`;
        feedback.className = "mini-feedback";
        busy = false;
      }, 650);
    };
    container.querySelectorAll("[data-sort-bin]").forEach((button) => {
      life.listen(button, "click", () => next(button.dataset.sortBin));
      life.listen(button, "dragover", (event) => event.preventDefault());
      life.listen(button, "drop", (event) => { event.preventDefault(); next(button.dataset.sortBin); });
    });
  }

  function smartShop(container, game, options, life) {
    const budget = 800;
    const items = [
      { id: "rice", name: "أرز للقائمة", price: 110, need: true, icon: "🍚" },
      { id: "milk", name: "لبن", price: 90, need: true, icon: "🥛" },
      { id: "transport", name: "كارت مواصلات", price: 220, need: true, icon: "🚌" },
      { id: "notebook", name: "كشكول دراسة", price: 75, need: true, icon: "📒" },
      { id: "decor", name: "ديكور لطيف", price: 260, need: false, icon: "🪩" },
      { id: "snacks", name: "سناكس إضافية", price: 180, need: false, icon: "🍿" },
      { id: "bottle", name: "زجاجة عليها خصم", price: 150, need: false, icon: "🧴" },
    ];
    const selected = new Set();
    container.innerHTML = shell(game, `<div class="shop-game"><div class="shop-wallet"><span>ميزانية افتراضية</span><strong data-shop-left>${budget} ج.م</strong><i><b data-shop-fill></b></i></div><p>القائمة الأساسية فيها أرز، لبن، مواصلات وكشكول. اختاري وراجعي الباقي.</p><div class="shop-grid">${items.map((item) => `<button data-shop-item="${item.id}"><span>${item.icon}</span><b>${item.name}</b><em>${item.price} ج.م</em></button>`).join("")}</div><button class="mini-primary" data-shop-confirm>راجعي السلة</button><p class="mini-feedback" data-shop-feedback></p></div>`);
    function total() { return [...selected].reduce((sum, id) => sum + items.find((item) => item.id === id).price, 0); }
    container.querySelectorAll("[data-shop-item]").forEach((button) => life.listen(button, "click", () => {
      const id = button.dataset.shopItem;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      const spent = total();
      if (spent > budget) { selected.delete(id); Q.sound.fail(); container.querySelector("[data-shop-feedback]").textContent = "السلة عدّت الميزانية. شيلي حاجة اختيارية الأول."; }
      else { button.classList.toggle("selected", selected.has(id)); Q.sound.click(); }
      container.querySelector("[data-shop-left]").textContent = `${budget - total()} ج.م`;
      container.querySelector("[data-shop-fill]").style.width = `${(total() / budget) * 100}%`;
    }));
    life.listen(container.querySelector("[data-shop-confirm]"), "click", () => {
      const needed = items.filter((item) => item.need).every((item) => selected.has(item.id));
      const optional = items.filter((item) => !item.need && selected.has(item.id)).length;
      if (!needed) { Q.sound.fail(); container.querySelector("[data-shop-feedback]").textContent = "لسه فيه حاجة أساسية من القائمة ناقصة."; return; }
      finish(container, game, options, life, Math.max(300, 900 - optional * 100), optional ? "كمّلتي القائمة وراجعتي الاختيارات" : "كمّلتي القائمة بأفضل توازن");
    });
  }

  function spotScam(container, game, options, life) {
    const suspicious = new Set(["sender", "urgent", "link", "otp"]);
    const found = new Set();
    container.innerHTML = shell(game, `<div class="spot-game"><div class="spot-phone"><div class="spot-top">رسالة جديدة</div><button data-spot="sender">المرسل: دعم-المحفظة-24</button><p><button data-spot="urgent">تحذير عاجل: حسابك هيتوقف خلال 30 دقيقة!</button></p><p>لتأكيد هويتك افتحي <button data-spot="link">secure-wallet-prize.example</button></p><p>واكتبي <button data-spot="otp">كود OTP</button> فورًا.</p><small>المسي أي جزء شايفة إنه علامة خطر.</small></div><div class="spot-score"><b data-spot-count>0 / ${suspicious.size}</b><span>علامات خطر</span></div><p class="mini-feedback show" data-spot-feedback>دوري على المرسل، الاستعجال، الرابط وطلب الكود.</p></div>`);
    container.querySelectorAll("[data-spot]").forEach((button) => life.listen(button, "click", () => {
      const id = button.dataset.spot;
      if (!suspicious.has(id) || found.has(id)) return;
      found.add(id); button.classList.add("found"); Q.sound.clue();
      const explanations = { sender: "اسم المرسل لا يثبت أنه جهة رسمية.", urgent: "التهديد والاستعجال يضغطانك قبل التحقق.", link: "الرابط غير معروف ولازم ما يتفتحش.", otp: "OTP سري ولا يُشارك مع أي شخص." };
      container.querySelector("[data-spot-feedback]").textContent = explanations[id];
      container.querySelector("[data-spot-count]").textContent = `${found.size} / ${suspicious.size}`;
      if (found.size === suspicious.size) life.later(() => finish(container, game, options, life, 800, "اكتشفتي كل علامات الخطر"), 500);
    }));
  }

  function savingsPath(container, game, options, life) {
    const situations = [
      { text: "ظهر مصروف دواء ضروري", choices: [["أستخدم الاحتياطي وأراجع الخطة", 3], ["أتجاهل الدواء", 0], ["ألغي الهدف", 1]] },
      { text: "وصلك مبلغ إضافي افتراضي", choices: [["أقسمه بين الهدف والطوارئ", 3], ["أصرفه كله", 0], ["أحطه كله في الهدف رغم ضغط الميزانية", 2]] },
      { text: "سعر الهدف زاد", choices: [["أراجع البدائل والمدة", 3], ["أتجاهل الزيادة", 1], ["أقترض فورًا", 0]] },
      { text: "فاتتك مساهمة شهر", choices: [["أكمل وأعدّل الخطة", 3], ["أعتبرها فشلت", 0], ["أضغط الأساسيات للتعويض", 1]] },
    ];
    let index = 0; let score = 0; let busy = false;
    container.innerHTML = shell(game, `<div class="path-game"><div class="path-visual"><span class="path-player">🚶‍♀️</span>${situations.map((_, i) => `<i data-path-step="${i}">${i + 1}</i>`).join("")}<b>🎯</b></div><span>الموقف ${index + 1} من ${situations.length}</span><h2 data-path-title>${situations[0].text}</h2><div class="path-choices" data-path-choices></div><p class="mini-feedback" data-path-feedback></p></div>`);
    function renderChoices() {
      container.querySelector("[data-path-title]").textContent = situations[index].text;
      container.querySelector(".path-game > span").textContent = `الموقف ${index + 1} من ${situations.length}`;
      container.querySelector("[data-path-choices]").innerHTML = situations[index].choices.map((choice, i) => `<button data-path-choice="${i}">${choice[0]}</button>`).join("");
      container.querySelectorAll("[data-path-choice]").forEach((button) => life.listen(button, "click", () => {
        if (life.destroyed || busy) return;
        busy = true;
        const value = situations[index].choices[Number(button.dataset.pathChoice)][1];
        score += value * 100;
        Q.sound[value >= 3 ? "success" : "fail"]();
        container.querySelector(`[data-path-step="${index}"]`).classList.add(value >= 3 ? "good" : "learn");
        container.querySelector("[data-path-feedback]").textContent = value >= 3 ? "اختيار مرن يحافظ على الاحتياج والهدف." : "الخطة محتاجة توازن أكتر بين الضروري والهدف.";
        container.querySelector("[data-path-feedback]").className = "mini-feedback show";
        life.later(() => { index += 1; if (index >= situations.length) finish(container, game, options, life, score, "وصلتي للهدف بخطة مرنة"); else { busy = false; container.querySelector("[data-path-feedback]").className = "mini-feedback"; renderChoices(); } }, 650);
      }));
    }
    renderChoices();
  }

  function moneyMemory(container, game, options, life) {
    const pairs = [
      ["OTP", "كود مؤقت سري"], ["ميزانية", "خطة للمبلغ المتاح"], ["طوارئ", "مصروف ضروري مفاجئ"], ["تصيد", "رسالة أو رابط خداع"], ["هدف", "مبلغ ومدة واضحان"], ["PIN", "رقم سري شخصي"],
    ];
    const cards = pairs.flatMap((pair, pairId) => pair.map((text, side) => ({ pairId, text, side }))).sort(() => Math.random() - .5);
    let open = []; let matched = new Set(); let attempts = 0;
    container.innerHTML = shell(game, `<div class="memory-game"><div class="memory-info"><span>طابقي المصطلح مع معناه</span><b data-memory-attempts>0 محاولة</b></div><div class="memory-grid">${cards.map((card, index) => `<button data-memory-card="${index}" aria-label="كارت مقلوب"><span class="front">?</span><span class="back">${card.text}</span></button>`).join("")}</div></div>`);
    container.querySelectorAll("[data-memory-card]").forEach((button) => life.listen(button, "click", () => {
      const index = Number(button.dataset.memoryCard);
      if (open.includes(index) || matched.has(index) || open.length >= 2) return;
      open.push(index); button.classList.add("open"); Q.sound.click();
      if (open.length === 2) {
        attempts += 1; container.querySelector("[data-memory-attempts]").textContent = `${attempts} محاولة`;
        const [a, b] = open;
        if (cards[a].pairId === cards[b].pairId && cards[a].side !== cards[b].side) {
          matched.add(a); matched.add(b); open = []; Q.sound.match();
          container.querySelector(`[data-memory-card="${a}"]`).classList.add("matched");
          container.querySelector(`[data-memory-card="${b}"]`).classList.add("matched");
          if (matched.size === cards.length) life.later(() => finish(container, game, options, life, Math.max(300, 1200 - attempts * 40), "طابقتي كل المفاهيم"), 450);
        } else {
          Q.sound.fail(); life.later(() => { container.querySelector(`[data-memory-card="${a}"]`)?.classList.remove("open"); container.querySelector(`[data-memory-card="${b}"]`)?.classList.remove("open"); open = []; }, 700);
        }
      }
    }));
  }

  function mount(container, id, options) {
    const game = games.find((item) => item.id === id) || games[0];
    const mounts = { sort: spendSort, shop: smartShop, spot: spotScam, path: savingsPath, memory: moneyMemory };
    const life = createLifecycle();
    mounts[game.id](container, game, options, life);
    life.listen(container.querySelector("[data-mini-exit]"), "click", options.onExit);
    Q.activeEngine = {
      get destroyed() { return life.destroyed; },
      destroy() { life.destroy(); if (Q.activeEngine === this) Q.activeEngine = null; },
    };
    return Q.activeEngine;
  }

  Q.miniGames = { games, mount };
})();
