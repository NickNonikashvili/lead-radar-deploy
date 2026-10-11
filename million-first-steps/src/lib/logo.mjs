// The footprint mark: a footprint whose sole is a window onto the Caucasus —
// a snow peak, the sun, Svan towers and a river running out through the heel.
let n = 0;

export const FOOT_OUTER =
  "M60 98C95 84 150 70 175 92C192 108 184 136 164 154C144 170 120 182 120 206C120 222 140 236 140 256C138 282 118 296 96 294C70 292 58 272 60 248C62 222 50 196 40 170C30 144 30 110 60 98Z";
export const FOOT_INNER =
  "M66 113C96 101 146 88 164 104C174 114 170 132 152 145C130 160 106 178 106 205C106 224 124 238 125 256C124 272 112 280 97 279C82 278 73 266 74 249C76 222 64 194 54 168C46 146 46 122 66 113Z";
export const TOES = [
  [150, 48, 21, 25, -12],
  [108, 37, 13.5, 15.5, -8],
  [76, 46, 11.5, 13, -4],
  [50, 63, 10, 11.5, 0],
  [30, 84, 8.5, 10, 8],
];
const RIVER = "M99 200C94 212 106 220 98 232C90 244 108 252 99 266C93 277 103 288 97 300";

export function logoMark({ className = "logo-mark", mono = false, title = "" } = {}) {
  const id = `lm${++n}`;
  const ink = mono ? "currentColor" : `url(#${id}b)`;
  const toes = TOES.map(
    ([cx, cy, rx, ry, r]) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${cx} ${cy})"/>`
  ).join("");
  const scene = mono
    ? `<g clip-path="url(#${id}w)" fill="currentColor">
        <path d="M40 190L58 172L72 180L88 152L100 164L110 156L128 178L150 166L176 184V300H40Z" opacity=".3"/>
        <path d="M46 206L74 170L94 124L102 138L110 130L130 176L160 206Z" opacity=".7"/>
        <circle cx="140" cy="126" r="11" opacity=".55"/>
        <path d="M36 226C52 206 74 204 94 218C96 240 92 270 90 300H36ZM106 220C124 204 150 202 176 212V300H104C102 270 100 240 106 220Z"/>
      </g>
      <path d="${RIVER}" fill="none" stroke="var(--logo-river, #f6e6c4)" stroke-width="6" stroke-linecap="round" clip-path="url(#${id}o)"/>`
    : `<g clip-path="url(#${id}w)">
        <rect x="30" y="80" width="160" height="220" fill="url(#${id}s)"/>
        <circle cx="140" cy="126" r="11" fill="#c8892a"/>
        <path d="M40 190L58 172L72 180L88 152L100 164L110 156L128 178L150 166L176 184V300H40Z" fill="#c39a68"/>
        <path d="M46 206L74 170L94 124L102 138L110 130L130 176L160 206Z" fill="#6e4b2c"/>
        <path d="M94 124L102 138L110 130L130 176L116 158L108 163L102 150L97 156Z" fill="#4b3119"/>
        <path d="M94 124L86 144L92 141L96 151L102 143L106 147L110 130L102 138Z" fill="#fbf1df"/>
        <rect x="30" y="204" width="160" height="96" fill="#8f6539"/>
        <path d="M64 216L65 192L63 192L68 185L73 192L71 192L72 216ZM128 214L129 194L127 194L132 187L137 194L135 194L136 214Z" fill="#3a2511"/>
        <path d="M36 226C52 206 74 204 94 218C96 240 92 270 90 300H36Z" fill="#4d331c"/>
        <path d="M106 220C124 204 150 202 176 212V300H104C102 270 100 240 106 220Z" fill="#5d3d20"/>
      </g>
      <path d="${RIVER}" fill="none" stroke="#f6e6c4" stroke-width="6" stroke-linecap="round" clip-path="url(#${id}o)"/>`;
  return `<svg class="${className}" viewBox="18 20 172 278" xmlns="http://www.w3.org/2000/svg" ${
    title ? `role="img" aria-label="${title}"` : 'aria-hidden="true"'
  } focusable="false">
    <defs>
      <clipPath id="${id}w"><path d="${FOOT_INNER}"/></clipPath>
      <clipPath id="${id}o"><path d="${FOOT_OUTER}"/></clipPath>
      ${
        mono
          ? ""
          : `<linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f3419"/><stop offset="1" stop-color="#2b190b"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8ead0"/><stop offset=".55" stop-color="#ecc993"/><stop offset="1" stop-color="#e2b578"/></linearGradient>`
      }
    </defs>
    <g fill="${ink}">${toes}<path d="${FOOT_OUTER}${FOOT_INNER}" fill-rule="evenodd"/></g>
    ${scene}
  </svg>`;
}

export const wordmark = (small = false) => `<span class="wordmark${small ? " wordmark--sm" : ""}" translate="no">
    <span class="wordmark__name">Million <br>First Steps</span>
    <span class="wordmark__tag">Georgia Travel Experiences</span>
  </span>`;

// Standalone SVG file used as favicon and as the scroll-reveal mask on the home page.
export const footprintMaskSVG = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 20 172 278"><g fill="#000">${TOES.map(
    ([cx, cy, rx, ry, r]) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${cx} ${cy})"/>`
  ).join("")}<path d="${FOOT_OUTER}"/></g></svg>`;

export const faviconSVG = () => logoMark({ className: "" }).replace("<svg ", '<svg width="64" height="96" ');
