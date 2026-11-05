import { DEFAULT_LANG, LOCALES, type Lang } from './ui';

/** Сторінки, повністю перекладені англійською та польською. */
export const FULLY_TRANSLATED = ['/', '/courses/', '/pricing/', '/contacts/'] as const;

/** Сторінки, що існують у en/pl як заглушка «перекладається» (TODO: перекласти). */
export const TODO_TRANSLATION = ['/exams/', '/tutoring/', '/teachers/', '/parents/', '/blog/', '/privacy/', '/terms/'] as const;

export const STATIC_PATHS = [...FULLY_TRANSLATED, ...TODO_TRANSLATION] as string[];

/** Додає base path (/online-school) до внутрішнього посилання. */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (/^(https?:|mailto:|tel:|viber:|#)/.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}

/** Шлях сторінки для потрібної мови: localizedPath('en', '/courses/') → /online-school/en/courses/ */
export function localizedPath(lang: Lang, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return withBase(lang === DEFAULT_LANG ? clean : `/${lang}${clean}`);
}

/** Шлях без base і без префікса мови: /online-school/en/pricing/ → /pricing/ */
export function stripLocale(pathname: string): { lang: Lang; path: string } {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let p = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  if (!p.startsWith('/')) p = `/${p}`;
  const seg = p.split('/')[1] as Lang;
  if (LOCALES.includes(seg) && seg !== DEFAULT_LANG) {
    p = p.slice(seg.length + 1) || '/';
    return { lang: seg, path: p };
  }
  return { lang: DEFAULT_LANG, path: p };
}

/** Куди вести перемикач мов: та сама сторінка, а якщо її немає в цій мові — відповідний розділ. */
/** Мови, якими є шаховий тренажер (/trener/). */
export const TRAINER_LANGS: readonly Lang[] = ['uk', 'pl'];

export function switchTarget(path: string, target: Lang): string {
  if (path.startsWith('/404')) return localizedPath(target, '/');
  if (path.startsWith('/trener/')) return localizedPath(target, TRAINER_LANGS.includes(target) ? '/trener/' : '/');
  if (target === DEFAULT_LANG || STATIC_PATHS.includes(path)) return localizedPath(target, path);
  if (path.startsWith('/courses/') || path.startsWith('/directions/')) return localizedPath(target, '/courses/');
  if (path.startsWith('/blog/')) return localizedPath(target, '/blog/');
  return localizedPath(target, '/');
}

export function isFullyTranslated(path: string): boolean {
  return (FULLY_TRANSLATED as readonly string[]).includes(path);
}
