// 페이지 첫 방문 등장 효과: 흑백 커서 떼가 빈 페이지를 위에서부터 조립한다.
//
//  · 시작: 사이트 아이콘 주위를 돌다가 흩어지며 출발한다
//  · 칸: 십자 커서로 끌어 그리면 자리표시가 생기고, 놓으면 진짜 모습이 서서히 나타난다(그림은 위에서 아래로)
//  · 글자: 글상자를 끌어 놓고 한 자씩 친다. 큰 제목은 작게 친 뒤 단계적으로 키운다
//  · 안내선: 눈금자에서 안내선을 끌어내고, 조금 비켜 친 글자를 끌어다 선에 딱 붙인다
//  · 선: 펜 도구로 점을 찍어 긋는다
//  · 반복 칸: 앞 칸을 골라 복제해 끌어다 놓고(간격 치수 표시), 글자를 두 번 눌러 골라 새로 친다
//  · 스크롤: 저절로 천천히 내려가되 일이 밀리면 늦추거나 멈춘다. 직접 스크롤하면 커서 떼가 따라오고, 빨리 내릴수록 커서가 합류한다
//  · 끝: 커서들이 마우스 쪽으로 무리 지어 모였다가 흩어지고 덮개가 걷힌다
//  · 상태 표시줄: 작업 현황, 1×/2×/3× 속도, 자동 스크롤, 소리
//  · 소리: Web Audio 로 바로 합성(파일 없음). 타자·클릭, 칸이 놓일 때 E장조 5음 음계의 유리 피아노 음, 끝날 때 화음
//
// 동작은 Joel Califa 의 Swarm 과 그 확장(swarm-cursors)을 보고 따라 만들었고, 코드는 이 사이트에 맞게 새로 짰다.
//
// 사용: 페이지 head 에서 조건이 맞으면 html 에 intro-on 클래스를 붙이고, 본문 스크립트에서
//   runIntro({ key: 'games', steps: [...] })
// step = { sel, all, kind: 'block' | 'type' | 'paint', dir: 'y', fill, at, guide }
const root = document.documentElement;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const frame1 = () => new Promise(r => requestAnimationFrame(r));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const inOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const out = t => 1 - Math.pow(1 - t, 3);
const NS = 'http://www.w3.org/2000/svg';

const ICON = {
  arrow: '<svg viewBox="0 0 20 24" width="20" height="24"><path d="M2 1.5v18.2l4.9-4.6 3.4 7.4 3.2-1.5-3.4-7.3h6.6z" fill="#fff"/></svg>',
  ibeam: '<svg viewBox="0 0 20 24" width="20" height="24"><path d="M6 2h3l1 1 1-1h3v2h-2.5v16H14v2h-3l-1-1-1 1H6v-2h2.5V4H6z" fill="#fff"/></svg>',
  cross: '<svg viewBox="0 0 20 24" width="20" height="24" style="translate:-9px -9px"><path d="M9 0h2v8H9zM9 12h2v8H9zM0 9h8v2H0zM12 9h8v2h-8z" fill="#fff"/></svg>',
  dup: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M2 1.5v18.2l4.9-4.6 3.4 7.4 3.2-1.5-3.4-7.3h6.6z" fill="#fff"/><path d="M15 15h3v-3h2v3h3v2h-3v3h-2v-3h-3z" fill="#fff"/></svg>',
  pen: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M2 2l9 3 6 9-3 3-9-6zM7 7l3 3" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M14 17l3-3 5 5-3 3z" fill="#fff"/></svg>',
  move: '<svg viewBox="0 0 24 24" width="24" height="24" style="translate:-11px -11px"><path d="M12 1l4 4h-3v6h6V8l4 4-4 4v-3h-6v6h3l-4 4-4-4h3v-6H5v3l-4-4 4-4v3h6V5H8z" fill="#fff"/></svg>',
};

// ── 소리 ─────────────────────────────
// 타자는 기계식 키보드 같은 짧은 딸깍 + 낮은 퉁, 칸이 놓이면 E장조 5음 음계의 유리 피아노 음을 8분음표 박자에 맞춰 낸다.
// 큰 칸은 낮게, 작은 칸은 높게, 왼쪽에서 오른쪽으로 갈수록 높아지고 커서 위치로 좌우가 나뉜다.
class Sfx {
  constructor() {
    this.on = true;
    try { if (sessionStorage.getItem('btwt-sound') === 'off') this.on = false; } catch (e) {}
    this.ctx = null;
  }
  get ready() { return this.on && this.ctx && this.ctx.state === 'running'; }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.out = this.ctx.createGain(); this.out.gain.value = .55;
    const comp = this.ctx.createDynamicsCompressor();
    this.out.connect(comp).connect(this.ctx.destination);
    const n = this.ctx.sampleRate * .05, buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
  }
  resume() { this.init(); return this.ctx?.resume(); }
  pan(x, w) { const p = this.ctx.createStereoPanner(); p.pan.value = clamp((x / w) * 2 - 1, -1, 1) * .6; p.connect(this.out); return p; }
  tick(x, w, f, len, vol) {
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = f;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    s.connect(hp).connect(g).connect(this.pan(x, w)); s.start(t); s.stop(t + len + .01);
  }
  thock(x, w, f0, f1, vol) {
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + .04);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
    o.connect(g).connect(this.pan(x, w)); o.start(t); o.stop(t + .06);
  }
  key(x, w, space) { if (!this.ready) return; this.tick(x, w, 2400 + rand(-300, 300), .025, .09); this.thock(x, w, space ? 110 : 170, space ? 60 : 90, space ? .1 : .06); }
  press(x, w) { if (!this.ready) return; this.tick(x, w, 3000, .02, .07); setTimeout(() => this.ready && this.tick(x, w, 3600, .015, .05), 70); }
  snap(x, w) { if (!this.ready) return; this.tick(x, w, 5000, .015, .12); }
  grow(k, x, w) { if (!this.ready) return; this.note(600 * Math.pow(2, k / 12), x, w, .03, .12, false); }
  note(f, x, w, vol = .05, len = 1.6, grid = true) {
    const c = this.ctx;
    const step = 60 / 112 / 2;
    const t = grid ? Math.ceil((c.currentTime + .01) / step) * step : c.currentTime;
    const g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 4200;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    g.connect(lp).connect(this.pan(x, w));
    for (const [m, v] of [[1, 1], [2.003, .35], [3.01, .12]]) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine'; o.frequency.value = f * m; og.gain.value = v;
      o.connect(og).connect(g); o.start(t); o.stop(t + len + .05);
    }
  }
  // 칸이 놓였을 때: 큰 칸 낮게, 작은 칸 높게, 왼쪽→오른쪽 높아짐. 드문드문만 울린다
  place(r, W, H, kind) {
    if (!this.ready || Math.random() > (kind === 'text' ? .35 : .6)) return;
    const PENTA = [0, 2, 4, 7, 9];
    const area = clamp((r.w * r.h) / (W * H), 0, 1);
    const oct = area > .25 ? 0 : area > .05 ? 1 : 2;
    const i = Math.floor(clamp((r.x + r.w / 2) / W, 0, .999) * PENTA.length);
    this.note(164.81 * Math.pow(2, oct + PENTA[i] / 12), r.x + r.w / 2, W, kind === 'dup' ? .04 : .05);
  }
  swell(w) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(1600, t + 1.2);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + .5); g.gain.exponentialRampToValueAtTime(.0001, t + 1.4);
    s.connect(bp).connect(g).connect(this.pan(w / 2, w)); s.start(t); s.stop(t + 1.5);
  }
  arp(w) { if (!this.ready) return; [0, 4, 7, 12, 16].forEach((s, i) => setTimeout(() => this.ready && this.note(329.63 * Math.pow(2, s / 12), w * (.2 + i * .15), w, .04, 1, false), i * 70)); }
  chord(w) { if (!this.ready) return; [164.81, 246.94, 329.63, 415.3].forEach((f, i) => this.note(f, w * (.3 + i * .13), w, .045, 3, false)); }
  fall(w) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(180, t + .6);
    g.gain.setValueAtTime(.04, t); g.gain.exponentialRampToValueAtTime(.0001, t + .65);
    o.connect(g).connect(this.pan(w / 2, w)); o.start(t); o.stop(t + .7);
  }
}

export const introWanted = () => root.classList.contains('intro-on');

export async function runIntro({ key, steps }) {
  const ov = document.getElementById('intro');
  if (!ov || !introWanted()) return;
  let done = false, raf = 0;
  const base = getComputedStyle(document.body).backgroundColor;
  const sfx = new Sfx();
  let speedMul = 1, tourOn = true;

  function finish(fast) {
    if (done) return;
    done = true;
    try { sessionStorage.setItem('btwt-intro-' + key, '1'); } catch (e) {}
    ov.style.transition = `opacity ${fast ? 200 : 500}ms ease`;
    ov.style.opacity = '0';
    root.classList.remove('intro-on');
    setTimeout(() => {
      cancelAnimationFrame(raf);
      ov.remove();
      if (!fast) scrollTo({ top: 0, behavior: 'smooth' });
    }, fast ? 210 : 650);
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') finish(true); });
  const startW = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - startW) > 40) finish(true); });

  // 나중에 불러오는 이미지를 미리 불러 와서 높이가 바뀌지 않게 하고, 글꼴이 준비된 뒤 위치를 잰다
  scrollTo({ top: 0, behavior: 'instant' });
  document.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
  const imgs = [...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; }));
  await Promise.race([Promise.all([document.fonts?.ready || Promise.resolve(), ...imgs]), sleep(900)]);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (done) return;

  const W = innerWidth, H = innerHeight;
  const D = Math.max(document.documentElement.scrollHeight, H);
  const mob = W <= 720;
  const box = el => {
    const r = el.getBoundingClientRect();
    const x = Math.max(0, r.left), y = r.top + scrollY;
    return { x, y, w: Math.min(W, r.right) - x, h: r.height };
  };
  // 단계 펼치기: all 이면 첫 요소가 원본, 나머지는 원본을 복제해서 만든다
  const plan = [];
  for (const s of steps) {
    const els = (s.all ? [...document.querySelectorAll(s.sel)] : [document.querySelector(s.sel)]).filter(Boolean);
    let master = null;
    els.forEach((el, gi) => {
      const it = { ...s, el, gi, r: box(el), done: false };
      if (it.r.w <= 4 || it.r.h <= 4) return;
      if (s.all) { if (!master) master = it; else it.master = master; }
      plan.push(it);
    });
  }
  const head = plan.filter(s => s.at != null);
  const tour = plan.filter(s => s.at == null).sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x);
  let doneCount = 0;

  // 층: 그림(바탕 + 구멍) → 복제본 → 조작 표시(커서·상자, 차이 혼합) → 상태 표시줄
  ov.style.position = 'absolute';
  ov.style.height = D + 'px';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'intro-paint');
  svg.setAttribute('width', W); svg.setAttribute('height', D);
  svg.innerHTML = `<defs><mask id="introMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${D}"><rect width="${W}" height="${D}" fill="#fff"/></mask></defs>
    <g mask="url(#introMask)" id="introPaint"><rect width="${W}" height="${D}" fill="${base}"/></g>`;
  ov.prepend(svg);
  ov.style.background = 'transparent';
  const clones = document.createElement('div');
  clones.className = 'intro-clones';
  svg.after(clones);
  const mask = svg.querySelector('#introMask');
  const paint = svg.querySelector('#introPaint');
  const ui = ov.querySelector('.intro-ui');
  const make = (cls, parent = ui) => { const d = document.createElement('div'); d.className = cls; parent.append(d); return d; };
  const place = (el, r) => { el.style.transform = `translate(${r.x}px,${r.y}px)`; el.style.width = Math.max(0, r.w) + 'px'; el.style.height = Math.max(0, r.h) + 'px'; };
  const setRect = (el, r) => { el.setAttribute('x', r.x); el.setAttribute('y', r.y); el.setAttribute('width', Math.max(0, r.w)); el.setAttribute('height', Math.max(0, r.h)); };
  const hole = r => { const h = document.createElementNS(NS, 'rect'); h.setAttribute('fill', '#000'); setRect(h, r); mask.append(h); return h; };
  function fadeIn(r, ms = 320) {
    hole(r);
    const v = make('intro-veil', clones);
    v.style.background = base;
    place(v, r);
    v.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms / tempo, easing: 'ease-out', fill: 'forwards' }).finished.then(() => v.remove());
  }
  function selBox(r, { handles = true, badge = true, ph = '' } = {}) {
    const b = make('intro-box' + (handles ? ' sel' : '') + (ph ? ' ' + ph : ''));
    if (handles) b.innerHTML = '<i></i><i></i><i></i><i></i>';
    const t = badge ? make('intro-badge') : null;
    const set = rr => {
      place(b, rr);
      if (t) { t.textContent = `${Math.round(rr.w)} × ${Math.round(rr.h)}`; t.style.transform = `translate(${clamp(rr.x + rr.w / 2 - 34, 4, W - 90)}px,${rr.y + rr.h + 8}px)`; }
    };
    set(r);
    return { set, remove: () => { b.remove(); t?.remove(); } };
  }
  function ping(x, y) {
    const p = make('intro-ping');
    p.style.transform = `translate(${x}px,${y}px)`;
    p.animate([{ scale: .2, opacity: 1 }, { scale: 1, opacity: 0 }], { duration: 380, easing: 'ease-out' }).finished.then(() => p.remove());
  }
  function measure() {
    const line = make('intro-meas'), label = make('intro-badge');
    return {
      set(a, b) {
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        let g = null;
        if (oy > 0) {
          const [l, rr] = a.x < b.x ? [a, b] : [b, a];
          const gap = rr.x - (l.x + l.w), y = Math.max(a.y, b.y) + oy / 2;
          if (gap > 2) g = { x: l.x + l.w, y, w: gap, h: 1, n: gap };
        } else if (ox > 0) {
          const [t, bt] = a.y < b.y ? [a, b] : [b, a];
          const gap = bt.y - (t.y + t.h), x = Math.max(a.x, b.x) + ox / 2;
          if (gap > 2) g = { x, y: t.y + t.h, w: 1, h: gap, n: gap };
        }
        line.hidden = label.hidden = !g;
        if (!g) return;
        place(line, g);
        label.textContent = Math.round(g.n);
        label.style.transform = `translate(${g.x + g.w / 2 + 6}px,${g.y + g.h / 2 - 9}px)`;
      },
      remove() { line.remove(); label.remove(); },
    };
  }
  // 원본 요소를 같은 자리에 복제한다. 조상 클래스를 껍데기로 붙여서 선택자 스타일이 그대로 먹게 한다
  function cloneAt(el) {
    const r = el.getBoundingClientRect();
    const host = make('intro-clone', clones);
    let cur = host;
    const chain = [];
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) chain.unshift(p);
    for (const a of chain) {
      const s = a.cloneNode(false);
      s.removeAttribute('id');
      s.style.cssText = 'display:block;position:static;margin:0;padding:0;border:0;background:none;width:auto;height:auto;min-height:0;max-width:none;overflow:visible;transform:none;clip-path:none;box-shadow:none;container-type:normal';
      cur.append(s); cur = s;
    }
    const n = el.cloneNode(true);
    n.removeAttribute('id');
    n.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    n.querySelectorAll('iframe,model-viewer,script').forEach(x => x.remove());
    Object.assign(n.style, { margin: '0', width: r.width + 'px', height: r.height + 'px', boxSizing: 'border-box', maxWidth: 'none', position: 'relative' });
    cur.append(n);
    const x0 = r.left, y0 = r.top + scrollY;
    host.style.transform = `translate(${x0}px,${y0}px)`;
    return { host, n, move: (x, y) => { host.style.transform = `translate(${x}px,${y}px)`; } };
  }
  const textsOf = n => {
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT, { acceptNode: t => t.nodeValue.trim() ? 1 : 3 });
    const a = []; while (w.nextNode()) a.push(w.currentNode); return a;
  };

  // ── 상태 표시줄 ─────────────────────────────
  const hud = make('intro-hud', ov);
  hud.innerHTML = `<span class="st"></span>
    <span class="grp">${[1, 2, 3].map(v => `<button type="button" data-sp="${v}" aria-pressed="${v === 1}">${v}×</button>`).join('')}</span>
    <button type="button" data-a="tour" aria-pressed="true">자동 스크롤</button>
    <button type="button" data-a="snd"></button>`;
  const st = hud.querySelector('.st');
  const sndBtn = hud.querySelector('[data-a="snd"]');
  const renderSnd = () => { sndBtn.textContent = !sfx.on ? '소리 꺼짐' : sfx.ready ? '소리 켜짐' : '소리 켜기'; sndBtn.setAttribute('aria-pressed', String(sfx.ready)); };
  hud.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sp) { speedMul = +b.dataset.sp; hud.querySelectorAll('[data-sp]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }
    else if (b.dataset.a === 'tour') { tourOn = !tourOn; b.setAttribute('aria-pressed', String(tourOn)); }
    else if (b.dataset.a === 'snd') {
      if (sfx.ready) sfx.on = false; else { sfx.on = true; await sfx.resume(); }
      try { sessionStorage.setItem('btwt-sound', sfx.on ? 'on' : 'off'); } catch (er) {}
      renderSnd();
    }
  });
  // 브라우저는 처음 한 번 누르기 전까지 소리를 막는다. 아무 데나 한 번 누르면 켠다
  sfx.init();
  if (sfx.on) sfx.ctx?.resume().then(renderSnd, () => {});
  ov.addEventListener('pointerdown', e => { if (sfx.on && !e.target.closest('[data-a="snd"]')) sfx.resume()?.then(renderSnd); });
  addEventListener('keydown', () => { if (sfx.on) sfx.resume()?.then(renderSnd); }, { once: true });
  renderSnd();
  let mouse = null;
  addEventListener('pointermove', e => { mouse = { x: e.clientX, y: e.clientY }; }, { passive: true });

  // ── 커서 ─────────────────────────────
  const MAX = mob ? 12 : 20;
  const START_N = mob ? 8 : 12;
  const cx = W / 2, cy = H / 2;
  let tempo = 1;
  const cursors = [];
  function addCursor(fromEdge) {
    const el = make('intro-cur');
    el.innerHTML = ICON.arrow;
    const i = cursors.length;
    const a = Math.random() * Math.PI * 2, far = Math.hypot(W, H) * .6;
    const c = { el, shape: 'arrow', x: cx + Math.cos(a) * far, y: scrollY + cy + Math.sin(a) * far, vx: 0, vy: 0, tx: cx, ty: cy, mode: 'orbit', busy: false, next: 0, r: 46 + i * (mob ? 6 : 7), sp: .9 + (i % 3) * .25, ph: i / START_N * Math.PI * 2, hooks: [] };
    if (fromEdge) { c.x = Math.random() < .5 ? -30 : W + 30; c.y = scrollY + rand(H * .2, H * .8); c.mode = 'idle'; }
    cursors.push(c);
    return c;
  }
  for (let i = 0; i < START_N; i++) addCursor(false);
  const shape = (c, s) => { if (c.shape !== s) { c.shape = s; c.el.innerHTML = ICON[s]; } };

  // 시작: 사이트 아이콘 주위를 돈다
  const fav = document.querySelector('link[rel="icon"]')?.href;
  const logo = make('intro-logo', clones);
  logo.style.transform = `translate(${cx - 28}px,${cy - 28}px)`;
  if (fav) logo.innerHTML = `<img src="${fav}" alt="">`;
  logo.animate([{ opacity: 0, scale: .6 }, { opacity: 1, scale: 1 }], { duration: 400, easing: 'ease-out', fill: 'forwards' });
  sfx.swell(W);

  const t0 = performance.now();
  let flock = false;
  function frame(now) {
    const t = (now - t0) / 1000, sy = scrollY;
    for (const c of cursors) {
      if (c.mode === 'orbit') {
        c.tx = cx + Math.cos(t * c.sp + c.ph) * c.r;
        c.ty = sy + cy + Math.sin(t * c.sp + c.ph) * c.r * .8;
      } else if (c.mode === 'idle') {
        // 쉬는 커서는 지금 화면 안을 느긋하게 돌아다닌다
        if (now > c.next) { c.ix = rand(W * .17, W * .83); c.iy = rand(H * .2, H * .8); c.next = now + rand(900, 2400); }
        c.tx += (c.ix - c.tx) * .03; c.ty += (sy + c.iy - c.ty) * .03;
      } else if (c.mode === 'flock') {
        // 무리 짓기: 마우스(없으면 화면 가운데)를 향해 모이되 서로 부딪히지 않고 같은 방향으로 흐른다
        const goal = mouse ? { x: mouse.x, y: sy + mouse.y } : { x: cx, y: sy + cy };
        let ax = (goal.x - c.x) * .0025, ay = (goal.y - c.y) * .0025, avx = 0, avy = 0, n = 0;
        for (const o of cursors) {
          if (o === c) continue;
          const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy);
          if (d < 34 && d > 0) { ax += dx / d * .6; ay += dy / d * .6; }
          if (d < 120) { avx += o.vx; avy += o.vy; n++; }
        }
        if (n) { ax += (avx / n - c.vx) * .05; ay += (avy / n - c.vy) * .05; }
        // 마우스 바로 위는 피해서 둘레를 돈다
        const md = Math.hypot(c.x - goal.x, c.y - goal.y);
        if (md < 60) { ax += (c.x - goal.x) / md * .8; ay += (c.y - goal.y) / md * .8; }
        c.vx = clamp((c.vx + ax) * .96, -9, 9); c.vy = clamp((c.vy + ay) * .96, -9, 9);
        c.x += c.vx; c.y += c.vy; c.tx = c.x; c.ty = c.y;
      }
      if (c.mode === 'move') { c.vx = c.tx - c.x; c.vy = c.ty - c.y; c.x = c.tx; c.y = c.ty; }
      else if (c.mode !== 'flock') { const nx = c.x + (c.tx - c.x) * .2, ny = c.y + (c.ty - c.y) * .2; c.vx = nx - c.x; c.vy = ny - c.y; c.x = nx; c.y = ny; }
      c.el.style.transform = `translate(${c.x}px,${c.y}px)`;
      c.hooks.forEach(h => h());
    }
    if (now - (frame.hudT || 0) > 200) {
      frame.hudT = now;
      const workers = cursors.filter(c => c.busy).length;
      st.textContent = flock ? `완성 · ${plan.length}칸` : `커서 ${cursors.length}개 · 작업 중 ${workers} · ${doneCount}/${plan.length}칸`
        + (!tourOn && tour.some(s => !s.started) ? ' · 스크롤하면 계속 만듭니다' : '');
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // 곡선으로 움직인다: 거리가 멀수록 오래, 할 일이 많으면(tempo) 빨리
  function moveTo(c, x, y, o = {}) {
    const x0 = c.x, y0 = c.y, dist = Math.hypot(x - x0, y - y0);
    const dur = clamp(.12 + Math.sqrt(dist) * .021, .14, .9) / (o.speed || 1) / (tempo * speedMul) * 1000;
    const bend = (o.bend ?? (Math.random() < .5 ? -1 : 1) * rand(.04, .14)) * Math.min(dist, 600);
    c.mode = 'move';
    const s = performance.now();
    return new Promise(res => {
      const step = () => {
        if (done) return res();
        const k = Math.min(1, (performance.now() - s) / dur);
        const e = o.drag || k < .15 ? inOut(k) : out(k);
        const dx = x - x0, dy = y - y0, L = dist || 1, off = Math.sin(Math.PI * e) * bend;
        c.tx = x0 + dx * e + (-dy / L) * off;
        c.ty = y0 + dy * e + (dx / L) * off;
        o.onStep?.();
        if (k < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
  }
  const wait = ms => sleep(ms / (tempo * speedMul));
  async function click(c) {
    c.el.classList.add('down'); ping(c.x, c.y); sfx.press(c.x, W);
    await wait(70);
    c.el.classList.remove('down');
  }
  const placed = (r, kind) => sfx.place({ ...r, y: r.y - scrollY }, W, H, kind);

  // ── 눈금자와 안내선 ─────────────────────────────
  const rulers = make('intro-rulers');
  rulers.innerHTML = '<div class="rx"></div><div class="ry"></div>';
  let rulerWant = 0;
  // 눈금자에서 세로 안내선을 끌어내 글자 왼쪽 끝 자리에 놓는다
  async function dragGuide(c, gx, r) {
    rulerWant++; rulers.classList.add('on');
    const gl = make('intro-guide');
    const top = r.y - Math.min(240, H * .3), h = r.h + Math.min(480, H * .6);
    place(gl, { x: 10, y: top, w: 1, h }); gl.style.opacity = 0;
    try {
      await moveTo(c, 10, scrollY + H * rand(.35, .55));
      if (done) return gl;
      c.el.classList.add('down'); sfx.press(c.x, W);
      shape(c, 'move');
      gl.style.opacity = 1;
      await moveTo(c, gx, c.y, { drag: true, bend: 0, speed: .7, onStep: () => place(gl, { x: c.x, y: top, w: 1, h }) });
      place(gl, { x: gx, y: top, w: 1, h });
      c.el.classList.remove('down');
      shape(c, 'arrow');
    } finally {
      rulerWant--;
      setTimeout(() => { if (!rulerWant) rulers.classList.remove('on'); }, 700);
    }
    return gl;
  }

  // ── 동작들 ─────────────────────────────
  async function drawBox(c, s, ph = 'ph') {
    const r = s.r;
    shape(c, 'cross');
    await moveTo(c, r.x, r.y);
    if (done) return;
    c.el.classList.add('down'); sfx.press(c.x, W);
    const b = selBox({ ...r, w: 0, h: 0 }, { handles: false, ph });
    await moveTo(c, r.x + r.w, r.y + r.h, { speed: .75, drag: true, bend: 0, onStep: () => b.set({ x: r.x, y: r.y, w: Math.max(0, c.x - r.x), h: Math.max(0, c.y - r.y) }) });
    c.el.classList.remove('down');
    shape(c, 'arrow');
    await wait(rand(180, 300));
    if (ph === 'hatch') {
      const h = hole({ ...r, h: 0 }), st0 = performance.now(), dur = 520 / (tempo * speedMul);
      await new Promise(res => { const f = () => { const k = done ? 1 : Math.min(1, (performance.now() - st0) / dur); setRect(h, { ...r, h: r.h * out(k) }); k < 1 ? requestAnimationFrame(f) : res(); }; f(); });
      placed(r, 'image');
    } else { fadeIn(r); placed(r, 'rect'); }
    await wait(300);
    b.remove();
  }
  async function twin(c, s) {
    const h = cursors.find(x => !x.busy && x !== c && x.mode !== 'orbit');
    if (!h) return drawBox(c, s);
    h.busy = true;
    const r = s.r, mx = r.x + r.w / 2, my = r.y + r.h / 2;
    shape(c, 'cross'); shape(h, 'cross');
    await Promise.all([moveTo(c, mx - 2, my - 2), moveTo(h, mx + 2, my + 2)]);
    if (!done) {
      c.el.classList.add('down'); h.el.classList.add('down'); sfx.press(mx, W);
      const b = selBox({ x: mx, y: my, w: 0, h: 0 }, { handles: false, ph: 'ph' });
      const upd = () => b.set({ x: Math.min(c.x, h.x), y: Math.min(c.y, h.y), w: Math.abs(h.x - c.x), h: Math.abs(h.y - c.y) });
      await Promise.all([moveTo(c, r.x, r.y, { drag: true, bend: 0, speed: .7, onStep: upd }), moveTo(h, r.x + r.w, r.y + r.h, { drag: true, bend: 0, speed: .7, onStep: upd })]);
      c.el.classList.remove('down'); h.el.classList.remove('down');
      shape(c, 'arrow'); shape(h, 'arrow');
      await wait(200);
      fadeIn(r); placed(r, 'rect');
      await wait(300);
      b.remove();
    }
    h.mode = 'idle'; h.busy = false;
  }
  async function pen(c, s) {
    const r = s.r, y = r.y + r.h - 1;
    shape(c, 'pen');
    await moveTo(c, r.x, y);
    if (done) return;
    await click(c);
    const a1 = make('intro-anchor'); a1.style.transform = `translate(${r.x}px,${y}px)`;
    const line = make('intro-line');
    await moveTo(c, r.x + r.w, y, { bend: rand(-.03, .03), onStep: () => place(line, { x: r.x, y, w: c.x - r.x, h: 1 }) });
    await click(c);
    const a2 = make('intro-anchor'); a2.style.transform = `translate(${r.x + r.w}px,${y}px)`;
    shape(c, 'arrow');
    await moveTo(c, c.x + rand(14, 30), c.y + rand(10, 24), { speed: 1.4 });
    fadeIn(r); placed(r, 'line');
    await wait(300);
    a1.remove(); a2.remove(); line.remove();
  }
  // 한 글자씩 친다. 칠 때마다 커서와 깜박이는 막대가 따라간다
  async function typeNodes(c, nodes, full, budgetMs) {
    const caret = make('intro-caret'), rg = document.createRange();
    const total = full.join('').length || 1;
    const per = clamp(budgetMs / total, 14, 55);
    for (let i = 0; i < nodes.length && !done; i++) {
      for (const ch of full[i]) {
        if (done) break;
        nodes[i].nodeValue += ch;
        rg.setStart(nodes[i], Math.max(0, nodes[i].nodeValue.length - 1)); rg.setEnd(nodes[i], nodes[i].nodeValue.length);
        const cr = rg.getBoundingClientRect();
        place(caret, { x: cr.right, y: cr.top + scrollY, w: 2, h: cr.height || 16 });
        c.tx = cr.right + 8; c.ty = cr.top + scrollY + (cr.height || 16) * .7; c.mode = 'move';
        sfx.key(c.x, W, ch === ' ');
        let d = per * rand(.5, 1.5) * (ch === ' ' ? 1.6 : 1);
        if (Math.random() < .025) d += rand(80, 200);
        await sleep(d / (tempo * speedMul));
      }
    }
    caret.remove();
  }
  async function typeIn(c, s) {
    const r = s.r;
    const fs = parseFloat(getComputedStyle(s.el).fontSize) || 16;
    const grow = fs > 30;
    // 안내선을 쓸 제목: 먼저 선을 끌어내고, 글자는 조금 비켜 쳤다가 나중에 선에 붙인다
    const useGuide = s.guide ?? (grow && Math.random() < .55);
    let gl = null, dx = 0;
    if (useGuide) { gl = await dragGuide(c, r.x, r); dx = rand(28, 64); if (done) return; }
    const cl = cloneAt(s.el);
    const nodes = textsOf(cl.n);
    const full = nodes.map(t => t.nodeValue);
    nodes.forEach(t => { t.nodeValue = ''; });
    cl.n.style.transformOrigin = '0 0';
    if (grow) cl.n.style.scale = String(Math.min(1, 18 / fs));
    if (dx) cl.move(r.x + dx, r.y);
    shape(c, 'cross');
    await moveTo(c, r.x + dx, r.y);
    if (done) return;
    c.el.classList.add('down'); sfx.press(c.x, W);
    const lh = Math.min(r.h, (grow ? 18 / fs : 1) * fs * 1.3);
    const b = selBox({ x: r.x + dx, y: r.y, w: 0, h: 0 }, { handles: false });
    await moveTo(c, r.x + dx + r.w * (grow ? .45 : 1), r.y + lh, { speed: .9, drag: true, bend: 0, onStep: () => b.set({ x: r.x + dx, y: r.y, w: Math.max(0, c.x - r.x - dx), h: Math.max(0, c.y - r.y) }) });
    c.el.classList.remove('down');
    b.remove();
    shape(c, 'ibeam');
    await typeNodes(c, nodes, full, 1100);
    shape(c, 'arrow');
    placed(r, 'text');
    if (grow && !done) {
      const sizes = [24, 32, 40, 48, 56, 64, 72, 88, 104].filter(v => v > 18 && v < fs).concat(fs);
      const sel = selBox({ x: r.x + dx, y: r.y, w: r.w, h: r.h }, { handles: true });
      let k = 0;
      for (const v of sizes) { if (done) break; cl.n.style.scale = String(v / fs); sel.set({ x: r.x + dx, y: r.y, w: r.w * v / fs, h: r.h * v / fs }); sfx.grow(k++, c.x, W); await wait(60); }
      await wait(150);
      sel.remove();
    }
    if (gl && !done) {
      // 글자를 잡아 왼쪽으로 끌어 안내선에 붙인다
      const ax = r.x + dx + Math.min(r.w * .3, 60), ay = r.y + Math.min(r.h * .5, 22);
      await moveTo(c, ax, ay);
      c.el.classList.add('down'); shape(c, 'move');
      let snapped = false;
      await moveTo(c, ax - dx - rand(2, 5), ay, {
        speed: .6, drag: true, onStep: () => {
          let off = c.x - (ax - dx);
          if (Math.abs(off) < 9) { if (!snapped) { snapped = true; gl.classList.add('flash'); sfx.snap(c.x, W); } off = 0; }
          cl.move(r.x + off, r.y);
        },
      });
      cl.move(r.x, r.y);
      c.el.classList.remove('down'); shape(c, 'arrow');
      await wait(220);
      gl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: 600, fill: 'forwards' }).finished.then(() => gl.remove());
    } else gl?.remove();
    hole(r);
    await frame1();
    cl.host.remove();
  }
  async function duplicate(c, s) {
    const m = s.master, mr = m.r, r = s.r;
    shape(c, 'arrow');
    const u = { x: mr.x + Math.min(mr.w * .45, 70) + rand(-8, 8), y: mr.y + Math.min(mr.h * .45, 30) + rand(-4, 4) };
    await moveTo(c, u.x, u.y);
    if (done) return;
    await click(c);
    const sel = selBox(mr);
    await wait(rand(150, 280));
    shape(c, 'dup');
    await wait(120);
    c.el.classList.add('down');
    const ghost = cloneAt(m.el);
    const meas = measure();
    const ox = r.x - mr.x, oy = r.y - mr.y;
    await moveTo(c, u.x + ox, u.y + oy, {
      speed: .6, drag: true,
      onStep: () => {
        const gx = mr.x + (c.x - u.x), gy = mr.y + (c.y - u.y);
        ghost.move(gx, gy);
        sel.set({ x: gx, y: gy, w: mr.w, h: mr.h });
        meas.set(mr, { x: gx, y: gy, w: mr.w, h: mr.h });
      },
    });
    ghost.move(r.x, r.y);
    c.el.classList.remove('down');
    ping(c.x, c.y);
    meas.remove();
    shape(c, 'arrow');
    sel.set(r);
    placed(r, 'dup');
    await wait(200);
    const same = m.el.textContent.trim() === s.el.textContent.trim();
    if (!same && !done) {
      // 두 번 눌러 글자를 고르고 새로 친다. 그림이 다르면 바로 바뀐다
      await click(c); await wait(60); await click(c);
      const cl = cloneAt(s.el);
      cl.host.style.visibility = 'hidden';
      const nodes = textsOf(cl.n);
      const full = nodes.map(t => t.nodeValue);
      let k = 0; full.forEach((v, i) => { if (v.trim().length > full[k].trim().length) k = i; });
      const gNodes = textsOf(ghost.n);
      const gk = gNodes.reduce((bi, n, i) => n.nodeValue.trim().length > (gNodes[bi]?.nodeValue.trim().length || 0) ? i : bi, 0);
      if (gNodes[gk]) {
        const rg = document.createRange(); rg.selectNodeContents(gNodes[gk]);
        const hr = rg.getBoundingClientRect();
        const hl = make('intro-hl'); place(hl, { x: hr.left, y: hr.top + scrollY, w: hr.width, h: hr.height });
        await wait(rand(180, 320));
        hl.remove();
      }
      ghost.host.remove();
      cl.host.style.visibility = '';
      const target = nodes[k];
      if (target) {
        target.nodeValue = '';
        shape(c, 'ibeam');
        await typeNodes(c, [target], [full[k]], 700);
        shape(c, 'arrow');
      }
      hole(r);
      await frame1();
      cl.host.remove();
    } else {
      await wait(200);
      hole(r);
      await frame1();
      ghost.host.remove();
    }
    sel.remove();
  }
  async function paintRect(c, s) {
    const r = s.r;
    shape(c, 'cross');
    await moveTo(c, r.x, r.y);
    if (done) return;
    c.el.classList.add('down'); sfx.press(c.x, W);
    const b = selBox({ ...r, w: 0, h: 0 }, { handles: false });
    await moveTo(c, r.x + r.w, r.y + r.h, { speed: .75, drag: true, bend: 0, onStep: () => b.set({ x: r.x, y: r.y, w: Math.max(0, c.x - r.x), h: Math.max(0, c.y - r.y) }) });
    c.el.classList.remove('down');
    shape(c, 'arrow');
    const f = document.createElementNS(NS, 'rect');
    f.setAttribute('fill', s.fill); setRect(f, r); paint.append(f);
    f.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'forwards' });
    placed(r, 'rect');
    await wait(260);
    b.remove();
  }

  let rot = 0;
  async function run(c, s) {
    c.busy = true; s.started = true;
    const r = s.r;
    const media = s.el.matches('img,video,iframe,canvas,model-viewer') || s.el.querySelector('img,iframe,model-viewer,video,canvas');
    try {
      if (s.kind === 'paint') await paintRect(c, s);
      else if (s.kind === 'type') await typeIn(c, s);
      else if (s.master) await duplicate(c, s);
      else if (media || s.dir === 'y' && r.h > 200) await drawBox(c, s, 'hatch');
      else if (r.h <= 60 && r.w >= 140) await pen(c, s);
      else await [drawBox, twin, drawBox][rot++ % 3](c, s);
    } catch (e) { hole(r); }
    s.done = true; doneCount++;
    c.mode = 'idle'; c.next = 0; c.busy = false;
  }

  // 1) 시작: 아이콘 주위를 돌다가 흩어진다. 첫 화면은 시각에 맞춰 만든다
  await sleep(700);
  if (done) return;
  logo.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 1.6 }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
  sfx.arp(W);
  for (const c of cursors) {
    // 바깥으로 한 번 퍼졌다가 일하러 간다
    const a = Math.atan2(c.y - scrollY - cy, c.x - cx);
    moveTo(c, cx + Math.cos(a) * rand(160, 280), scrollY + cy + Math.sin(a) * rand(110, 200), { speed: 1.2 }).then(() => { if (!c.busy) { c.mode = 'idle'; c.next = 0; } });
  }
  const owner = new Map();
  let nx = 0;
  const firstJobs = head.map(s => {
    if (!owner.has(s.sel)) owner.set(s.sel, cursors[nx++ % cursors.length]);
    const c = owner.get(s.sel);
    return sleep(Math.max(0, s.at - 700)).then(() => done ? null : run(c, s));
  });
  await Promise.all(firstJobs);
  if (done) return;

  // 2) 스크롤: 화면 아래 경계(frontier)까지 온 칸만 일감이 된다.
  //    자동 스크롤은 할 일이 적으면 내려가고, 밀리면 늦추거나 멈춘다.
  //    직접 스크롤하면 잠시 자동을 멈추고 따라가며, 빨리 내릴수록 커서가 합류한다.
  const maxScroll = Math.max(0, D - H);
  const SPEED = mob ? 170 : 220;
  const running = [];
  let ti = 0, pos = scrollY, last = performance.now(), vel = 0, frontier = pos + H, prevY = scrollY, sv = 0, userAt = -1e9, joinAt = 0;
  const pending = [];
  await new Promise(res => {
    const tick = now => {
      if (done) return res();
      const dt = Math.min(.25, (now - last) / 1000); last = now;
      const y = scrollY;
      if (Math.abs(y - Math.round(pos)) > 3) { userAt = now; pos = y; }
      sv = sv * .8 + (Math.abs(y - prevY) / Math.max(dt, .001)) * .2; prevY = y;
      frontier = Math.max(frontier, y + H * .92);
      while (ti < tour.length && tour[ti].r.y < frontier) pending.push(tour[ti++]);
      const avail = pending.filter(s => !s.started && (!s.master || s.master.done));
      const backlog = pending.filter(s => !s.done).length;
      tempo = clamp(1.15 + sv / 900 + (avail.length / cursors.length) * .5, 1.15, 2.4);
      // 빨리 내리면 화면 옆에서 커서가 합류한다
      if (sv > 900 && now > joinAt && cursors.length < MAX) { addCursor(true); joinAt = now + 260; }
      // 쉬는 커서에게 화면 안에서 가까운 일부터 준다
      for (const c of cursors) {
        if (c.busy || c.mode === 'orbit') continue;
        let best = null, bs = Infinity;
        for (const s of avail) {
          if (s.started) continue;
          const sy2 = s.r.y, inView = sy2 >= y - 40 && sy2 <= y + H;
          const sc = (inView ? 0 : sy2 < y ? 1e6 : 2e6) + Math.abs(sy2 - y) * .6 + Math.abs(sy2 - c.y) * .4;
          if (sc < bs) { bs = sc; best = s; }
        }
        if (!best) break;
        running.push(run(c, best));
      }
      const userActive = now - userAt < 2500;
      const want = !tourOn || userActive ? 0 : backlog <= Math.max(4, cursors.length * .6) ? SPEED : backlog <= cursors.length * 1.5 ? SPEED * .35 : 0;
      vel += (want - vel) * Math.min(1, dt * 2.5);
      if (!userActive && pos < maxScroll && vel > 1) {
        pos = Math.min(maxScroll, pos + vel * dt);
        scrollTo({ top: pos, behavior: 'instant' });
      }
      if (ti >= tour.length && pending.every(s => s.done)) return res();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await Promise.all(running);
  if (done) return;

  // 3) 끝: 화음과 함께 커서들이 마우스 쪽으로 무리 지어 모였다가 흩어지고 덮개가 걷힌다
  tempo = 1;
  sfx.chord(W);
  flock = true;
  for (const c of cursors) { c.vx = rand(-3, 3); c.vy = rand(-3, 3); c.mode = 'flock'; shape(c, 'arrow'); }
  await sleep(1800);
  if (done) return;
  sfx.fall(W);
  const sy = scrollY;
  for (const c of cursors) {
    const a = Math.atan2(c.y - sy - cy, c.x - cx) + (Math.random() - .5) * .6, far = Math.hypot(W, H);
    moveTo(c, cx + Math.cos(a) * far, sy + cy + Math.sin(a) * far, { speed: .8 });
  }
  await sleep(450);
  finish(false);
}
