# native-federation.com

Static site for [native-federation.com](https://native-federation.com). The
documentation is written in **Markdown** under `docs/` and generated to HTML by
`build.mjs`. The landing pages (`index.html`, `team.html`, `resources.html`) and
the shared chrome (`components.js`, `styles.css`) are hand-authored.

## Editing docs

Just edit the Markdown under `docs/`. Every `docs/**/*.md` file becomes a
clean-URL page at build time (`docs/foo.md` → `docs/foo/index.html`, served at
`/docs/foo/`) — you never write docs HTML by hand.

When you add a **new** docs page, also add it to the sidebar navigation tree in
`components.js` (`renderDocsSidebar`), which is the one place the nav is listed.

### Frontmatter

```markdown
---
applies_to: [v3, v4]   # renders the "Applies to" version badge
title: Custom Title    # optional; defaults to the first # heading
description: ...        # optional; defaults to the first blockquote (the lead)
---
```

### Markdown conventions

| You write | You get |
| --- | --- |
| First `>` blockquote after the H1 | `<p class="doc-lead">` + the page meta description |
| `> [!NOTE]` or `> **Note:** …` | `<div class="callout">` |
| `> [!INFO]` / `> [!TIP]` | `<div class="callout callout-info">` |
| `> [!WARNING]` or `> **Warning:** …` | `<div class="callout callout-warning">` |
| `**On this page**` followed by a bullet list | `<nav class="page-toc">` |
| A Markdown table | wrapped in `<div class="table-wrap">` |
| A link to `other-page.md` | rewritten to the clean URL `other-page/` |

Heading IDs use GitHub-style slugs, so `**On this page**` anchors match. Raw HTML
in Markdown passes through untouched if you ever need a bespoke component.

## Local development

```bash
npm install
npm run build      # generate into dist/
npm run preview    # build + serve dist/ at http://localhost:8080
```

The generated `dist/` is git-ignored.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs the build
and publishes `dist/` to GitHub Pages.

> **One-time setup:** in the repo, go to **Settings → Pages → Build and
> deployment → Source** and select **GitHub Actions** (instead of "Deploy from a
> branch"). The `CNAME` file is included in `dist/`, so the custom domain carries
> over automatically.
