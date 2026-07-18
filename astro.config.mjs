// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mermaid from 'astro-mermaid';
import rawMdPassthrough from './src/integrations/raw-md.mjs';
import remarkDocLead from './src/plugins/remark-doc-lead.mjs';
import remarkCallouts from './src/plugins/remark-callouts.mjs';
import remarkMdLinks from './src/plugins/remark-md-links.mjs';
import rehypeVersionBadge from './src/plugins/rehype-version-badge.mjs';
import rehypeTableWrap from './src/plugins/rehype-table-wrap.mjs';

// https://astro.build/config
export default defineConfig({
	site: 'https://native-federation.com',
	outDir: 'dist',
	// astro-mermaid FIRST so it transforms ```mermaid fences (into client-rendered diagram
	// containers) before Prism highlighting sees them — mermaid source is never wrapped as
	// `language-mermaid`. mermaid.js is lazy-loaded only on pages that contain a diagram.
	integrations: [
		mermaid({
			theme: 'base',
			autoTheme: false, // the site is single-theme (light); no data-theme toggle
			enableLog: false,
			mermaidConfig: {
				themeVariables: {
					// Mapped to the site palette (styles.css :root).
					primaryColor: '#cffafe', // --color-primary-light
					primaryBorderColor: '#0891b2', // --color-primary
					primaryTextColor: '#1e293b', // --color-text
					lineColor: '#475569', // --color-text-secondary
					secondaryColor: '#fef3c7', // --color-accent-light
					secondaryBorderColor: '#d97706', // --color-accent
					tertiaryColor: '#f1f5f9', // --color-border-light
					background: '#ffffff', // --color-surface
					fontFamily: 'inherit',
				},
			},
		}),
		sitemap(),
		rawMdPassthrough(),
	],
	markdown: {
		// Prism (not the default Shiki): emits class-based `.token.*` spans that the
		// existing theme in styles.css (~L1425-1449) already styles — zero new CSS.
		syntaxHighlight: 'prism',
		// Off to preserve content verbatim: the old build (markdown-it, typographer:false)
		// kept straight quotes/dashes; Astro defaults smartypants:true, which would rewrite
		// them (curly quotes, en/em dashes, …) in every body AND in lead-derived meta.
		smartypants: false,
		// Order matters: doc-lead unwraps the first blockquote before callouts run.
		remarkPlugins: [remarkDocLead, remarkCallouts, remarkMdLinks],
		rehypePlugins: [rehypeVersionBadge, rehypeTableWrap],
	},
});
