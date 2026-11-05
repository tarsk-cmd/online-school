// Мінімальні типи для cm-chessboard (бібліотека без власних .d.ts).
declare module 'cm-chessboard/src/Chessboard.js' {
  export const COLOR: { white: 'w'; black: 'b' };
  export const INPUT_EVENT_TYPE: {
    moveInputStarted: 'moveInputStarted';
    movingOverSquare: 'movingOverSquare';
    validateMoveInput: 'validateMoveInput';
    moveInputCanceled: 'moveInputCanceled';
    moveInputFinished: 'moveInputFinished';
  };
  export const POINTER_EVENTS: { pointerdown: 'pointerdown' };
  export const BORDER_TYPE: { none: 'none'; thin: 'thin'; frame: 'frame' };
  export interface MarkerType { class: string; slice: string; position?: 'above' }
  export interface MoveInputEvent {
    type: string;
    squareFrom: string;
    squareTo?: string;
    piece?: string;
    animate?: boolean;
  }
  export class Chessboard {
    constructor(context: HTMLElement, props: Record<string, unknown>);
    setPosition(fen: string, animated?: boolean): Promise<void>;
    setPiece(square: string, piece: string | null, animated?: boolean): Promise<void>;
    setOrientation(color: 'w' | 'b', animated?: boolean): Promise<void>;
    getPiece(square: string): string | null;
    enableMoveInput(handler: (e: MoveInputEvent) => boolean | void, color?: 'w' | 'b'): void;
    disableMoveInput(): void;
    cancelMoveInput(): void;
    enableSquareSelect(eventType: string, handler: (e: { square: string | null; event: Event }) => void): void;
    disableSquareSelect(eventType: string): void;
    isSquareSelectEnabled(): boolean;
    addMarker(type: MarkerType, square: string): void;
    removeMarkers(type?: MarkerType, square?: string): void;
    destroy(): void;
  }
}
declare module 'cm-chessboard/src/extensions/markers/Markers.js' {
  export class Markers {}
}
declare module '*?no-inline' {
  const url: string;
  export default url;
}
