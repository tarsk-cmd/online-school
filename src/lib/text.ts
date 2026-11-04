import type { Lang } from '@/i18n/ui';

export type Localized = { uk: string; en?: string; pl?: string };

/** Бере текст потрібною мовою з об'єкта {uk, en, pl}; якщо перекладу немає — українською. */
export function l(value: Localized | string | undefined, lang: Lang): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value.uk;
}

/** Кольорові теми напрямів (повні назви класів, щоб Tailwind їх знайшов). */
export const DIRECTION_THEME = {
  indigo: { bg: 'bg-indigo-50', icon: 'bg-indigo-600 text-white', text: 'text-indigo-800', border: 'border-indigo-200', ring: 'hover:border-indigo-400' },
  teal: { bg: 'bg-teal-50', icon: 'bg-teal-700 text-white', text: 'text-teal-800', border: 'border-teal-200', ring: 'hover:border-teal-400' },
  violet: { bg: 'bg-violet-50', icon: 'bg-violet-600 text-white', text: 'text-violet-800', border: 'border-violet-200', ring: 'hover:border-violet-400' },
  rose: { bg: 'bg-rose-50', icon: 'bg-rose-600 text-white', text: 'text-rose-800', border: 'border-rose-200', ring: 'hover:border-rose-400' },
  emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-700 text-white', text: 'text-emerald-800', border: 'border-emerald-200', ring: 'hover:border-emerald-400' },
  amber: { bg: 'bg-amber-50', icon: 'bg-amber-500 text-ink', text: 'text-amber-900', border: 'border-amber-200', ring: 'hover:border-amber-400' },
} as const;

export function initials(name: string): string {
  const clean = name.replace(/\[.*?\]/g, '').trim();
  if (!clean) return '?';
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatDate(date: Date, lang: Lang): string {
  const locale = { uk: 'uk-UA', en: 'en-GB', pl: 'pl-PL' }[lang];
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
