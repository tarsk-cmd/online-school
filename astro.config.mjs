// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import rehypeBaseLinks from './scripts/rehype-base-links.mjs';

// Адреса сайту і base path для GitHub Pages.
// Якщо підключите власний домен (напр. school.ua) — задайте SITE_URL=https://school.ua і BASE_PATH=/
const SITE_URL = process.env.SITE_URL ?? 'https://tarsk-cmd.github.io';
const BASE_PATH = process.env.BASE_PATH ?? '/online-school';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'uk',
    locales: ['uk', 'en', 'pl'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'uk', locales: { uk: 'uk-UA', en: 'en', pl: 'pl-PL' } },
    }),
  ],
  markdown: { processor: unified({ rehypePlugins: [rehypeBaseLinks(BASE_PATH)] }) },
  vite: { plugins: [tailwindcss()] },
});
