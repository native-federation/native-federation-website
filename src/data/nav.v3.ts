import type { NavSection } from './nav';

// v3 is the legacy tree: it carries only the pages that were marked `applies_to: [v3]`.
// Core and the esbuild adapter have no v3 pages, so those sections are absent here; the
// migration/comparison pages live in v4 only and are reached through cross-version links.
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
		section: 'Runtime / Orchestrator',
		items: [
			{ label: 'Overview', id: 'orchestrator' },
			{ label: 'Getting Started', id: 'orchestrator/getting-started' },
			{ label: 'Architecture', id: 'orchestrator/architecture' },
			{ label: 'Configuration', id: 'orchestrator/configuration' },
			{ label: 'Version Resolver', id: 'orchestrator/version-resolver' },
			{ label: 'Dependency Pooling', id: 'orchestrator/pooling' },
			{ label: 'Event Registry', id: 'orchestrator/event-registry' },
			{ label: 'Module Federation', id: 'orchestrator/module-federation' },
			{ label: 'Security & SRI', id: 'orchestrator/security' },
			{ label: 'Legacy Runtime', id: 'runtime' },
		],
	},
	{
		section: 'Adapters',
		items: [{ label: 'Overview', id: 'adapters' }],
	},
	{
		section: 'Angular Adapter',
		items: [
			{ label: 'Runtime', id: 'angular-adapter/runtime' },
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
