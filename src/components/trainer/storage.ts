/**
 * Прогрес тренажера в localStorage. Усі звернення обгорнуті в try/catch:
 * якщо сховище недоступне (приватний режим, заборона cookies, iframe) —
 * тренажер працює з прогресом у пам'яті.
 */
const KEY = 'debut-trainer-v1';

export interface LevelResult {
  stars: number;
}

export interface Progress {
  v: 1;
  points: number;
  levels: Record<string, LevelResult>;
  badges: string[];
  streak: number;
  mates: number;
  muted: boolean;
  unlockAll: boolean;
  seenIntro: string[];
}

export const emptyProgress = (): Progress => ({
  v: 1,
  points: 0,
  levels: {},
  badges: [],
  streak: 0,
  mates: 0,
  muted: false,
  unlockAll: false,
  seenIntro: [],
});

export let storageAvailable = true;

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return emptyProgress();
    return { ...emptyProgress(), ...data };
  } catch {
    storageAvailable = false;
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    storageAvailable = false;
  }
}

export function clearProgress(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    storageAvailable = false;
  }
}
