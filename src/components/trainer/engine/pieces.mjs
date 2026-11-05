/**
 * Рушій режиму «Як ходять фігури» (зібрати всі зірочки).
 * Чистий JS без залежностей: використовується і в браузері (тренажер),
 * і в Node (scripts/check-puzzles.mjs) — щоб перевірка задач рахувала так само, як гра.
 *
 * Модель завдання:
 *   piece    — 'r' | 'b' | 'q' | 'k' | 'n' | 'p' (біла фігура гравця)
 *   start    — поле старту, напр. 'a1'
 *   stars    — поля із зірочками (зібрати, ставши на поле)
 *   food     — поля з чорними пішаками, яких можна «з'їсти» (для пішака — по діагоналі)
 *   blockers — поля зі своїми (білими) пішаками-перешкодами: на них ставати не можна,
 *              крізь них ходять лише кінь
 *   enemies  — чорні фігури-«сторожі» у форматі 'nd5' (тип + поле). Їх не можна бити,
 *              а поля, які вони б'ють, — «небезпечні»: туди ставати не можна.
 */

export const FILES = 'abcdefgh';

/** @param {string} sq */
export function parseSquare(sq) {
  if (typeof sq !== 'string' || !/^[a-h][1-8]$/.test(sq)) return null;
  return { f: FILES.indexOf(sq[0]), r: Number(sq[1]) - 1 };
}
/** @param {number} f @param {number} r */
export function toSquare(f, r) {
  return f >= 0 && f < 8 && r >= 0 && r < 8 ? FILES[f] + (r + 1) : null;
}

const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const LINES = { r: ROOK, b: BISHOP, q: [...ROOK, ...BISHOP] };

/** Поля, які б'є чорна фігура-сторож (для небезпечних полів). */
export function attackedBy(type, sq, isOccupied) {
  const p = parseSquare(sq);
  const out = [];
  if (!p) return out;
  if (type === 'p') {
    // чорний пішак б'є вниз по діагоналі
    for (const df of [-1, 1]) {
      const s = toSquare(p.f + df, p.r - 1);
      if (s) out.push(s);
    }
    return out;
  }
  if (type === 'n' || type === 'k') {
    const deltas = type === 'n' ? KNIGHT : [...ROOK, ...BISHOP];
    for (const [df, dr] of deltas) {
      const s = toSquare(p.f + df, p.r + dr);
      if (s) out.push(s);
    }
    return out;
  }
  for (const [df, dr] of LINES[type] ?? []) {
    let f = p.f + df;
    let r = p.r + dr;
    let s;
    while ((s = toSquare(f, r))) {
      out.push(s);
      if (isOccupied(s)) break;
      f += df;
      r += dr;
    }
  }
  return out;
}

/** Розбирає 'nd5' → { type: 'n', square: 'd5' } */
export function parseEnemy(code) {
  if (typeof code !== 'string' || !/^[pnbrqk][a-h][1-8]$/.test(code)) return null;
  return { type: code[0], square: code.slice(1) };
}

/** Готує «світ» завдання: зайняті поля й небезпечні поля. */
export function buildWorld(task) {
  const blockers = new Set(task.blockers ?? []);
  const enemies = (task.enemies ?? []).map(parseEnemy).filter(Boolean);
  const enemySquares = new Set(enemies.map((e) => e.square));
  const food = new Set(task.food ?? []);
  const isOccupied = (s) => blockers.has(s) || enemySquares.has(s) || food.has(s);
  const danger = new Set();
  for (const e of enemies) for (const s of attackedBy(e.type, e.square, isOccupied)) danger.add(s);
  return { blockers, enemies, enemySquares, food, danger };
}

/**
 * Куди може піти фігура гравця (за геометрією, без урахування небезпечних полів).
 * @param {string} type @param {string} from
 * @param {{blockers:Set<string>, enemySquares:Set<string>}} world
 * @param {Set<string>} food — ще не з'їдені чорні пішаки
 */
export function pieceMoves(type, from, world, food) {
  const p = parseSquare(from);
  const out = [];
  if (!p) return out;
  const solid = (s) => world.blockers.has(s) || world.enemySquares.has(s);
  const empty = (s) => !solid(s) && !food.has(s);
  if (type === 'p') {
    const one = toSquare(p.f, p.r + 1);
    if (one && empty(one)) {
      out.push(one);
      const two = toSquare(p.f, p.r + 2);
      if (p.r === 1 && two && empty(two)) out.push(two);
    }
    for (const df of [-1, 1]) {
      const s = toSquare(p.f + df, p.r + 1);
      if (s && food.has(s)) out.push(s);
    }
    return out;
  }
  if (type === 'n' || type === 'k') {
    const deltas = type === 'n' ? KNIGHT : [...ROOK, ...BISHOP];
    for (const [df, dr] of deltas) {
      const s = toSquare(p.f + df, p.r + dr);
      if (s && !solid(s)) out.push(s);
    }
    return out;
  }
  for (const [df, dr] of LINES[type] ?? []) {
    let f = p.f + df;
    let r = p.r + dr;
    let s;
    while ((s = toSquare(f, r)) && !solid(s)) {
      out.push(s);
      if (food.has(s)) break;
      f += df;
      r += dr;
    }
  }
  return out;
}

/** Пішак на останній горизонталі стає ферзем. */
export function promoted(type, sq) {
  return type === 'p' && sq[1] === '8' ? 'q' : type;
}

/**
 * Мінімальна кількість ходів, щоб зібрати всі зірочки й з'їсти всіх пішаків (пошук у ширину).
 * Повертає null, якщо завдання нерозв'язне.
 */
export function minMoves(task) {
  const world = buildWorld(task);
  const goals = [...(task.stars ?? []), ...(task.food ?? [])];
  const full = (1 << goals.length) - 1;
  const collect = (mask, sq) => {
    const i = goals.indexOf(sq);
    return i >= 0 ? mask | (1 << i) : mask;
  };
  const startMask = collect(0, task.start);
  const key = (t, s, m) => `${t}${s}${m}`;
  let frontier = [[task.piece, task.start, startMask]];
  const seen = new Set([key(task.piece, task.start, startMask)]);
  if (startMask === full) return 0;
  for (let depth = 1; depth <= 64 && frontier.length; depth++) {
    const next = [];
    for (const [type, sq, mask] of frontier) {
      const food = new Set((task.food ?? []).filter((s) => !(mask & (1 << goals.indexOf(s)))));
      for (const to of pieceMoves(type, sq, world, food)) {
        if (world.danger.has(to)) continue;
        const m = collect(mask, to);
        const t = promoted(type, to);
        if (m === full) return depth;
        const k = key(t, to, m);
        if (!seen.has(k)) {
          seen.add(k);
          next.push([t, to, m]);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * Перший крок найкоротшого шляху (для кнопки «Підказка»).
 * Повертає { from, to } або null.
 */
export function nextStep(task) {
  const world = buildWorld(task);
  const goals = [...(task.stars ?? []), ...(task.food ?? [])];
  const full = (1 << goals.length) - 1;
  const collect = (mask, sq) => {
    const i = goals.indexOf(sq);
    return i >= 0 ? mask | (1 << i) : mask;
  };
  const startMask = collect(0, task.start);
  if (startMask === full) return null;
  let frontier = [[task.piece, task.start, startMask, null]];
  const seen = new Set([`${task.piece}${task.start}${startMask}`]);
  for (let depth = 1; depth <= 64 && frontier.length; depth++) {
    const next = [];
    for (const [type, sq, mask, first] of frontier) {
      const food = new Set((task.food ?? []).filter((s) => !(mask & (1 << goals.indexOf(s)))));
      for (const to of pieceMoves(type, sq, world, food)) {
        if (world.danger.has(to)) continue;
        const m = collect(mask, to);
        const step = first ?? to;
        if (m === full) return { from: task.start, to: step };
        const t = promoted(type, to);
        const k = `${t}${to}${m}`;
        if (!seen.has(k)) {
          seen.add(k);
          next.push([t, to, m, step]);
        }
      }
    }
    frontier = next;
  }
  return null;
}
