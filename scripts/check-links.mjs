/**
 * Перевірка битих внутрішніх посилань у зібраному сайті (папка dist/).
 * Запуск: npm run build && npm run check:links
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const BASE = (process.env.BASE_PATH ?? '/online-school').replace(/\/$/, '');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const exists = async (p) => stat(p).then(() => true, () => false);

async function resolveTarget(urlPath) {
  let p = decodeURIComponent(urlPath);
  if (BASE && !p.startsWith(`${BASE}/`) && p !== BASE) return { ok: false, reason: `немає base path ${BASE}` };
  p = p.slice(BASE.length) || '/';
  const file = join(DIST, p);
  if (p.endsWith('/')) return { ok: await exists(join(file, 'index.html')), file: join(file, 'index.html') };
  if (await exists(file)) return { ok: true, file };
  if (await exists(join(file, 'index.html'))) return { ok: true, file: join(file, 'index.html') };
  return { ok: false };
}

const files = (await walk(DIST)).filter((f) => f.endsWith('.html'));
const idCache = new Map();
async function ids(file) {
  if (!idCache.has(file)) {
    const html = await readFile(file, 'utf8');
    idCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idCache.get(file);
}

let broken = 0;
let checked = 0;
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const refs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1].replaceAll('&amp;', '&'));
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|viber:|data:|javascript:)/.test(ref) || ref.startsWith('//')) continue;
    checked++;
    const [pathAndQuery, hash] = ref.split('#');
    const path = pathAndQuery.split('?')[0];
    let target = { ok: true, file };
    if (path) {
      if (!path.startsWith('/')) {
        console.log(`⚠ відносне посилання "${ref}" у ${relative(DIST, file)}`);
        continue;
      }
      target = await resolveTarget(path);
    }
    if (!target.ok) {
      broken++;
      console.log(`✗ ${relative(DIST, file)} → ${ref}${target.reason ? ` (${target.reason})` : ''}`);
      continue;
    }
    if (hash && target.file?.endsWith('.html')) {
      const anchor = decodeURIComponent(hash);
      if (!(await ids(target.file)).has(anchor)) {
        broken++;
        console.log(`✗ ${relative(DIST, file)} → ${ref} (немає якоря #${anchor})`);
      }
    }
  }
}

console.log(`\nПеревірено сторінок: ${files.length}, посилань: ${checked}, битих: ${broken}`);
process.exit(broken ? 1 : 0);
