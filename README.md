# YSpace — Personal Portal

A static, hand-crafted personal website. No frameworks, no build tools — just HTML, CSS, and vanilla JS.

## Design

Design system inspired by [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (Vercel style). Includes:

- Shadow-as-border technique
- Dark/light theme with CSS custom properties
- Responsive mobile-first layout
- Scroll-triggered animations
- Accessible navigation (ARIA labels, keyboard support)

## Structure

```
/                                → Portal Home
/about/                          → Personal Introduction
/resume/                         → Online Resume
/projects/                       → Project Gallery
/projects/ai-explainer/          → AI Explainer (interactive demo)
/projects/personal-portal/       → Portal Architecture (this site)
/blog/                           → Blog List
/blog/launching-a-personal-portal/ → Sample Article
```

## Deploy

Copy the entire `my-space/` folder to any static file server:

```bash
# Nginx example
cp -r my-space/ /var/www/my-space
# Point Nginx root to /var/www/my-space
```

Or serve locally for development:

```bash
cd my-space
python3 -m http.server 8080
```

## Tech Stack

- **HTML5** — Semantic markup
- **CSS3** — Custom properties, Grid, Flexbox, animations
- **JavaScript** — Vanilla ES6+, no dependencies
- **Fonts** — Space Grotesk + JetBrains Mono (via Google Fonts)

## License

MIT
