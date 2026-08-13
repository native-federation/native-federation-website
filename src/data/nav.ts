import { navV3 } from './nav.v3';
import { navV4 } from './nav.v4';

export const VERSIONS = ['v4', 'v3'] as const;
export type Version = (typeof VERSIONS)[number];

export const DEFAULT_VERSION: Version = 'v4';
/** Present in every version tree, so it is always a safe landing page. */
export const VERSION_ROOT = 'getting-started';

export interface NavItem {
	label: string;
	/** Version-relative clean URL (rendered as `/docs/${version}/${id}/`). */
	id: string;
	/** Absolute href for cross-version links; when set, `id` is not used to build the URL. */
	href?: string;
}

export interface NavSection {
	section: string;
	items: NavItem[];
}

const trees: Record<Version, NavSection[]> = { v3: navV3, v4: navV4 };

export const navFor = (version: Version): NavSection[] => trees[version];

export const isVersion = (value: string): value is Version =>
	(VERSIONS as readonly string[]).includes(value);
