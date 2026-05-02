/**
 * i18n.js — Lightweight runtime i18n for the personal portal
 *
 * Usage in HTML:
 *   <span data-i18n="home.hero.tagline"></span>              -> replaces textContent
 *   <meta data-i18n="home.meta.description"
 *         data-i18n-attr="content">                          -> replaces an attribute
 *   <title data-i18n="home.meta.title"></title>
 *
 * Language resolution order:
 *   1. ?lang=xx in URL (one-shot override, also persisted)
 *   2. localStorage('lang')
 *   3. navigator.language (maps zh-* -> zh, others -> en)
 *   4. 'en' (fallback)
 */
(function () {
  const SUPPORTED = ['en', 'zh'];
  const DEFAULT_LANG = 'en';
  const STORAGE_KEY = 'lang';

  function detectLang() {
    // 1. URL param
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get('lang');
      if (q && SUPPORTED.includes(q)) {
        localStorage.setItem(STORAGE_KEY, q);
        return q;
      }
    } catch (_) {}

    // 2. localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;

    // 3. navigator
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('zh')) return 'zh';

    // 4. fallback
    return DEFAULT_LANG;
  }

  // Resolve path to the i18n folder relative to this script,
  // so pages at any depth (/, /about/, /projects/ai-explainer/) all work.
  function resolveI18nBase() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].getAttribute('src') || '';
      if (src.indexOf('i18n.js') !== -1) {
        // strip "i18n.js" + query, keep directory; then go up to assets/i18n/
        const dir = src.replace(/[?#].*$/, '').replace(/i18n\.js$/, '');
        return dir.replace(/js\/?$/, 'i18n/');
      }
    }
    return '/assets/i18n/';
  }

  const I18N_BASE = resolveI18nBase();
  const cache = {};

  function fetchDict(lang) {
    if (cache[lang]) return Promise.resolve(cache[lang]);
    return fetch(I18N_BASE + lang + '.json', { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load ' + lang);
        return r.json();
      })
      .then((json) => {
        cache[lang] = json;
        return json;
      });
  }

  function get(dict, path) {
    return path.split('.').reduce((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) return acc[key];
      return undefined;
    }, dict);
  }

  function applyDict(dict) {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = get(dict, key);
      if (val === undefined) return; // keep original text as fallback
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) {
        el.setAttribute(attr, val);
      } else if (el.tagName === 'TITLE') {
        document.title = val;
      } else {
        // Support simple <br> inside translated text
        if (typeof val === 'string' && val.indexOf('<br>') !== -1) {
          el.innerHTML = val;
        } else {
          el.textContent = val;
        }
      }
    });
  }

  function updateHtmlLang(lang) {
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
    document.documentElement.setAttribute('data-lang', lang);
  }

  function updateSwitcherState(lang) {
    // Mark the currently active option inside each .lang-switcher
    document.querySelectorAll('.lang-switcher').forEach((sw) => {
      sw.querySelectorAll('.lang-switcher__item').forEach((item) => {
        const itemLang = item.getAttribute('data-lang');
        if (itemLang === lang) {
          item.setAttribute('aria-current', 'true');
        } else {
          item.removeAttribute('aria-current');
        }
      });
    });
  }

  function bindSwitchers() {
    document.querySelectorAll('.lang-switcher').forEach((sw) => {
      if (sw.__bound) return;
      sw.__bound = true;

      const trigger = sw.querySelector('.lang-switcher__trigger');
      const menu = sw.querySelector('.lang-switcher__menu');
      if (!trigger || !menu) return;

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = sw.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      menu.querySelectorAll('.lang-switcher__item').forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const lang = item.getAttribute('data-lang');
          if (lang) setLang(lang);
          sw.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
        });
      });
    });

    // Close on outside click / Esc (bind once)
    if (!window.__i18nSwitcherGlobalBound) {
      window.__i18nSwitcherGlobalBound = true;
      document.addEventListener('click', () => {
        document.querySelectorAll('.lang-switcher.is-open').forEach((sw) => {
          sw.classList.remove('is-open');
          const t = sw.querySelector('.lang-switcher__trigger');
          if (t) t.setAttribute('aria-expanded', 'false');
        });
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          document.querySelectorAll('.lang-switcher.is-open').forEach((sw) => {
            sw.classList.remove('is-open');
            const t = sw.querySelector('.lang-switcher__trigger');
            if (t) t.setAttribute('aria-expanded', 'false');
          });
        }
      });
    }
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
    localStorage.setItem(STORAGE_KEY, lang);
    updateHtmlLang(lang);
    updateSwitcherState(lang);
    return fetchDict(lang).then((dict) => {
      applyDict(dict);
      window.__i18n.current = lang;
      window.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang, dict } }));
    }).catch((err) => {
      console.warn('[i18n] load failed:', err);
    });
  }

  function toggleLang() {
    const next = (window.__i18n.current === 'zh') ? 'en' : 'zh';
    return setLang(next);
  }

  // Expose a tiny global API
  window.__i18n = {
    current: null,
    supported: SUPPORTED.slice(),
    setLang: setLang,
    toggleLang: toggleLang,
    // Re-bind click handlers on <.lang-switcher> nodes. Safe to call many
    // times: each node is flagged with __bound to avoid double-binding.
    // Call this after injecting header/footer partials at runtime.
    bindSwitchers: function () {
      bindSwitchers();
      updateSwitcherState(window.__i18n.current || DEFAULT_LANG);
    },
    t: function (key) {
      const dict = cache[window.__i18n.current];
      const v = dict ? get(dict, key) : undefined;
      return v === undefined ? key : v;
    },
  };
  // Convenience global for inline onclick handlers
  window.toggleLang = toggleLang;

  // Boot: set <html lang> ASAP to reduce FOUC, then load dict
  const initial = detectLang();
  updateHtmlLang(initial);

  function boot() {
    bindSwitchers();
    updateSwitcherState(initial);
    setLang(initial);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
