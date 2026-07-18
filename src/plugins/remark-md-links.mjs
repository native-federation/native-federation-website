import { visit } from 'unist-util-visit';
import path from 'node:path';

/**
 * Port of build.mjs `rewriteMdLinks()`. Rewrites relative `*.md` links in doc bodies to
 * clean directory URLs, preserving `#hash`. Link paths are authored relative to the current
 * source file's directory; output is a RELATIVE url between the two clean URLs — byte-for-byte
 * what the old regex produced (see risk #2: must match exactly or internal nav breaks).
 *
 *   from runtime/import-map.md, `../orchestrator/index.md`  -> `../../orchestrator/`
 *   from adapters/esbuild/index.md, `../../core/index.md`   -> `../../core/`
 *   `./configuration.md#foo`                                -> `../configuration/#foo` (etc.)
 * External (http/mailto), in-page (#…), and non-.md links are left untouched.
 */
const CONTENT_BASE = ['src', 'content', 'docs'];

export default function remarkMdLinks() {
	return (tree, file) => {
		const base = path.join(file.cwd, ...CONTENT_BASE);
		const abs = path.resolve(file.cwd, file.path);
		const srcRelNoExt = path
			.relative(base, abs)
			.replace(/\.md$/, '')
			.split(path.sep)
			.join('/');

		const cleanOf = (p) => p.replace(/(^|\/)index$/, '');
		const srcClean = cleanOf(srcRelNoExt); // this page is served at /docs/<srcClean>/
		const srcDir = path.posix.dirname(srcRelNoExt);

		visit(tree, 'link', (node) => {
			const url = node.url;
			if (/^(https?:|mailto:|#)/.test(url)) return;

			const hashIdx = url.indexOf('#');
			const pathPart = hashIdx === -1 ? url : url.slice(0, hashIdx);
			const hash = hashIdx === -1 ? '' : url.slice(hashIdx);
			if (!pathPart.endsWith('.md')) return;

			const linkPath = pathPart.replace(/\.md$/, '');
			const targetClean = cleanOf(path.posix.normalize(path.posix.join(srcDir, linkPath)));
			const rel = path.posix.relative(srcClean || '.', targetClean || '.');
			const href = rel === '' ? './' : `${rel}/`;
			node.url = `${href}${hash}`;
		});
	};
}
