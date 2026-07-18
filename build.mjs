/* ==========================================================================
   Native Federation website — static site generator
   Converts every Markdown file under docs/ into an HTML page inside dist/,
   and copies the hand-authored static assets (landing pages, CSS, JS,
   images) alongside.

   Conventions (see README section in this file):
     - frontmatter: applies_to: [v3, v4], optional title / description
     - first blockquote            -> <p class="doc-lead"> (also the meta description)
     - > [!NOTE] / **Note:**       -> <div class="callout">
     - > [!INFO] / [!TIP]          -> <div class="callout callout-info">
     - > [!WARNING]                -> <div class="callout callout-warning">
     - **On this page** + list     -> <nav class="page-toc">
     - markdown tables             -> wrapped in <div class="table-wrap">
     - internal links to *.md      -> rewritten to *.html
   ========================================================================== */

import { readFile, writeFile, mkdir, readdir, copyFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import { slug as githubSlug } from 'github-slugger';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const DOCS = path.join(ROOT, 'docs');

const SITE_ORIGIN = 'https://native-federation.com';
const OG_IMAGE = `${SITE_ORIGIN}/images/sujet-dark.jpg`;
const SUPPORTED_VERSIONS = ['v3', 'v4'];

/* Top-level files/dirs copied verbatim into dist/ (hand-authored, not generated). */
const STATIC_ASSETS = [
  'index.html',
  'team.html',
  'resources.html',
  'components.js',
  'styles.css',
  'robots.txt',
  'llms.txt',
  'CNAME',
  'images',
];

/* -------------------------------------------------------------------------- */
/* Markdown renderer                                                          */
/* -------------------------------------------------------------------------- */

const md = new MarkdownIt({ html: true, linkify: false, typographer: false });

md.use(anchor, {
  slugify: (s) => githubSlug(s),
  permalink: false,
  tabIndex: false,
});

/* Callout / doc-lead detection on blockquotes, and page-toc detection.
   Runs before inline parsing so we can strip admonition labels from raw text. */
const CALLOUT_RULES = [
  { re: /^\s*\[!WARNING\]\s*/i, cls: 'callout callout-warning', strip: true },
  { re: /^\s*\[!(INFO|TIP|IMPORTANT)\]\s*/i, cls: 'callout callout-info', strip: true },
  { re: /^\s*\[!NOTE\]\s*/i, cls: 'callout', strip: true },
  { re: /^\s*\*\*Warning:\*\*\s*/, cls: 'callout callout-warning', strip: true },
  { re: /^\s*\*\*(Info|Tip):\*\*\s*/, cls: 'callout callout-info', strip: true },
  { re: /^\s*\*\*Note:\*\*\s*/, cls: 'callout', strip: true },
];

md.core.ruler.before('inline', 'nf_blocks', (state) => {
  const tokens = state.tokens;
  let blockquoteSeen = 0;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    /* ---- blockquotes -> doc-lead / callout ---- */
    if (tok.type === 'blockquote_open') {
      // find matching close (track nesting)
      let depth = 1;
      let close = -1;
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === 'blockquote_open') depth++;
        else if (tokens[j].type === 'blockquote_close') {
          depth--;
          if (depth === 0) { close = j; break; }
        }
      }
      if (close === -1) continue;

      blockquoteSeen++;
      const firstInline = tokens.slice(i + 1, close).find((t) => t.type === 'inline');

      if (blockquoteSeen === 1) {
        // The lead: render as a single <p class="doc-lead">, no blockquote wrapper.
        tok.meta = { ...(tok.meta || {}), lead: true };
        tokens[close].meta = { ...(tokens[close].meta || {}), lead: true };
        const innerP = tokens.slice(i + 1, close).find((t) => t.type === 'paragraph_open');
        if (innerP) innerP.attrSet('class', 'doc-lead');
        continue;
      }

      // Any other blockquote is a callout; pick a variant from its label.
      let cls = 'callout';
      if (firstInline) {
        for (const rule of CALLOUT_RULES) {
          if (rule.re.test(firstInline.content)) {
            cls = rule.cls;
            if (rule.strip) firstInline.content = firstInline.content.replace(rule.re, '');
            break;
          }
        }
      }
      tok.meta = { ...(tok.meta || {}), callout: cls };
      tokens[close].meta = { ...(tokens[close].meta || {}), callout: true };
      continue;
    }

    /* ---- "**On this page**" + list -> page-toc ---- */
    if (
      tok.type === 'paragraph_open' &&
      tokens[i + 1]?.type === 'inline' &&
      /^\*\*On this page\*\*$/i.test(tokens[i + 1].content.trim()) &&
      tokens[i + 2]?.type === 'paragraph_close' &&
      tokens[i + 3]?.type === 'bullet_list_open'
    ) {
      tokens[i + 1].content = 'On this page'; // re-tokenized by the inline rule (runs after this)
      tok.meta = { ...(tok.meta || {}), toc: 'open' };
      tokens[i + 2].meta = { ...(tokens[i + 2].meta || {}), toc: 'label' };
      // find matching bullet_list_close
      let depth = 1;
      for (let j = i + 4; j < tokens.length; j++) {
        if (tokens[j].type === 'bullet_list_open') depth++;
        else if (tokens[j].type === 'bullet_list_close') {
          depth--;
          if (depth === 0) {
            tokens[j].meta = { ...(tokens[j].meta || {}), toc: 'close' };
            break;
          }
        }
      }
    }
  }
});

md.renderer.rules.blockquote_open = (tokens, idx) => {
  const m = tokens[idx].meta;
  if (m?.lead) return '';
  return `<div class="${m?.callout || 'callout'}">\n`;
};
md.renderer.rules.blockquote_close = (tokens, idx) => {
  const m = tokens[idx].meta;
  if (m?.lead) return '';
  return '</div>\n';
};

const defaultParagraphOpen =
  md.renderer.rules.paragraph_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
  if (tokens[idx].meta?.toc === 'open') {
    return '<nav class="page-toc" aria-label="On this page">\n<strong>';
  }
  return defaultParagraphOpen(tokens, idx, options, env, self);
};
md.renderer.rules.paragraph_close = (tokens, idx, options, env, self) => {
  if (tokens[idx].meta?.toc === 'label') return '</strong>\n';
  return self.renderToken(tokens, idx, options);
};
const defaultBulletClose =
  md.renderer.rules.bullet_list_close ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.bullet_list_close = (tokens, idx, options, env, self) => {
  if (tokens[idx].meta?.toc === 'close') return '</ul>\n</nav>\n';
  return defaultBulletClose(tokens, idx, options, env, self);
};

md.renderer.rules.table_open = () => '<div class="table-wrap">\n<table>\n';
md.renderer.rules.table_close = () => '</table>\n</div>\n';

/* -------------------------------------------------------------------------- */
/* Page helpers                                                               */
/* -------------------------------------------------------------------------- */

/** First H1 text, plain. */
function extractTitle(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'heading_open' && tokens[i].tag === 'h1') {
      const inline = tokens[i + 1];
      return inline ? stripInline(inline.content) : '';
    }
  }
  return '';
}

/** First blockquote's text (the lead) — used as the meta description. */
function extractLead(tokens) {
  let seenBq = false;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'blockquote_open') {
      if (seenBq) return '';
      seenBq = true;
      const inline = tokens.slice(i).find((t) => t.type === 'inline');
      return inline ? stripInline(inline.content) : '';
    }
  }
  return '';
}

/** Strip inline markdown (links, code, emphasis) to plain text for metadata. */
function stripInline(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Rewrite relative links to *.md so they point at the generated *.html. */
function rewriteMdLinks(html) {
  return html.replace(/href="(?!https?:|mailto:|#)([^"]*?)\.md(#[^"]*)?"/g, 'href="$1.html$2"');
}

function versionBadge(appliesTo) {
  if (!Array.isArray(appliesTo) || appliesTo.length === 0) return '';
  const labels = SUPPORTED_VERSIONS.map((v) => {
    const active = appliesTo.includes(v);
    const cls = active ? 'version-check version-check--active' : 'version-check';
    const checked = active ? ' checked' : '';
    return `  <label class="${cls}"><input type="checkbox" disabled${checked} /><span>${v}</span></label>`;
  }).join('\n');
  return `<div class="version-support">
  <span class="version-support__label">Applies to</span>
${labels}
</div>\n`;
}

/** Insert the version badge immediately after the first </h1>. */
function injectBadge(html, badge) {
  if (!badge) return html;
  const i = html.indexOf('</h1>');
  if (i === -1) return badge + html;
  const after = i + '</h1>'.length;
  return html.slice(0, after) + '\n' + badge + html.slice(after);
}

function pageTemplate({ title, description, rel, rootPrefix, body }) {
  const pageTitle = `${title} — Native Federation Docs`;
  const canonical = `${SITE_ORIGIN}/docs/${rel}`;
  const mdUrl = canonical.replace(/\.html$/, '.md');
  const desc = escapeHtml(description || title);
  const t = escapeHtml(pageTitle);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t}</title>
    <meta name="description" content="${desc}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" type="text/markdown" href="${mdUrl}" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:site_name" content="Native Federation" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" type="image/png" href="${rootPrefix}images/favicon.png" />
    <link rel="apple-touch-icon" href="${rootPrefix}images/favicon.png" />
    <link rel="stylesheet" href="${rootPrefix}styles.css" />
  </head>
  <body>
    <div class="docs-layout">
      <aside class="docs-sidebar" aria-label="Documentation navigation"></aside>

      <main class="docs-content">
${body}
      </main>
    </div>

    <button class="sidebar-toggle" aria-label="Toggle documentation menu">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>

    <script src="${rootPrefix}components.js"></script>
    <script async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
  </body>
</html>
`;
}

/** Indent generated body so it sits neatly inside <main>. */
function indentBody(html) {
  return html
    .split('\n')
    .map((line) => (line.length ? '        ' + line : line))
    .join('\n')
    .replace(/\s+$/, '');
}

/* -------------------------------------------------------------------------- */
/* File walking / build                                                       */
/* -------------------------------------------------------------------------- */

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function copyRecursive(src, dest) {
  const s = await stat(src);
  if (s.isDirectory()) {
    await mkdir(dest, { recursive: true });
    for (const entry of await readdir(src)) {
      await copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(src, dest);
  }
}

async function buildDoc(mdPath) {
  const raw = await readFile(mdPath, 'utf8');
  const { data: fm, content } = matter(raw);

  const tokens = md.parse(content, {});
  const title = fm.title || extractTitle(tokens);
  const description = fm.description || extractLead(tokens);

  let body = md.render(content, {});
  body = rewriteMdLinks(body);
  body = injectBadge(body, versionBadge(fm.applies_to));
  body = indentBody(body);

  const rel = path.relative(DOCS, mdPath).replace(/\.md$/, '.html'); // e.g. adapters/esbuild/index.html
  const dirDepth = rel.split('/').length - 1;
  const rootPrefix = '../'.repeat(dirDepth + 1);

  const html = pageTemplate({ title, description, rel, rootPrefix, body });

  const outPath = path.join(DIST, 'docs', rel);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html, 'utf8');

  // Publish the markdown source alongside the HTML (for llms.txt / alternate links).
  const mdOut = path.join(DIST, 'docs', path.relative(DOCS, mdPath));
  await mkdir(path.dirname(mdOut), { recursive: true });
  await copyFile(mdPath, mdOut);

  return rel;
}

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // 1. Generate docs from markdown.
  const files = (await walk(DOCS)).filter((f) => f.endsWith('.md'));
  for (const f of files) await buildDoc(f);

  // 2. Copy hand-authored static assets.
  for (const asset of STATIC_ASSETS) {
    const src = path.join(ROOT, asset);
    if (!existsSync(src)) {
      console.warn(`  ! static asset missing, skipped: ${asset}`);
      continue;
    }
    await copyRecursive(src, path.join(DIST, asset));
  }

  console.log(`Built ${files.length} docs pages + ${STATIC_ASSETS.length} static assets -> dist/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
