# native-federation.com

Static site for [native-federation.com](https://native-federation.com), built with
**[Astro](https://astro.build)**. The documentation is written in **Markdown** under
`src/content/docs/` (an Astro content collection) and the landing pages, chrome, and
Markdown conventions are Astro components — there is no hand-written HTML output.

## Project layout

```
astro.config.mjs          # site config: Prism highlighting, remark/rehype plugins, mermaid, sitemap
src/
  content/docs/**/*.md      # the docs (content collection); content.config.ts defines the schema
  content.config.ts         # docs collection + Zod frontmatter schema
  pages/
    index.astro team.astro resources.astro   # landing pages
    docs/[...slug].astro                      # renders every doc at its clean URL
  layouts/    DocPage.astro LandingPage.astro
  components/ Header.astro Footer.astro Sidebar.astro Toc.astro
  data/nav.ts               # sidebar navigation tree
  plugins/                  # remark/rehype ports of the doc conventions (below)
  integrations/raw-md.mjs   # emits raw .md sources to dist/docs/ for llms.txt
  styles/styles.css
public/                     # images/, robots.txt, llms.txt, CNAME, favicon
```

## Editing docs

Just edit the Markdown under `src/content/docs/`. Every `**/*.md` file becomes a
clean-URL page (`foo.md` → `/docs/foo/`, `foo/index.md` → `/docs/foo/`) — you never
write docs HTML by hand.

When you add a **new** docs page, also add it to the sidebar navigation tree in
`src/data/nav.ts`, which is the one place the nav is listed.

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
| A Markdown table | wrapped in `<div class="table-wrap">` |
| A link to `other-page.md` | rewritten to the clean URL `other-page/` |
| A ` ```mermaid ` fence | rendered client-side as a diagram (`astro-mermaid`) |

Code fences are highlighted by **Prism** (`syntaxHighlight: 'prism'`) using the existing
`.token.*` theme in `styles.css`. Heading IDs use GitHub-style slugs, so `#anchors` match.
Raw HTML in Markdown passes through untouched.

## Local development

```bash
npm install
npm run dev        # Astro dev server with hot reload
npm run build      # build the static site into dist/
npm run preview    # preview the built dist/ locally
```

The generated `dist/` is git-ignored.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs `npm run build`
(`astro build`) and publishes `dist/` to GitHub Pages.

> **One-time setup:** in the repo, go to **Settings → Pages → Build and deployment →
> Source** and select **GitHub Actions** (instead of "Deploy from a branch"). The `CNAME`
> file (in `public/`) is included in `dist/`, so the custom domain carries over
> automatically.
