import type { APIRoute } from 'astro';
import { buildLlmsTxt } from '../data/llms';
import { DEFAULT_VERSION } from '../data/nav';

export const GET: APIRoute = async () =>
	new Response(await buildLlmsTxt(DEFAULT_VERSION), {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
