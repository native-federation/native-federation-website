import type { APIRoute } from 'astro';
import { buildLlmsTxt } from '../../../data/llms';

export const GET: APIRoute = async () =>
	new Response(await buildLlmsTxt('v3'), {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
