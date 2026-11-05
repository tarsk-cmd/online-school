import { uk, type TrainerKey } from './uk';

/** Мови тренажера. Додайте сюди pl / en, коли з'являться переклади (див. uk.ts). */
const DICTS: Record<string, Partial<Record<TrainerKey, string>>> = { uk };

export type TrainerLang = 'uk' | 'en' | 'pl';
export type Localized = Partial<Record<TrainerLang, string>> | undefined;

export function createT(lang: TrainerLang) {
  const dict = DICTS[lang] ?? uk;
  return (key: TrainerKey, vars: Record<string, string | number> = {}): string => {
    const raw = dict[key] ?? uk[key] ?? key;
    return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  };
}

/** Текст із JSON задач ({ "uk": "...", "pl": "..." }) з запасним варіантом українською. */
export function pick(text: Localized, lang: TrainerLang): string {
  return text?.[lang] ?? text?.uk ?? '';
}

export type T = ReturnType<typeof createT>;
