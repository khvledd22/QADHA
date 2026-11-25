(function () {
  const Q = (window.Qadha = window.Qadha || {});
  const KEY = "qadha-demo-v1";

  function defaults() {
    return {
      version: 2,
      onboarded: false,
      adventureOnboarded: false,
      demoMode: false,
      locale: "ar-EG",
      nickname: "يا بطلة",
      avatar: "ن",
      avatarId: "noura",
      outfit: "sage",
      accessory: "star",
      unlockedAccessories: ["star"],
      learningGoal: "تنظيم المصاريف",
      xp: 0,
      streak: 3,
      completedGames: {},
      gameScores: {},
      awardedGameXp: {},
      completedLessons: [],
      unlockedBadges: [],
      savingsGoal: { name: "لابتوب للتعلم", target: 12000, saved: 3600, periodic: 600, frequency: "شهري" },
      group: { joined: false, contributed: 0 },
      gameLevels: { runner: 1, maze: 1, match3: 1 },
      completedLevels: { runner: {}, maze: {}, match3: {} },
      levelScores: { runner: {}, maze: {}, match3: {} },
      awardedLevels: { runner: {}, maze: {}, match3: {} },
      collectibles: { stars: 0, tokens: 0, shields: 0, clues: 0 },
      completedMiniGames: [],
      glossarySeen: [],
      sound: true,
      music: false,
      volume: 0.45,
      daily: { date: "", missionId: "", progress: 0, completed: false },
      plazaVisited: [],
      notifications: true,
      reduceMotion: false,
      stats: { gamesCompleted: 0, questionsAnswered: 0, correctAnswers: 0, lessonsCompleted: 0, savingsRuns: 0 },
    };
  }

  function normalize(value) {
    const base = defaults();
    if (!value || typeof value !== "object" || Array.isArray(value)) return base;
    const state = { ...base, ...value };
    state.completedGames = { ...base.completedGames, ...(value.completedGames || {}) };
    state.gameScores = { ...base.gameScores, ...(value.gameScores || {}) };
    state.awardedGameXp = { ...base.awardedGameXp, ...(value.awardedGameXp || {}) };
    state.stats = { ...base.stats, ...(value.stats || {}) };
    state.savingsGoal = { ...base.savingsGoal, ...(value.savingsGoal || {}) };
    state.group = { ...base.group, ...(value.group || {}) };
    state.gameLevels = { ...base.gameLevels, ...(value.gameLevels || {}) };
    state.completedLevels = {
      runner: { ...base.completedLevels.runner, ...(value.completedLevels?.runner || {}) },
      maze: { ...base.completedLevels.maze, ...(value.completedLevels?.maze || {}) },
      match3: { ...base.completedLevels.match3, ...(value.completedLevels?.match3 || {}) },
    };
    state.levelScores = {
      runner: { ...base.levelScores.runner, ...(value.levelScores?.runner || {}) },
      maze: { ...base.levelScores.maze, ...(value.levelScores?.maze || {}) },
      match3: { ...base.levelScores.match3, ...(value.levelScores?.match3 || {}) },
    };
    state.awardedLevels = {
      runner: { ...base.awardedLevels.runner, ...(value.awardedLevels?.runner || {}) },
      maze: { ...base.awardedLevels.maze, ...(value.awardedLevels?.maze || {}) },
      match3: { ...base.awardedLevels.match3, ...(value.awardedLevels?.match3 || {}) },
    };
    if (!value.completedLevels) {
      const ids = { runner: "budget", maze: "scam", match3: "savings" };
      Object.keys(ids).forEach((type) => {
        for (let level = 1; level < state.gameLevels[type]; level += 1) state.completedLevels[type][level] = true;
        if (state.gameLevels[type] === 5 && state.awardedLevels[type][5] && Number(state.levelScores[type][5]) > 0) state.completedLevels[type][5] = true;
        if (!Object.keys(state.completedLevels[type]).length) delete state.completedGames[ids[type]];
      });
    }
    state.collectibles = { ...base.collectibles, ...(value.collectibles || {}) };
    state.daily = { ...base.daily, ...(value.daily || {}) };
    state.completedLessons = Array.isArray(value.completedLessons) ? value.completedLessons : [];
    state.unlockedBadges = Array.isArray(value.unlockedBadges) ? value.unlockedBadges : [];
    state.completedMiniGames = Array.isArray(value.completedMiniGames) ? value.completedMiniGames : [];
    state.glossarySeen = Array.isArray(value.glossarySeen) ? value.glossarySeen : [];
    state.unlockedAccessories = Array.isArray(value.unlockedAccessories) ? value.unlockedAccessories : ["star"];
    state.plazaVisited = Array.isArray(value.plazaVisited) ? value.plazaVisited : [];
    state.xp = Math.max(0, Number(value.xp) || 0);
    state.locale = ["ar-EG", "en"].includes(value.locale) ? value.locale : base.locale;
    state.version = base.version;
    return state;
  }

  function load() {
    try {
      return normalize(JSON.parse(localStorage.getItem(KEY)));
    } catch (error) {
      console.warn("QADHA storage reset after invalid data", error);
      return defaults();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn("QADHA progress could not be saved", error);
      return false;
    }
  }

  function reset() {
    localStorage.removeItem(KEY);
    return defaults();
  }

  Q.storage = { load, save, reset, defaults, key: KEY };
})();
