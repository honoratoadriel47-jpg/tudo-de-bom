/**
 * Gera ilustrações SVG PROVISÓRIAS dos produtos em public/assets/img/produtos/.
 * Servem só até você ter as fotos reais — depois, envie as fotos pelo painel (/admin).
 * Uso: npm run images
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'img', 'produtos');
fs.mkdirSync(out, { recursive: true });

const ACAI = '#4A0F5E', ACAI2 = '#6B1D80';
let uid = 0;
const id = (p) => `${p}${++uid}`;

function frame(inner, bg = ['#F3E6FF', '#D9BDF2']) {
  const g = id('bg');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img">
<defs><radialGradient id="${g}" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></radialGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#2B0A3D" flood-opacity=".28"/></filter></defs>
<rect width="600" height="600" fill="url(#${g})"/>
<circle cx="90" cy="110" r="46" fill="#fff" opacity=".25"/><circle cx="520" cy="470" r="70" fill="#fff" opacity=".18"/>
<ellipse cx="300" cy="520" rx="170" ry="22" fill="#2B0A3D" opacity=".14"/>
<g filter="url(#sh)">${inner}</g>
<text x="300" y="580" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#2B0A3D" opacity=".35" letter-spacing="1">foto ilustrativa</text>
</svg>`;
}

// ── Coberturas ──
const strawberry = (x, y, s = 1, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M0-22C18-22 26-8 22 6 18 20 6 28 0 30-6 28-18 20-22 6-26-8-18-22 0-22Z" fill="#E5304F"/><path d="M-12-20 0-30 12-20 4-16 0-24-4-16Z" fill="#3E9A3A"/>${[[-8,-6],[6,-4],[-2,8],[10,10],[-12,8],[2,-14]].map(([a,b])=>`<ellipse cx="${a}" cy="${b}" rx="1.6" ry="2.4" fill="#FFE9A8"/>`).join('')}</g>`;
const banana = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="20" fill="#FFF0B3" stroke="#F2D46B" stroke-width="3"/><circle r="5" fill="#E8D08A" opacity=".6"/></g>`;
const kiwi = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="22" fill="#8BC34A" stroke="#6D4C2F" stroke-width="3"/><circle r="8" fill="#F1F8D4"/>${Array.from({length:10},(_,i)=>{const a=i*36*Math.PI/180;return `<ellipse cx="${(13*Math.cos(a)).toFixed(1)}" cy="${(13*Math.sin(a)).toFixed(1)}" rx="1.5" ry="2.6" fill="#222" transform="rotate(${i*36} ${(13*Math.cos(a)).toFixed(1)} ${(13*Math.sin(a)).toFixed(1)})"/>`}).join('')}</g>`;
const mango = (x, y, s = 1) => `<rect x="${x-14*s}" y="${y-14*s}" width="${28*s}" height="${28*s}" rx="6" fill="#FFB238" transform="rotate(12 ${x} ${y})"/>`;
const granola = (x, y, w = 120) => Array.from({ length: 22 }, (_, i) => `<circle cx="${x - w / 2 + ((i * 37) % w)}" cy="${y + ((i * 13) % 18) - 9}" r="${4 + (i % 3)}" fill="${['#C68B3E', '#A9702B', '#E0B068'][i % 3]}"/>`).join('');
const drizzle = (x, y, w, color) => `<path d="M${x - w / 2} ${y} q${w / 8} 24 ${w / 4} 0 t${w / 4} 0 t${w / 4} 0 t${w / 4} 0" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>`;
const kitkat = (x, y, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-10" y="-40" width="20" height="80" rx="4" fill="#B5651D"/><rect x="-10" y="-40" width="20" height="10" fill="#C8102E"/><line x1="0" y1="-30" x2="0" y2="40" stroke="#8B4513" stroke-width="2"/></g>`;
const dots = (x, y, colors, n = 14, w = 140) => Array.from({ length: n }, (_, i) => `<circle cx="${x - w / 2 + ((i * 53) % w)}" cy="${y + ((i * 29) % 26) - 13}" r="6" fill="${colors[i % colors.length]}"/>`).join('');

// ── Formatos ──
function cup({ toppings = '', tall = 1 } = {}) {
  const g = id('cup'), a = id('ac');
  const h = 260 * tall, top = 470 - h;
  return `<defs><linearGradient id="${g}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity=".45"/></linearGradient>
<linearGradient id="${a}" y2="1" x2="0"><stop offset="0" stop-color="${ACAI2}"/><stop offset="1" stop-color="${ACAI}"/></linearGradient></defs>
<path d="M190 ${top} L410 ${top} L385 470 Q300 488 215 470Z" fill="url(#${a})"/>
<path d="M200 ${top + h * .45} L400 ${top + h * .45}" stroke="#F6E7C1" stroke-width="10" opacity=".7"/>
<path d="M175 ${top} Q300 ${top - 120} 425 ${top} Z" fill="${ACAI2}"/>
<path d="M190 ${top} L410 ${top} L385 470 Q300 488 215 470Z" fill="url(#${g})" stroke="#fff" stroke-opacity=".7" stroke-width="4"/>
<rect x="172" y="${top - 8}" width="256" height="16" rx="8" fill="#fff" opacity=".85"/>
<g transform="translate(0 ${top - 210})">${toppings}</g>`;
}
function bowl({ rows = [] } = {}) {
  const g = id('bw');
  const stripes = rows.map((r, i) => `<g clip-path="url(#clipb)">${r(300 - 150 + i * 75 + 37, 300)}</g>`).join('');
  return `<defs><linearGradient id="${g}" x2="0" y2="1"><stop offset="0" stop-color="#A0673D"/><stop offset="1" stop-color="#6E4227"/></linearGradient><clipPath id="clipb"><ellipse cx="300" cy="300" rx="190" ry="70"/></clipPath></defs>
<path d="M100 300 Q110 470 300 480 Q490 470 500 300Z" fill="url(#${g})"/>
<ellipse cx="300" cy="300" rx="200" ry="74" fill="#5A3520"/><ellipse cx="300" cy="300" rx="190" ry="70" fill="${ACAI2}"/>
${stripes}
<path d="M130 340 Q300 400 470 340" stroke="#fff" stroke-opacity=".18" stroke-width="10" fill="none"/>`;
}
function popsicle(body, coat, extra = '') {
  return `<rect x="282" y="380" width="36" height="140" rx="16" fill="#E8C48F"/>
<path d="M200 140 Q200 80 300 80 Q400 80 400 140 L400 400 Q400 420 380 420 L220 420 Q200 420 200 400Z" fill="${body}"/>
${coat ? `<path d="M200 140 Q200 80 300 80 Q400 80 400 140 L400 230 Q380 260 360 232 Q340 272 315 236 Q292 270 270 232 Q248 262 230 232 Q214 254 200 230Z" fill="${coat}"/>` : ''}
${extra}<path d="M225 120 Q232 100 255 95" stroke="#fff" stroke-opacity=".45" stroke-width="12" stroke-linecap="round" fill="none"/>
`;
}
function bucket(color, stripe, label) {
  return `<path d="M170 200 L430 200 L405 470 Q300 490 195 470Z" fill="#fff"/>
<path d="M181 290 L419 290 L410 380 L190 380Z" fill="${stripe}"/>
<text x="300" y="350" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900" font-size="46" fill="#fff">${label}</text>
<rect x="155" y="180" width="290" height="34" rx="12" fill="${ACAI2}"/>
<path d="M215 182 Q220 120 300 118 Q380 120 385 182Z" fill="${color}"/>
<circle cx="265" cy="150" r="10" fill="#fff" opacity=".35"/>`;
}
function shake(color, top = '') {
  return `<path d="M205 170 L395 170 L370 470 Q300 485 230 470Z" fill="${color}"/>
<path d="M205 170 L395 170 L370 470 Q300 485 230 470Z" fill="#fff" opacity=".18" stroke="#fff" stroke-width="5" stroke-opacity=".7"/>
<rect x="318" y="40" width="20" height="150" rx="8" fill="#E5405E" transform="rotate(12 328 110)"/>
<path d="M195 172 Q200 110 250 112 Q262 70 300 78 Q340 66 352 112 Q402 108 405 172Z" fill="#FFF8EE"/>
${top}<circle cx="300" cy="70" r="20" fill="#C8102E"/><path d="M300 52 Q310 30 330 26" stroke="#3E9A3A" stroke-width="4" fill="none"/>`;
}
const scoop = (x, y, c, r = 62) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><path d="M${x - r} ${y + 10} q${r / 3} 18 ${r / 1.5} 0 t${r / 1.5} 0 t${r / 1.5} 0" fill="${c}"/><circle cx="${x - r / 3}" cy="${y - r / 3}" r="${r / 5}" fill="#fff" opacity=".35"/>`;

const T = {
  classic: `${granola(300, 205, 180)}${banana(240, 170)}${banana(300, 160)}${banana(358, 172)}${drizzle(300, 140, 200, '#F6E7C1')}`,
  tropical: `${strawberry(245, 165, 1.2, -15)}${kiwi(305, 150)}${mango(360, 170, 1.1)}${granola(300, 210, 170)}${drizzle(300, 130, 180, '#F4B942')}`,
  especial: `${kitkat(250, 120, -14)}${kitkat(350, 118, 12)}${strawberry(300, 150, 1.3)}${dots(300, 200, ['#FFF4DE', '#D9A464'], 18, 190)}${drizzle(300, 172, 200, '#5B3216')}`,
  zero: `${kiwi(250, 165)}${strawberry(310, 150, 1.2, 10)}${kiwi(360, 172, .9)}${granola(300, 210, 170)}`,
};

const files = {
  'acai-copo': frame(cup({ toppings: T.classic })),
  'acai-morango': frame(cup({ toppings: T.tropical })),
  'acai-especial': frame(cup({ toppings: T.especial, tall: 1.12 }), ['#FFF1D6', '#F2C46B']),
  'acai-zero': frame(cup({ toppings: T.zero, tall: .9 }), ['#EAF6DA', '#BFDDA0']),
  'acai-tigela': frame(bowl({ rows: [(x, y) => `${banana(x, y - 40, .9)}${banana(x, y + 5, .9)}${banana(x, y + 48, .9)}`, (x, y) => strawberry(x, y - 25, 1.1) + strawberry(x, y + 30, 1.1, 20), (x, y) => granola(x, y, 60) + granola(x, y + 36, 60), (x, y) => kiwi(x, y - 20, .9) + kiwi(x, y + 34, .9)] })),
  'acai-familia': frame(`<path d="M160 190 L440 190 L420 470 Q300 490 180 470Z" fill="${ACAI}"/><rect x="145" y="168" width="310" height="36" rx="14" fill="#fff"/><path d="M175 300 L425 300 L415 390 L185 390Z" fill="#F8BE1C"/><text x="300" y="362" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="50" fill="${ACAI}">1 LITRO</text>`),
  'picole-morango': frame(popsicle('#F7A1B5', '', `${strawberry(260, 280, .9, -20)}${strawberry(340, 330, .9, 15)}`), ['#FFE6EC', '#F7B6C6']),
  'picole-chocolate': frame(popsicle('#8A5532', '#4E2A1A'), ['#F6E2D3', '#D6A985']),
  'picole-coco': frame(popsicle('#FFF7EA', '#D9A464', dots(300, 300, ['#fff', '#F3E5C8'], 10, 160)), ['#FFF8EC', '#EAD7B4']),
  'picole-maracuja': frame(popsicle('#F9CF3A', '', dots(300, 300, ['#2B1A0E'], 9, 150)), ['#FFF6D6', '#F4D97A']),
  'picole-acai': frame(popsicle(ACAI2, '', `${banana(270, 290, .8)}${banana(330, 340, .8)}`)),
  'picole-ninho': frame(popsicle('#FFF4E0', '#5B3216', drizzle(300, 300, 160, '#5B3216')), ['#FFF4E0', '#E9CFA2']),
  'balde-1l': frame(bucket('#8A5532', '#5B1A7A', '1L')),
  'balde-2l': frame(bucket('#F7A1B5', '#E5405E', '2L'), ['#FFE6EC', '#F7B6C6']),
  'balde-5l': frame(bucket('#FFF4E0', '#F8BE1C', '5L'), ['#FFF6D6', '#F4D97A']),
  'balde-premium': frame(bucket('#7B4A2A', '#2B0A3D', 'PREMIUM').replace('font-size="46"', 'font-size="34"'), ['#F6E2D3', '#D6A985']),
  'shake-ovomaltine': frame(shake('#8A5532', dots(300, 130, ['#6B3E1E'], 10, 150)), ['#F6E2D3', '#D6A985']),
  'shake-morango': frame(shake('#F28BA4', strawberry(250, 130, .8, -20)), ['#FFE6EC', '#F7B6C6']),
  casquinha: frame(`<path d="M230 260 L370 260 L300 500Z" fill="#E0A458"/><path d="M245 300 L355 300 M255 340 L345 340 M265 380 L335 380 M260 270 L330 470 M340 270 L270 470" stroke="#B9773A" stroke-width="5"/>${scoop(300, 230, '#F7A1B5', 70)}${scoop(300, 150, '#8A5532', 60)}`, ['#FFE6EC', '#F7B6C6']),
  sundae: frame(`<path d="M170 250 Q300 400 430 250Z" fill="#fff" opacity=".7"/><rect x="285" y="320" width="30" height="130" fill="#fff" opacity=".7"/><ellipse cx="300" cy="460" rx="90" ry="18" fill="#fff" opacity=".8"/>${scoop(240, 230, '#FFF4E0', 55)}${scoop(360, 230, '#F7A1B5', 55)}${scoop(300, 180, '#8A5532', 58)}${drizzle(300, 160, 140, '#4E2A1A')}<circle cx="300" cy="110" r="20" fill="#C8102E"/>`),
  'banana-split': frame(`<path d="M110 330 Q300 430 490 330 L470 300 L130 300Z" fill="#fff" opacity=".85"/><path d="M130 300 Q300 360 470 300" stroke="#F2D46B" stroke-width="40" fill="none" stroke-linecap="round"/>${scoop(210, 260, '#FFF4E0', 50)}${scoop(300, 250, '#8A5532', 54)}${scoop(390, 260, '#F7A1B5', 50)}${drizzle(300, 230, 220, '#4E2A1A')}`, ['#FFF6D6', '#F4D97A']),
  brownie: frame(`<rect x="170" y="300" width="260" height="130" rx="12" fill="#4E2A1A"/><rect x="170" y="300" width="260" height="30" rx="10" fill="#6B3E1E"/>${scoop(300, 270, '#FFF4E0', 62)}${drizzle(300, 300, 240, '#2B1609')}`, ['#F6E2D3', '#D6A985']),
  'petit-gateau': frame(`<ellipse cx="300" cy="440" rx="180" ry="30" fill="#fff"/><path d="M200 430 Q200 300 300 300 Q400 300 400 430Z" fill="#4E2A1A"/><path d="M300 420 Q290 460 260 470 Q330 480 340 450" fill="#2B1609"/>${scoop(390, 300, '#FFF4E0', 50)}`, ['#F6E2D3', '#D6A985']),
  'mousse-acai': frame(`<path d="M215 200 L385 200 L370 460 Q300 475 230 460Z" fill="#B57CD1"/><path d="M220 280 L380 280" stroke="#fff" stroke-width="18" opacity=".7"/><path d="M215 200 L385 200 L370 460 Q300 475 230 460Z" fill="#fff" opacity=".15" stroke="#fff" stroke-width="5"/>${dots(300, 190, ['#FFF4E0', '#fff'], 12, 140)}`),
  'combo-casal': frame(`<g transform="translate(-95 30) scale(.85)">${cup({ toppings: T.classic })}</g><g transform="translate(185 30) scale(.85)">${cup({ toppings: T.tropical })}</g>`),
  'combo-familia': frame(`<g transform="translate(-80 40) scale(.8)">${bucket('#F7A1B5', '#E5405E', '1L')}</g><g transform="translate(200 40) scale(.8)"><path d="M160 190 L440 190 L420 470 Q300 490 180 470Z" fill="${ACAI}"/><rect x="145" y="168" width="310" height="36" rx="14" fill="#fff"/></g>`, ['#FFF1D6', '#F2C46B']),
};

for (const [name, svg] of Object.entries(files)) fs.writeFileSync(path.join(out, `${name}.svg`), svg.replace(/\n/g, ''));
console.log(`${Object.keys(files).length} ilustrações geradas em ${out}`);
