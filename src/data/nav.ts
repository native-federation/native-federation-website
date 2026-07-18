export interface NavItem {
	label: string;
	/** Doubles as the clean URL relative to /docs/ (rendered as `/docs/${id}/`). */
	id: string;
}

export interface NavSection {
	section: string;
	items: NavItem[];
}

// The docs sidebar tree, moved verbatim from renderDocsSidebar() in components.js.
export const nav: NavSection[] = [
	{
		section: 'Getting Started',
		items: [
			{ label: 'Overview', id: 'getting-started' },
			{ label: 'Architecture Overview', id: 'architecture' },
			{ label: 'The Mental Model', id: 'mental-model' },
			{ label: 'Terminology', id: 'terminology' },
			{ label: 'Tutorial', id: 'tutorial' },
			{ label: 'Coming from Module Federation?', id: 'example' },
			{ label: 'v3 vs v4', id: 'v3-vs-v4' },
			{ label: 'Migration to v4', id: 'migration' },
		],
	},
	{
		section: 'Orchestrator',
		items: [
			{ label: 'Overview', id: 'orchestrator' },
			{ label: 'Getting Started', id: 'orchestrator/getting-started' },
			{ label: 'Architecture', id: 'orchestrator/architecture' },
			{ label: 'Configuration', id: 'orchestrator/configuration' },
			{ label: 'Version Resolver', id: 'orchestrator/version-resolver' },
			{ label: 'Event Registry', id: 'orchestrator/event-registry' },
			{ label: 'Node.js / SSR', id: 'orchestrator/node' },
			{ label: 'Module Federation', id: 'orchestrator/module-federation' },
			{ label: 'Security & SRI', id: 'orchestrator/security' },
		],
	},
	{
		section: 'Core',
		items: [
			{ label: 'Overview', id: 'core' },
			{ label: 'Getting Started', id: 'core/getting-started' },
			{ label: 'federation.config.mjs', id: 'core/configuration' },
			{ label: 'Sharing Dependencies', id: 'core/sharing' },
			{ label: 'Build Process', id: 'core/build-process' },
			{ label: 'Caching', id: 'core/caching' },
			{ label: 'Build Adapters', id: 'core/build-adapters' },
			{ label: 'Build Artifacts', id: 'core/artifacts' },
			{ label: 'API Reference', id: 'core/api-reference' },
		],
	},
	{
		section: 'Runtime',
		items: [
			{ label: 'Overview', id: 'runtime' },
			{ label: 'Getting Started', id: 'runtime/getting-started' },
			{ label: 'initFederation', id: 'runtime/init-federation' },
			{ label: 'loadRemoteModule', id: 'runtime/load-remote-module' },
			{ label: 'The Import Map', id: 'runtime/import-map' },
			{ label: 'API Reference', id: 'runtime/api-reference' },
		],
	},
	{
		section: 'Adapters',
		items: [
			{ label: 'Overview', id: 'adapters' },
			{ label: 'Build Your Own', id: 'adapters/build-your-own' },
		],
	},
	{
		section: 'esbuild Adapter',
		items: [
			{ label: 'Overview', id: 'adapters/esbuild' },
			{ label: 'Getting Started', id: 'adapters/esbuild/getting-started' },
			{ label: 'Builder', id: 'adapters/esbuild/builder' },
			{ label: 'Adapter Configuration', id: 'adapters/esbuild/configuration' },
			{ label: 'React & CJS Interop', id: 'adapters/esbuild/react-interop' },
		],
	},
	{
		section: 'Angular Adapter',
		items: [
			{ label: 'Overview', id: 'angular-adapter' },
			{ label: 'Getting Started', id: 'angular-adapter/getting-started' },
			{ label: 'Builder', id: 'angular-adapter/builder' },
			{ label: 'Schematics', id: 'angular-adapter/schematics' },
			{ label: 'Angular Config', id: 'angular-adapter/configuration' },
			{ label: 'Runtime', id: 'angular-adapter/runtime' },
			{ label: 'SSR & Hydration', id: 'angular-adapter/ssr' },
			{ label: 'I18N', id: 'angular-adapter/i18n' },
			{ label: 'Localization', id: 'angular-adapter/localization' },
			{ label: 'Custom Builder', id: 'angular-adapter/custom-builder' },
			{ label: 'Migration to v4', id: 'angular-adapter/migration-v4' },
		],
	},
	{
		section: 'Guides',
		items: [
			{ label: 'SSR & Hydration', id: 'ssr-hydration' },
			{ label: 'Native & Module Federation', id: 'native-and-module-federation' },
			{ label: 'Component Libs', id: 'component-libs' },
		],
	},
	{
		section: 'Reference',
		items: [
			{ label: 'FAQ', id: 'faq' },
			{ label: 'Blog Series', id: 'documentation' },
			{ label: 'Architecture Workshop', id: 'workshop' },
		],
	},
];
