(function () {
  const Q = (window.Qadha = window.Qadha || {});

  function categories() {
    return [...new Set(Q.lessons.map((lesson) => lesson.category))];
  }

  function find(id) {
    return Q.lessons.find((lesson) => lesson.id === id);
  }

  function complete(state, lessonId) {
    if (state.completedLessons.includes(lessonId)) return false;
    state.completedLessons.push(lessonId);
    state.stats.lessonsCompleted = state.completedLessons.length;
    Q.gamification.addXp(state, 15, "إكمال درس");
    return true;
  }

  Q.lessonLogic = { categories, find, complete };
})();
