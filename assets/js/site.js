/**
 * site.js — Shared runtime for the personal portal
 */

/* ── Theme Toggle ──
 * Default: dark. The user's choice is remembered in localStorage and
 * takes precedence over the default on subsequent visits.
 */
(function initTheme() {
  const saved = localStorage.getItem('theme');
  const theme = saved === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
})();

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
  updateThemeIcon();
}

function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.innerHTML = isDark
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
  });
}

/* ── Mobile Menu ── */
function toggleMobileMenu() {
  const nav = document.querySelector('.mobile-nav');
  if (nav) nav.classList.toggle('open');
}

/* ── Scroll Animations ── */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('anim-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
}

/* ── Active Nav Link ── */
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    // Resolve relative href to absolute
    const a = document.createElement('a');
    a.href = href;
    const linkPath = a.pathname;
    if (path === linkPath || (linkPath !== '/' && path.startsWith(linkPath))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/* ── HTML Partials (data-include) ──
 * Usage in any page:
 *   <div data-include="/assets/partials/header.html"></div>
 * All placeholders are fetched in parallel, then i18n / theme / nav hooks
 * are re-applied so injected DOM behaves identically to inline markup.
 */
function includePartials() {
  const placeholders = Array.from(document.querySelectorAll('[data-include]'));
  if (placeholders.length === 0) return Promise.resolve();

  const jobs = placeholders.map(el => {
    const url = el.getAttribute('data-include');
    return fetch(url, { cache: 'no-cache' })
      .then(r => {
        if (!r.ok) throw new Error('Include failed: ' + url + ' (' + r.status + ')');
        return r.text();
      })
      .then(html => {
        // Replace the placeholder with the fetched fragment to avoid an
        // extra wrapper element in the DOM.
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const frag = document.createDocumentFragment();
        while (tmp.firstChild) frag.appendChild(tmp.firstChild);
        el.replaceWith(frag);
      })
      .catch(err => {
        console.warn('[include]', err);
        // Leave the placeholder in place so the page still renders.
      });
  });

  return Promise.all(jobs);
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  includePartials().then(() => {
    // Re-run everything that depends on header/footer DOM
    updateThemeIcon();
    setActiveNav();
    initScrollAnimations();

    // Re-apply i18n to newly injected nodes and (re-)bind the language
    // switcher click handlers — they live inside the injected header,
    // so they did not exist when i18n.js first ran at DOMContentLoaded.
    if (window.__i18n) {
      if (typeof window.__i18n.bindSwitchers === 'function') {
        window.__i18n.bindSwitchers();
      }
      if (window.__i18n.current) {
        window.__i18n.setLang(window.__i18n.current);
      }
    }
  });
});
