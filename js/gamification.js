(function () {
  const Q = (window.Qadha = window.Qadha || {});

  function currentLevel(xp) {
    return [...Q.levels].reverse().find((level) => xp >= level.min) || Q.levels[0];
  }

  function levelProgress(xp) {
    const index = Q.levels.findIndex((level) => level.name === currentLevel(xp).name);
    const level = Q.levels[index];
    const next = Q.levels[index + 1];
    if (!next) return { percent: 100, remaining: 0, next: null };
    const percent = Math.round(((xp - level.min) / (next.min - level.min)) * 100);
    return { percent: Math.max(0, Math.min(100, percent)), remaining: next.min - xp, next };
  }

  function addXp(state, amount, reason) {
    const safeAmount = Math.max(0, Number(amount) || 0);
    state.xp += safeAmount;
    if (safeAmount && Q.ui) Q.ui.toast(`+${safeAmount} XP · ${reason}`, "success");
    unlockBadges(state);
  }

  function unlockBadges(state) {
    const unlocked = [];
    Q.badges.forEach((badge) => {
      if (!state.unlockedBadges.includes(badge.id) && badge.test(state)) {
        state.unlockedBadges.push(badge.id);
        unlocked.push(badge);
      }
    });
    if (unlocked.length && Q.ui) {
      setTimeout(() => Q.ui.toast(`وسام جديد: ${unlocked[0].name}`, "badge"), 350);
    }
    return unlocked;
  }

  function awardGame(state, gameId, scorePercent, correctCount, questionCount) {
    state.stats.questionsAnswered += questionCount;
    state.stats.correctAnswers += correctCount;
    const firstCompletion = !state.completedGames[gameId];
    state.completedGames[gameId] = true;
    state.gameScores[gameId] = Math.max(state.gameScores[gameId] || 0, scorePercent);
    if (firstCompletion) state.stats.gamesCompleted += 1;
    const priorAward = state.awardedGameXp[gameId] || 0;
    const earned = 30 + correctCount * 10;
    const delta = Math.max(0, earned - priorAward);
    if (delta) {
      state.awardedGameXp[gameId] = earned;
      addXp(state, delta, firstCompletion ? "إكمال لعبة" : "تحسين النتيجة");
    } else if (Q.ui) {
      Q.ui.toast("النتيجة محفوظة. الـXP بيتحسب مرة واحدة لأفضل أداء.", "info");
    }
    unlockBadges(state);
  }

  Q.gamification = { currentLevel, levelProgress, addXp, unlockBadges, awardGame };
})();
