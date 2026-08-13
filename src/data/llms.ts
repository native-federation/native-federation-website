import { getCollection } from 'astro:content';
import { navFor, type Version } from './nav';

const SITE = 'https://native-federation.com';

const INTRO = `> Native Federation is a browser-native implementation of Module Federation for building Micro Frontends using web standards (ESM + Import Maps). It provides a shared API across build tools (esbuild, Angular CLI, Vite) and a runtime that wires remotes into a host via a generated import map.

This file indexes the Native Federation documentation for LLMs and AI coding tools. Each link points to a standalone markdown version of the corresponding docs page, mirroring the site's folder structure.

The ecosystem is split into four layers:

- **Core** (\`@softarc/native-federation\`) — the tooling-agnostic builder that consumes a \`federation.config.js\` and produces a \`remoteEntry.json\` plus an import map.
- **Orchestrator** (\`@softarc/native-federation-orchestrator\`) — the host-side runtime: version negotiation across many remotes, caching, and SRI verification.
- **Adapters** — wire the core into a specific build tool (esbuild, Vite, Angular CLI).
- **Runtime** (\`@softarc/native-federation-runtime\`) — the classic host runtime the Orchestrator replaces; end-of-life.`;

const HEADERS: Record<Version, string> = {
	v4: `# Native Federation (v4)

${INTRO}

Documentation for the previous major is indexed separately at ${SITE}/docs/v3/llms.txt.`,
	v3: `# Native Federation (v3 — legacy)

${INTRO}

This index covers the **v3** documentation only, which is frozen. Pages that exist for v4 alone are absent here. The current documentation is indexed at ${SITE}/llms.txt.`,
};

// Keyed by version-relative page id. Pages without an entry are listed without a suffix,
// matching the hand-written file this generator replaces.
const DESCRIPTIONS: Record<string, string> = {
	'getting-started': "switchboard linking to every section's getting-started page",
	architecture: 'how hosts, remotes, the builder, and the runtime fit together',
	'mental-model': 'core concepts for reasoning about Native Federation',
	terminology: 'glossary of host, remote, shared, exposed, import map, etc.',
	tutorial: 'end-to-end walkthrough building a host and a remote',
	example: 'the original webpack Module Federation plugin example, migrated to Native Federation',
	'v3-vs-v4': 'what changed between majors',
	migration: 'upgrade steps from v3',

	orchestrator: 'what the orchestrator solves and when to use it',
	'orchestrator/architecture': 'internal design and extension points',
	'orchestrator/configuration': 'every config option',
	'orchestrator/version-resolver': 'how shared-dependency version conflicts are resolved',
	'orchestrator/pooling': 'isolating shared dependencies into separate pools',
	'orchestrator/event-registry':
		'`window.__NF_REGISTRY__` — race-free init, cross-MFE resources and event streams',
	'orchestrator/node': '`initNodeFederation` and the `module.register()` loader hook',
	'orchestrator/module-federation':
		"`createGetShared` — bridge resolved singletons into webpack Module Federation's `shared` config",
	'orchestrator/security': 'subresource integrity for remote entries and their chunks',
	runtime: 'the end-of-life classic runtime and the gaps that motivated the Orchestrator',

	core: 'what the core package does and its public surface',
	'core/getting-started': 'install, minimal config, wire the builder',
	'core/configuration': 'every option on `withNativeFederation`',
	'core/sharing': '`share`, `shareAll`, secondary entry points',
	'core/build-process': 'the `federationBuilder` lifecycle including watch mode',
	'core/caching': 'how the builder caches shared bundles',
	'core/build-adapters': 'the `NFBuildAdapter` contract',
	'core/artifacts': '`remoteEntry.json` and the generated import map',
	'core/api-reference': 'exported functions and types',

	adapters: 'which adapters exist and when to use each',
	'adapters/build-your-own': 'implement `NFBuildAdapter` for a new bundler',
	'adapters/esbuild/react-interop': 'working with CommonJS and React ecosystems',

	'angular-adapter/builder': 'the Angular CLI builder',
	'angular-adapter/schematics': '`ng add` and generators',
	'angular-adapter/runtime': 'Angular-specific runtime helpers',
	'angular-adapter/i18n': 'Angular internationalization integration',

	'ssr-hydration': 'general SSR patterns',
	'native-and-module-federation': 'interop and differences',
	'component-libs': 'sharing component libraries',
	faq: 'common questions and pitfalls',
	documentation: 'the blog series behind these docs',
	workshop: 'the architecture workshop material',
};

/**
 * Builds the llms.txt body for one version from that version's sidebar tree, so the index and
 * the navigation can never disagree about which pages exist. Links point at the raw markdown
 * sources emitted next to the HTML by the raw-md integration.
 */
export async function buildLlmsTxt(version: Version): Promise<string> {
	const docs = await getCollection('docs');
	const sourceOf = new Map(
		docs
			.filter((entry) => entry.id.startsWith(`${version}/`))
			.map((entry) => [entry.id.slice(version.length + 1), entry.filePath!.replace(/^src\/content\/docs\//, '')]),
	);

	const sections = navFor(version).map((group) => {
		const lines = group.items
			// Cross-version pointers are indexed by the other version's file.
			.filter((item) => !item.href && sourceOf.has(item.id))
			.map((item) => {
				const url = `${SITE}/docs/${sourceOf.get(item.id)}`;
				const description = DESCRIPTIONS[item.id];
				return `- [${item.label}](${url})${description ? `: ${description}` : ''}`;
			});
		return `## ${group.section}\n\n${lines.join('\n')}`;
	});

	return `${HEADERS[version]}\n\n${sections.join('\n\n')}\n`;
}
