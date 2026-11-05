/**
 * Шаховий тренажер «Дебют» — головна логіка інтерфейсу.
 * Режими: 1) як ходять фігури; 2) шах чи не шах; 3) втечі від шаху; 4) мат в 1 хід.
 */
import { Chess, type Square } from 'chess.js';
import piecesData from '@/data/puzzles/pieces.json';
import checkData from '@/data/puzzles/check.json';
import escapeData from '@/data/puzzles/escape.json';
import mateData from '@/data/puzzles/mate.json';
import { buildWorld, minMoves, nextStep, pieceMoves, promoted } from './engine/pieces.mjs';
import { Board } from './board';
import { createT, movesWord as movesWordFor, pick, type Localized, type T, type TrainerLang } from './i18n';
import type { TrainerKey } from './i18n/uk';
import { clearProgress, emptyProgress, loadProgress, saveProgress, storageAvailable, type Progress } from './storage';
import { play, setMuted } from './sound';
import { mascotSvg } from './mascot';

// ---------- Типи даних ----------
type ModeId = 'pieces' | 'check' | 'escape' | 'mate';
type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

interface PieceTask {
  start: string;
  stars?: string[];
  food?: string[];
  blockers?: string[];
  enemies?: string[];
  hint?: Localized;
}
interface Puzzle {
  id: string;
  fen: string;
  toMove: string;
  hint: Localized;
  explanation: Localized;
  solution?: string;
  check?: boolean;
  difficulty?: string;
  tags?: string[];
}
interface Level {
  id: string;
  mode: ModeId;
  title: string;
  sub: string;
  piece?: PieceType;
  intro?: string;
  tasks: (PieceTask | Puzzle)[];
}
interface Mode {
  id: ModeId;
  levels: Level[];
}

export interface TrainerConfig {
  lang: TrainerLang;
  signupUrl: string;
  parentsUrl: string;
  embed: boolean;
}

const BADGES: { id: string; icon: string }[] = [
  { id: 'first-move', icon: '👣' },
  { id: 'knight', icon: '🐴' },
  { id: 'pieces', icon: '♟️' },
  { id: 'eye', icon: '🦅' },
  { id: 'saver', icon: '🛡️' },
  { id: 'first-mate', icon: '🏁' },
  { id: 'smothered', icon: '🐎' },
  { id: 'mate-master', icon: '👑' },
  { id: 'streak10', icon: '🔥' },
  { id: 'points100', icon: '💯' },
  { id: 'stars', icon: '🌟' },
];

const GLYPH: Record<PieceType, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

const POINTS = 10;
const BONUS = 5;

// ---------- Допоміжне ----------
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const rand = (list: string) => {
  const parts = list.split('|');
  return parts[Math.floor(Math.random() * parts.length)];
};

/** Ділить список на рівні частини розміром не більше max. */
function chunk<X>(list: X[], max = 7): X[][] {
  const parts = Math.max(1, Math.ceil(list.length / max));
  const size = Math.ceil(list.length / parts);
  const out: X[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Розстановка FEN із мапи «поле → фігура» (латинська літера FEN). */
function placement(map: Map<string, string>): string {
  const rows: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let row = '';
    let empty = 0;
    for (const f of 'abcdefgh') {
      const p = map.get(`${f}${r}`);
      if (p) {
        if (empty) row += empty;
        empty = 0;
        row += p;
      } else empty++;
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join('/');
}

const fenPlacement = (chess: Chess) => chess.fen().split(' ')[0];

const starsText = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

// ---------- Стан гри на рівні ----------
interface PlayState {
  level: Level;
  index: number;
  mistakes: number;
  hints: number;
  /** зайві ходи в кожному завданні (рахується остання спроба) */
  extraByTask: number[];
  /** завдання, за які вже нараховано бали в цьому проходженні */
  awarded: Set<number>;
  earned: number;
  newBadges: string[];
  // поточне завдання
  taskMistakes: number;
  taskHint: boolean;
  solved: boolean;
  busy: boolean;
  // режим «фігури»
  piece?: PieceType;
  square?: string;
  stars?: Set<string>;
  food?: Set<string>;
  moves?: number;
  best?: number;
  // шахові режими
  chess?: Chess;
  stage?: 'answer' | 'checker';
}

export class TrainerApp {
  private t: T;
  private progress: Progress;
  private modes: Mode[];
  private levels = new Map<string, Level>();
  private view!: HTMLElement;
  private pointsEl!: HTMLElement;
  private soundBtn!: HTMLButtonElement;
  private backBtn!: HTMLButtonElement;
  private board: Board | null = null;
  private st: PlayState | null = null;
  private timers: number[] = [];

  constructor(
    private root: HTMLElement,
    private cfg: TrainerConfig,
  ) {
    this.t = createT(cfg.lang);
    this.progress = loadProgress();
    setMuted(this.progress.muted);
    this.modes = this.buildModes();
    for (const m of this.modes) for (const l of m.levels) this.levels.set(l.id, l);
    this.renderShell();
    this.showMap();
  }

  // ---------- Дані ----------
  private buildModes(): Mode[] {
    const { t } = this;
    const lang = this.cfg.lang;
    const pieces: Level[] = piecesData.levels.map((l) => ({
      id: l.id,
      mode: 'pieces',
      title: pick(l.title, lang),
      sub: t('level.tasks', { n: l.tasks.length }),
      piece: l.piece as PieceType,
      intro: pick(l.intro, lang),
      tasks: l.tasks as PieceTask[],
    }));
    const parts = (mode: ModeId, list: Puzzle[], prefix: string, label = '') =>
      chunk(list).map((tasks, i, all): Level => ({
        id: `${prefix}-${i + 1}`,
        mode,
        title: label || t(`mode.${mode}` as TrainerKey),
        sub: all.length > 1 ? t('level.part', { n: i + 1 }) : t('level.tasks', { n: tasks.length }),
        tasks,
      }));
    const mate = (['easy', 'medium', 'hard'] as const).flatMap((d) =>
      parts('mate', (mateData.puzzles as Puzzle[]).filter((p) => p.difficulty === d), `mate-${d}`, t(`level.${d}`)),
    );
    return [
      { id: 'pieces', levels: pieces },
      { id: 'check', levels: parts('check', checkData.puzzles as Puzzle[], 'check') },
      { id: 'escape', levels: parts('escape', escapeData.puzzles as Puzzle[], 'escape') },
      { id: 'mate', levels: mate },
    ];
  }

  private save() {
    saveProgress(this.progress);
    this.pointsEl.textContent = String(this.progress.points);
  }

  private isDone(levelId: string) {
    return !!this.progress.levels[levelId];
  }
  private modeDone(mode: Mode) {
    return mode.levels.every((l) => this.isDone(l.id));
  }
  private modeUnlocked(i: number) {
    return this.progress.unlockAll || i === 0 || this.modeDone(this.modes[i - 1]);
  }
  private levelUnlocked(level: Level) {
    const mi = this.modes.findIndex((m) => m.id === level.mode);
    if (!this.modeUnlocked(mi)) return false;
    if (this.progress.unlockAll) return true;
    const list = this.modes[mi].levels;
    const li = list.indexOf(level);
    return li === 0 || this.isDone(list[li - 1].id);
  }
  private allLevels() {
    return this.modes.flatMap((m) => m.levels);
  }

  // ---------- Каркас ----------
  private renderShell() {
    const { t } = this;
    this.root.innerHTML = `
      <div class="tr-app${this.cfg.embed ? ' tr-embed' : ''}">
        <div class="tr-top">
          <button type="button" class="tr-iconbtn tr-back" data-act="map" hidden aria-label="${esc(t('app.back'))}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <p class="tr-top-title">${esc(t('app.title'))}</p>
          <p class="tr-pill" title="${esc(t('app.points'))}"><span aria-hidden="true">⭐</span> <span class="tr-points">${this.progress.points}</span><span class="sr-only"> ${esc(t('app.points'))}</span></p>
          <button type="button" class="tr-iconbtn tr-sound" data-act="sound"></button>
        </div>
        <div class="tr-view"></div>
        <div class="tr-toast" role="status" aria-live="polite"></div>
      </div>`;
    this.view = this.root.querySelector('.tr-view')!;
    this.pointsEl = this.root.querySelector('.tr-points')!;
    this.soundBtn = this.root.querySelector('.tr-sound')!;
    this.backBtn = this.root.querySelector('.tr-back')!;
    this.updateSoundBtn();
    this.root.addEventListener('click', (e) => this.onClick(e));
  }

  private updateSoundBtn() {
    const muted = this.progress.muted;
    const label = muted ? this.t('app.soundOn') : this.t('app.soundOff');
    this.soundBtn.setAttribute('aria-label', label);
    this.soundBtn.setAttribute('aria-pressed', String(!muted));
    this.soundBtn.title = label;
    this.soundBtn.innerHTML = muted
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  }

  private onClick(e: Event) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || el.hasAttribute('disabled')) return;
    const act = el.dataset.act;
    switch (act) {
      case 'sound':
        this.progress.muted = !this.progress.muted;
        setMuted(this.progress.muted);
        this.save();
        this.updateSoundBtn();
        if (!this.progress.muted) play('tap');
        break;
      case 'map':
        play('tap');
        this.showMap();
        break;
      case 'level':
        play('tap');
        this.openLevel(el.dataset.id!);
        break;
      case 'go':
        play('tap');
        this.startTask();
        break;
      case 'next':
        play('tap');
        this.nextTask();
        break;
      case 'retry-task':
        play('tap');
        this.startTask();
        break;
      case 'restart':
        play('tap');
        if (this.st) this.openLevel(this.st.level.id, true);
        break;
      case 'hint':
        this.hint();
        break;
      case 'answer':
        this.answerCheck(el.dataset.v === 'yes');
        break;
      case 'reset':
        if (window.confirm(this.t('settings.resetConfirm'))) {
          clearProgress();
          const muted = this.progress.muted;
          this.progress = { ...emptyProgress(), muted };
          this.save();
          this.showMap();
          this.toast(this.t('settings.resetDone'));
        }
        break;
      case 'unlock':
        this.progress.unlockAll = true;
        this.save();
        this.showMap();
        this.toast(this.t('settings.unlockDone'));
        break;
    }
  }

  private clearTimers() {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers = [];
  }
  private later(fn: () => void, ms: number) {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private toast(text: string) {
    const el = this.root.querySelector<HTMLElement>('.tr-toast')!;
    el.textContent = text;
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
    window.setTimeout(() => el.classList.remove('is-on'), 2600);
  }

  /** Прокрутити до початку тренажера (під липку шапку сайту). */
  private toTop() {
    const y = this.root.getBoundingClientRect().top + window.scrollY - (this.cfg.embed ? 0 : 72);
    if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y) });
  }

  private destroyBoard() {
    this.clearTimers();
    if (this.board) {
      this.board.destroy();
      this.board = null;
    }
  }

  private ctaHtml() {
    const { t } = this;
    const target = this.cfg.embed ? ' target="_blank" rel="noopener"' : '';
    return `
      <section class="tr-cta">
        <div>
          <h2 class="tr-cta-title">${esc(t('cta.title'))}</h2>
          <p>${esc(t('cta.text'))}</p>
        </div>
        <div class="tr-cta-btns">
          <a class="tr-btn tr-btn-sun" href="${esc(this.cfg.signupUrl)}"${target}>${esc(t('cta.button'))}</a>
          <a class="tr-link-light" href="${esc(this.cfg.parentsUrl)}"${target}>${esc(t('cta.parents'))} →</a>
        </div>
      </section>`;
  }

  // ---------- Карта рівнів ----------
  showMap() {
    this.destroyBoard();
    this.st = null;
    this.backBtn.hidden = true;
    this.toTop();
    const { t } = this;
    const all = this.allLevels();
    const done = all.filter((l) => this.isDone(l.id)).length;
    const pct = Math.round((done / all.length) * 100);
    const modesHtml = this.modes
      .map((mode, mi) => {
        const unlocked = this.modeUnlocked(mi);
        const prev = mi > 0 ? t(`mode.${this.modes[mi - 1].id}` as TrainerKey) : '';
        const levels = mode.levels
          .map((l) => {
            const open = this.levelUnlocked(l);
            const res = this.progress.levels[l.id];
            const icon = l.piece ? `<span class="tr-lv-piece" aria-hidden="true">${GLYPH[l.piece]}\uFE0E</span>` : '';
            return `
              <li>
                <button type="button" class="tr-level${res ? ' is-done' : ''}" data-act="level" data-id="${l.id}" ${open ? '' : 'disabled'}
                  aria-label="${esc(`${l.title}. ${l.sub}. ${open ? (res ? t('level.stars', { n: res.stars }) : '') : t('level.locked')}`)}">
                  ${icon}
                  <span class="tr-lv-text"><span class="tr-lv-title">${esc(l.title)}</span><span class="tr-lv-sub">${esc(l.sub)}</span></span>
                  <span class="tr-lv-stars" aria-hidden="true">${open ? (res ? starsText(res.stars) : '☆☆☆') : '🔒'}</span>
                </button>
              </li>`;
          })
          .join('');
        return `
          <section class="tr-mode${unlocked ? '' : ' is-locked'}" aria-labelledby="tr-mode-${mode.id}">
            <div class="tr-mode-head">
              <span class="tr-mode-num" aria-hidden="true">${mi + 1}</span>
              <div>
                <h2 id="tr-mode-${mode.id}" class="tr-mode-title">${esc(t(`mode.${mode.id}` as TrainerKey))}</h2>
                <p class="tr-mode-desc">${esc(unlocked ? t(`mode.${mode.id}.desc` as TrainerKey) : t('mode.locked', { prev }))}</p>
              </div>
            </div>
            <ul class="tr-levels">${levels}</ul>
          </section>`;
      })
      .join('');
    const badges = BADGES.map((b) => {
      const got = this.progress.badges.includes(b.id);
      return `<li class="tr-badge${got ? ' is-got' : ''}" title="${esc(t(`badge.${b.id}.desc` as TrainerKey))}">
          <span class="tr-badge-icon" aria-hidden="true">${got ? b.icon : '🔒'}</span>
          <span class="tr-badge-name">${esc(t(`badge.${b.id}` as TrainerKey))}</span>
          <span class="tr-badge-desc">${esc(t(`badge.${b.id}.desc` as TrainerKey))}</span>
        </li>`;
    }).join('');

    this.view.innerHTML = `
      <div class="tr-map">
        <section class="tr-hero">
          <div class="tr-mascot is-happy">${mascotSvg}</div>
          <div class="tr-hero-text">
            <p class="tr-bubble">${esc(rand(t('say.welcome')))}</p>
            <h1 class="tr-h1">${esc(t('app.title'))}</h1>
            <p class="tr-lead">${esc(t('app.subtitle'))}</p>
          </div>
        </section>
        <div class="tr-overall">
          <p>${esc(t('app.progress', { done, total: all.length }))}</p>
          <div class="tr-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(t('app.progress', { done, total: all.length }))}"><span style="width:${pct}%"></span></div>
        </div>
        ${storageAvailable ? '' : `<p class="tr-note">${esc(t('app.noStorage'))}</p>`}
        ${modesHtml}
        <section class="tr-badges-wrap" aria-labelledby="tr-badges-title">
          <h2 id="tr-badges-title" class="tr-mode-title">${esc(t('badges.title'))}</h2>
          <ul class="tr-badges">${badges}</ul>
        </section>
        ${this.ctaHtml()}
        <details class="tr-settings">
          <summary>${esc(t('settings.title'))}</summary>
          <div class="tr-settings-body">
            <button type="button" class="tr-btn tr-btn-ghost" data-act="unlock">${esc(t('settings.unlock'))}</button>
            <button type="button" class="tr-btn tr-btn-ghost" data-act="reset">${esc(t('settings.reset'))}</button>
          </div>
          <p class="tr-credits">${esc(t('app.credits'))}</p>
        </details>
      </div>`;
  }

  // ---------- Рівень ----------
  private openLevel(id: string, skipIntro = false) {
    const level = this.levels.get(id);
    if (!level || !this.levelUnlocked(level)) return;
    this.destroyBoard();
    this.backBtn.hidden = false;
    this.toTop();
    const { t } = this;
    this.st = {
      level,
      index: 0,
      mistakes: 0,
      hints: 0,
      extraByTask: [],
      awarded: new Set(),
      earned: 0,
      newBadges: [],
      taskMistakes: 0,
      taskHint: false,
      solved: false,
      busy: false,
    };
    this.view.innerHTML = `
      <div class="tr-play">
        <div class="tr-play-head">
          <h1 class="tr-play-title">${esc(level.title)} <span class="tr-play-sub">· ${esc(level.sub)}</span></h1>
          <p class="tr-counter"></p>
          <div class="tr-bar tr-bar-sm" aria-hidden="true"><span></span></div>
        </div>
        <div class="tr-play-grid">
          <div class="tr-board-wrap">
            <div class="tr-board" role="group" aria-label="${esc(t('app.boardLabel'))}"></div>
            <div class="tr-burst" aria-hidden="true"></div>
          </div>
          <div class="tr-side">
            <div class="tr-helper">
              <div class="tr-mascot tr-mascot-sm is-happy">${mascotSvg}</div>
              <p class="tr-bubble tr-say" aria-live="polite"></p>
            </div>
            <div class="tr-panel"></div>
            <div class="tr-tools">
              <button type="button" class="tr-btn tr-btn-ghost" data-act="hint">💡 ${esc(t('btn.hint'))}</button>
              <button type="button" class="tr-btn tr-btn-ghost" data-act="restart">↺ ${esc(t('btn.restart'))}</button>
            </div>
          </div>
        </div>
      </div>`;
    this.board = new Board(this.view.querySelector('.tr-board')!);
    const firstOfMode = this.modes.find((m) => m.id === level.mode)!.levels[0] === level;
    if (!skipIntro && (level.mode === 'pieces' || firstOfMode)) this.showIntro();
    else this.startTask();
  }

  private panel() {
    return this.view.querySelector<HTMLElement>('.tr-panel')!;
  }

  private say(text: string, mood: 'happy' | 'oops' | 'think' | 'cheer' = 'happy') {
    const bubble = this.view.querySelector<HTMLElement>('.tr-say');
    const mascot = this.view.querySelector<HTMLElement>('.tr-helper .tr-mascot');
    if (bubble) {
      bubble.textContent = text;
      bubble.classList.remove('is-pop');
      void bubble.offsetWidth;
      bubble.classList.add('is-pop');
    }
    if (mascot) {
      mascot.className = `tr-mascot tr-mascot-sm is-${mood}`;
    }
  }

  private setTools(enabled: boolean) {
    this.view.querySelectorAll<HTMLButtonElement>('[data-act="hint"]').forEach((b) => (b.disabled = !enabled));
  }

  private updateCounter() {
    const st = this.st!;
    const n = st.level.tasks.length;
    const counter = this.view.querySelector<HTMLElement>('.tr-counter');
    if (counter) counter.textContent = this.t('task.counter', { n: st.index + 1, total: n });
    const bar = this.view.querySelector<HTMLElement>('.tr-play-head .tr-bar span');
    if (bar) bar.style.width = `${Math.round(((st.index + (st.solved ? 1 : 0)) / n) * 100)}%`;
  }

  private async showIntro() {
    const st = this.st!;
    const { level } = st;
    const board = this.board!;
    let text = level.intro ?? '';
    if (level.mode === 'pieces' && level.piece) {
      const sq = level.piece === 'p' ? 'd2' : 'd4';
      const food = level.piece === 'p' ? new Set(['e3']) : new Set<string>();
      const map = new Map([[sq, level.piece.toUpperCase()]]);
      for (const f of food) map.set(f, 'p');
      await board.show(placement(map));
      const world = buildWorld({});
      board.mark('select', sq);
      for (const s of pieceMoves(level.piece, sq, world, food)) board.mark(food.has(s) ? 'ring' : 'dot', s);
    } else {
      const demo: Record<string, { fen: string; mark: [string, string[]][] }> = {
        check: { fen: '4r1k1/8/8/8/8/8/8/4K3', mark: [['king', ['e1']], ['hint', ['e8']]] },
        escape: { fen: '4r1k1/8/8/8/8/8/8/4K3', mark: [['king', ['e1']], ['dot', ['d1', 'd2', 'f1', 'f2']]] },
        mate: { fen: 'R5k1/5ppp/8/8/8/8/5PPP/6K1', mark: [['king', ['g8']], ['hint', ['a8']]] },
      };
      const d = demo[level.mode];
      text = this.t(`intro.${level.mode}` as TrainerKey);
      await board.show(d.fen);
      for (const [name, squares] of d.mark) board.mark(name as 'dot', squares);
    }
    this.updateCounter();
    this.setTools(false);
    this.say(rand(this.t('say.start')), 'happy');
    this.panel().innerHTML = `
      <div class="tr-intro">
        <p>${esc(text)}</p>
        <button type="button" class="tr-btn tr-btn-primary" data-act="go">${esc(this.t('intro.go'))}</button>
      </div>`;
  }

  private nextTask() {
    const st = this.st!;
    if (st.index + 1 >= st.level.tasks.length) {
      this.finishLevel();
      return;
    }
    st.index++;
    this.startTask();
  }

  private startTask() {
    const st = this.st!;
    this.clearTimers();
    st.taskMistakes = 0;
    st.taskHint = false;
    st.solved = false;
    st.busy = false;
    this.setTools(true);
    this.updateCounter();
    const task = st.level.tasks[st.index];
    if (st.level.mode === 'pieces') void this.startPieceTask(task as PieceTask);
    else void this.startChessTask(task as Puzzle);
  }

  // ---------- Режим 1: фігури ----------
  private pieceTaskFull(): PieceTask & { piece: PieceType } {
    const st = this.st!;
    return {
      piece: st.piece!,
      start: st.square!,
      stars: [...st.stars!],
      food: [...st.food!],
      blockers: (st.level.tasks[st.index] as PieceTask).blockers,
      enemies: (st.level.tasks[st.index] as PieceTask).enemies,
    };
  }

  private async startPieceTask(task: PieceTask) {
    const st = this.st!;
    const board = this.board!;
    st.piece = st.level.piece!;
    st.square = task.start;
    st.stars = new Set(task.stars ?? []);
    st.food = new Set(task.food ?? []);
    st.moves = 0;
    st.best = minMoves({ ...task, piece: st.piece }) ?? 0;
    const world = buildWorld(task);
    const map = new Map<string, string>([[task.start, st.piece.toUpperCase()]]);
    for (const s of task.blockers ?? []) map.set(s, 'P');
    for (const s of task.food ?? []) map.set(s, 'p');
    for (const e of task.enemies ?? []) map.set(e.slice(1), e[0]);
    await board.show(placement(map));
    board.mark('star', [...st.stars]);
    board.mark('danger', [...world.danger]);
    board.mark('soft', task.start);
    this.renderPiecePanel();
    this.say(st.index === 0 ? rand(this.t('say.start')) : this.t('q.pieces'), 'happy');

    board.enableMoves('w', {
      start: (sq) => {
        if (st.solved || st.busy || sq !== st.square) return false;
        board.unmark('soft');
        const targets = pieceMoves(st.piece!, sq, world, st.food!);
        return st.piece === 'k' ? targets.filter((s) => !world.danger.has(s)) : targets;
      },
      move: (from, to) => this.pieceMove(from, to, world),
    });
  }

  private renderPiecePanel() {
    const st = this.st!;
    const { t } = this;
    this.panel().innerHTML = `
      <p class="tr-q">${esc(t('q.pieces'))}</p>
      <p class="tr-movecount"><span>${esc(t('task.moves', { n: st.moves ?? 0 }))}</span><span>${esc(t('task.best', { n: st.best ?? 0 }))}</span></p>
      <div class="tr-actions"></div>`;
  }

  private pieceMove(from: string, to: string, world: ReturnType<typeof buildWorld>): boolean {
    const st = this.st!;
    const board = this.board!;
    if (from === to) return false;
    const legal = pieceMoves(st.piece!, from, world, st.food!);
    if (!legal.includes(to)) {
      this.mistake(this.t('fb.wrongMove', { piece: this.t(`piece.${st.piece}` as TrainerKey) }));
      return false;
    }
    if (world.danger.has(to)) {
      this.mistake(st.piece === 'k' ? this.t('fb.dangerKing') : this.t('fb.danger'));
      board.mark('hint', to);
      this.later(() => board.unmark('hint', to), 900);
      return false;
    }
    st.moves!++;
    st.square = to;
    board.unmark('hint');
    let got = false;
    if (st.stars!.delete(to)) {
      got = true;
      board.unmark('star', to);
      board.mark('starGone', to);
      this.later(() => board.unmark('starGone', to), 700);
    }
    if (st.food!.delete(to)) got = true;
    play(got ? 'star' : 'move');
    const newType = promoted(st.piece!, to);
    if (newType !== st.piece) {
      st.piece = newType as PieceType;
      this.later(() => void board.setPiece(to, 'wq', true), 300);
      this.say(this.t('fb.promoted'), 'cheer');
    } else if (got) this.say(this.t('fb.starGot'), 'happy');
    const mc = this.view.querySelector('.tr-movecount span');
    if (mc) mc.textContent = this.t('task.moves', { n: st.moves! });
    if (st.stars!.size === 0 && st.food!.size === 0) this.later(() => this.pieceTaskDone(), 350);
    return true;
  }

  private pieceTaskDone() {
    const st = this.st!;
    const { t } = this;
    const extra = Math.max(0, st.moves! - st.best!);
    st.extraByTask[st.index] = extra;
    this.success(extra === 0);
    const movesWord = (n: number) => movesWordFor(this.cfg.lang, n, t);
    const msg = extra === 0 ? t('fb.taskDoneBest', { n: movesWord(st.best!) }) : t('fb.taskDoneMore', { n: movesWord(st.moves!), best: movesWord(st.best!) });
    this.say(msg, extra === 0 ? 'cheer' : 'happy');
    const actions = this.view.querySelector('.tr-actions')!;
    const last = st.index + 1 >= st.level.tasks.length;
    actions.innerHTML = `
      ${extra ? `<button type="button" class="tr-btn tr-btn-ghost" data-act="retry-task">↺ ${esc(t('task.retryTask'))}</button>` : ''}
      <button type="button" class="tr-btn tr-btn-primary" data-act="next">${esc(last ? t('task.finish') : t('task.next'))} →</button>`;
    actions.querySelector<HTMLElement>('[data-act="next"]')?.focus();
  }

  // ---------- Режими 2–4 ----------
  private async startChessTask(p: Puzzle) {
    const st = this.st!;
    const board = this.board!;
    const chess = new Chess(p.fen);
    st.chess = chess;
    st.stage = 'answer';
    const side = chess.turn();
    await board.show(fenPlacement(chess), side);
    const { t } = this;
    const mode = st.level.mode;
    if (mode === 'check') {
      board.mark('king', this.kingSquare(chess, side));
      this.panel().innerHTML = `
        <p class="tr-q">${esc(t(`q.check.${side}` as TrainerKey))}</p>
        <div class="tr-actions tr-answers">
          <button type="button" class="tr-btn tr-btn-yes" data-act="answer" data-v="yes">${esc(t('btn.yes'))}</button>
          <button type="button" class="tr-btn tr-btn-no" data-act="answer" data-v="no">${esc(t('btn.no'))}</button>
        </div>`;
      board.disable();
    } else {
      this.panel().innerHTML = `
        <p class="tr-q">${esc(t(`q.${mode}.${side}` as TrainerKey))}</p>
        <div class="tr-actions"></div>`;
      if (mode === 'escape') board.mark('king', this.kingSquare(chess, side));
      board.enableMoves(side, {
        start: (sq) => {
          if (st.solved || st.busy) return false;
          const piece = chess.get(sq as Square);
          if (!piece || piece.color !== side) return false;
          board.unmark('hint');
          return [...new Set(chess.moves({ square: sq as Square, verbose: true }).map((m) => m.to))];
        },
        move: (from, to) => this.chessMove(from, to),
      });
    }
    this.say(st.index === 0 ? rand(t('say.start')) : t(`mode.${mode}` as TrainerKey), 'happy');
  }

  private kingSquare(chess: Chess, color: 'w' | 'b'): string {
    for (const row of chess.board()) for (const c of row) if (c && c.type === 'k' && c.color === color) return c.square;
    return 'e1';
  }

  private puzzle(): Puzzle {
    const st = this.st!;
    return st.level.tasks[st.index] as Puzzle;
  }

  /** Чи може фігура геометрично піти з from на to (без урахування шаху). */
  private geometryOk(chess: Chess, from: string, to: string): boolean {
    const piece = chess.get(from as Square);
    if (!piece) return false;
    const own = new Set<string>();
    const opp = new Set<string>();
    for (const row of chess.board()) for (const c of row) if (c && c.square !== from) (c.color === piece.color ? own : opp).add(c.square);
    if (own.has(to)) return false;
    if (piece.type === 'p') {
      const dir = piece.color === 'w' ? 1 : -1;
      const ff = from.charCodeAt(0);
      const fr = Number(from[1]);
      const tf = to.charCodeAt(0);
      const tr = Number(to[1]);
      const free = (s: string) => !own.has(s) && !opp.has(s);
      if (tf === ff && tr === fr + dir) return free(to);
      if (tf === ff && tr === fr + 2 * dir && fr === (dir === 1 ? 2 : 7)) return free(to) && free(`${from[0]}${fr + dir}`);
      if (Math.abs(tf - ff) === 1 && tr === fr + dir) return opp.has(to) || chess.fen().split(' ')[3] === to;
      return false;
    }
    if (piece.type === 'k' && from[1] === to[1] && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2) return true; // рокіровка
    return pieceMoves(piece.type, from, { blockers: own, enemySquares: new Set() }, opp).includes(to);
  }

  private chessMove(from: string, to: string): boolean {
    const st = this.st!;
    const chess = st.chess!;
    const board = this.board!;
    const mode = st.level.mode;
    const { t } = this;
    if (from === to) return false;
    const legal = chess.moves({ square: from as Square, verbose: true }).find((m) => m.to === to);
    if (!legal) {
      const piece = chess.get(from as Square)!;
      if (!this.geometryOk(chess, from, to)) this.mistake(t('fb.wrongMove', { piece: t(`piece.${piece.type}` as TrainerKey) }));
      else if (mode === 'escape') this.mistake(piece.type === 'k' ? t('fb.kingAttacked') : t('fb.stillCheck'));
      else this.mistake(t('fb.selfCheck'));
      return false;
    }
    const checkersBefore = chess.inCheck() ? chess.attackers(this.kingSquare(chess, chess.turn()) as Square, chess.turn() === 'w' ? 'b' : 'w') : [];
    const move = chess.move({ from, to, promotion: 'q' });
    play(move.captured ? 'star' : 'move');
    const needsSync = move.isPromotion() || move.isEnPassant() || move.isKingsideCastle() || move.isQueensideCastle();
    if (needsSync) this.later(() => void board.setPosition(fenPlacement(chess), true), 300);

    if (mode === 'escape') {
      board.unmark('king');
      const why = move.piece === 'k' ? 'fb.escapeKing' : checkersBefore.includes(move.to as Square) ? 'fb.escapeCapture' : 'fb.escapeBlock';
      this.chessSolved(`${t('fb.escaped')} ${t(why)}`);
      return true;
    }
    // мат в 1
    if (chess.isCheckmate()) {
      board.mark('king', this.kingSquare(chess, chess.turn()));
      this.progress.mates++;
      this.chessSolved(t('fb.mate'));
      return true;
    }
    // хибний хід: показуємо, чому не мат, і повертаємо позицію
    st.busy = true;
    let msg = t('fb.notCheck');
    if (chess.inCheck()) {
      msg = t('fb.checkNotMate');
      const reply = chess.moves({ verbose: true })[0];
      if (reply) {
        this.later(() => {
          board.mark('soft', reply.from);
          board.mark('dot', reply.to);
        }, 350);
      }
    }
    this.mistake(msg);
    this.later(() => {
      chess.undo();
      board.unmark('soft');
      board.unmark('dot');
      void board.setPosition(fenPlacement(chess), true);
      st.busy = false;
    }, 1700);
    return true;
  }

  private answerCheck(yes: boolean) {
    const st = this.st!;
    if (!st || st.solved || st.stage !== 'answer') return;
    const chess = st.chess!;
    const real = chess.inCheck();
    const { t } = this;
    if (yes !== real) {
      this.mistake(real ? t('fb.checkWrongNo') : t('fb.checkWrongYes'));
      return;
    }
    if (!real) {
      this.chessSolved(t('fb.noCheck'));
      return;
    }
    play('tap');
    st.stage = 'checker';
    this.say(rand(t('say.good')), 'happy');
    this.panel().innerHTML = `<p class="tr-q">${esc(t('q.showChecker'))}</p><div class="tr-actions"></div>`;
    const side = chess.turn();
    const checkers = chess.attackers(this.kingSquare(chess, side) as Square, side === 'w' ? 'b' : 'w');
    this.board!.enableSelect((sq) => {
      if (st.solved) return;
      if (checkers.includes(sq as Square)) {
        this.board!.disable();
        this.board!.mark('good', checkers);
        this.chessSolved(rand(t('say.good')));
        return;
      }
      const piece = chess.get(sq as Square);
      if (!piece) {
        this.say(t('fb.checkerEmpty'), 'think');
        return;
      }
      this.mistake(t('fb.checkerWrong'));
    });
  }

  private chessSolved(text: string) {
    const st = this.st!;
    const { t } = this;
    const p = this.puzzle();
    this.board!.disable();
    this.board!.unmark('hint');
    if (p.tags?.includes('smothered')) this.award('smothered');
    this.success(true);
    this.say(text, 'cheer');
    const last = st.index + 1 >= st.level.tasks.length;
    this.panel().innerHTML = `
      <div class="tr-explain">
        <p class="tr-explain-title">${esc(text)}</p>
        <p>${esc(pick(p.explanation, this.cfg.lang))}</p>
      </div>
      <div class="tr-actions">
        <button type="button" class="tr-btn tr-btn-primary" data-act="next">${esc(last ? t('task.finish') : t('task.next'))} →</button>
      </div>`;
    this.panel().querySelector<HTMLElement>('[data-act="next"]')?.focus();
  }

  // ---------- Успіх, помилка, підказка ----------
  private success(perfect: boolean) {
    const st = this.st!;
    st.solved = true;
    this.setTools(false);
    const clean = st.taskMistakes === 0;
    const firstTry = clean && !st.taskHint && perfect;
    play('success');
    this.burst();
    if (!st.awarded.has(st.index)) {
      // повторна спроба того самого завдання балів не додає
      st.awarded.add(st.index);
      const pts = POINTS + (firstTry ? BONUS : 0);
      st.earned += pts;
      this.progress.points += pts;
      if (clean) this.progress.streak++;
      this.toast(firstTry ? `${this.t('fb.points', { n: POINTS })} ${this.t('fb.bonus', { n: BONUS })}` : this.t('fb.points', { n: pts }));
    }
    this.updateCounter();
    this.checkBadges();
    this.save();
  }

  private mistake(text: string) {
    const st = this.st!;
    st.mistakes++;
    st.taskMistakes++;
    this.progress.streak = 0;
    this.save();
    play('oops');
    this.say(`${text} ${st.taskMistakes >= 2 ? '' : rand(this.t('say.oops'))}`.trim(), 'oops');
    if (st.taskMistakes >= 2 && !st.taskHint) {
      // після двох спроб — лагідно нагадуємо про підказку
      this.view.querySelector('[data-act="hint"]')?.classList.add('is-glow');
    }
  }

  private hint() {
    const st = this.st;
    if (!st || st.solved) return;
    const board = this.board!;
    const { t } = this;
    if (!st.taskHint) {
      st.taskHint = true;
      st.hints++;
    }
    this.view.querySelector('[data-act="hint"]')?.classList.remove('is-glow');
    board.unmark('hint');
    let text = '';
    if (st.level.mode === 'pieces') {
      const task = st.level.tasks[st.index] as PieceTask;
      text = pick(task.hint, this.cfg.lang);
      const step = nextStep(this.pieceTaskFull());
      if (step) board.mark('hint', step.to);
    } else {
      const p = this.puzzle();
      text = pick(p.hint, this.cfg.lang);
      const chess = st.chess!;
      if (st.level.mode === 'check') {
        board.mark('hint', this.kingSquare(chess, chess.turn()));
      } else {
        let from: string | undefined;
        if (p.solution) {
          try {
            const c = new Chess(chess.fen());
            from = c.move(p.solution).from;
          } catch {
            from = undefined;
          }
        }
        if (!from) {
          const moves = chess.moves({ verbose: true });
          const good = st.level.mode === 'mate' ? moves.find((m) => m.san.endsWith('#')) : moves[0];
          from = good?.from;
        }
        if (from) board.mark('hint', from);
      }
    }
    play('tap');
    this.say(`${rand(t('say.hint'))} ${text}`.trim(), 'think');
  }

  private burst() {
    const el = this.view.querySelector<HTMLElement>('.tr-burst');
    if (!el) return;
    el.innerHTML = '';
    const colors = ['#ffd54a', '#f2712f', '#3d63dd', '#22c55e', '#ff9db0'];
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('span');
      const angle = (i / 18) * Math.PI * 2;
      const dist = 90 + Math.random() * 70;
      s.style.setProperty('--x', `${Math.cos(angle) * dist}px`);
      s.style.setProperty('--y', `${Math.sin(angle) * dist}px`);
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = `${Math.random() * 0.12}s`;
      el.appendChild(s);
    }
    window.setTimeout(() => (el.innerHTML = ''), 1300);
  }

  // ---------- Нагороди ----------
  private award(id: string) {
    if (this.progress.badges.includes(id)) return;
    this.progress.badges.push(id);
    this.st?.newBadges.push(id);
    const b = BADGES.find((x) => x.id === id);
    window.setTimeout(() => {
      play('badge');
      this.toast(`${b?.icon ?? '🏅'} ${this.t('res.newBadge')} ${this.t(`badge.${id}` as TrainerKey)}`);
    }, 900);
  }

  private checkBadges() {
    const p = this.progress;
    const byId = (id: ModeId) => this.modes.find((m) => m.id === id)!;
    if (Object.keys(p.levels).length > 0) this.award('first-move');
    if ((p.levels.knight?.stars ?? 0) >= 2) this.award('knight');
    if (this.modeDone(byId('pieces'))) this.award('pieces');
    if (this.modeDone(byId('check'))) this.award('eye');
    if (this.modeDone(byId('escape'))) this.award('saver');
    if (this.modeDone(byId('mate'))) this.award('mate-master');
    if (p.mates >= 1) this.award('first-mate');
    if (p.streak >= 10) this.award('streak10');
    if (p.points >= 100) this.award('points100');
    if (Object.values(p.levels).filter((l) => l.stars === 3).length >= 5) this.award('stars');
  }

  // ---------- Результати ----------
  private finishLevel() {
    const st = this.st!;
    const extra = st.extraByTask.reduce((a, b) => a + (b ?? 0), 0);
    const penalty = st.mistakes + extra + st.hints;
    const stars = penalty === 0 ? 3 : penalty <= 2 ? 2 : 1;
    const prev = this.progress.levels[st.level.id]?.stars ?? 0;
    this.progress.levels[st.level.id] = { stars: Math.max(prev, stars) };
    this.checkBadges();
    this.save();
    this.showResult(stars);
  }

  private showResult(stars: number) {
    const st = this.st!;
    const { t } = this;
    this.destroyBoard();
    const all = this.allLevels();
    const idx = all.indexOf(st.level);
    const next = all.slice(idx + 1).find((l) => this.levelUnlocked(l) && !this.isDone(l.id)) ?? all[idx + 1];
    const nextOpen = next && this.levelUnlocked(next);
    const everything = all.every((l) => this.isDone(l.id));
    const badges = st.newBadges
      .map((id) => {
        const b = BADGES.find((x) => x.id === id)!;
        return `<li class="tr-badge is-got is-new"><span class="tr-badge-icon" aria-hidden="true">${b.icon}</span><span class="tr-badge-name">${esc(t(`badge.${id}` as TrainerKey))}</span></li>`;
      })
      .join('');
    this.view.innerHTML = `
      <div class="tr-result">
        <div class="tr-mascot is-cheer">${mascotSvg}</div>
        <p class="tr-bubble">${esc(everything ? t('res.allDone') : rand(t('say.result')))}</p>
        <h1 class="tr-h1">${esc(t('res.title'))}</h1>
        <p class="tr-lead">${esc(st.level.title)} · ${esc(st.level.sub)}</p>
        <p class="tr-bigstars" aria-label="${esc(t('level.stars', { n: stars }))}">
          ${[1, 2, 3].map((i) => `<span class="${i <= stars ? 'is-on' : ''}" style="animation-delay:${i * 0.18}s">★</span>`).join('')}
        </p>
        <p class="tr-res-line">${esc(t('res.points', { n: st.earned }))} · ${esc(t('res.total', { n: this.progress.points }))}</p>
        <p class="tr-res-line">${esc(st.mistakes === 0 ? t('res.mistakes0') : t('res.mistakes', { n: st.mistakes }))}</p>
        ${badges ? `<p class="tr-res-badges-title">${esc(t('res.newBadge'))}</p><ul class="tr-badges tr-badges-new">${badges}</ul>` : ''}
        <div class="tr-res-btns">
          ${nextOpen ? `<button type="button" class="tr-btn tr-btn-primary" data-act="level" data-id="${next.id}">${esc(t('res.next'))} →</button>` : ''}
          <button type="button" class="tr-btn tr-btn-ghost" data-act="level" data-id="${st.level.id}">↺ ${esc(t('res.again'))}</button>
          <button type="button" class="tr-btn tr-btn-ghost" data-act="map">${esc(t('res.map'))}</button>
        </div>
        ${this.ctaHtml()}
      </div>`;
    play('success');
    this.toTop();
    this.view.querySelector<HTMLElement>('[data-act="level"]')?.focus({ preventScroll: true });
  }
}

export function mountTrainer(root: HTMLElement, cfg: TrainerConfig) {
  return new TrainerApp(root, cfg);
}
