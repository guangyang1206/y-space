# Contributing

Welcome — and thanks for taking the time to look at the code.

This is a static personal portal: vanilla HTML / CSS / JS, **no build step**.
The only "tooling" lives in `node_modules` for local lint and is never shipped
to production.

## Local setup

```bash
# Node 20+ recommended (any LTS ≥ 18 works)
npm install
```

That's it. Open any `.html` file with a static server — for example:

```bash
# Quick local preview
python3 -m http.server 8080
# then visit http://localhost:8080/
```

## Linters

Four linters cover the whole site. Run them all with:

```bash
npm run lint
```

| Script             | Tool        | What it checks                                       |
|--------------------|-------------|------------------------------------------------------|
| `npm run lint:json` | Node script | Validates every `.json` (catches broken i18n dicts)  |
| `npm run lint:html` | HTMLHint    | Required tags, alt text, attribute hygiene, IDs      |
| `npm run lint:css`  | Stylelint   | CSS syntax, unknown properties, duplicate rules      |
| `npm run lint:js`   | ESLint      | JS syntax, undeclared globals, unused code           |

Auto-fix what's auto-fixable (CSS + JS only):

```bash
npm run lint:fix
```

## Deployment

`deploy-mac.sh` syncs the site to the production server (Tencent Cloud Lighthouse).
**Lint runs automatically before deploy** — if anything fails, the deploy aborts.

```bash
# Normal deploy (lints first)
bash deploy-mac.sh

# Emergency: skip lint (use sparingly!)
SKIP_LINT=1 bash deploy-mac.sh
```

The deploy script also excludes development-only files (`package.json`,
config files, `node_modules`, lint configs, etc.) from rsync — production
only ever sees the actual static assets.

## Conventions

- **Indentation**: 2 spaces (enforced by `.editorconfig`)
- **Line endings**: LF
- **i18n**: every visible text on user-facing pages should have a
  `data-i18n="namespace.key"` attribute and a corresponding entry in
  **both** `assets/i18n/en.json` and `assets/i18n/zh.json`
- **Cache busting**: when `site.js` / `i18n.js` / `global.css` change,
  bump `CACHE_BUST` in `assets/js/head-boot.js`

## File layout

```
my-space/
├── index.html, about/, blog/, projects/, resume/, …  ← Pages
├── assets/
│   ├── css/global.css       ← Single design-token CSS
│   ├── js/                  ← head-boot.js, i18n.js, site.js
│   ├── i18n/{en,zh}.json    ← Translation dictionaries
│   └── partials/            ← Shared header / footer fragments
├── lessons/                 ← Long-form Chinese articles (single-language, lint-skipped)
├── tools/                   ← Internal utilities (lint-skipped)
├── scripts/                 ← Repo tooling (e.g. lint-json.js)
├── deploy-mac.sh            ← One-shot deploy from local Mac
└── nginx.conf.example       ← Reference server config
```
