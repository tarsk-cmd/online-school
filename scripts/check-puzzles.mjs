/**
 * Перевірка задач шахового тренажера (src/data/puzzles/*.json).
 * Запуск: npm run check-puzzles   (автоматично виконується перед npm run build)
 *
 * Для кожної задачі через chess.js перевіряє:
 *  - FEN коректний, по одному королю, реалістична кількість фігур, пішаки не на 1/8 горизонталі;
 *  - сторона, що НЕ ходить, не під шахом; поле toMove збігається з FEN;
 *  - «Шах чи не шах?»: відповідь check збігається з реальною позицією;
 *  - «Втечі від шаху»: сторона під шахом, є легальні ходи (не мат), авторський хід легальний;
 *  - «Мат в 1»: існує щонайменше один матуючий хід, авторський розв'язок — мат;
 *  - «Як ходять фігури»: поля коректні, зірочки досяжні (рахує мінімум ходів).
 * Будь-яка помилка → код виходу 1, і збірка зупиняється.
 */
import { readFile } from 'node:fs/promises';
import { Chess, validateFen } from 'chess.js';
import { buildWorld, minMoves, parseEnemy, parseSquare } from '../src/components/trainer/engine/pieces.mjs';

const DIR = new URL('../src/data/puzzles/', import.meta.url);
const load = async (name) => JSON.parse(await readFile(new URL(name, DIR), 'utf8'));

const errors = [];
const warn = [];
const err = (where, msg) => errors.push(`✗ ${where}: ${msg}`);
const VERBOSE = process.argv.includes('--verbose');

function hasText(obj) {
  return obj && typeof obj === 'object' && typeof obj.uk === 'string' && obj.uk.trim().length > 0;
}

/** Загальна перевірка позиції. Повертає Chess або null. */
function checkPosition(where, p) {
  if (typeof p.fen !== 'string') {
    err(where, 'немає поля fen');
    return null;
  }
  const v = validateFen(p.fen);
  if (!v.ok) {
    err(where, `некоректний FEN: ${v.error}`);
    return null;
  }
  let chess;
  try {
    chess = new Chess(p.fen);
  } catch (e) {
    err(where, `chess.js не завантажив FEN: ${e.message}`);
    return null;
  }
  const turn = chess.turn();
  if (p.toMove !== turn) err(where, `toMove="${p.toMove}", а за FEN ходять "${turn}"`);

  const count = { w: { all: 0, p: 0, k: 0 }, b: { all: 0, p: 0, k: 0 } };
  let kingOther = null;
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue;
      const c = count[cell.color];
      c.all++;
      if (cell.type === 'p') {
        c.p++;
        if (cell.square[1] === '1' || cell.square[1] === '8') err(where, `пішак на ${cell.square} (1-ша/8-ма горизонталь)`);
      }
      if (cell.type === 'k') {
        c.k++;
        if (cell.color !== turn) kingOther = cell.square;
      }
    }
  }
  for (const side of ['w', 'b']) {
    const c = count[side];
    if (c.k !== 1) err(where, `у сторони ${side} королів: ${c.k}`);
    if (c.all > 16) err(where, `у сторони ${side} забагато фігур: ${c.all}`);
    if (c.p > 8) err(where, `у сторони ${side} забагато пішаків: ${c.p}`);
  }
  if (kingOther && chess.isAttacked(kingOther, turn)) {
    err(where, `король сторони, що НЕ ходить (${kingOther}), під шахом — позиція нелегальна`);
  }
  if (!hasText(p.hint)) err(where, 'немає підказки hint.uk');
  if (!hasText(p.explanation)) err(where, 'немає пояснення explanation.uk');
  return chess;
}

function checkIds(where, list) {
  const seen = new Set();
  for (const p of list) {
    if (!p.id) err(where, 'задача без id');
    else if (seen.has(p.id)) err(where, `повторюється id "${p.id}"`);
    seen.add(p.id);
  }
}

function tryMove(chess, san) {
  try {
    return chess.move(san);
  } catch {
    return null;
  }
}

// ---------- Режим 2: Шах чи не шах ----------
const check = await load('check.json');
checkIds('check.json', check.puzzles);
for (const p of check.puzzles) {
  const where = `check.json → ${p.id}`;
  const chess = checkPosition(where, p);
  if (!chess) continue;
  if (typeof p.check !== 'boolean') err(where, 'поле check має бути true або false');
  else if (chess.isCheck() !== p.check) err(where, `check=${p.check}, а насправді ${chess.isCheck() ? 'шах є' : 'шаху немає'}`);
}

// ---------- Режим 3: Втечі від шаху ----------
const escape = await load('escape.json');
checkIds('escape.json', escape.puzzles);
for (const p of escape.puzzles) {
  const where = `escape.json → ${p.id}`;
  const chess = checkPosition(where, p);
  if (!chess) continue;
  if (!chess.isCheck()) err(where, 'сторона, що ходить, НЕ під шахом');
  const moves = chess.moves();
  if (moves.length === 0) err(where, 'немає легальних ходів (це мат або пат)');
  if (p.solution && !moves.includes(p.solution)) err(where, `авторський хід ${p.solution} нелегальний (є: ${moves.join(', ')})`);
  if (VERBOSE) console.log(`  ${p.id}: рятують ${moves.join(', ')}`);
}

// ---------- Режим 4: Мат в 1 ----------
const mate = await load('mate.json');
checkIds('mate.json', mate.puzzles);
const DIFFS = ['easy', 'medium', 'hard'];
for (const p of mate.puzzles) {
  const where = `mate.json → ${p.id}`;
  if (!DIFFS.includes(p.difficulty)) err(where, `difficulty має бути одним із ${DIFFS.join('/')}`);
  const chess = checkPosition(where, p);
  if (!chess) continue;
  if (chess.isGameOver()) {
    err(where, 'гра вже закінчена в початковій позиції');
    continue;
  }
  const mates = [];
  for (const m of chess.moves({ verbose: true })) {
    chess.move(m);
    if (chess.isCheckmate()) mates.push(m.san);
    chess.undo();
  }
  if (mates.length === 0) err(where, 'немає жодного матуючого ходу');
  if (p.solution) {
    const m = tryMove(chess, p.solution);
    if (!m) err(where, `авторський хід ${p.solution} нелегальний`);
    else if (!chess.isCheckmate()) err(where, `авторський хід ${p.solution} — не мат`);
  } else err(where, 'немає авторського розв’язку solution');
  if (VERBOSE) console.log(`  ${p.id}: мати ${mates.join(', ')}`);
}
for (const d of DIFFS) {
  const n = mate.puzzles.filter((p) => p.difficulty === d).length;
  if (n < 5) err('mate.json', `у підрівні ${d} лише ${n} задач (потрібно ≥ 5)`);
}

// ---------- Режим 1: Як ходять фігури ----------
const pieces = await load('pieces.json');
const levelIds = new Set();
for (const level of pieces.levels) {
  const lw = `pieces.json → ${level.id}`;
  if (levelIds.has(level.id)) err(lw, 'повторюється id рівня');
  levelIds.add(level.id);
  if (!'rbqknp'.includes(level.piece) || level.piece.length !== 1) err(lw, `невідома фігура "${level.piece}"`);
  if (!hasText(level.title) || !hasText(level.intro)) err(lw, 'немає title.uk або intro.uk');
  const mins = [];
  level.tasks.forEach((task, i) => {
    const where = `${lw} #${i + 1}`;
    const all = [task.start, ...(task.stars ?? []), ...(task.food ?? []), ...(task.blockers ?? [])];
    for (const s of all) if (!parseSquare(s)) err(where, `некоректне поле "${s}"`);
    for (const e of task.enemies ?? []) if (!parseEnemy(e)) err(where, `некоректний сторож "${e}" (формат: nd5)`);
    const enemySq = (task.enemies ?? []).map((e) => e.slice(1));
    const used = [...all, ...enemySq];
    const dup = used.filter((s, k) => used.indexOf(s) !== k);
    if (dup.length) err(where, `на одному полі кілька предметів: ${[...new Set(dup)].join(', ')}`);
    if (!task.stars?.length && !task.food?.length) err(where, 'немає жодної зірочки');
    if ((task.food ?? []).length && (task.enemies ?? []).length) err(where, 'не поєднуйте food і enemies в одному завданні');
    if (task.piece && task.piece !== level.piece) err(where, 'фігура завдання не збігається з фігурою рівня');
    if (level.piece === 'p' && /[18]$/.test(task.start)) err(where, 'пішак не може стояти на 1-й чи 8-й горизонталі');
    for (const s of task.food ?? []) if (/[18]$/.test(s)) err(where, `чорний пішак на ${s} — нелегально`);
    const world = buildWorld(task);
    if (world.danger.has(task.start)) err(where, `старт ${task.start} — на небезпечному полі`);
    for (const s of task.stars ?? []) if (world.danger.has(s)) err(where, `зірочка ${s} — на небезпечному полі`);
    if (!hasText(task.hint)) err(where, 'немає підказки hint.uk');
    const n = minMoves({ ...task, piece: level.piece });
    if (n === null) err(where, 'зірочки неможливо зібрати');
    mins.push(n);
  });
  if (VERBOSE) console.log(`  ${level.id}: мінімум ходів ${mins.join(', ')}`);
}

// ---------- Кількість ----------
if (mate.puzzles.length < 30) err('mate.json', `задач лише ${mate.puzzles.length} (потрібно ≥ 30)`);
if (check.puzzles.length < 15) err('check.json', `задач лише ${check.puzzles.length} (потрібно ≥ 15)`);
if (escape.puzzles.length < 15) err('escape.json', `задач лише ${escape.puzzles.length} (потрібно ≥ 15)`);

for (const w of warn) console.warn(w);
if (errors.length) {
  console.error(`\nПеревірка задач: знайдено помилок — ${errors.length}\n`);
  for (const e of errors) console.error(e);
  process.exit(1);
}
const taskCount = pieces.levels.reduce((n, l) => n + l.tasks.length, 0);
console.log(
  `✓ Задачі в порядку: фігури — ${pieces.levels.length} рівнів (${taskCount} завдань), ` +
    `«шах чи не шах» — ${check.puzzles.length}, «втечі» — ${escape.puzzles.length}, «мат в 1» — ${mate.puzzles.length}.`,
);
