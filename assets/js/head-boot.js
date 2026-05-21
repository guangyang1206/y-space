/**
 * head-boot.js — Injects shared <head> resources
 *
 * Using document.write (synchronous) to guarantee:
 *   - CSS loads in correct order (before body renders)
 *   - i18n.js runs before DOMContentLoaded so FOUC window is minimal
 *   - No extra HTTP cost vs writing these tags by hand in each page
 *
 * Per-page responsibilities (still done in each page's <head>):
 *   - <meta charset>, <meta viewport>      (must be first, cannot be injected)
 *   - <title>, page-specific <meta name="description">
 *   - Page-specific inline <style> blocks
 *   - Page-specific JSON-LD structured data
 *
 * SEO tags (canonical, OG, Twitter, hreflang) are generated here automatically
 * based on the current URL — so every page gets proper social previews and
 * search-engine hints without duplicating boilerplate.
 */
(function () {
  var CACHE_BUST = 'v=8';
  var SITE_ORIGIN = 'https://yeranyang.com';

  // ── Derive canonical path (strip query/hash, ensure trailing slash on dirs) ──
  var path = location.pathname || '/';
  // Normalize: /foo/index.html → /foo/
  path = path.replace(/index\.html$/i, '');
  var canonical = SITE_ORIGIN + path;

  // ── Read per-page title/description from existing head tags ──
  // (These exist because each page writes them *before* this script runs.)
  function attr(sel, a) {
    var el = document.querySelector(sel);
    return el ? (a ? el.getAttribute(a) : el.textContent) : '';
  }
  var pageTitle = attr('title') || 'YSpace';
  var pageDesc  = attr('meta[name="description"]', 'content') || '';

  // ── Escape for safe HTML attribute injection ──
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  var tags = [
    // ── Stylesheets ──
    '<link rel="stylesheet" href="/assets/css/global.css?' + CACHE_BUST + '">',

    // ── Runtime scripts — load in <head> so i18n fires before first paint ──
    '<script src="/assets/js/i18n.js?' + CACHE_BUST + '"><\/script>',
    '<script src="/assets/js/site.js?' + CACHE_BUST + '"><\/script>',

    // ── Favicon / app icons ──
    '<link rel="icon" type="image/svg+xml" href="/assets/images/favicon.svg">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-touch-icon.png">',

    // ── Theme color (matches brand accent) ──
    '<meta name="theme-color" content="#0A72EF">',
    '<meta name="author" content="Yang Guang">',

    // ── Canonical + hreflang (bilingual site) ──
    '<link rel="canonical" href="' + esc(canonical) + '">',
    '<link rel="alternate" hreflang="en" href="' + esc(canonical) + '?lang=en">',
    '<link rel="alternate" hreflang="zh-CN" href="' + esc(canonical) + '?lang=zh">',
    '<link rel="alternate" hreflang="x-default" href="' + esc(canonical) + '">',

    // ── Open Graph ──
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="YSpace">',
    '<meta property="og:title" content="' + esc(pageTitle) + '">',
    '<meta property="og:description" content="' + esc(pageDesc) + '">',
    '<meta property="og:url" content="' + esc(canonical) + '">',
    '<meta property="og:image" content="' + SITE_ORIGIN + '/assets/images/og-cover.svg">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:locale" content="en_US">',
    '<meta property="og:locale:alternate" content="zh_CN">',

    // ── Twitter / X ──
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:site" content="@guangyang1206">',
    '<meta name="twitter:creator" content="@guangyang1206">',
    '<meta name="twitter:title" content="' + esc(pageTitle) + '">',
    '<meta name="twitter:description" content="' + esc(pageDesc) + '">',
    '<meta name="twitter:image" content="' + SITE_ORIGIN + '/assets/images/og-cover.svg">'
  ];

  document.write(tags.join('\n'));
})();
