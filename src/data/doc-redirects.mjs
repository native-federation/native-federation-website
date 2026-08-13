import { readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Maps every pre-split `/docs/<page>` URL onto its versioned replacement, so inbound links
 * and search results keep working after the v3/v4 fork. Read from disk at config load
 * because astro.config cannot query the content collection.
 *
 * v4 wins on collision; a page that survives only in v3 (example) redirects there instead.
 */
const CONTENT_BASE = path.join('src', 'content', 'docs');

function docIds(version) {
	const root = path.join(CONTENT_BASE, version);
	const ids = [];
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const abs = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(abs);
			else if (entry.name.endsWith('.md')) {
				const rel = path.relative(root, abs).split(path.sep).join('/');
				ids.push(rel.replace(/\.md$/, '').replace(/(^|\/)index$/, ''));
			}
		}
	};
	walk(root);
	return ids;
}

export function docRedirects() {
	const redirects = { '/docs': '/docs/v4/getting-started/' };
	for (const version of ['v3', 'v4']) {
		for (const id of docIds(version)) redirects[`/docs/${id}`] = `/docs/${version}/${id}/`;
	}
	// runtime-v3.md was absorbed as the v3 tree's angular-adapter/runtime, so it has no
	// versioned counterpart to derive this from.
	redirects['/docs/angular-adapter/runtime-v3'] = '/docs/v3/angular-adapter/runtime/';
	return redirects;
}
