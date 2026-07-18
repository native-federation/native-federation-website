import { visit } from 'unist-util-visit';

/**
 * Port of build.mjs CALLOUT_RULES. Runs AFTER remark-doc-lead, which has already unwrapped
 * the first blockquote (the lead). Every REMAINING blockquote becomes a
 * `<div class="callout …">`, matching the old renderer where any non-lead blockquote is a
 * callout (default class `callout`, upgraded by label). The label prefix is stripped.
 *
 *   [!WARNING]                     -> callout callout-warning   (case-insensitive)
 *   [!INFO] / [!TIP] / [!IMPORTANT]-> callout callout-info      (case-insensitive)
 *   [!NOTE]                        -> callout                   (case-insensitive)
 *   **Warning:**                   -> callout callout-warning   (case-sensitive)
 *   **Info:** / **Tip:**           -> callout callout-info      (case-sensitive)
 *   **Note:**                      -> callout                   (case-sensitive)
 *   (no label)                     -> callout
 */
const BRACKET_RULES = [
	{ re: /^\s*\[!WARNING\]\s*/i, cls: ['callout', 'callout-warning'] },
	{ re: /^\s*\[!(INFO|TIP|IMPORTANT)\]\s*/i, cls: ['callout', 'callout-info'] },
	{ re: /^\s*\[!NOTE\]\s*/i, cls: ['callout'] },
];

// Prose labels are the exact text of a leading **strong** node (case-sensitive, like the old regexes).
const PROSE_RULES = {
	'Warning:': ['callout', 'callout-warning'],
	'Info:': ['callout', 'callout-info'],
	'Tip:': ['callout', 'callout-info'],
	'Note:': ['callout'],
};

export default function remarkCallouts() {
	return (tree) => {
		visit(tree, 'blockquote', (node) => {
			let cls = ['callout'];
			let matched = false;

			const firstPara = node.children.find((c) => c.type === 'paragraph');
			const first = firstPara?.children?.[0];

			// Case A: bracket label as a leading text node, e.g. "[!NOTE] …".
			if (first && first.type === 'text') {
				for (const rule of BRACKET_RULES) {
					if (rule.re.test(first.value)) {
						cls = rule.cls;
						first.value = first.value.replace(rule.re, '');
						matched = true;
						break;
					}
				}
			}

			// Case B: prose label as a leading **strong** node, e.g. "**Note:** …".
			if (!matched && first && first.type === 'strong') {
				const label = toText(first);
				if (Object.prototype.hasOwnProperty.call(PROSE_RULES, label)) {
					cls = PROSE_RULES[label];
					firstPara.children.shift(); // drop the strong label
					const next = firstPara.children[0];
					if (next && next.type === 'text') next.value = next.value.replace(/^\s+/, '');
				}
			}

			// Render as <div class="callout …"> instead of <blockquote>.
			node.data = node.data || {};
			node.data.hName = 'div';
			node.data.hProperties = { ...(node.data.hProperties || {}), className: cls };
		});
	};
}

/** Plain text of an mdast node. */
function toText(node) {
	if (!node) return '';
	if (typeof node.value === 'string') return node.value;
	if (Array.isArray(node.children)) return node.children.map(toText).join('');
	return '';
}
