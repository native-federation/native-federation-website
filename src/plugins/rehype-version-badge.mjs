import { visit, EXIT } from 'unist-util-visit';

/**
 * Port of build.mjs `versionBadge()` + `injectBadge()`.
 *
 * Emits the `.version-support` badge from a doc's `applies_to` frontmatter and inserts it
 * immediately after the first <h1> — identical markup and placement to the old build.
 *
 * Implemented as a rehype plugin rather than the plan's "VersionBadge.astro rendered in
 * DocPage": the H1 is rendered inside <Content />, so after-H1 placement requires a tree
 * transform (exactly what injectBadge did on the HTML string). Doing it here keeps the
 * content H1 — and its github-slugger anchor id / inline formatting — untouched.
 */
const SUPPORTED = ['v3', 'v4'];

export default function rehypeVersionBadge() {
	return (tree, file) => {
		const appliesTo = file.data?.astro?.frontmatter?.applies_to;
		if (!Array.isArray(appliesTo) || appliesTo.length === 0) return;

		const badge = buildBadge(appliesTo);
		visit(tree, 'element', (node, index, parent) => {
			if (node.tagName === 'h1' && parent && index != null) {
				parent.children.splice(index + 1, 0, badge);
				return EXIT;
			}
		});
	};
}

const el = (tagName, properties, children) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });

function buildBadge(appliesTo) {
	return el('div', { className: ['version-support'] }, [
		el('span', { className: ['version-support__label'] }, [text('Applies to')]),
		...SUPPORTED.map((v) => {
			const active = appliesTo.includes(v);
			const inputProps = { type: 'checkbox', disabled: true };
			if (active) inputProps.checked = true;
			return el(
				'label',
				{ className: active ? ['version-check', 'version-check--active'] : ['version-check'] },
				[el('input', inputProps, []), el('span', {}, [text(v)])],
			);
		}),
	]);
}
