(function () {
  const Q = (window.Qadha = window.Qadha || {});
  const routes = ["home", "games", "learn", "achievements", "profile", "group", "settings"];

  function getRoute() {
    const value = location.hash.replace("#", "").split("/")[0];
    return routes.includes(value) ? value : "home";
  }

  function go(route) {
    if (!routes.includes(route)) route = "home";
    if (location.hash === `#${route}`) {
      Q.app.render();
    } else {
      location.hash = route;
    }
    window.scrollTo({ top: 0, behavior: Q.app.state.reduceMotion ? "auto" : "smooth" });
  }

  function init() {
    window.addEventListener("hashchange", () => Q.app.render());
  }

  Q.navigation = { getRoute, go, init };
})();
