import { visit, EXIT } from 'unist-util-visit';

/**
 * Port of the old build.mjs "doc-lead" behaviour (extractLead / blockquoteSeen === 1):
 * the FIRST blockquote in a doc is the lead. It renders as a bare
 * `<p class="doc-lead">` (no blockquote/div wrapper), and its plain text becomes the
 * page meta description unless the frontmatter already sets `description`.
 *
 * Runs BEFORE remark-callouts so the first blockquote is unwrapped and never mistaken
 * for a callout.
 */
export default function remarkDocLead() {
	return (tree, file) => {
		let target = null;
		visit(tree, 'blockquote', (node, index, parent) => {
			if (parent && index !== null && index !== undefined) {
				target = { node, index, parent };
			}
			return EXIT; // only the first blockquote is the lead
		});
		if (!target) return;

		const { node, index, parent } = target;

		// Mark the first inner paragraph as the lead paragraph.
		const firstPara = node.children.find((c) => c.type === 'paragraph');
		if (firstPara) {
			firstPara.data = firstPara.data || {};
			firstPara.data.hProperties = {
				...(firstPara.data.hProperties || {}),
				className: ['doc-lead'],
			};
		}

		// Unwrap: replace the blockquote with its children (drops the wrapper).
		parent.children.splice(index, 1, ...node.children);

		// Expose the lead text as the meta description (explicit frontmatter wins).
		const text = toText(firstPara || node).replace(/\s+/g, ' ').trim();
		const fm = file.data?.astro?.frontmatter;
		if (fm && text && !fm.description) {
			fm.description = text;
		}
	};
}

/** Plain text of an mdast node (drops formatting/images, keeps link/inline-code text). */
function toText(node) {
	if (!node) return '';
	if (typeof node.value === 'string') return node.value;
	if (Array.isArray(node.children)) return node.children.map(toText).join('');
	return '';
}
