import { visit, SKIP } from 'unist-util-visit';

/**
 * Port of build.mjs `table_open`/`table_close` renderer rules: wrap every Markdown
 * `<table>` in `<div class="table-wrap">…</div>` so styles.css `.table-wrap` keeps the
 * horizontal-scroll treatment.
 */
export default function rehypeTableWrap() {
	return (tree) => {
		visit(tree, 'element', (node, index, parent) => {
			if (node.tagName !== 'table' || !parent || index == null) return;

			// Skip if already wrapped (idempotent — avoids re-wrapping the node we just created).
			if (
				parent.type === 'element' &&
				parent.tagName === 'div' &&
				parent.properties?.className?.includes('table-wrap')
			) {
				return;
			}

			parent.children[index] = {
				type: 'element',
				tagName: 'div',
				properties: { className: ['table-wrap'] },
				children: [node],
			};
			return [SKIP, index]; // don't descend into the wrapper we just inserted
		});
	};
}
