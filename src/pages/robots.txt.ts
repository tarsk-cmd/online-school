import type { APIRoute } from 'astro';

// robots.txt генерується автоматично з адреси сайту (astro.config.mjs)
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/sitemap-index.xml`, site);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap.href}\n`, { headers: { 'Content-Type': 'text/plain' } });
};
