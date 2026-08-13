import type { NavSection } from './nav';

// v3 is the legacy tree, documented against the 21.x.x branch of the
// angular-architects/module-federation-plugin monorepo. The classic runtime is v3's default —
// the orchestrator is a v4 package and gets a single opt-in page that links into the v4 tree.
export const navV3: NavSection[] = [
	{
		section: 'Getting Started',
		items: [
			{ label: 'Overview', id: 'getting-started' },
			{ label: 'Architecture Overview', id: 'architecture' },
			{ label: 'The Mental Model', id: 'mental-model' },
			{ label: 'Terminology', id: 'terminology' },
			{ label: 'Coming from Module Federation?', id: 'example' },
			{ label: 'Migration to v4 ↗', id: 'migration', href: '/docs/v4/migration/' },
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
			{ label: 'Orchestrator (opt-in)', id: 'orchestrator' },
		],
	},
	{
		section: 'Core',
		items: [
			{ label: 'Overview', id: 'core' },
			{ label: 'Getting Started', id: 'core/getting-started' },
			{ label: 'federation.config.js', id: 'core/configuration' },
			{ label: 'Sharing Dependencies', id: 'core/sharing' },
			{ label: 'Build Process', id: 'core/build-process' },
			{ label: 'Build Adapters', id: 'core/build-adapters' },
			{ label: 'Build Artifacts', id: 'core/artifacts' },
		],
	},
	{
		section: 'Adapters',
		items: [{ label: 'Overview', id: 'adapters' }],
	},
	{
		section: 'esbuild Adapter',
		items: [
			{ label: 'Overview', id: 'adapters/esbuild' },
			{ label: 'Getting Started', id: 'adapters/esbuild/getting-started' },
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
			{ label: 'SSR', id: 'angular-adapter/ssr' },
			{ label: 'I18N', id: 'angular-adapter/i18n' },
			{ label: 'Localization', id: 'angular-adapter/localization' },
			{ label: 'Custom Builder', id: 'angular-adapter/custom-builder' },
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
