(function () {
  const Q = (window.Qadha = window.Qadha || {});
  const locales = {};
  let activeLocale = "ar-EG";

  function register(locale, messages, meta = {}) {
    locales[locale] = {
      messages: messages || {},
      lang: meta.lang || locale.split("-")[0],
      dir: meta.dir || "ltr",
      label: meta.label || locale,
    };
  }

  function lookup(messages, key) {
    return key.split(".").reduce((value, part) => value?.[part], messages);
  }

  function interpolate(value, variables) {
    if (typeof value !== "string") return value;
    return String(value).replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? `{${key}}`);
  }

  function t(key, variables = {}, fallback = key) {
    const preferred = lookup(locales[activeLocale]?.messages || {}, key);
    const arabicFallback = lookup(locales["ar-EG"]?.messages || {}, key);
    const value = preferred ?? arabicFallback ?? fallback;
    return interpolate(value, variables);
  }

  function use(locale) {
    activeLocale = locales[locale] ? locale : "ar-EG";
    const config = locales[activeLocale] || { lang: "ar", dir: "rtl" };
    document.documentElement.lang = config.lang;
    document.documentElement.dir = config.dir;
    document.body.dataset.locale = activeLocale;
    const title = lookup(config.messages, "meta.title");
    const description = lookup(config.messages, "meta.description");
    if (title) document.title = title;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    return activeLocale;
  }

  function number(value, options = {}) {
    return new Intl.NumberFormat(activeLocale, options).format(Number(value) || 0);
  }

  function isRtl() { return (locales[activeLocale]?.dir || "rtl") === "rtl"; }
  function available() { return Object.keys(locales); }

  Q.i18n = {
    register,
    use,
    t,
    number,
    isRtl,
    available,
    get locale() { return activeLocale; },
  };
})();

