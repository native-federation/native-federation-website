# native-federation.com

Static site for [native-federation.com](https://native-federation.com), built with
**[Astro](https://astro.build)**. The documentation is written in **Markdown** under
`src/content/docs/` (an Astro content collection) and the landing pages, chrome, and
Markdown conventions are Astro components — there is no hand-written HTML output.

## Project layout

```
astro.config.mjs          # site config: Prism highlighting, remark/rehype plugins, mermaid, sitemap, redirects
src/
  content/docs/v4/**/*.md   # the current docs (content collection); content.config.ts defines the schema
  content/docs/v3/**/*.md   # the frozen v3 docs
  content.config.ts         # docs collection + Zod frontmatter schema
  pages/
    index.astro team.astro resources.astro   # landing pages
    docs/[...slug].astro                      # renders every doc at its clean URL
    llms.txt.ts docs/v3/llms.txt.ts           # generated LLM indexes (v4 at the root, v3 in-tree)
  layouts/    DocPage.astro LandingPage.astro
  components/ Header.astro Footer.astro Sidebar.astro VersionSelect.astro Toc.astro
  data/nav.ts nav.v3.ts nav.v4.ts   # one sidebar navigation tree per version
  data/doc-redirects.mjs    # pre-split /docs/<page> URLs -> their versioned home
  data/llms.ts              # llms.txt generator + per-page descriptions
  plugins/                  # remark/rehype ports of the doc conventions (below)
  integrations/raw-md.mjs   # emits raw .md sources to dist/docs/ for llms.txt
  styles/styles.css
public/                     # images/, robots.txt, CNAME, favicon
```

## Versioned docs

The docs are split into two independent trees, `src/content/docs/v4/` (current) and
`src/content/docs/v3/` (frozen legacy). The directory name becomes the first URL segment,
so `v4/core/sharing.md` is served at `/docs/v4/core/sharing/`, and a `<select>` at the top
of the sidebar switches between them. Pre-split `/docs/<page>` URLs redirect into v4.

Only `v3` pages that genuinely documented v3 were kept, so the v3 tree has no Core or
esbuild section. Links from v3 into v4-only pages are written as absolute
`/docs/v4/…/` URLs; relative `.md` links always stay inside their own tree.

## Editing docs

Just edit the Markdown under `src/content/docs/<version>/`. Every `**/*.md` file becomes a
clean-URL page (`v4/foo.md` → `/docs/v4/foo/`, `v4/foo/index.md` → `/docs/v4/foo/`) — you
never write docs HTML by hand.

When you add a **new** docs page, also add it to that version's sidebar tree in
`src/data/nav.v4.ts` or `src/data/nav.v3.ts`, which is the one place the nav is listed —
and which the generated `llms.txt` is built from.

### Frontmatter

Optional in full; most pages have none.

```markdown
---
title: Custom Title    # optional; defaults to the first # heading
description: ...        # optional; defaults to the first blockquote (the lead)
deprecated: true        # optional; marks a page as superseded
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
| A link to `other-page.md` | rewritten to the clean URL `other-page/`, within the same version tree |
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
