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
 *
 * To add a site-wide resource (e.g. favicon, analytics, font preload),
 * add it here once — it propagates to every page automatically.
 */
(function () {
  var CACHE_BUST = 'v=6';

  var tags = [
    // Stylesheets
    '<link rel="stylesheet" href="/assets/css/global.css?' + CACHE_BUST + '">',

    // Runtime scripts — load in <head> so i18n fires before first paint
    '<script src="/assets/js/i18n.js?' + CACHE_BUST + '"><\/script>',
    '<script src="/assets/js/site.js?' + CACHE_BUST + '"><\/script>',

    // Favicon / app icons — SVG for modern browsers, PNG fallback for iOS
    '<link rel="icon" type="image/svg+xml" href="/assets/images/favicon.svg">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-touch-icon.png">',

    // Theme color — matches favicon background so mobile address bar blends in
    '<meta name="theme-color" content="#000000">'
  ];

  document.write(tags.join('\n'));
})();
