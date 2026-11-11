// 검토흰토 등장 효과
// 지금 페이지를 설계도(상자·글·그림·선·반복 묶음)로 읽은 뒤 화면을 비우고,
// 커서 떼가 그 설계도대로 다시 짓는다. 다 지으면 "사이트 보기"로 진짜 페이지로 돌아간다.
// 동작은 Joel Califa의 Swarm(swarm-cursors)을 보고 이 사이트에 맞게 새로 작성했다.

const root = document.documentElement;
export const introWanted = () => root.classList.contains('intro-on');

// ── 조절값 ─────────────────────────────
const MIN_CREW = 8;        // 늘 남아 있는 커서 수
const MAX_CREW = 48;       // 한꺼번에 일할 수 있는 최대 커서 수
const INTRO_CREW = 18;     // 시작할 때 모여드는 커서 수
const FLOCK_CREW = 36;     // 다 짓고 마우스 주위를 도는 커서 수
const ITEM_LIMIT = 4000;
const WORLD_LIMIT = 40000;
const RULER = 20;
const BLUE = '#0D99FF';
const RED = '#F24822';
const NAMES = ['하람', '누리', '보람', '다온', '가온', '라온', '새롬', '한빛', '이든', '도담', '미르', '아라', '온새', '단비', '솔', '별', '여울', '나래', '구름', '바다', '노을', '시내', '초롱', '해솔'];
const COLORS = ['#FF5A36', '#9B5CFF', '#22B8FF', '#14C98B', '#FF6F91', '#FFC21A', '#7B61FF', '#EC4D86', '#1FA463', '#0A8CFF', '#FF8C1A', '#00B3C7'];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const inOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2;
const out = t => 1 - Math.pow(1 - t, 3);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const frame = () => new Promise(r => requestAnimationFrame(() => r()));
const r1 = n => Math.round(n * 10) / 10;
const SVGNS = 'http://www.w3.org/2000/svg';

function alpha(c) {
  if (!c || c === 'transparent') return 0;
  const s = c.match(/\/\s*([\d.]+%?)\s*\)/);
  if (s) return s[1].endsWith('%') ? parseFloat(s[1]) / 100 : parseFloat(s[1]);
  const m = c.match(/^rgba\(([^)]+)\)/);
  if (m) { const p = m[1].split(','); return p.length > 3 ? parseFloat(p[3]) : 1; }
  return 1;
}
const sameColor = (a, b) => (a || '').replace(/\s/g, '') === (b || '').replace(/\s/g, '');
const edges = r => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
function overlap(a, b) {
  if (!a || !b) return null;
  const l = Math.max(a.l, b.l), t = Math.max(a.t, b.t), r = Math.min(a.r, b.r), bt = Math.min(a.b, b.b);
  return r > l && bt > t ? { l, t, r, b: bt } : null;
}

// ── 커서 모양 ─────────────────────────────
const TIP = 'M5 3.2C4.7 2.5 5.4 1.9 6.1 2.3L20 9.1C20.8 9.5 20.7 10.6 19.8 10.8L13.6 12.4C13.1 12.5 12.7 12.9 12.6 13.4L11 19.6C10.8 20.5 9.6 20.6 9.3 19.8Z';
const HOT = { arrow: [5, 3], dup: [5, 3], pen: [3, 3], 'pen-add': [3, 3], cross: [12, 12], ibeam: [12, 12], ew: [12, 12], ns: [12, 12] };
let INK = '#000', PAPER = '#fff';   // 커서는 흑백: 밝은 페이지엔 검은 커서, 어두운 페이지엔 흰 커서
function cursorArt(shape) {
  const col = INK, W = PAPER;
  const edge = `stroke="${W}" stroke-width="1.5" stroke-linejoin="round"`;
  const plus = (x, y) => `<g stroke-linecap="round"><path d="M${x} ${y - 3.5}V${y + 3.5}M${x - 3.5} ${y}H${x + 3.5}" stroke="${W}" stroke-width="3.4"/><path d="M${x} ${y - 3.5}V${y + 3.5}M${x - 3.5} ${y}H${x + 3.5}" stroke="${col}" stroke-width="1.3"/></g>`;
  switch (shape) {
    case 'arrow': return `<path d="${TIP}" fill="${col}" ${edge}/>`;
    case 'dup': return `<path d="${TIP}" transform="translate(4 3.5)" fill="${W}" stroke="${col}" stroke-width="1.3" stroke-linejoin="round"/><path d="${TIP}" fill="${col}" ${edge}/>`;
    case 'pen':
    case 'pen-add': {
      const s = `<path d="M3 3L13.5 6.6L17.2 10.4L10.4 17.2L6.6 13.5Z" fill="${col}" ${edge}/><path d="M17.2 10.4L20.4 13.6L13.6 20.4L10.4 17.2Z" fill="${col}" ${edge}/><path d="M3.6 3.6L8.6 8.6" stroke="${W}" stroke-width="1.2" stroke-linecap="round"/><circle cx="9.9" cy="9.9" r="1.7" fill="none" stroke="${W}" stroke-width="1.2"/>`;
      return shape === 'pen-add' ? s + plus(23, 23) : s;
    }
    case 'cross': return `<g stroke-linecap="round"><path d="M12 3.5V20.5M3.5 12H20.5" stroke="${W}" stroke-width="3.6"/><path d="M12 3.5V20.5M3.5 12H20.5" stroke="${col}" stroke-width="1.5"/></g>`;
    case 'ibeam': {
      const d = 'M8.6 4.6H10.4Q12 4.6 12 6.2Q12 4.6 13.6 4.6H15.4M12 6.2V17.8M8.6 19.4H10.4Q12 19.4 12 17.8Q12 19.4 13.6 19.4H15.4';
      return `<g fill="none" stroke-linecap="round"><path d="${d}" stroke="${W}" stroke-width="3.6"/><path d="${d}" stroke="${col}" stroke-width="1.5"/></g>`;
    }
    case 'ew':
    case 'ns': return `<path d="M2.5 12L7.2 7.4V10.3H16.8V7.4L21.5 12L16.8 16.6V13.7H7.2V16.6Z"${shape === 'ns' ? ' transform="rotate(90 12 12)"' : ''} fill="${col}" ${edge}/>`;
  }
  return '';
}
const PIC = '<svg class="ph" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18L10 13L14 16L17 13.5L21 17"/></svg>';

// ── 계산된 스타일 옮기기 ─────────────────────────────
const SKIP = new Set(['script', 'style', 'noscript', 'template', 'head', 'meta', 'link', 'title', 'base', 'datalist', 'area', 'map', 'source', 'track', 'param']);
const DROP = new Set(['script', 'style', 'noscript', 'template', 'iframe', 'object', 'embed', 'link', 'meta']);
const MEDIA = new Set(['img', 'svg', 'video', 'canvas', 'iframe', 'embed', 'object', 'picture', 'model-viewer']);
const FORM = new Set(['input', 'textarea', 'select']);
const WHOLE = new Set(['img', 'svg', 'video', 'canvas', 'input', 'select', 'textarea', 'iframe', 'picture', 'button']);
const P_TEXT = ['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'font-stretch', 'font-feature-settings', 'font-variation-settings', 'font-kerning', 'line-height', 'letter-spacing', 'word-spacing', 'text-transform', 'text-align', 'text-indent', 'text-decoration-line', 'text-decoration-color', 'text-decoration-style', 'text-decoration-thickness', 'text-underline-offset', 'text-shadow', 'white-space', 'text-wrap', 'direction', 'overflow-wrap', 'word-break', 'hyphens', '-webkit-text-fill-color', '-webkit-text-stroke-width', '-webkit-text-stroke-color', 'list-style-type', 'list-style-position', 'writing-mode', 'font-variant-numeric'];
const P_BOX = ['display', 'box-sizing', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius', 'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat', 'background-clip', 'box-shadow', 'opacity', 'vertical-align', 'position', 'top', 'right', 'bottom', 'left', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'gap', 'flex-grow', 'flex-shrink', 'flex-basis', 'align-self', 'object-fit', 'object-position', 'overflow-x', 'overflow-y', 'text-overflow', 'visibility', 'transform', 'filter', 'float', 'mix-blend-mode', 'grid-template-columns', 'grid-column', 'grid-row'];
const P_ELEM = [...P_TEXT, ...P_BOX];
const P_SVG = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'clip-rule', 'opacity', 'color', 'stop-color', 'stop-opacity', 'display', 'visibility', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'letter-spacing'];
const P_SVG_OUT = ['margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'vertical-align', 'display', 'position', 'top', 'right', 'bottom', 'left', 'transform', 'transform-origin', 'flex-shrink', 'flex-grow', 'align-self'];
const P_RECT = ['background-color', 'background-image', 'background-size', 'background-position', 'background-repeat', 'background-origin', 'background-clip', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius', 'box-shadow', 'backdrop-filter', 'filter', 'clip-path'];

function styleText(cs, list) {
  let s = '';
  for (const p of list) { const v = cs.getPropertyValue(p); if (v !== '') s += `${p}:${v};`; }
  return s;
}
const lineH = cs => { const v = parseFloat(cs.lineHeight); return isNaN(v) ? (parseFloat(cs.fontSize) || 16) * 1.2 : v; };
const boxy = st => {
  if (alpha(st.backgroundColor) > .02) return true;
  if (st.backgroundImage && st.backgroundImage !== 'none') return true;
  if (st.boxShadow && st.boxShadow !== 'none') return true;
  return ['Top', 'Right', 'Bottom', 'Left'].some(s => parseFloat(st['border' + s + 'Width']) > 0 && st['border' + s + 'Style'] !== 'none' && alpha(st['border' + s + 'Color']) > .02);
};

let inertDoc = null;
const inert = () => inertDoc || (inertDoc = document.implementation.createHTMLDocument(''));
const srcOf = img => img.currentSrc || img.src || img.getAttribute('data-src') || '';

function pseudoSpan(src, which) {
  const ps = getComputedStyle(src, which);
  const c = ps.content;
  if (!c || c === 'none' || c === 'normal' || ps.display === 'none') return null;
  const sp = document.createElement('span');
  const str = c.match(/^"((?:[^"\\]|\\.)*)"/);
  if (str) sp.textContent = str[1].replace(/\\(.)/g, '$1');
  sp.setAttribute('style', styleText(ps, P_ELEM));
  return sp;
}
function withPseudos(src, dst) {
  const b = pseudoSpan(src, '::before'); if (b) dst.insertBefore(b, dst.firstChild);
  const a = pseudoSpan(src, '::after'); if (a) dst.appendChild(a);
}
// 원본 요소 하나의 계산된 스타일을 복제본에 그대로 입힌다
function dress(src, dst) {
  const tag = src.localName;
  if (DROP.has(tag)) { dst.remove(); return null; }
  const cs = getComputedStyle(src);
  if (cs.display === 'none') { dst.remove(); return null; }
  const svg = src instanceof SVGElement;
  let st = styleText(cs, svg ? P_SVG : P_ELEM);
  if (svg && tag === 'svg' && !src.ownerSVGElement) {
    const r = src.getBoundingClientRect();
    dst.setAttribute('width', r.width); dst.setAttribute('height', r.height);
    st += styleText(cs, P_SVG_OUT);
  }
  dst.setAttribute('style', st);
  for (const a of [...dst.attributes]) if (/^on|^(tabindex|autofocus|srcset|sizes|loading|contenteditable)$/.test(a.name)) dst.removeAttribute(a.name);
  if (tag === 'img') dst.setAttribute('src', srcOf(src));
  if (tag === 'audio') { dst.remove(); return null; }
  if (tag === 'video' || tag === 'canvas' || (!svg && tag.includes('-'))) {
    const rep = document.createElement(tag === 'video' && src.poster ? 'img' : 'span');
    if (rep.localName === 'img') rep.src = src.poster;
    else if (tag.includes('-')) while (dst.firstChild) rep.appendChild(dst.firstChild);
    rep.setAttribute('style', st);
    dst.replaceWith(rep);
    dst = rep;
  }
  if (!svg && !MEDIA.has(tag) && !FORM.has(tag)) withPseudos(src, dst);
  return dst;
}
function dressAll(src, dst) {
  const a = src.querySelectorAll('*'), b = dst.querySelectorAll('*');
  for (let i = 0; i < a.length && i < b.length; i++) dress(a[i], b[i]);
}
function cloneDressed(src) {
  const dst = inert().importNode(src, true);
  const kids = [...src.querySelectorAll('*')], dkids = [...dst.querySelectorAll('*')];
  const top = dress(src, dst) || document.createElement('span');
  for (let i = 0; i < kids.length && i < dkids.length; i++) dress(kids[i], dkids[i]);
  return top;
}

function pageBg() {
  const pick = el => { const c = getComputedStyle(el); return { color: c.backgroundColor, image: c.backgroundImage, size: c.backgroundSize, position: c.backgroundPosition, repeat: c.backgroundRepeat, from: el }; };
  const h = pick(root);
  if (alpha(h.color) > .01 || h.image !== 'none') return h;
  const b = pick(document.body);
  if (alpha(b.color) > .01 || b.image !== 'none') return b;
  return { color: 'rgb(255, 255, 255)', image: 'none', from: null };
}

// ── 설계도 만들기 ─────────────────────────────
// 칸 좌표는 문서 기준(world)이고, 화면에 붙은 머리글 같은 것은 화면 기준(over)이다.
function blueprint(host, bg) {
  const sx = scrollX, sy = scrollY, vw = root.clientWidth, vh = innerHeight;
  const docW = Math.max(root.scrollWidth, vw);
  const docH = Math.min(Math.max(root.scrollHeight, document.body.scrollHeight, vh), WORLD_LIMIT);
  const items = [], tops = [];
  let order = 0;
  const csMap = new Map();
  const css = el => { let c = csMap.get(el); if (!c) { c = getComputedStyle(el); csMap.set(el, c); } return c; };
  const inlineMap = new Map();
  const ALL = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 }, VIEW = { l: 0, t: 0, r: innerWidth, b: innerHeight };
  const body = document.body;
  const place = (r, layer) => layer === 'world' ? { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height } : { x: r.left, y: r.top, w: r.width, h: r.height };
  const placeClip = (c, layer) => layer === 'world' ? { l: c.l + sx, t: c.t + sy, r: c.r + sx, b: c.b + sy } : { ...c };
  const clipFor = (r, clip, layer) => r.left >= clip.l - .5 && r.top >= clip.t - .5 && r.right <= clip.r + .5 && r.bottom <= clip.b + .5 ? null : placeClip(clip, layer);
  const onPage = (b, layer) => layer === 'world' ? b.x + b.w > 0 && b.x < docW && b.y + b.h > 0 && b.y < docH : b.x + b.w > 0 && b.x < innerWidth && b.y + b.h > 0 && b.y < innerHeight;
  const add = it => { Object.assign(it, { id: items.length, v: 1, rv: 0, vis: false, dx: 0, dy: 0, scale: 1, mode: 'own' }); items.push(it); return it; };

  function inlineOnly(el) {
    let v = inlineMap.get(el);
    if (v !== undefined) return v;
    v = !el.shadowRoot;
    if (v) for (const c of el.children) {
      const t = c.localName;
      if (SKIP.has(t) || t === 'br' || t === 'wbr' || c instanceof SVGElement) continue;
      const d = css(c).display;
      if (d === 'none') continue;
      if (d === 'inline' ? !inlineOnly(c) : !d.startsWith('inline')) { v = false; break; }
    }
    inlineMap.set(el, v);
    return v;
  }
  function blockStyle(cs, run) {
    let s = styleText(cs, P_TEXT);
    if (run) return s + 'display:block;padding:0;margin:0;box-sizing:border-box;width:100%;height:100%;position:relative;';
    const pad = side => (parseFloat(cs.getPropertyValue(`padding-${side}`)) || 0) + (parseFloat(cs.getPropertyValue(`border-${side}-width`)) || 0);
    let d = cs.display;
    if (/flex/.test(d)) { d = 'flex'; s += styleText(cs, ['flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'align-content', 'row-gap', 'column-gap']); }
    else if (/grid/.test(d)) { d = 'grid'; s += styleText(cs, ['grid-template-columns', 'grid-template-rows', 'grid-auto-flow', 'grid-auto-columns', 'grid-auto-rows', 'align-items', 'justify-items', 'justify-content', 'align-content', 'row-gap', 'column-gap']); }
    else if (d !== 'list-item' && d !== '-webkit-box') d = 'block';
    s += `display:${d};padding:${pad('top')}px ${pad('right')}px ${pad('bottom')}px ${pad('left')}px;`;
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.textOverflow === 'ellipsis') s += styleText(cs, ['overflow-x', 'overflow-y', 'text-overflow', '-webkit-line-clamp', '-webkit-box-orient']);
    return s + 'margin:0;box-sizing:border-box;width:100%;height:100%;position:relative;';
  }
  function textItem(base, full, tb, cs) {
    const text = full.textContent.replace(/\s+/g, ' ').trim();
    return add({ kind: 'text', ...base, tb, full, fs: parseFloat(cs.fontSize) || 16, lh: lineH(cs), align: cs.textAlign, text, sig: text });
  }
  // 글만 든 덩어리 하나 (문단, 제목, 버튼 글씨)
  function leaf(el, cs, r, ctx, key) {
    const full = document.createElement('div');
    full.setAttribute('style', blockStyle(cs, false));
    const c = inert().importNode(el, true);
    dressAll(el, c);
    while (c.firstChild) full.appendChild(c.firstChild);
    withPseudos(el, full);
    const rg = document.createRange();
    rg.selectNodeContents(el);
    const tr = rg.getBoundingClientRect();
    if (cs.display === 'table-cell' && tr.height) full.style.paddingTop = Math.max(0, tr.top - r.top) + 'px';
    // 늘이거나 옮긴(transform) 글: 원래 크기로 놓고 같은 변형을 다시 건다
    const mt = cs.transform.match(/^matrix\(([^)]+)\)$/);
    if (mt) {
      const [a, b, c, d, e, f] = mt[1].split(',').map(Number);
      if (!b && !c && a > 0 && d > 0) {
        const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
        // 바깥 칸은 변형된 뒤의 자리(r)에 있으므로, 안쪽은 변형 전 자리에서 시작한다
        Object.assign(full.style, { position: 'absolute', width: el.offsetWidth + 'px', height: el.offsetHeight + 'px', left: (ox * (a - 1) - e) + 'px', top: (oy * (d - 1) - f) + 'px', transform: cs.transform, transformOrigin: cs.transformOrigin });
      }
    }
    const box = place(r, ctx.layer);
    const tb = tr.width > 0 && tr.height > 0 ? place(tr, ctx.layer) : { ...box };
    tb.x = clamp(tb.x, box.x - 4, box.x + box.w);
    tb.y = clamp(tb.y, box.y - 4, box.y + box.h);
    textItem({ ...box, layer: ctx.layer, key, op: ctx.op, clip: clipFor(r, ctx.clip, ctx.layer), parentBox: ctx.boxItem, blend: cs.mixBlendMode !== 'normal' ? cs.mixBlendMode : ctx.blend || '' }, full, tb, cs);
  }
  // 상자 사이에 섞인 글 줄기
  function run(el, cs, nodes, ctx) {
    const rg = document.createRange();
    rg.setStartBefore(nodes[0]); rg.setEndAfter(nodes[nodes.length - 1]);
    const r = rg.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || !overlap(edges(r), ctx.clip)) return;
    const full = document.createElement('div');
    full.setAttribute('style', blockStyle(cs, true));
    if (r.height < lineH(cs) * 1.6) full.style.whiteSpace = 'nowrap';
    for (const n of nodes) full.appendChild(n.nodeType === 3 ? document.createTextNode(n.data) : cloneDressed(n));
    const box = place(r, ctx.layer);
    if (!onPage(box, ctx.layer)) return;
    box.w += 1;
    textItem({ ...box, layer: ctx.layer, key: ctx.key(), op: ctx.op, clip: clipFor(r, ctx.clip, ctx.layer), parentBox: ctx.boxItem, blend: ctx.blend || '' }, full, { ...box }, cs);
  }
  function line(pts, stroke, sw, dash, ctx, key) {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return add({ kind: 'line', x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), pts, stroke, sw, dash, placed: 0, shut: false, owner: null, layer: ctx.layer, key, op: ctx.op, clip: null, parentBox: ctx.boxItem, sig: pts.length + stroke });
  }
  // 배경·테두리·그림자가 있는 상자. 테두리만 몇 면 있으면 선으로 바꾼다
  function box(el, cs, r, ctx, key, force) {
    if (el === root || (el === body && bg.from === body)) return null;
    const bgc = cs.backgroundColor, bgi = cs.backgroundImage;
    const shows = (alpha(bgc) > .01 && !sameColor(bgc, bg.color)) || bgi !== 'none';
    const sides = ['top', 'right', 'bottom', 'left'].map(s => {
      const w = parseFloat(cs.getPropertyValue(`border-${s}-width`)) || 0, st = cs.getPropertyValue(`border-${s}-style`), c = cs.getPropertyValue(`border-${s}-color`);
      return w > 0 && st !== 'none' && st !== 'hidden' && alpha(c) > .02 ? { s, w, st, c } : null;
    });
    const nb = sides.filter(Boolean).length;
    const shadow = cs.boxShadow && cs.boxShadow !== 'none';
    const b = place(r, ctx.layer);
    if (el.localName === 'hr') {
      const y = b.y + b.h / 2;
      line([{ x: b.x, y }, { x: b.x + b.w, y }], sides[0] ? sides[0].c : alpha(bgc) > .01 ? bgc : 'rgb(200,200,200)', Math.max(1, Math.min(b.h, 2)), null, ctx, key);
      return null;
    }
    if (!force && !shows && !shadow) {
      if (!nb) return null;
      if (nb < 4) {
        for (const d of sides) {
          if (!d) continue;
          const h = d.w / 2;
          const pts = d.s === 'top' ? [{ x: b.x, y: b.y + h }, { x: b.x + b.w, y: b.y + h }]
            : d.s === 'bottom' ? [{ x: b.x, y: b.y + b.h - h }, { x: b.x + b.w, y: b.y + b.h - h }]
            : d.s === 'left' ? [{ x: b.x + h, y: b.y }, { x: b.x + h, y: b.y + b.h }]
            : [{ x: b.x + b.w - h, y: b.y }, { x: b.x + b.w - h, y: b.y + b.h }];
          line(pts, d.c, d.w, d.st === 'dashed' ? `${d.w * 3} ${d.w * 2}` : d.st === 'dotted' ? `${d.w} ${d.w * 1.5}` : null, ctx, key);
        }
        return null;
      }
    }
    const style = styleText(cs, P_RECT);
    return add({ kind: 'rect', blend: cs.mixBlendMode !== 'normal' ? cs.mixBlendMode : ctx.blend || '', big: b.w * b.h > vw * vh * .4, ...b, css: style, radius: cs.borderRadius, draw: null, styled: false, layer: ctx.layer, key, op: ctx.op, clip: clipFor(r, ctx.clip, ctx.layer), parentBox: ctx.boxItem, sig: style });
  }
  // 꾸밈용 ::before/::after (절대 위치이거나 빈 아이콘 요소만)
  function pseudoBox(el, cs, r, ctx, which, empty) {
    const ps = getComputedStyle(el, which);
    const c = ps.content;
    if (!c || c === 'none' || c === 'normal' || ps.display === 'none' || ps.visibility !== 'visible') return;
    const op = parseFloat(ps.opacity);
    if (!(op > .03)) return;
    const n = v => parseFloat(v) || 0, w = parseFloat(ps.width), h = parseFloat(ps.height);
    if (!(w > 0 && h > 0)) return;
    const inner = { l: r.left + n(cs.borderLeftWidth), t: r.top + n(cs.borderTopWidth), r: r.right - n(cs.borderRightWidth), b: r.bottom - n(cs.borderBottomWidth) };
    let L, T, bw = w, bh = h;
    if (ps.position === 'absolute') {
      if (cs.position === 'static') return;
      bw = w + n(ps.paddingLeft) + n(ps.paddingRight) + n(ps.borderLeftWidth) + n(ps.borderRightWidth);
      bh = h + n(ps.paddingTop) + n(ps.paddingBottom) + n(ps.borderTopWidth) + n(ps.borderBottomWidth);
      L = ps.left !== 'auto' ? inner.l + n(ps.left) : ps.right !== 'auto' ? inner.r - n(ps.right) - bw : inner.l;
      T = ps.top !== 'auto' ? inner.t + n(ps.top) : ps.bottom !== 'auto' ? inner.b - n(ps.bottom) - bh : inner.t;
    } else if (empty) {
      const cl = inner.l + n(cs.paddingLeft), ct = inner.t + n(cs.paddingTop);
      L = cl + Math.max(0, (inner.r - n(cs.paddingRight) - cl - w) / 2);
      T = ct + Math.max(0, (inner.b - n(cs.paddingBottom) - ct - h) / 2);
    } else return;
    const fake = { left: L, top: T, right: L + bw, bottom: T + bh, width: bw, height: bh };
    if (!overlap(edges(fake), ctx.clip)) return;
    box({ localName: 'pseudo' }, ps, fake, { ...ctx, op: ctx.op * op }, ctx.key(), false);
  }
  function mediaOf(el, cs) {
    const tag = el.localName;
    const fit = `object-fit:${cs.objectFit};object-position:${cs.objectPosition};`;
    const img = (src, extra = '') => { const m = document.createElement('img'); m.src = src; m.draggable = false; m.setAttribute('style', extra + 'display:block;width:100%;height:100%;'); return { el: m, sig: src.slice(0, 120) + src.length }; };
    const flat = (bgc, label) => { const d = document.createElement('div'); d.setAttribute('style', `background:${bgc};display:flex;align-items:center;justify-content:center;font:500 12px/1.2 Paperlogy,system-ui,sans-serif;color:#8A8F98;`); d.textContent = label || ''; return { el: d, sig: 'flat:' + label }; };
    if (tag === 'img') { const s = srcOf(el); return s ? img(s, fit) : null; }
    if (tag === 'svg') {
      const m = cloneDressed(el);
      m.setAttribute('width', '100%'); m.setAttribute('height', '100%');
      Object.assign(m.style, { display: 'block', overflow: 'visible', margin: '0', position: 'static', transform: 'none' });
      const h = m.outerHTML;
      return { el: m, sig: h.length + ':' + h.slice(0, 160) };
    }
    if (tag === 'video') {
      if (el.poster) return img(el.poster, fit);
      try { const c = document.createElement('canvas'); c.width = el.videoWidth; c.height = el.videoHeight; c.getContext('2d').drawImage(el, 0, 0); return img(c.toDataURL('image/jpeg', .82), fit); } catch (e) { return flat('#111', ''); }
    }
    if (tag === 'canvas') { try { return img(el.toDataURL()); } catch (e) { return null; } }
    if (tag === 'model-viewer') { try { const u = el.toDataURL?.('image/png'); if (u && u.length > 2000) return img(u, 'object-fit:contain;'); } catch (e) {} return flat('transparent', ''); }
    // 영상 틀(iframe): 유튜브면 대표 그림을, 아니면 주소만 적은 회색 칸
    const url = el.src || el.data || '';
    const yt = url.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/);
    if (yt) return img(`https://i.ytimg.com/vi/${yt[1]}/maxresdefault.jpg`, 'object-fit:cover;');
    let hostName = '';
    try { hostName = new URL(url, location.href).hostname.replace(/^www\./, ''); } catch (e) {}
    return flat('#F1F2F4', hostName || 'embed');
  }
  function media(el, cs, r, ctx, key) {
    let src = el, scs = cs;
    if (el.localName === 'picture') { src = el.querySelector('img'); if (!src) return; scs = css(src); }
    const m = mediaOf(src, scs);
    if (!m) return;
    add({ kind: 'image', ...place(r, ctx.layer), blend: cs.mixBlendMode !== 'normal' ? cs.mixBlendMode : ctx.blend || '', media: m.el, frame: styleText(cs, P_RECT.filter(p => p.startsWith('border-') && !p.endsWith('radius'))), radius: cs.borderRadius, shadow: cs.boxShadow !== 'none' ? cs.boxShadow : '', bg: alpha(cs.backgroundColor) > .01 ? cs.backgroundColor : '', draw: null, styled: false, layer: ctx.layer, key, op: ctx.op, clip: clipFor(r, ctx.clip, ctx.layer), parentBox: ctx.boxItem, sig: m.sig });
  }
  function field(el, cs, r, ctx, key) {
    const tag = el.localName, type = (el.getAttribute('type') || '').toLowerCase();
    if (type === 'hidden' || type === 'checkbox' || type === 'radio') return;
    const b = place(r, ctx.layer);
    const holder = box(el, cs, r, ctx, key, false);
    let text = '', ph = false;
    if (tag === 'select') text = el.selectedOptions?.[0]?.text || '';
    else if (['submit', 'button', 'reset'].includes(type)) text = el.value || '';
    else text = el.value || '';
    if (!text && el.placeholder) { text = el.placeholder; ph = true; }
    if (!text.trim()) return;
    const pad = side => (parseFloat(cs.getPropertyValue(`padding-${side}`)) || 0) + (parseFloat(cs.getPropertyValue(`border-${side}-width`)) || 0);
    let st = styleText(cs, P_TEXT) + `padding:${pad('top')}px ${pad('right')}px ${pad('bottom')}px ${pad('left')}px;margin:0;box-sizing:border-box;width:100%;height:100%;overflow:hidden;`;
    st += tag === 'textarea' ? 'display:block;white-space:pre-wrap;' : 'display:flex;align-items:center;white-space:pre;';
    if (ph) st += `color:${getComputedStyle(el, '::placeholder').color};-webkit-text-fill-color:currentColor;`;
    const full = document.createElement('div');
    full.setAttribute('style', st);
    full.textContent = text;
    textItem({ ...b, layer: ctx.layer, key: key + .5, op: ctx.op, clip: clipFor(r, ctx.clip, ctx.layer), parentBox: holder || ctx.boxItem }, full, { ...b }, cs);
  }

  function walk(el, ctx, parent) {
    if (items.length >= ITEM_LIMIT) return;
    const tag = el.localName;
    if (SKIP.has(tag) || el === host) return;
    const cs = css(el), disp = cs.display;
    if (disp === 'none') return;
    if (disp === 'contents') {
      let txt = [];
      const flush = () => { if (ctx.key && txt.some(n => /\S/.test(n.data))) run(el, cs, txt, ctx); txt = []; };
      for (const c of el.childNodes) { if (c.nodeType === 3) txt.push(c); else if (c.nodeType === 1) { flush(); walk(c, ctx, parent); } }
      flush();
      return;
    }
    const op = ctx.op * parseFloat(cs.opacity);
    if (!(op > .03)) return;
    const r = el.getBoundingClientRect();
    const clipsSelf = el !== root && el !== body && cs.overflowX !== 'visible' && cs.overflowY !== 'visible';
    if (clipsSelf && (r.width <= 2 || r.height <= 2)) return;
    if (cs.position === 'absolute' && /rect\(0px,? 0px,? 0px,? 0px\)/.test(cs.clip)) return;
    if (/inset\(50%\)|circle\(0px/.test(cs.clipPath)) return;
    let { layer, clip, zTop, posd } = ctx;
    const pos = cs.position;
    if (pos === 'fixed' && layer !== 'over') { layer = 'over'; clip = VIEW; }
    else if (pos === 'sticky' && layer === 'world') {
      const top = parseFloat(cs.top);
      if (!isNaN(top) && Math.abs(r.top - top) < 2 && r.height < vh * .4) { layer = 'over'; clip = VIEW; }
    }
    const pe = el.parentElement;
    const flexKid = pos === 'static' && pe && /flex|grid/.test(css(pe).display);
    if (pos !== 'static' || flexKid) {
      if (cs.zIndex !== 'auto') { if (zTop == null) zTop = parseInt(cs.zIndex, 10) || 0; }
      else if (pos !== 'static') posd = true;
    }
    const keyFn = () => (zTop || 0) * 1e7 + (posd ? 5e6 : 0) + order++;
    const b = place(r, layer);
    const visible = cs.visibility === 'visible';
    const emit = visible && r.width >= 1 && r.height >= 1 && !!overlap(edges(r), clip) && onPage(b, layer);
    const node = { el, tag, cls: el.getAttribute?.('class') || '', layer, start: items.length, end: items.length, kids: [], box: b };
    (parent ? parent.kids : tops).push(node);

    if (MEDIA.has(tag) || FORM.has(tag)) {
      if (emit) (FORM.has(tag) ? field : media)(el, cs, r, { ...ctx, layer, clip, op }, keyFn());
      node.end = items.length;
      return;
    }
    let boxItem = ctx.boxItem;
    if (emit) { const bx = box(el, cs, r, { ...ctx, layer, clip, op }, keyFn(), false); if (bx) boxItem = bx; }
    let kidClip = clip;
    if (el !== root && el !== body && (cs.overflowX !== 'visible' || cs.overflowY !== 'visible')) {
      kidClip = overlap(clip, { l: r.left + (parseFloat(cs.borderLeftWidth) || 0), t: r.top + (parseFloat(cs.borderTopWidth) || 0), r: r.right - (parseFloat(cs.borderRightWidth) || 0), b: r.bottom - (parseFloat(cs.borderBottomWidth) || 0) });
      if (!kidClip) { node.end = items.length; return; }
    }
    const blend = cs.mixBlendMode !== 'normal' ? cs.mixBlendMode : ctx.blend;
    const kctx = { op, layer, clip: kidClip, zTop, posd, boxItem, key: keyFn, blend };
    if (cs.contentVisibility === 'hidden') { node.end = items.length; return; }
    let kids = [...el.childNodes];
    if (tag === 'details' && !el.open) { const s = kids.find(n => n.localName === 'summary'); kids = s ? [s] : []; }
    const empty = !kids.some(k => (k.nodeType === 3 && /\S/.test(k.data)) || k.nodeType === 1);
    const direct = kids.some(n => n.nodeType === 3 && /\S/.test(n.data));
    const kinds = [];
    let allInline = !el.shadowRoot, anyText = direct;
    for (const n of kids) {
      if (n.nodeType === 3) { kinds.push(1); continue; }
      if (n.nodeType !== 1 || SKIP.has(n.localName)) { kinds.push(0); continue; }
      const d = css(n).display;
      if (d === 'none') { kinds.push(0); continue; }
      const nt = n.localName;
      let inl = false;
      if (n.shadowRoot || nt === 'slot' || MEDIA.has(nt) && nt !== 'svg' && nt !== 'img') inl = false;
      else if (nt === 'br' || nt === 'wbr') inl = true;
      else if (d === 'inline') inl = inlineOnly(n);
      else if (direct && d.startsWith('inline')) inl = true;
      if (inl && !anyText && /\S/.test(n.textContent)) anyText = true;
      kinds.push(inl ? 1 : 2);
      if (!inl) allInline = false;
    }
    if (allInline && anyText) {
      if (emit) leaf(el, cs, r, kctx, keyFn());
      node.end = items.length;
      return;
    }
    const pctx = { ...kctx, layer, clip };
    if (emit) pseudoBox(el, cs, r, pctx, '::before', empty);
    let txt = [];
    const flush = () => {
      if (!txt.length) return;
      if (txt.some(n => /\S/.test(n.nodeType === 3 ? n.data : n.textContent))) { if (visible) run(el, cs, txt, kctx); }
      else for (const n of txt) if (n.nodeType === 1) walk(n, kctx, node);
      txt = [];
    };
    kids.forEach((n, i) => { if (kinds[i] === 1) txt.push(n); else if (kinds[i] === 2) { flush(); walk(n, kctx, node); } });
    flush();
    if (emit) pseudoBox(el, cs, r, pctx, '::after', empty);
    node.end = items.length;
  }
  walk(root, { op: 1, layer: 'world', clip: ALL, zTop: null, posd: false, boxItem: null }, null);

  // 반복되는 묶음(카드, 목록 줄)은 하나를 만든 뒤 복제해서 쓴다
  const groups = [];
  const shapeSig = n => { let s = ''; for (let i = n.start; i < n.end; i++) s += items[i].kind[0]; return s; };
  const alike = (a, b, loose) => a.w > 0 && b.w > 0 && a.h > 0 && b.h > 0 && a.h / b.h < 1.8 && b.h / a.h < 1.8 && (loose || (a.w / b.w < 1.6 && b.w / a.w < 1.6));
  (function find(list, skip) {
    for (const node of list) {
      if (skip.has(node)) continue;
      const buckets = new Map();
      for (const k of node.kids) {
        const n = k.end - k.start;
        if (n < 1 || n > 48) continue;
        if (n === 1 && items[k.start].kind === 'text' && items[k.start].text.length > 40) continue;
        const sig = `${k.tag}|${k.cls}|${k.layer}|${shapeSig(k)}`;
        if (!buckets.has(sig)) buckets.set(sig, []);
        buckets.get(sig).push(k);
      }
      const copies = new Set();
      for (const l of buckets.values()) {
        if (l.length < 2) continue;
        const m = l[0];
        const loose = m.end - m.start === 1 && items[m.start].kind === 'text';
        const members = l.filter(k => alike(k.box, m.box, loose));
        if (members.length < 2) continue;
        groups.push({ id: groups.length, master: members[0], copies: members.slice(1) });
        members.slice(1).forEach(c => copies.add(c));
      }
      find(node.kids, copies);
    }
  })([{ kids: tops }], new Set());
  for (const g of groups) for (const c of g.copies) for (let i = c.start; i < c.end; i++) {
    const it = items[i];
    if (it.copyOf) continue;
    it.copyOf = items[g.master.start + (i - c.start)];
    it.group = g;
  }
  // 같은 자리에 겹친 같은 글은 함께 나타난다
  const seen = new Map();
  for (const it of items) {
    if (it.kind !== 'text' || it.copyOf || !it.text) continue;
    const k = `${it.layer}|${Math.round(it.tb.x / 4)}|${Math.round(it.tb.y / 4)}|${it.text}`;
    if (seen.has(k)) it.twinOf = seen.get(k); else seen.set(k, it);
  }

  // 일감: 상자 → 그 안의 것 순서로 기다린다
  const tasks = [];
  const job = (y, spec, deps, layer) => { const t = { id: tasks.length, y, spec, deps, state: 'wait', doneAt: 0, layer }; tasks.push(t); return t; };
  for (const it of items) {
    if (it.copyOf) continue;
    if (it.twinOf) { it.final = it.twinOf.final; continue; }
    it.task = job(it.kind === 'text' ? it.tb.y : it.y, { type: it.kind, it }, it.parentBox?.final || [], it.layer);
    it.final = [it.task];
  }
  for (let gi = groups.length - 1; gi >= 0; gi--) {
    const g = groups[gi];
    const mItems = items.slice(g.master.start, g.master.end);
    const needs = [];
    for (const it of mItems) if (it.final) needs.push(...it.final);
    if (mItems[0]?.parentBox?.final) needs.push(...mItems[0].parentBox.final);
    g.src = { items: mItems, box: g.master.box };
    g.dst = g.copies.map((c, k) => {
      const its = items.slice(c.start, c.end).filter(it => it.group === g);
      const t = job(Math.min(...its.map(it => it.kind === 'text' ? it.tb.y : it.y)), { type: 'dup', g, k }, needs, c.layer);
      for (const it of its) {
        it.dupTask = t; it.final = [t];
        const m = it.copyOf;
        const type = it.sig === m.sig ? null : it.kind === 'text' ? 'edit' : it.kind === 'image' ? 'swap' : it.kind === 'rect' ? 'restyle' : null;
        if (type) { it.editTask = job(it.kind === 'text' ? it.tb.y : it.y, { type, it }, [t], it.layer); it.final = [t, it.editTask]; }
      }
      return { items: its, box: c.box, task: t };
    });
  }

  // 안내선: 왼쪽 끝이 같은 글이 셋 이상이면 세로선, 윗줄이 같은 글이 셋 이상이면 가로선
  const guides = [];
  const bands = new Map();
  for (const it of items) {
    if (it.kind !== 'text' || !it.task || it.layer !== 'world' || it.fs < 13 || it.tb.w <= 30) continue;
    const k = Math.floor(it.tb.y / 900);
    if (!bands.has(k)) bands.set(k, []);
    bands.get(k).push(it);
  }
  for (const [, list] of [...bands].sort((a, b) => a[0] - b[0])) {
    if (guides.length >= 16) break;
    const byX = new Map();
    for (const it of list) { const x = Math.round(it.tb.x); (byX.get(x) || byX.set(x, []).get(x)).push(it); }
    let best = null;
    for (const e of byX) if (e[1].length >= 3 && (!best || e[1].length > best[1].length)) best = e;
    if (best) {
      const top = Math.min(...best[1].map(m => m.tb.y));
      const members = best[1].filter(m => m.tb.y < top + 450).sort((a, b) => b.fs - a.fs).slice(0, 2);
      const g = { axis: 'x', pos: best[0], cur: best[0], op: 1, flash: 0, dragging: false, vis: false, deps: [] };
      guides.push(g);
      g.task = job(Math.min(...members.map(m => m.tb.y)) - 30, { type: 'guide', g }, [], 'world');
      for (const m of members) { m.task.spec.snap = g; g.deps.push(m.task); }
    }
    const byY = new Map();
    for (const it of list) { const y = Math.round(it.tb.y); (byY.get(y) || byY.set(y, []).get(y)).push(it); }
    let row = null;
    for (const e of byY) if (e[1].length >= 3 && (!row || e[1].length > row[1].length)) row = e;
    const m = row && row[1].find(it => !it.task.spec.snap);
    if (m) {
      const g = { axis: 'y', pos: row[0], cur: row[0], op: 1, flash: 0, dragging: false, vis: false, deps: [m.task] };
      guides.push(g);
      g.task = job(row[0] - 30, { type: 'guide', g }, [], 'world');
      m.task.spec.snap = g;
    }
  }
  for (const it of items) if (it.kind === 'text' && it.task && it.fs >= 28 && it.tb.h < 400) it.task.spec.grow = true;
  // 앞선 일감이 뒤 일감보다 늦게 풀리지 않게, 가장 이른 필요 시점을 거꾸로 전한다
  for (const t of tasks) t.gate = t.y;
  for (let i = tasks.length - 1; i >= 0; i--) for (const d of tasks[i].deps) if (tasks[i].gate < d.gate) d.gate = tasks[i].gate;
  return { items, tasks, groups, guides, docW, docH };
}

// ── 글 한 자씩 보이기 ─────────────────────────────
function wsOf(n, top) { for (let e = n; e && e !== top.parentNode; e = e.parentNode) { const w = e.style?.whiteSpace; if (w) return w; } return 'normal'; }
function prepText(it) {
  const live = it.full.cloneNode(true);
  const units = [], boxes = [];
  let seq = '';
  (function walk(n, holder) {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) {
        let s = c.data;
        if (!/^pre|break-spaces/.test(wsOf(n, live))) s = s.replace(/[\t\n\r ]+/g, ' ');
        if (!s.length) { c.remove(); continue; }
        units.push({ t: c, s, len: s.length, holder });
        seq += s;
      } else if (c.nodeType === 1) {
        if (WHOLE.has(c.localName) || c instanceof SVGElement || (!/\S/.test(c.textContent) && c.style && boxy(c.style))) {
          units.push({ e: c, len: 1, holder, on: true });
          seq += '□';
        } else {
          const h = c.style && boxy(c.style) ? c : holder;
          if (h === c) boxes.push(c);
          walk(c, h);
        }
      }
    }
  })(live, null);
  for (const u of units) { if (u.t) u.t.data = ''; else { u.e.style.visibility = 'hidden'; u.on = false; } }
  for (const b of boxes) { b.style.visibility = 'hidden'; b._on = false; }
  Object.assign(it, { live, units, seq, total: seq.length, shown: 0, rshown: 0 });
}
function showText(it, n) {
  let left = n, last = null;
  for (const u of it.units) {
    const k = left <= 0 ? 0 : Math.min(left, u.len);
    left -= k;
    if (u.t) { const want = k === u.len ? u.s : u.s.slice(0, k); if (u.t.data !== want) u.t.data = want; if (k) last = u.t; }
    else { const on = k > 0; if (u.on !== on) { u.e.style.visibility = on ? '' : 'hidden'; u.on = on; } if (on) last = u.e; }
    if (k && u.holder && u.holder._on === false) for (let b = u.holder; b && b !== it.live; b = b.parentNode) if (b._on === false) { b.style.visibility = ''; b._on = true; }
  }
  return last;
}

// ── 화면 ─────────────────────────────
const STYLE = `
:host{all:initial}
*{box-sizing:border-box}
.bg{position:absolute;inset:0;opacity:0;transition:opacity .5s ease}
.bg.on{opacity:1}
.layer{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.world{position:absolute;left:0;top:0;will-change:transform}
.it{position:absolute;left:0;top:0;transform-origin:0 0}
.it.settle{transition:transform .3s cubic-bezier(.2,.8,.2,1)}
.r{background-color:var(--ph);transition:background-color .22s ease,border-radius .22s ease}
.r.st{background-color:transparent}
.r>.f{position:absolute;inset:0;opacity:0;transition:opacity .22s ease,background-color .35s ease,border-radius .35s ease,box-shadow .35s ease,border-color .35s ease}
.r.st>.f{opacity:1}
.m{background-color:var(--ph);overflow:hidden}
.m>.ph{position:absolute;left:50%;top:50%;width:22px;height:22px;transform:translate(-50%,-50%);opacity:.7;transition:opacity .2s}
.m>.md{position:absolute;inset:0;width:100%;height:100%;opacity:0;clip-path:inset(0 0 100% 0);transition:opacity .35s ease,clip-path .6s cubic-bezier(.2,.75,.2,1)}
.m.st{background-color:transparent;transition:background-color .3s ease .3s}
.m.st>.ph{opacity:0}
.m.st>.md{opacity:1;clip-path:inset(0)}
.m>.md.swap{animation:swap .45s ease}
@keyframes swap{from{opacity:0;filter:blur(6px)}}
.m>.fr{position:absolute;inset:0;pointer-events:none}
.l svg{position:absolute;left:0;top:0;overflow:visible}
.caret{display:inline-block;width:1.5px;height:1.1em;margin:0 -2.5px 0 1px;vertical-align:text-bottom;background:currentColor;animation:blink 1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.sa{background-color:rgba(13,153,255,.28)!important}
.ov{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.badges,.cursors{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.badge{position:absolute;transform:translate(-50%);padding:1px 4px;border-radius:2px;color:#fff;font:600 11px/16px Paperlogy,system-ui,sans-serif;white-space:nowrap;font-variant-numeric:tabular-nums}
.cursor{position:absolute;left:0;top:0;will-change:transform}
.cursor svg{position:absolute;overflow:visible;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.28))}
.hud .dots i{background:#fff!important;color:#000!important}
.rulers{position:absolute;inset:0;pointer-events:none}
.ruler{position:absolute;background:#2c2c2c}
.ruler svg{display:block}
.ruler-top{top:0;left:0;right:0;height:${RULER}px;border-bottom:1px solid #3a3a3a}
.ruler-left{top:0;left:0;bottom:0;width:${RULER}px;border-right:1px solid #3a3a3a}
.ruler-corner{position:absolute;top:0;left:0;width:${RULER}px;height:${RULER}px;background:#2c2c2c}
.rtext{font:500 9px Paperlogy,system-ui,sans-serif;fill:#8c8c8c}
.rsel{fill:${BLUE}}
.logo{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.92);opacity:0;transition:opacity .35s ease,transform .45s cubic-bezier(.2,.8,.2,1);pointer-events:none}
.logo.on{opacity:1;transform:translate(-50%,-50%)}
.logo.gone{opacity:0;transform:translate(-50%,-50%) scale(.9)}
.logo img{display:block;width:60px;height:60px;object-fit:contain;filter:grayscale(1);opacity:.42;border-radius:14px}
.hud{position:absolute;left:50%;bottom:20px;transform:translate(-50%,18px);opacity:0;display:flex;align-items:center;gap:10px;padding:6px 6px 6px 10px;max-width:calc(100% - 20px);background:rgba(30,30,30,.94);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.07);font:500 12px/1 Paperlogy,system-ui,sans-serif;pointer-events:auto;transition:opacity .45s ease,transform .45s cubic-bezier(.2,.8,.2,1);white-space:nowrap;user-select:none;z-index:5}
.hud.on{opacity:1;transform:translate(-50%,0)}
.hud .dots{display:flex;padding-left:5px}
.hud .dots i{display:block;width:18px;height:18px;margin-left:-5px;border-radius:50%;border:2px solid #1e1e1e;font:600 8px/14px Paperlogy,system-ui,sans-serif;font-style:normal;text-align:center;color:#fff}
.hud .status{display:flex;align-items:center;gap:7px;color:#cfcfcf;font-variant-numeric:tabular-nums}
.hud .status b{color:#fff;font-weight:600}
.hud .sep{width:1px;height:12px;background:#444}
.hud .bar{width:64px;height:3px;border-radius:2px;background:#3a3a3a;overflow:hidden;flex:none}
.hud .bar i{display:block;height:100%;width:0;background:${BLUE};transition:width .35s ease}
.hud button{all:unset;cursor:pointer;padding:7px 10px;border-radius:8px;background:#2c2c2c;color:#fff;font:500 12px/1 Paperlogy,system-ui,sans-serif;transition:background .15s}
.hud button:hover{background:#3a3a3a}
.hud button.pri{background:${BLUE}}
.hud button.pri:hover{background:#2aa6ff}
.hud button.on{background:rgba(13,153,255,.22);color:#8fd0ff}
.hud button[hidden]{display:none}
.hud .x{padding:7px 9px;color:#aaa}
@media (max-width:640px){.hud{bottom:12px;gap:8px}.hud .dots,.hud .bar{display:none}}
`;

export async function runIntro({ key }) {
  const host = document.getElementById('intro');
  if (!host || !introWanted()) return;
  host.textContent = '';
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
  let app = null;
  const finishKey = () => { try { sessionStorage.setItem('btwt-intro-' + key, '1'); } catch (e) {} };

  function start() {
    app = build();
    app.go().catch(err => console.error('[intro]', err));
  }
  function stop(reveal) {
    if (!app) return;
    const a = app; app = null;
    finishKey();
    a.destroy(reveal);
  }
  function restart() {
    if (app) { app.kill(); app = null; }
    scrollTo({ top: 0, behavior: 'instant' });
    start();
  }

  function build() {
    const A = { dead: false, t0: performance.now(), tour: true, tourV: 0, tourAcc: 0, speed: 1, complete: false };
    const bg = pageBg();
    host.style.cssText = 'opacity:1;transition:opacity .6s ease;pointer-events:auto;contain:strict';
    shadow.innerHTML = `<style>${STYLE}</style>
<div class="bg"></div>
<div class="layer port"><div class="world"></div></div>
<div class="layer over"></div>
<div class="logo"></div>
<svg class="ov"></svg>
<div class="badges"></div>
<div class="cursors"></div>
<div class="rulers"></div>
<div class="hud" role="status">
  <div class="dots"></div>
  <div class="status">페이지 읽는 중…</div>
  <div class="bar"><i></i></div>
  <button type="button" data-a="tour" class="on" title="짓는 동안 저절로 내려갑니다">둘러보는 중</button>
  <button type="button" data-a="speed" title="짓는 속도">1×</button>
  <button type="button" data-a="live" class="pri" hidden title="진짜 페이지로 돌아갑니다">사이트 보기</button>
  <button type="button" data-a="replay" hidden title="처음부터 다시 짓습니다">다시 보기</button>
  <button type="button" data-a="close" class="x" title="끝내기 (Esc)" aria-label="끝내기">✕</button>
</div>`;
    const $ = s => shadow.querySelector(s);
    const V = { bg: $('.bg'), port: $('.port'), world: $('.world'), over: $('.over'), logo: $('.logo'), ov: $('.ov'), badges: $('.badges'), cur: $('.cursors'), rulers: $('.rulers'), hud: $('.hud'), status: $('.status'), bar: $('.bar i'), dots: $('.dots') };
    V.bg.style.backgroundColor = bg.color;
    if (bg.image !== 'none') Object.assign(V.bg.style, { backgroundImage: bg.image, backgroundSize: bg.size, backgroundPosition: bg.position, backgroundRepeat: bg.repeat });
    const rgb = (bg.color.match(/[\d.]+/g) || [255, 255, 255]).map(Number);
    const dark = (.2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]) / 255 < .4;
    host.style.setProperty('--ph', dark ? '#3B3D42' : '#D9D9D9');
    INK = dark ? '#fff' : '#000'; PAPER = dark ? '#000' : '#fff';
    const fav = [...document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"]')].map(l => l.href).filter(Boolean)[0];
    if (fav) V.logo.innerHTML = `<img src="${fav}" alt="">`;

    let W = innerWidth, H = innerHeight, frozen = null;
    const vp = () => frozen || { sx: scrollX, sy: scrollY, vw: root.clientWidth, vh: innerHeight };
    const syncWorld = () => { const v = vp(); V.world.style.transform = `translate(${-v.sx}px,${-v.sy}px)`; };

    // ── 엔진 상태 ──
    const E = { items: null, tasks: [], groups: [], guides: [], editLines: new Set(), cursors: [], started: false, ready: false, frontier: 0, vel: 0, tempo: 1, time: 0, rulers: { want: 0, t: 0, need: -10 }, lastScroll: null, nextId: 0, cool: 0, flocking: false, releasing: false, lastM: null, tv: { x: 0, y: 0 }, mouse: null, retired: 0, doneCount: 0, waiting: 0 };
    let v = vp();
    const top = () => v.sy, bot = () => v.sy + v.vh;
    const fromScreen = (x, y) => ({ x: x + v.sx, y: y + v.sy });
    const taskY = t => t.layer === 'world' ? t.y : top() + t.y;
    function makeCursor(x, y, home = false) {
      const id = E.nextId++, quick = Math.random() < .25;
      return { id, x, y, home, name: NAMES[id % NAMES.length], color: COLORS[id % COLORS.length], shape: 'arrow', press: 0, task: null, gen: null, ov: null, idle: 0, leaving: false, worked: false, sticky: false, vx: 0, vy: 0, angle: 0, speed: quick ? rand(1000, 1500) : rand(300, 750), force: quick ? rand(3500, 6000) : rand(700, 1800), spin: quick ? rand(2.2, 3.4) : rand(.8, 1.8), curl: rand(-1, 1), orbit: rand(70, 170), follow: false };
    }
    for (let n = 0; n < INTRO_CREW; n++) {
      const left = n % 2 === 0;
      const p = fromScreen(left ? -40 - rand(0, 200) : v.vw + 40 + rand(0, 200), rand(.05, .95) * v.vh);
      const c = makeCursor(p.x, p.y, n < MIN_CREW);
      c.follow = true;
      E.cursors.push(c);
    }

    function bump(it) { it.v++; }
    function bounds(it) {
      if (it.kind === 'text') {
        let h = it.tb.h;
        if (it.editing && !it.selAll && it.total) {
          const lines = Math.max(1, Math.round(it.tb.h / it.lh));
          h = Math.min(it.tb.h, Math.max(it.lh, Math.ceil(it.shown / it.total * lines) * it.lh));
        }
        const s = it.scale;
        const ax = it.align === 'center' ? it.tb.w * (1 - s) / 2 : it.align === 'right' || it.align === 'end' ? it.tb.w * (1 - s) : 0;
        return { x: it.tb.x + it.dx + ax, y: it.tb.y + it.dy, w: it.tb.w * s, h: h * s };
      }
      return { x: it.x + it.dx, y: it.y + it.dy, w: it.draw ? it.draw.w : it.w, h: it.draw ? it.draw.h : it.h };
    }
    function union(list) {
      const bs = list.map(bounds);
      const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y));
      return { x, y, w: Math.max(...bs.map(b => b.x + b.w)) - x, h: Math.max(...bs.map(b => b.y + b.h)) - y };
    }
    const size = b => `${Math.round(b.w)} × ${Math.round(b.h)}`;
    function selection(it, extra) {
      const b = bounds(it);
      return { t: 'box', b, handles: true, badge: size(b), rulerLines: true, underline: it.kind === 'text' ? { x: b.x, y: b.y + (it.lh * .5 + it.fs * .42) * it.scale, w: Math.min(b.w, it.tb.w * it.scale) } : null, ...extra };
    }
    function available() {
      const list = [];
      for (const t of E.tasks) {
        if (t.state !== 'wait' || (t.layer === 'world' && t.gate > E.frontier)) continue;
        if (t.deps.every(d => d.state === 'done')) list.push(t);
      }
      return list;
    }
    function pick(c, list) {
      let best = null, bs = Infinity;
      const t0 = top() - 40, b0 = bot(), cy = c.sticky ? c.y + top() : c.y;
      for (const t of list) {
        const y = taskY(t), zone = y >= t0 && y <= b0 ? 0 : y < t0 ? 1 : 2;
        const s = zone * 1e6 + (zone === 1 ? t0 - y : y) * .6 + Math.abs(y - cy) * .4 - (t.spec.type === 'guide' ? 5e5 : 0);
        if (s < bs) { bs = s; best = t; }
      }
      return best;
    }
    const backlog = () => E.tasks.reduce((n, t) => n + (t.state !== 'done' && (t.layer !== 'world' || t.gate <= E.frontier) ? 1 : 0), 0);

    function beginBuild() {
      if (E.started || !E.ready) return;
      E.started = true;
      E.startTime = E.time;
      V.logo.classList.add('gone');
      for (const c of E.cursors) { c.follow = false; c.gen = null; c.angle = ((c.angle + 180) % 360 + 360) % 360 - 180; }
    }

    function step(dt) {
      dt = Math.min(dt, .05);
      E.time += dt;
      v = vp();
      const sv = Math.abs(v.sy - (E.lastScroll ?? v.sy)) / Math.max(dt, .001);
      E.lastScroll = v.sy;
      E.vel = Math.max(E.vel * Math.exp(-dt * 1.2), E.vel * .7 + sv * .3);
      if (E.started) E.frontier = Math.max(E.frontier, bot());
      const avail = E.started ? available() : [];
      E.tempo = clamp(2.1 + E.vel / 900 + avail.length / Math.max(1, E.cursors.length) * .5, 2.1, 4.5) * A.speed;
      if (E.rulers.want > 0) E.rulers.need = E.time;
      const rt = E.time - E.rulers.need < .7 ? 1 : 0;
      E.rulers.t += (rt - E.rulers.t) * Math.min(1, dt * 10);
      if (Math.abs(rt - E.rulers.t) < .002) E.rulers.t = rt;
      for (const g of E.guides) {
        if (!g.vis) continue;
        if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 1.5);
        if (g.shownAt == null) g.shownAt = E.time;
        if (!g.dragging && g.op > 0 && E.time - g.shownAt > 7 && !g.deps.some(t => t.state === 'active')) g.op = Math.max(0, g.op - dt * 1.2);
        else if (!g.dragging && g.deps.every(t => t.state === 'done') && E.time - Math.max(0, ...g.deps.map(t => t.doneAt)) > 1.2 && g.op > 0) g.op = Math.max(0, g.op - dt * 1.2);
      }
      if (!E.flocking && E.started && E.waiting === 0) {
        for (const c of E.cursors) if (!c.task && !c.follow) Object.assign(c, { follow: true, gen: null, leaving: false, ov: null, shape: 'arrow' });
        if (E.cursors.every(c => c.follow)) { E.flocking = true; E.endTime = E.time; onComplete(); }
      }
      if (E.flocking) return flock(dt);
      if (!E.started) {
        if (orbit(dt, E.cursors, fromScreen(v.vw / 2, v.vh / 2), .7) && E.ready) beginBuild();
        return;
      }
      const followers = E.cursors.filter(c => c.follow);
      if (followers.length) orbit(dt, followers);
      // 할 일이 쌓이고 빨리 스크롤할수록 화면 옆에서 커서가 합류한다
      E.cool -= dt;
      const want = clamp(MIN_CREW + Math.floor(E.vel / 40) + Math.floor(avail.length / 2), MIN_CREW, MAX_CREW);
      const active = E.cursors.filter(c => !c.leaving).length, busy = E.cursors.filter(c => c.task).length;
      if (active < want && avail.length > active - busy && E.cool <= 0) {
        const p = fromScreen(Math.random() < .5 ? -40 : v.vw + 40, rand(.2, .8) * v.vh);
        E.cursors.push(makeCursor(p.x, p.y));
        E.cool = .035;
      }
      for (const c of E.cursors) {
        if (c.task || c.leaving || c.follow) continue;
        const t = pick(c, avail);
        if (!t) continue;
        avail.splice(avail.indexOf(t), 1);
        t.state = 'active';
        E.waiting--;
        Object.assign(c, { task: t, worked: true, idle: 0 });
        if (t.layer !== 'world') { c.sticky = true; c.x -= v.sx; c.y -= v.sy; }
        c.gen = perform(c, t);
      }
      for (const c of [...E.cursors]) {
        if (c.follow) continue;
        c.press = Math.max(0, c.press - dt * 6);
        if (c.angle) c.angle = Math.abs(c.angle) < .5 ? 0 : c.angle * (1 - Math.min(1, dt * 10));
        if (!c.task) {
          c.idle += dt;
          // 일 없이 오래 쉬면 화면 밖으로 퇴근한다 (기본 인원은 남는다)
          if (!c.leaving && c.idle > 2.5 && !c.home && E.cursors.filter(m => !m.leaving).length > MIN_CREW) { c.leaving = true; c.gen = leave(c); }
          if (!c.gen) c.gen = wander(c);
        }
        if (c.gen.next(dt).done) {
          if (c.task) {
            c.task.state = 'done';
            c.task.doneAt = E.time;
            E.doneCount++;
            c.task = null; c.ov = null;
            if (c.sticky) { c.sticky = false; c.x += v.sx; c.y += v.sy; }
            c.shape = 'arrow';
          }
          c.gen = null;
          if (c.leaving) { if (c.worked) E.retired++; E.cursors.splice(E.cursors.indexOf(c), 1); }
        }
      }
    }

    function flock(dt) {
      E.cool -= dt;
      if (E.cursors.length < FLOCK_CREW && E.cool <= 0 && !E.releasing) {
        const p = fromScreen(Math.random() < .5 ? -30 : v.vw + 30, rand(.1, .9) * v.vh);
        const c = makeCursor(p.x, p.y);
        c.follow = true;
        E.cursors.push(c);
        E.cool = .04;
      }
      if (E.releasing) {
        for (const c of [...E.cursors]) { if (!c.gen) c.gen = leave(c); if (c.gen.next(dt).done) E.cursors.splice(E.cursors.indexOf(c), 1); }
        return;
      }
      orbit(dt, E.cursors);
    }
    function flockGoal() {
      if (E.mouse) return fromScreen(E.mouse.x, E.mouse.y);
      return fromScreen(v.vw * (.5 + .28 * Math.sin(E.time * .37)), v.vh * (.5 + .25 * Math.sin(E.time * .53 + 1)));
    }
    // 목표점 둘레를 무리 지어 돈다. 마우스에 닿으면 튕겨 나간다. 마우스가 닿았는지를 돌려준다
    function orbit(dt, list, goal, scale = 1) {
      const m = E.mouse ? fromScreen(E.mouse.x, E.mouse.y) : null;
      const o = goal || flockGoal(), t = E.time;
      if (m && E.lastM && dt > 0) {
        const k = Math.min(1, dt * 18);
        E.tv.x += ((m.x - E.lastM.x) / dt - E.tv.x) * k;
        E.tv.y += ((m.y - E.lastM.y) / dt - E.tv.y) * k;
      }
      E.lastM = m;
      const R = 135 * scale * (1 + .18 * Math.sin(t * .55));
      const swirl = Math.tanh(Math.cos(t * .11) * 3);
      const aim = list.map(c => {
        const ex = c.x - o.x, ey = c.y - o.y, d = Math.hypot(ex, ey) || .01, nx = ex / d, ny = ey / d;
        const ring = R * (1 + .3 * Math.sin(3 * Math.atan2(ey, ex) + t * .7)) + (c.orbit - 120) * .55 * scale;
        const along = 300 * (.7 + c.spin * .2) * swirl;
        const pull = clamp((ring - d) * 4, -2600, 1400);
        const far = clamp((d - ring) / 600, 0, 1);
        return [-ny * along + nx * pull - ny * c.curl * 400 * far, nx * along + ny * pull + nx * c.curl * 400 * far];
      });
      list.forEach((c, i) => {
        let ax = 0, ay = 0, wsum = 0;
        for (const q of list) {
          if (q === c) continue;
          const d = Math.hypot(q.x - c.x, q.y - c.y);
          if (d > 90) continue;
          const w = 1 - d / 90;
          ax += q.vx * w; ay += q.vy * w; wsum += w;
        }
        let [fx, fy] = aim[i];
        if (wsum) { fx = fx * .7 + ax / wsum * .3; fy = fy * .7 + ay / wsum * .3; }
        const dist = Math.max(0, Math.hypot(c.x - o.x, c.y - o.y) - 180 * scale);
        const maxV = c.speed * (1.3 + Math.min(3.2, dist / 90)), L = Math.hypot(fx, fy);
        if (L > maxV) { fx *= maxV / L; fy *= maxV / L; }
        let gx = (fx - c.vx) * 6, gy = (fy - c.vy) * 6;
        const maxF = c.force * (1.4 + Math.min(5, dist / 50)), G = Math.hypot(gx, gy);
        if (G > maxF) { gx *= maxF / G; gy *= maxF / G; }
        c.vx += gx * dt; c.vy += gy * dt;
        c.x += c.vx * dt; c.y += c.vy * dt;
      });
      let touched = false;
      if (m) for (const c of list) {
        const ex = c.x - m.x, ey = c.y - m.y, d = Math.hypot(ex, ey) || .01;
        if (d >= 48) continue;
        touched = true;
        const nx = ex / d, ny = ey / d;
        c.x = m.x + nx * 48; c.y = m.y + ny * 48;
        const rel = (c.vx - E.tv.x) * nx + (c.vy - E.tv.y) * ny;
        if (rel < 0) { c.vx -= nx * rel * 1.6; c.vy -= ny * rel * 1.6; }
        c.vx += nx * 260; c.vy += ny * 260;
      }
      for (const c of list) {
        if (Math.hypot(c.vx, c.vy) < 30) continue;
        const d = ((Math.atan2(c.vy, c.vx) * 180 / Math.PI + 128 - c.angle + 540) % 360 + 360) % 360 - 180;
        c.angle += d * Math.min(1, dt * 8);
        c.press = Math.max(0, c.press - dt * 6);
      }
      return touched;
    }

    // ── 동작 (한 프레임씩 진행되는 생성기) ──
    function* wait(s) { let n = 0; while (n < s) n += (yield) * E.tempo; }
    function* moveTo(c, target, o = {}) {
      const get = typeof target === 'function' ? target : () => target;
      const x0 = c.x, y0 = c.y, p0 = get(), dist = Math.hypot(p0.x - x0, p0.y - y0);
      if (dist < .5) { c.x = p0.x; c.y = p0.y; o.onStep?.(); return; }
      const dur = clamp(.12 + Math.sqrt(dist) * .021, .14, .9) / (o.speed || 1);
      const bend = (o.bend ?? (Math.random() < .5 ? -1 : 1) * rand(.04, .14)) * Math.min(dist, 600);
      let t = 0;
      while (t < dur) {
        t += (yield) * E.tempo;
        const k = Math.min(1, t / dur), e = o.drag || k < .15 ? inOut(k) : out(k);
        const p = get(), dx = p.x - x0, dy = p.y - y0, L = Math.hypot(dx, dy) || 1, off = Math.sin(Math.PI * e) * bend;
        c.x = x0 + dx * e - dy / L * off;
        c.y = y0 + dy * e + dx / L * off;
        o.onStep?.();
      }
      const p = get();
      c.x = p.x; c.y = p.y;
      o.onStep?.();
    }
    function* click(c) { c.press = 1; yield* wait(.07); }
    function* type(it) {
      const N = it.total, k = clamp(70 / Math.max(1, N), .06, 1);
      let budget = 0, i = it.shown;
      while (i < N) {
        budget += (yield) * E.tempo;
        while (i < N && budget > 0) {
          const ch = it.seq[i];
          let d = rand(.012, .04);
          if (ch === ' ') d += rand(0, .03);
          if (ch === '\n') d += .1;
          if (Math.random() < .025) d += rand(.08, .2);   // 가끔 멈칫한다
          budget -= d * k;
          i++;
        }
        it.shown = i;
        bump(it);
      }
    }
    function* wander(c) {
      for (;;) {
        yield* moveTo(c, { x: rand(v.sx + v.vw * .17, v.sx + v.vw * .83), y: rand(top() + v.vh * .2, top() + v.vh * .8) }, { speed: .35 });
        let w = rand(.4, 1.4);
        while (w > 0) { w -= yield; if (c.y < top() || c.y > bot()) break; }
      }
    }
    function* leave(c) {
      const right = c.x > v.sx + v.vw / 2;
      yield* moveTo(c, () => fromScreen(right ? v.vw + 60 : -60, c.y - top()), { speed: .8 });
    }
    function perform(c, t) {
      const s = t.spec;
      switch (s.type) {
        case 'rect': return drawBox(c, s.it, false);
        case 'image': return drawBox(c, s.it, true);
        case 'line': return drawLine(c, s.it);
        case 'text': return drawText(c, s.it, s.snap || null, !!s.grow);
        case 'guide': return dragGuide(c, s.g);
        case 'dup': return duplicate(c, s.g, s.k);
        case 'edit': return editText(c, s.it);
        default: return restyle(c, s.it);
      }
    }
    // 큰 상자를 끌다 커서가 화면 밖으로 나가지 않게 끝점을 화면 안에 둔다
    function dragEnd(c, it) {
      const right = c.sticky ? v.vw : v.sx + v.vw, b0 = c.sticky ? v.vh : bot();
      const x = it.x + it.w > right - 16 ? Math.max(it.x + Math.min(it.w, 40), right - 30) : it.x + it.w;
      const y = it.y + it.h > b0 - 16 ? Math.max(it.y + Math.min(it.h, 40), b0 - 40) : it.y + it.h;
      return { x: Math.min(x, it.x + it.w), y: Math.min(y, it.y + it.h) };
    }
    function* drawBox(c, it, pic) {
      c.shape = 'cross';
      yield* moveTo(c, { x: it.x, y: it.y });
      c.press = 1;
      it.vis = true;
      if (it.big) it.styled = true;
      it.draw = { w: 0, h: 0 };
      bump(it);
      c.ov = () => [selection(it)];
      const end = dragEnd(c, it);
      yield* moveTo(c, end, { speed: .75, drag: true, bend: 0, onStep: () => { it.draw = { w: Math.max(0, c.x - it.x), h: Math.max(0, c.y - it.y) }; bump(it); } });
      if (end.x < it.x + it.w - .5 || end.y < it.y + it.h - .5) {
        const w0 = it.draw.w, h0 = it.draw.h;
        for (let k = 0; k < 1;) { k = Math.min(1, k + (yield) * E.tempo / .5); const e = out(k); it.draw = { w: w0 + (it.w - w0) * e, h: h0 + (it.h - h0) * e }; bump(it); }
      }
      it.draw = null;
      bump(it);
      c.shape = 'arrow';
      yield* wait(rand(.18, .3));
      it.styled = true;
      bump(it);
      yield* wait(pic ? .5 : .35);
      c.ov = null;
      it.done = true;
      bump(it);
    }
    function* drawLine(c, it) {
      c.shape = 'pen-add';
      yield* moveTo(c, it.pts[0]);
      yield* click(c);
      Object.assign(it, { vis: true, placed: 1, owner: c });
      bump(it);
      E.editLines.add(it);
      c.shape = 'pen';
      for (let i = 1; i < it.pts.length; i++) {
        yield* moveTo(c, it.pts[i], { bend: rand(-.03, .03) });
        yield* click(c);
        it.placed = i + 1;
        bump(it);
        yield* wait(rand(.04, .12));
      }
      it.owner = null;
      bump(it);
      yield* moveTo(c, { x: c.x + rand(14, 30), y: c.y + rand(10, 24) }, { speed: 1.4 });
      yield* wait(.3);
      E.editLines.delete(it);
      it.done = true;
      bump(it);
    }
    function* drawText(c, it, guide, grow) {
      if (guide) {
        if (guide.axis === 'x') { it.dx = rand(28, 64); it.dy = rand(-8, 8); }
        else { it.dx = rand(-8, 8); it.dy = rand(18, 34) * (Math.random() < .5 ? -1 : 1); }
      }
      if (grow) it.scale = Math.min(1, 18 / it.fs);
      const b0 = bounds(it);
      c.shape = 'cross';
      yield* moveTo(c, { x: b0.x, y: b0.y });
      const lh = Math.min(b0.h, it.lh * it.scale);
      if (b0.w < 140 && it.tb.h < it.lh * 1.6) yield* click(c);
      else {
        c.press = 1;
        const ghost = { x: b0.x, y: b0.y, w: 0, h: 0 };
        c.ov = () => [{ t: 'box', b: ghost, handles: true, badge: size(ghost), rulerLines: true }];
        yield* moveTo(c, { x: b0.x + b0.w, y: b0.y + lh }, { speed: .9, drag: true, bend: 0, onStep: () => { ghost.w = Math.max(0, c.x - b0.x); ghost.h = Math.max(0, c.y - b0.y); } });
      }
      Object.assign(it, { vis: true, editing: true, shown: 0 });
      bump(it);
      c.shape = 'ibeam';
      c.ov = () => [{ t: 'box', b: bounds(it) }];
      yield* moveTo(c, { x: c.x + rand(-30, 10), y: c.y + rand(10, 30) }, { speed: 1.5 });
      yield* type(it);
      yield* wait(.12);
      it.editing = false;
      bump(it);
      c.shape = 'arrow';
      c.ov = () => [selection(it)];
      if (grow) {
        // 작게 친 큰 제목을 단계별로 키운다
        const steps = [24, 32, 40, 48, 56, 64, 72, 88, 104].filter(s => s < it.fs && s > 18);
        for (const s of [...steps, it.fs]) { yield* wait(.06); it.scale = s / it.fs; bump(it); }
        it.scale = 1;
        bump(it);
        yield* wait(.15);
      }
      if (guide) {
        let waited = 0;
        while (guide.task.state !== 'done' && waited < 1.6) waited += (yield) * E.tempo;
        if (guide.task.state !== 'done') guide = null;
      }
      if (guide) {
        // 조금 비켜 친 글을 잡아끌어 안내선에 붙인다
        const u = bounds(it);
        const a = { x: u.x + Math.min(u.w * .4, 60) + rand(-6, 6), y: u.y + Math.min(u.h * .5, 22) };
        yield* moveTo(c, a);
        c.press = 1;
        const home = { x: a.x - it.dx, y: a.y - it.dy };
        const miss = { x: home.x + (guide.axis === 'x' ? -rand(2, 5) : rand(-6, 6)), y: home.y + (guide.axis === 'y' ? -rand(2, 5) : rand(-3, 3)) };
        const drag = () => {
          let h = c.x - home.x, vv = c.y - home.y;
          if (guide.axis === 'x' && Math.abs(h) < 9) { if (h !== 0 && it.dx !== 0) guide.flash = 1; h = 0; }
          if (guide.axis === 'y' && Math.abs(vv) < 9) { if (vv !== 0 && it.dy !== 0) guide.flash = 1; vv = 0; }
          it.dx = h; it.dy = vv;
          bump(it);
        };
        yield* moveTo(c, miss, { speed: .6, drag: true, onStep: drag });
        yield* wait(.1);
        yield* moveTo(c, home, { speed: 2, onStep: drag });
        it.dx = 0; it.dy = 0;
        bump(it);
        yield* wait(.25);
      } else if (it.dx || it.dy) {
        const dx0 = it.dx, dy0 = it.dy;
        for (let k = 0; k < 1;) { k = Math.min(1, k + (yield) * E.tempo / .3); const e = inOut(k); it.dx = dx0 * (1 - e); it.dy = dy0 * (1 - e); bump(it); }
        yield* wait(.15);
      } else yield* wait(.2);
      c.ov = null;
      it.done = true;
      bump(it);
    }
    function* dragGuide(c, g) {
      E.rulers.want++;
      try {
        const r = rand(-.15, .15);
        const from = () => g.axis === 'x' ? fromScreen(10, v.vh * (.45 + r)) : fromScreen(v.vw * .3 + r * 200, 10);
        c.shape = 'arrow';
        yield* moveTo(c, from);
        while (E.rulers.t < .95) yield;
        yield* moveTo(c, from, { speed: 3 });
        c.press = 1;
        c.shape = g.axis === 'x' ? 'ew' : 'ns';
        Object.assign(g, { vis: true, dragging: true, op: 1 });
        const upd = () => { g.cur = g.axis === 'x' ? c.x : c.y; };
        upd();
        yield* moveTo(c, () => { const s = from(); return g.axis === 'x' ? { x: g.pos, y: s.y + 40 } : { x: s.x + 30, y: g.pos }; }, { speed: .55, drag: true, onStep: upd });
        g.cur = g.pos;
        g.dragging = false;
        c.shape = 'arrow';
        yield* wait(.25);
      } finally { E.rulers.want--; }
    }
    function gap(a, b) {
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y), ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (oy > 0) {
        const y = Math.max(a.y, b.y) + oy / 2, [l, r] = a.x < b.x ? [a, b] : [b, a], d = r.x - (l.x + l.w);
        if (d > 0) return { t: 'measure', a: { x: l.x + l.w, y }, b: { x: r.x, y }, label: String(Math.round(d)) };
      } else if (ox > 0) {
        const x = Math.max(a.x, b.x) + ox / 2, [t, bt] = a.y < b.y ? [a, b] : [b, a], d = bt.y - (t.y + t.h);
        if (d > 0) return { t: 'measure', a: { x, y: t.y + t.h }, b: { x, y: bt.y }, label: String(Math.round(d)) };
      }
      return null;
    }
    // 이미 만든 칸을 골라 복제 커서로 끌어다 놓는다
    function* duplicate(c, g, k) {
      const dst = g.dst[k];
      let src = g.src;
      const far = s => Math.hypot(s.box.x - dst.box.x, s.box.y - dst.box.y);
      for (const s of [g.src, ...g.dst.filter(d => d.task.state === 'done')]) if (far(s) < far(src)) src = s;
      const sb = union(src.items);
      c.shape = 'arrow';
      const grab = { x: sb.x + Math.min(sb.w * .45, 70) + rand(-8, 8), y: sb.y + Math.min(sb.h * .45, 30) + rand(-4, 4) };
      yield* moveTo(c, grab);
      yield* click(c);
      c.ov = () => [{ t: 'box', b: sb, handles: true, badge: size(sb) }];
      yield* wait(rand(.15, .3));
      c.shape = 'dup';
      yield* wait(.12);
      c.press = 1;
      const ox = src.box.x - dst.box.x, oy = src.box.y - dst.box.y;
      for (const it of dst.items) {
        Object.assign(it, { vis: true, mode: 'master', dx: ox, dy: oy });
        if (it.kind === 'rect' || it.kind === 'image') { it.styled = true; it.draw = null; }
        if (it.kind === 'line') it.placed = it.pts.length;
        bump(it);
      }
      c.ov = () => { const cb = union(dst.items), sp = gap(sb, cb), l = [{ t: 'box', b: sb, color: 'red' }, { t: 'box', b: cb, color: 'red' }]; if (sp) l.push(sp); return l; };
      yield* moveTo(c, { x: grab.x - ox, y: grab.y - oy }, { speed: .6, drag: true, onStep: () => { for (const it of dst.items) { it.dx = ox + c.x - grab.x; it.dy = oy + c.y - grab.y; bump(it); } } });
      for (const it of dst.items) {
        Object.assign(it, { dx: 0, dy: 0, settle: true });
        if (!it.editTask) it.mode = 'own';
        if (it.kind === 'text' && it.mode === 'own') it.shown = it.total;
        bump(it);
      }
      yield* wait(.1);
      c.shape = 'arrow';
      c.ov = () => { const cb = union(dst.items); return [{ t: 'box', b: cb, handles: true, badge: size(cb) }]; };
      yield* wait(.35);
      for (const it of dst.items) if (!it.editTask) { it.done = true; bump(it); }
    }
    // 복제한 칸의 글을 두 번 눌러 고르고 이 칸의 글로 새로 친다
    function* editText(c, it) {
      c.shape = 'arrow';
      const b = bounds(it);
      yield* moveTo(c, { x: b.x + Math.min(b.w * .5, 50) + rand(-5, 5), y: b.y + Math.min(it.lh, b.h) * .55 });
      yield* click(c);
      yield* wait(.08);
      yield* click(c);
      Object.assign(it, { selAll: true, editing: true });
      bump(it);
      c.shape = 'ibeam';
      c.ov = () => [{ t: 'box', b: bounds(it) }];
      yield* wait(rand(.2, .35));
      Object.assign(it, { mode: 'own', selAll: false, shown: 0 });
      bump(it);
      yield* type(it);
      yield* wait(.12);
      it.editing = false;
      bump(it);
      c.shape = 'arrow';
      c.ov = () => [selection(it)];
      yield* wait(.3);
      c.ov = null;
      it.done = true;
      bump(it);
    }
    // 복제한 칸의 그림·색만 바꾼다
    function* restyle(c, it) {
      c.shape = 'arrow';
      const b = bounds(it);
      yield* moveTo(c, { x: b.x + Math.min(b.w * .5, 60) + rand(-6, 6), y: b.y + Math.min(b.h * .5, 30) + rand(-4, 4) });
      yield* click(c);
      c.ov = () => [selection(it)];
      yield* wait(rand(.15, .3));
      it.mode = 'own';
      bump(it);
      yield* wait(.4);
      c.ov = null;
      it.done = true;
      bump(it);
    }

    // ── 그리기 ──
    function mount(m) {
      V.world.style.width = m.docW + 'px';
      V.world.style.height = m.docH + 'px';
      for (const layer of ['world', 'over']) {
        const f = document.createDocumentFragment();
        for (const it of m.items.filter(i => i.layer === layer).sort((a, b) => a.key - b.key)) f.appendChild(makeNode(it));
        (layer === 'world' ? V.world : V.over).appendChild(f);
      }
    }
    function makeNode(it) {
      const n = document.createElement('div');
      n.style.display = 'none';
      it.node = n;
      if (it.kind === 'rect') { n.className = 'it r'; n.appendChild(document.createElement('div')).className = 'f'; }
      else if (it.kind === 'image') { n.className = 'it m'; n.innerHTML = PIC; }
      else if (it.kind === 'text') { n.className = 'it t'; prepText(it); }
      else { n.className = 'it l'; n.innerHTML = '<svg width="1" height="1"><path fill="none"/></svg>'; }
      if (it.op < .999) n.style.opacity = it.op;
      if (it.blend) n.style.mixBlendMode = it.blend;
      return n;
    }
    function drawItem(it) {
      const tw = it.twinOf;
      if (tw && it._tv !== tw.v) {
        it._tv = tw.v;
        Object.assign(it, { vis: tw.vis, shown: tw.total ? Math.round(tw.shown / tw.total * it.total) : it.total, dx: tw.dx, dy: tw.dy, scale: tw.scale, done: tw.done });
        it.v++;
      }
      if (it.rv === it.v) return;
      it.rv = it.v;
      const n = it.node;
      if (!it.vis) { if (n.style.display !== 'none') n.style.display = 'none'; return; }
      if (n.style.display === 'none') n.style.display = '';
      if (it.settle) { it.settle = false; n.classList.add('settle'); clearTimeout(n._st); n._st = setTimeout(() => n.classList.remove('settle'), 340); }
      if (it.kind === 'line') {
        n.style.transform = `translate(${it.dx}px,${it.dy}px)`;
        const path = n.firstChild.firstChild;
        path.setAttribute('d', it.pts.slice(0, it.placed).map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' '));
        path.setAttribute('stroke', it.stroke);
        path.setAttribute('stroke-width', it.sw);
        path.setAttribute('stroke-linecap', 'square');
        if (it.dash) path.setAttribute('stroke-dasharray', it.dash);
        return;
      }
      n.style.transform = `translate(${it.x + it.dx}px,${it.y + it.dy}px)` + (it.scale !== 1 ? ` scale(${it.scale})` : '');
      n.style.width = (it.draw ? it.draw.w : it.w) + 'px';
      n.style.height = (it.draw ? it.draw.h : it.h) + 'px';
      const c = it.clip;
      n.style.clipPath = it.done && c ? `inset(${Math.max(0, c.t - it.y)}px ${Math.max(0, it.x + it.w - c.r)}px ${Math.max(0, it.y + it.h - c.b)}px ${Math.max(0, c.l - it.x)}px)` : '';
      const from = it.mode === 'master' ? it.copyOf : it;
      if (it.kind === 'rect') {
        if (n._css !== from.css) { n.firstChild.setAttribute('style', from.css); n._css = from.css; }
        n.classList.toggle('st', !!it.styled);
        n.style.borderRadius = it.styled ? from.radius : '0px';
      } else if (it.kind === 'image') {
        if (n._src !== from) {
          const old = n.querySelector('.md'), m = from.media.cloneNode(true);
          m.classList.add('md');
          if (old) { m.classList.add('swap'); old.replaceWith(m); } else n.appendChild(m);
          n._src = from;
          if (from.frame) { let fr = n.querySelector('.fr'); if (!fr) { fr = document.createElement('div'); fr.className = 'fr'; n.appendChild(fr); } fr.setAttribute('style', from.frame + `border-radius:${from.radius};`); }
        }
        n.classList.toggle('st', !!it.styled);
        n.style.borderRadius = it.styled ? from.radius : '0px';
        n.style.boxShadow = it.styled ? from.shadow : '';
        n.style.backgroundColor = it.styled && from.bg ? from.bg : '';
      } else {
        let content;
        if (it.mode === 'master') content = it._mv || (it._mv = it.copyOf.full.cloneNode(true));
        else content = it.live;
        if (n.firstChild !== content) { n.textContent = ''; n.appendChild(content); }
        if (it.mode !== 'master' && it.rshown !== it.shown) { it._last = showText(it, it.shown); it.rshown = it.shown; }
        content.classList.toggle('sa', !!it.selAll);
        if (it.editing && !it.selAll && it.mode !== 'master') {
          const caret = it._caret || (it._caret = Object.assign(document.createElement('span'), { className: 'caret' }));
          const last = it._last;
          if (last?.parentNode) last.parentNode.insertBefore(caret, last.nextSibling); else content.insertBefore(caret, content.firstChild);
        } else it._caret?.remove();
        if (it.scale !== 1) {
          const ox = it.tb.x - it.x + (it.align === 'center' ? it.tb.w / 2 : it.align === 'right' || it.align === 'end' ? it.tb.w : 0);
          n.style.transformOrigin = `${ox}px ${it.tb.y - it.y}px`;
        }
      }
    }
    const curEls = new Map();
    function drawCursors() {
      const seen = new Set();
      for (const c of E.cursors) {
        let el = curEls.get(c.id);
        if (!el) {
          el = document.createElement('div');
          el.className = 'cursor';
          el.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"></svg>';
          V.cur.appendChild(el);
          curEls.set(c.id, el);
        }
        seen.add(c.id);
        const X = c.sticky ? c.x : c.x - v.sx, Y = c.sticky ? c.y : c.y - v.sy;
        el.style.transform = `translate(${r1(X)}px,${r1(Y)}px)`;
        const svg = el.firstChild;
        if (el._shape !== c.shape) {
          svg.innerHTML = cursorArt(c.shape);
          el._shape = c.shape;
          [el._hx, el._hy] = HOT[c.shape];
          svg.style.transformOrigin = `${el._hx}px ${el._hy}px`;
        }
        svg.style.transform = `translate(${-el._hx}px,${-el._hy}px) rotate(${r1(c.angle)}deg) scale(${1 - c.press * .12})`;
      }
      for (const [id, el] of curEls) if (!seen.has(id)) { el.remove(); curEls.delete(id); }
    }
    let lastOv = '', lastBadges = '', rulersOn = false;
    function drawOverlay() {
      const X = (x, st) => r1(st ? x : x - v.sx), Y = (y, st) => r1(st ? y : y - v.sy);
      let s = '', b = '';
      for (const g of E.guides) {
        if (!g.vis || g.op <= 0) continue;
        const glow = g.flash > 0 ? ` style="filter:drop-shadow(0 0 ${r1(2 + g.flash * 3)}px ${RED})"` : '';
        if (g.axis === 'x') { const x = X(g.cur); s += `<line x1="${x}" x2="${x}" y1="0" y2="${H}" stroke="${RED}" stroke-width="${1 + g.flash}" opacity="${r1(g.op)}"${glow}/>`; }
        else { const y = Y(g.cur); s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="${RED}" stroke-width="${1 + g.flash}" opacity="${r1(g.op)}"${glow}/>`; }
      }
      for (const it of E.editLines) {
        const st = it.layer !== 'world';
        const pts = it.pts.slice(0, it.placed).map(p => [X(p.x + it.dx, st), Y(p.y + it.dy, st)]);
        const o = it.owner, all = o ? [...pts, [X(o.x, o.sticky), Y(o.y, o.sticky)]] : pts;
        s += `<polyline points="${all.map(p => p.join(',')).join(' ')}" fill="none" stroke="${BLUE}" stroke-width="1.5"/>`;
        for (const p of pts) s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.6" fill="#fff" stroke="${BLUE}" stroke-width="1.5"/>`;
      }
      const rt = E.rulers.t;
      for (const c of E.cursors) {
        if (!c.ov) continue;
        const st = c.sticky;
        for (const o of c.ov()) {
          if (o.t === 'box') {
            const x = X(o.b.x, st), y = Y(o.b.y, st), w = r1(o.b.w), h = r1(o.b.h), col = o.color === 'red' ? RED : BLUE;
            s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${col}" stroke-width="1"/>`;
            if (o.underline && o.underline.w > 0) s += `<line x1="${X(o.underline.x, st)}" x2="${X(o.underline.x + o.underline.w, st)}" y1="${Y(o.underline.y, st)}" y2="${Y(o.underline.y, st)}" stroke="${BLUE}" stroke-width="1.5"/>`;
            if (o.rulerLines && rt > .05) s += `<g stroke="${BLUE}" stroke-width="1" stroke-dasharray="2 2" opacity="${r1(rt)}"><line x1="${RULER}" x2="${x}" y1="${r1(y + h / 2)}" y2="${r1(y + h / 2)}"/><line x1="${r1(x + w / 2)}" x2="${r1(x + w / 2)}" y1="${RULER}" y2="${y}"/></g>`;
            if (o.handles) for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) s += `<rect x="${r1(hx - 3.5)}" y="${r1(hy - 3.5)}" width="7" height="7" fill="#fff" stroke="${col}" stroke-width="1"/>`;
            if (o.badge && w > 0) b += `<div class="badge" style="left:${r1(x + w / 2)}px;top:${r1(y + h + 8)}px;background:${col}">${o.badge}</div>`;
          } else {
            const a = { x: X(o.a.x, st), y: Y(o.a.y, st) }, z = { x: X(o.b.x, st), y: Y(o.b.y, st) }, flat = a.y === z.y;
            s += `<line x1="${a.x}" y1="${a.y}" x2="${z.x}" y2="${z.y}" stroke="${RED}" stroke-width="1"/>`;
            b += `<div class="badge" style="left:${r1(flat ? (a.x + z.x) / 2 : a.x + 18)}px;top:${r1(flat ? a.y + 8 : (a.y + z.y) / 2 - 9)}px;background:${RED}">${o.label}</div>`;
          }
        }
      }
      if (s !== lastOv) { V.ov.innerHTML = s; lastOv = s; }
      if (b !== lastBadges) { V.badges.innerHTML = b; lastBadges = b; }
    }
    function drawRulers() {
      const t = E.rulers.t;
      if (t <= .001) { if (rulersOn) { V.rulers.innerHTML = ''; rulersOn = false; } return; }
      rulersOn = true;
      let u = '', a = '';
      for (let c = Math.floor(v.sx / 100) * 100; c - v.sx < W; c += 50) {
        const x = r1(c - v.sx), major = c % 100 === 0;
        u += `<line x1="${x}" x2="${x}" y1="${major ? 13 : 16}" y2="${RULER}" stroke="#5E5E5E"/>`;
        if (major) u += `<text x="${r1(x + 3)}" y="11" class="rtext">${c}</text>`;
      }
      for (let c = Math.floor(v.sy / 100) * 100; c - v.sy < H; c += 50) {
        const y = r1(c - v.sy), major = c % 100 === 0;
        a += `<line y1="${y}" y2="${y}" x1="${major ? 13 : 16}" x2="${RULER}" stroke="#5E5E5E"/>`;
        if (major) a += `<text x="11" y="${r1(y - 3)}" class="rtext" transform="rotate(-90 11 ${r1(y - 3)})">${c}</text>`;
      }
      for (const c of E.cursors) {
        if (!c.ov || c.sticky) continue;
        for (const o of c.ov()) {
          if (o.t !== 'box' || !o.handles) continue;
          const l = r1(o.b.x - v.sx), rr = r1(o.b.x + o.b.w - v.sx), tp = r1(o.b.y - v.sy), bt = r1(o.b.y + o.b.h - v.sy);
          u = `<rect x="${l}" y="0" width="${r1(rr - l)}" height="${RULER}" fill="rgba(13,153,255,.22)"/>` + u + `<text x="${r1(l + 3)}" y="11" class="rtext rsel">${Math.round(o.b.x)}</text>`;
          a = `<rect y="${tp}" x="0" height="${r1(bt - tp)}" width="${RULER}" fill="rgba(13,153,255,.22)"/>` + a;
        }
      }
      for (const g of E.guides) {
        if (!g.dragging) continue;
        if (g.axis === 'x') { const x = r1(g.cur - v.sx); u += `<line x1="${x}" x2="${x}" y1="0" y2="${RULER}" stroke="${RED}"/><text x="${r1(x + 4)}" y="11" class="rtext" style="fill:${RED}">${Math.round(g.cur)}</text>`; }
        else { const y = r1(g.cur - v.sy); a += `<line y1="${y}" y2="${y}" x1="0" x2="${RULER}" stroke="${RED}"/>`; }
      }
      V.rulers.innerHTML = `<div class="ruler ruler-top" style="transform:translateY(${r1((t - 1) * 100)}%)"><svg width="${W}" height="${RULER}">${u}</svg></div><div class="ruler ruler-left" style="transform:translateX(${r1((t - 1) * 100)}%)"><svg width="${RULER}" height="${H}">${a}</svg></div><div class="ruler-corner" style="opacity:${r1(t)}"></div>`;
    }
    function render() {
      syncWorld();
      if (E.items) for (const it of E.items) drawItem(it);
      drawOverlay();
      drawCursors();
      drawRulers();
    }

    // ── 상태 표시줄 ──
    let dotsKey = '';
    function hud() {
      if (!E.ready || A.complete) return;
      const crew = E.cursors.filter(c => c.worked).length + E.retired, total = E.tasks.length, done = E.doneCount;
      if (!E.started) V.status.innerHTML = `커서 <b>${E.cursors.length}</b>개 준비<span class="sep"></span>레이어 ${total.toLocaleString()}개`;
      else {
        const below = E.tasks.some(t => t.state === 'wait' && t.layer === 'world' && t.gate > E.frontier);
        V.status.innerHTML = `커서 <b>${crew}</b>개<span class="sep"></span><b>${done.toLocaleString()}</b> / ${total.toLocaleString()} 레이어` + (below && !A.tour && backlog() === 0 ? '<span class="sep"></span>스크롤하면 계속 짓습니다' : '');
      }
      V.bar.style.width = total ? `${done / total * 100}%` : '0%';
      const busy = E.cursors.filter(c => c.task).slice(-5), k = busy.map(c => c.id).join(',');
      if (k !== dotsKey) { dotsKey = k; V.dots.innerHTML = busy.map(c => `<i style="background:${c.color}" title="${c.name}">${c.name[0]}</i>`).join(''); }
    }
    function onComplete() {
      A.complete = true;
      A.tour = false;
      const crew = E.cursors.filter(c => c.worked).length + E.retired;
      V.status.innerHTML = `커서 <b>${crew}</b>개가 <b>${(E.endTime - E.startTime).toFixed(1)}초</b> 만에 완성`;
      V.bar.style.width = '100%';
      V.dots.innerHTML = '';
      $('[data-a="live"]').hidden = false;
      $('[data-a="replay"]').hidden = false;
      $('[data-a="tour"]').hidden = true;
      $('[data-a="speed"]').hidden = true;
    }
    // 둘러보기: 할 일이 적으면 내려가고, 밀리면 늦추거나 멈춘다
    function tourStep(dt) {
      if (!E.started) return;
      const maxY = Math.max(root.scrollHeight, document.body.scrollHeight) - innerHeight;
      if (scrollY >= maxY - 1) { A.tourV = 0; return; }
      const crew = Math.max(MIN_CREW, E.cursors.filter(c => !c.leaving).length), n = backlog();
      const target = n <= Math.max(4, crew * .6) ? 230 : n <= crew * 1.5 ? 80 : 0;
      A.tourV += (target - A.tourV) * Math.min(1, dt * 2.5);
      A.tourAcc += A.tourV * dt;
      if (A.tourAcc >= 1) { const d = Math.floor(A.tourAcc); A.tourAcc -= d; scrollBy({ top: d, behavior: 'instant' }); }
    }

    // ── 입력 ──
    const offs = [];
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
    on(window, 'scroll', () => { if (!frozen) syncWorld(); }, { passive: true });
    on(window, 'resize', () => { W = innerWidth; H = innerHeight; });
    on(window, 'wheel', () => { if (E.ready) beginBuild(); }, { passive: true });
    on(window, 'touchmove', () => { if (E.ready) beginBuild(); }, { passive: true });
    on(window, 'pointermove', e => { E.mouse = { x: e.clientX, y: e.clientY }; }, { passive: true });
    on(root, 'pointerleave', () => { E.mouse = null; });
    on(window, 'keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); stop(false); } }, true);
    on(V.hud, 'click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'close') stop(false);
      else if (a === 'live') stop(true);
      else if (a === 'replay') restart();
      else if (a === 'tour') { A.tour = !A.tour; b.classList.toggle('on', A.tour); b.textContent = A.tour ? '둘러보는 중' : '둘러보기'; if (A.tour) beginBuild(); }
      else if (a === 'speed') { A.speed = A.speed === 3 ? 1 : A.speed + 1; b.textContent = A.speed + '×'; }
    });

    let raf = 0, last = performance.now(), hudT = 0;
    function loop(now) {
      if (A.dead) return;
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      try {
        step(dt);
        if (A.tour) tourStep(dt);
        render();
        if (now - hudT > 200) { hudT = now; hud(); }
      } catch (err) { console.error('[intro]', err); }
      raf = requestAnimationFrame(loop);
    }

    // 페이지를 한 번 훑어 늦게 뜨는 그림과 등장 애니메이션을 깨운다
    async function scan() {
      const h = Math.max(root.scrollHeight, document.body.scrollHeight), y0 = scrollY;
      if (h <= innerHeight * 1.25) return;
      frozen = { ...vp() };
      const n = Math.min(28, Math.ceil(h / (innerHeight * .85)));
      for (let i = 1; i <= n && !A.dead; i++) { scrollTo({ top: Math.min(h, h / n * i), behavior: 'instant' }); await frame(); await sleep(30); }
      scrollTo({ top: y0, behavior: 'instant' });
      await frame();
      await sleep(750);
      scrollTo({ top: y0, behavior: 'instant' });
      frozen = null;
    }

    A.go = async () => {
      raf = requestAnimationFrame(loop);
      await frame();
      V.bg.classList.add('on');
      V.logo.classList.add('on');
      V.hud.classList.add('on');
      await sleep(520);
      if (A.dead) return;
      await scan();
      if (A.dead) return;
      try { await Promise.race([document.fonts.ready, sleep(1200)]); } catch (e) {}
      W = innerWidth; H = innerHeight;
      let m;
      try { m = blueprint(host, bg); } catch (err) { console.error('[intro] capture', err); m = { items: [], tasks: [], groups: [], guides: [], docW: 0, docH: 0 }; }
      if (A.dead) return;
      mount(m);
      Object.assign(E, { items: m.items, tasks: m.tasks, groups: m.groups, guides: m.guides, waiting: m.tasks.length, ready: true });
      const rest = 1500 - (performance.now() - A.t0);
      if (rest > 0) await sleep(rest);
      if (A.dead) return;
      beginBuild();
    };
    A.kill = () => { A.dead = true; cancelAnimationFrame(raf); offs.forEach(f => f()); shadow.innerHTML = ''; };
    A.destroy = reveal => {
      const end = () => {
        A.kill();
        host.style.cssText = '';
        root.classList.remove('intro-on');
      };
      if (reveal) {
        // 커서들이 흩어져 나간 뒤 덮개가 걷힌다
        E.releasing = true; E.flocking = true;
        for (const c of E.cursors) { c.gen = null; c.follow = false; }
        V.hud.classList.remove('on');
        setTimeout(() => { host.style.opacity = '0'; }, 450);
        setTimeout(end, 1150);
      } else {
        host.style.transition = 'opacity .25s ease';
        host.style.opacity = '0';
        A.dead = true;
        cancelAnimationFrame(raf);
        offs.forEach(f => f());
        setTimeout(end, 260);
      }
    };
    return A;
  }

  start();
}
