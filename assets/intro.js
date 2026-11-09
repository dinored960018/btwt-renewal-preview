// 페이지 첫 방문 등장 효과: 흑백 커서 여러 개가 빈 화면에서 그 페이지의 첫 화면을 조립한다.
// 바탕색 덮개 위에 커서가 칸을 그리면 그 자리의 실제 화면이 드러나고, 끝나면 덮개가 걷힌다.
//
// 사용: 페이지 head 에서 조건이 맞으면 html 에 intro-on 클래스를 붙이고, 본문 스크립트에서
//   runIntro({ key: 'games', steps: [...] })
// step = { at: 시작 ms, sel: 선택자, kind: 'block' | 'type' | 'paint', dir: 'x' | 'y', fill: 칠할 색, n: 글자 수 }
const root = document.documentElement;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const NS = 'http://www.w3.org/2000/svg';

const ARROW = '<svg viewBox="0 0 20 24" width="20" height="24" aria-hidden="true"><path d="M2 1.5v18.2l4.9-4.6 3.4 7.4 3.2-1.5-3.4-7.3h6.6z" fill="#fff"/></svg>';
const IBEAM = '<svg viewBox="0 0 20 24" width="20" height="24" aria-hidden="true"><path d="M6 2h3l1 1 1-1h3v2h-2.5v16H14v2h-3l-1-1-1 1H6v-2h2.5V4H6z" fill="#fff"/></svg>';

export const introWanted = () => root.classList.contains('intro-on');

export async function runIntro({ key, steps }) {
  const ov = document.getElementById('intro');
  if (!ov || !introWanted()) return;
  let done = false, raf = 0;
  const base = getComputedStyle(document.body).backgroundColor;

  function finish(fast) {
    if (done) return;
    done = true;
    try { sessionStorage.setItem('btwt-intro-' + key, '1'); } catch (e) {}
    ov.style.transition = `opacity ${fast ? 200 : 450}ms ease`;
    ov.style.opacity = '0';
    root.classList.remove('intro-on');
    setTimeout(() => { cancelAnimationFrame(raf); ov.remove(); }, fast ? 210 : 460);
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') finish(true); });
  // 화면 폭이 바뀌면 잰 위치가 틀어지므로 바로 끝낸다 (모바일 주소창 높이 변화는 무시)
  const startW = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - startW) > 40) finish(true); });
  // 바로 스크롤하려는 사람은 막지 않는다
  ov.addEventListener('wheel', () => finish(true), { passive: true, once: true });
  ov.addEventListener('touchmove', () => finish(true), { passive: true, once: true });

  // 글꼴과 글자 맞춤이 끝난 뒤 실제 위치를 잰다
  scrollTo(0, 0);
  await Promise.race([document.fonts?.ready || Promise.resolve(), sleep(1200)]);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (done) return;

  const W = innerWidth, H = innerHeight;
  const mob = W <= 720;
  const box = el => {
    const r = el.getBoundingClientRect();
    const x = Math.max(0, r.left), y = Math.max(0, r.top);
    return { x, y, w: Math.min(W, r.right) - x, h: Math.min(H, r.bottom) - y };
  };
  const plan = steps
    .map(s => ({ ...s, el: document.querySelector(s.sel) }))
    .filter(s => s.el)
    .map(s => ({ ...s, r: box(s.el) }))
    .filter(s => s.r.w > 4 && s.r.h > 4);

  // 그림 층: 바탕색 + 커서가 칠한 면, 구멍으로 실제 화면이 보인다
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'intro-paint');
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.innerHTML = `<defs><mask id="introMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/></mask></defs>
    <g mask="url(#introMask)" id="introPaint"><rect width="${W}" height="${H}" fill="${base}"/></g>`;
  ov.prepend(svg);
  ov.style.background = 'transparent';
  const mask = svg.querySelector('#introMask');
  const paint = svg.querySelector('#introPaint');
  const setRect = (el, r) => { el.setAttribute('x', r.x); el.setAttribute('y', r.y); el.setAttribute('width', Math.max(0, r.w)); el.setAttribute('height', Math.max(0, r.h)); };
  const hole = () => { const r = document.createElementNS(NS, 'rect'); r.setAttribute('fill', '#000'); mask.append(r); return r; };

  // 조작 표시 층: 커서·선택 상자·치수 표시는 차이 혼합으로 흑백 어디서나 보인다
  const ui = ov.querySelector('.intro-ui');
  const make = cls => { const d = document.createElement('div'); d.className = cls; ui.append(d); return d; };

  const N = mob ? 8 : 12;
  const cx = W / 2, cy = H / 2;
  const cursors = Array.from({ length: N }, (_, i) => {
    const el = make('intro-cur');
    el.innerHTML = ARROW;
    const a = Math.random() * Math.PI * 2, far = Math.hypot(W, H) * .6;
    return { el, x: cx + Math.cos(a) * far, y: cy + Math.sin(a) * far, vx: 0, vy: 0, tx: cx, ty: cy, mode: 'orbit', r: 34 + i * (mob ? 7 : 9), sp: .9 + (i % 3) * .25, ph: i / N * Math.PI * 2, hooks: [] };
  });
  const t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000;
    for (const c of cursors) {
      if (c.mode === 'orbit') {
        c.tx = cx + Math.cos(t * c.sp + c.ph) * c.r;
        c.ty = cy + Math.sin(t * c.sp + c.ph) * c.r * .8;
      } else if (c.mode === 'hover') {
        c.tx = c.ax + Math.sin(t * 1.3 + c.ph) * 26;
        c.ty = c.ay + Math.cos(t * 1.1 + c.ph) * 18;
      }
      c.vx = (c.vx + (c.tx - c.x) * .14) * .7;
      c.vy = (c.vy + (c.ty - c.y) * .14) * .7;
      c.x += c.vx; c.y += c.vy;
      c.el.style.transform = `translate(${c.x}px,${c.y}px)`;
      c.hooks.forEach(h => h());
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function moveTo(c, x, y, dur = 450) {
    c.mode = 'move';
    const sx = c.tx, sy = c.ty, s = performance.now();
    return new Promise(res => {
      const step = () => {
        if (done) return res();
        const p = Math.min(1, (performance.now() - s) / dur), e = ease(p);
        c.tx = sx + (x - sx) * e; c.ty = sy + (y - sy) * e;
        if (p < 1) requestAnimationFrame(step); else setTimeout(res, 60);
      };
      step();
    });
  }
  const press = (c, on) => c.el.classList.toggle('down', on);

  // 십자 드래그로 칸을 그린다: 드래그하는 동안 선택 상자와 치수를 보여 준다
  async function drag(c, r, dur = 560) {
    await moveTo(c, r.x, r.y);
    if (done) return null;
    press(c, true);
    const sel = make('intro-box'), badge = make('intro-badge');
    const hook = () => {
      const w = Math.max(0, c.x - r.x), h = Math.max(0, c.y - r.y);
      sel.style.transform = `translate(${r.x}px,${r.y}px)`;
      sel.style.width = w + 'px'; sel.style.height = h + 'px';
      badge.textContent = `${Math.round(w)} × ${Math.round(h)}`;
      badge.style.transform = `translate(${Math.min(c.x + 14, W - 90)}px,${Math.min(c.y + 16, H - 24)}px)`;
    };
    c.hooks.push(hook);
    await moveTo(c, r.x + r.w, r.y + r.h, dur);
    c.hooks = c.hooks.filter(h => h !== hook);
    press(c, false);
    badge.remove();
    return sel;
  }
  function reveal(r, dir = 'x', dur = 260) {
    const h = hole(), s = performance.now();
    return new Promise(res => {
      const step = () => {
        const p = done ? 1 : Math.min(1, (performance.now() - s) / dur), e = ease(p);
        setRect(h, dir === 'x' ? { ...r, w: r.w * e } : { ...r, h: r.h * e });
        if (p < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
  }

  async function run(c, s) {
    const r = s.r;
    if (s.kind === 'paint') {
      const sel = await drag(c, r, 640);
      if (done) return;
      const fill = document.createElementNS(NS, 'rect');
      fill.setAttribute('fill', s.fill);
      setRect(fill, r);
      paint.append(fill);
      fill.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'forwards' });
      sel?.remove();
    } else if (s.kind === 'type') {
      const sel = await drag(c, r, 480);
      if (done) return;
      c.el.innerHTML = IBEAM;
      const h = hole(), caret = make('intro-caret');
      caret.style.height = r.h + 'px';
      const n = s.n || 6;
      for (let i = 1; i <= n && !done; i++) {
        const w = r.w * i / n;
        setRect(h, { ...r, w });
        caret.style.transform = `translate(${r.x + w - 1}px,${r.y}px)`;
        c.tx = r.x + w + 6; c.ty = r.y + r.h * .55; c.mode = 'move';
        await sleep(s.per || 100);
      }
      caret.remove(); sel?.remove();
      c.el.innerHTML = ARROW;
    } else {
      const sel = await drag(c, r, 420);
      if (done) return;
      await reveal(r, s.dir || 'x', s.dir === 'y' ? 600 : 240);
      sel?.remove();
    }
    c.ax = r.x + r.w * .6; c.ay = r.y + Math.min(r.h * .4, 60); c.mode = 'hover';
  }

  // 단계마다 커서를 하나씩 맡긴다. 같은 칸을 칠하고 여는 두 단계는 같은 커서가 이어서 한다
  const owner = new Map();
  let next = 0;
  const jobs = plan.map(s => {
    if (!owner.has(s.sel)) owner.set(s.sel, cursors[next++ % N]);
    const c = owner.get(s.sel);
    return sleep(s.at).then(() => done ? null : run(c, s));
  });
  // 일을 받지 않은 커서는 화면 여기저기를 맴돈다
  sleep(1200).then(() => cursors.slice(next).forEach((c, k) => { c.ax = W * (.2 + .15 * k); c.ay = H * (.3 + .12 * (k % 3)); c.mode = 'hover'; }));

  await Promise.all(jobs);
  if (done) return;
  await sleep(250);
  // 마무리: 커서가 바깥으로 흩어지고 덮개가 걷힌다
  for (const c of cursors) {
    const a = Math.atan2(c.y - cy, c.x - cx) + (Math.random() - .5) * .6, far = Math.hypot(W, H);
    moveTo(c, cx + Math.cos(a) * far, cy + Math.sin(a) * far, 700);
  }
  await sleep(420);
  finish(false);
}
