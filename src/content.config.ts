import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
	schema: z.object({
		applies_to: z.array(z.enum(['v3', 'v4'])).optional(),
		title: z.string().optional(),
		description: z.string().optional(),
		// Not in the migration plan's stated schema, but present in the current
		// frontmatter (docs/example.md). Declared so it is preserved, not silently stripped.
		deprecated: z.boolean().optional(),
	}),
});

export const collections = { docs };
