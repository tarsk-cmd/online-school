import { uk, type TrainerKey } from './uk';
import { pl } from './pl';

/** Мови тренажера. Щоб додати англійську — створіть en.ts за зразком pl.ts і додайте сюди. */
const DICTS: Record<string, Partial<Record<TrainerKey, string>>> = { uk, pl };

export type TrainerLang = 'uk' | 'en' | 'pl';
export type Localized = Partial<Record<TrainerLang, string>> | undefined;

export function createT(lang: TrainerLang) {
  const dict = DICTS[lang] ?? uk;
  return (key: TrainerKey, vars: Record<string, string | number> = {}): string => {
    const raw = dict[key] ?? uk[key] ?? key;
    return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  };
}

/** «3 ходи» / «3 ruchy»: правильна форма слова «хід» для числа n. */
export function movesWord(lang: TrainerLang, n: number, t: ReturnType<typeof createT>): string {
  const m10 = n % 10;
  const m100 = n % 100;
  const few = m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14);
  let form: TrainerKey;
  if (lang === 'pl') form = n === 1 ? 'moves.one' : few ? 'moves.few' : 'moves.many';
  else form = m10 === 1 && m100 !== 11 ? 'moves.one' : few ? 'moves.few' : 'moves.many';
  return `${n} ${t(form)}`;
}

/** Текст із JSON задач ({ "uk": "...", "pl": "..." }) з запасним варіантом українською. */
export function pick(text: Localized, lang: TrainerLang): string {
  return text?.[lang] ?? text?.uk ?? '';
}

export type T = ReturnType<typeof createT>;
