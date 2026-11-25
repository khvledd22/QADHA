(function () {
  const Q = (window.Qadha = window.Qadha || {});

  function budgetDefaultAllocations() {
    return { basics: 1900, transport: 700, food: 900, personal: 400, savings: 600, emergency: 500 };
  }

  function sumAllocations(allocations) {
    return Object.values(allocations).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }

  function savingsProjection({ target, current, contribution, frequency }) {
    const remaining = Math.max(0, target - current);
    const safeContribution = Math.max(1, contribution);
    const periods = Math.ceil(remaining / safeContribution);
    const months = frequency === "weekly" ? Math.ceil(periods / 4.345) : periods;
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return {
      remaining,
      periods,
      months,
      dateLabel: new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(date),
      percent: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
    };
  }

  function startSession(gameId) {
    const game = Q.games[gameId];
    return {
      gameId,
      index: 0,
      score: 0,
      correct: 0,
      answered: false,
      selected: null,
      balance: gameId === "budget" ? game.budget : 0,
      saved: gameId === "savings" ? 0 : null,
      allocations: gameId === "budget" ? budgetDefaultAllocations() : null,
    };
  }

  Q.gameLogic = { budgetDefaultAllocations, sumAllocations, savingsProjection, startSession };
})();
