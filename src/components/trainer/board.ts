/**
 * Обгортка над cm-chessboard: дошка з дотиками («фігура → поле» і перетягування),
 * власні маркери (зірочки, небезпечні поля, підказки).
 */
import { BORDER_TYPE, Chessboard, INPUT_EVENT_TYPE, POINTER_EVENTS, type MarkerType } from 'cm-chessboard/src/Chessboard.js';
import { Markers } from 'cm-chessboard/src/extensions/markers/Markers.js';
import 'cm-chessboard/assets/chessboard.css';
import piecesUrl from 'cm-chessboard/assets/pieces/standard.svg?no-inline';
import markersUrl from './assets/markers.svg?no-inline';

export const MK = {
  star: { class: 'tr-mk-star', slice: 'trStar' },
  starGone: { class: 'tr-mk-star-gone', slice: 'trStar' },
  danger: { class: 'tr-mk-danger', slice: 'trDanger' },
  dot: { class: 'tr-mk-dot', slice: 'trDot', position: 'above' },
  ring: { class: 'tr-mk-ring', slice: 'trRing', position: 'above' },
  select: { class: 'tr-mk-select', slice: 'trSquare' },
  hint: { class: 'tr-mk-hint', slice: 'trSquare' },
  good: { class: 'tr-mk-good', slice: 'trSquare' },
  soft: { class: 'tr-mk-soft', slice: 'trFrame' },
  king: { class: 'tr-mk-king', slice: 'trFrame' },
} satisfies Record<string, MarkerType>;

export type MarkerName = keyof typeof MK;

export interface MoveHandlers {
  /** Чи можна почати хід цією фігурою; повертає поля для крапок-підказок. */
  start(square: string): string[] | false;
  /** true — хід прийнято (дошка пересуне фігуру), false — фігура повернеться. */
  move(from: string, to: string): boolean;
}

export class Board {
  private cb: Chessboard;
  private selectHandler: ((sq: string) => void) | null = null;

  constructor(el: HTMLElement) {
    this.cb = new Chessboard(el, {
      position: '8/8/8/8/8/8/8/8',
      responsive: true,
      assetsUrl: '/',
      style: {
        cssClass: 'debut',
        showCoordinates: true,
        borderType: BORDER_TYPE.none,
        pieces: { file: piecesUrl },
        animationDuration: 260,
      },
      extensions: [{ class: Markers, props: { autoMarkers: null, sprite: markersUrl } }],
    });
  }

  async show(placement: string, orientation: 'w' | 'b' = 'w') {
    this.clear();
    await this.cb.setOrientation(orientation);
    await this.cb.setPosition(placement, false);
  }

  setPosition(placement: string, animated = true) {
    return this.cb.setPosition(placement, animated);
  }

  setPiece(square: string, piece: string | null, animated = false) {
    return this.cb.setPiece(square, piece, animated);
  }

  getPiece(square: string) {
    return this.cb.getPiece(square);
  }

  mark(name: MarkerName, squares: string | string[]) {
    for (const s of Array.isArray(squares) ? squares : [squares]) this.cb.addMarker(MK[name], s);
  }

  unmark(name?: MarkerName, square?: string) {
    this.cb.removeMarkers(name ? MK[name] : undefined, square);
  }

  clear() {
    this.cb.removeMarkers();
  }

  enableMoves(color: 'w' | 'b', h: MoveHandlers) {
    this.disable();
    this.cb.enableMoveInput((e) => {
      switch (e.type) {
        case INPUT_EVENT_TYPE.moveInputStarted: {
          const targets = h.start(e.squareFrom);
          if (!targets) return false;
          this.unmark('dot');
          this.unmark('ring');
          this.unmark('select');
          this.mark('select', e.squareFrom);
          for (const t of targets) this.mark(this.cb.getPiece(t) ? 'ring' : 'dot', t);
          return true;
        }
        case INPUT_EVENT_TYPE.validateMoveInput:
          return e.squareTo ? h.move(e.squareFrom, e.squareTo) : false;
        case INPUT_EVENT_TYPE.moveInputCanceled:
        case INPUT_EVENT_TYPE.moveInputFinished:
          this.unmark('dot');
          this.unmark('ring');
          this.unmark('select');
          return true;
      }
      return true;
    }, color);
  }

  enableSelect(handler: (square: string) => void) {
    this.disable();
    this.selectHandler = handler;
    this.cb.enableSquareSelect(POINTER_EVENTS.pointerdown, (e) => {
      if (e.square && this.selectHandler) this.selectHandler(e.square);
    });
  }

  disable() {
    this.unmark('dot');
    this.unmark('ring');
    this.unmark('select');
    try {
      this.cb.disableMoveInput();
    } catch {
      /* not enabled */
    }
    if (this.selectHandler) {
      this.cb.disableSquareSelect(POINTER_EVENTS.pointerdown);
      this.selectHandler = null;
    }
  }

  destroy() {
    this.disable();
    this.cb.destroy();
  }
}
