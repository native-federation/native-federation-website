import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Emits the raw Markdown sources at `dist/docs/**\/*.md` after build, mirroring the old
 * build.mjs behaviour (it copied each source .md next to its generated HTML). llms.txt links
 * to 52 `/docs/<page>.md` URLs and DocPage's `<link rel="alternate" type="text/markdown">`
 * points at the same paths, so those must resolve on the built site.
 *
 * Post-build copy (not a public/docs mirror) keeps src/content/docs the single source of truth.
 */
export default function rawMdPassthrough() {
	return {
		name: 'raw-md-passthrough',
		hooks: {
			'astro:build:done': async ({ dir, logger }) => {
				const srcDocs = path.join(process.cwd(), 'src', 'content', 'docs');
				const destDocs = path.join(fileURLToPath(dir), 'docs');
				// src/content/docs contains only .md files, so a plain recursive copy is exact.
				await cp(srcDocs, destDocs, {
					recursive: true,
					filter: (src) => !src.endsWith('.mdx') && (src.endsWith('.md') || !path.extname(src)),
				});
				logger.info('Copied raw docs .md sources to dist/docs/');
			},
		},
	};
}
