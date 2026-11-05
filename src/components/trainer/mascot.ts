/**
 * Пішко — талісман тренажера: кмітливий пішак у шарфику школи.
 * Власна проста SVG-графіка (без сторонніх ліцензій).
 */
export const mascotSvg = `
<svg class="tr-mascot-svg" viewBox="0 0 120 140" aria-hidden="true" focusable="false">
  <ellipse cx="60" cy="132" rx="38" ry="6" fill="#1c2c63" opacity=".12"/>
  <path d="M24 128c0-14 8-22 18-26l-2-14h40l-2 14c10 4 18 12 18 26z" fill="#22399b"/>
  <path d="M24 128c0-14 8-22 18-26h36c10 4 18 12 18 26z" fill="#2a4bc4"/>
  <rect x="34" y="78" width="52" height="14" rx="7" fill="#f2712f"/>
  <path d="M74 86l10 20-9 2-6-16z" fill="#c2410c"/>
  <circle cx="60" cy="46" r="34" fill="#3d63dd"/>
  <circle cx="60" cy="46" r="34" fill="url(#trShine)"/>
  <defs>
    <radialGradient id="trShine" cx=".35" cy=".3" r=".7">
      <stop offset="0" stop-color="#fff" stop-opacity=".45"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g class="tr-mascot-eyes">
    <ellipse cx="47" cy="44" rx="7" ry="8.5" fill="#fff"/>
    <ellipse cx="73" cy="44" rx="7" ry="8.5" fill="#fff"/>
    <circle cx="48.5" cy="46" r="4" fill="#121b3d"/>
    <circle cx="74.5" cy="46" r="4" fill="#121b3d"/>
    <circle cx="50" cy="44.5" r="1.4" fill="#fff"/>
    <circle cx="76" cy="44.5" r="1.4" fill="#fff"/>
  </g>
  <circle cx="38" cy="58" r="5" fill="#ff9db0" opacity=".7"/>
  <circle cx="82" cy="58" r="5" fill="#ff9db0" opacity=".7"/>
  <path class="tr-mascot-mouth" d="M50 60q10 9 20 0" fill="none" stroke="#121b3d" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M44 16q16-12 32 0l-4 6q-12-7-24 0z" fill="#ffd54a"/>
</svg>`;
