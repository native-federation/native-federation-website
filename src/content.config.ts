import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
	schema: z.object({
		title: z.string().optional(),
		description: z.string().optional(),
		// Declared so it is preserved, not silently stripped.
		deprecated: z.boolean().optional(),
	}),
});

export const collections = { docs };
