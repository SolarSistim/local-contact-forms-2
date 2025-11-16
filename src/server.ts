/**
 * Netlify-compatible server entry point for Angular SSR
 * This file is optimized for Netlify Edge Functions
 */
import { AngularAppEngine } from '@angular/ssr';
import { getContext } from '@netlify/angular-runtime';

const angularAppEngine = new AngularAppEngine();

/**
 * Request handler for Netlify Edge Functions
 */
export default async function handler(request: Request): Promise<Response> {
  const context = getContext();

  try {
    const response = await angularAppEngine.handle(request, context);
    return response || new Response('Not found', { status: 404 });
  } catch (error) {
    console.error('SSR error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
