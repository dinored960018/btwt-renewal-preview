// 첫 방문 등장 효과: 흑백 커서 여러 개가 빈 화면에서 첫 화면을 조립한다.
// 검은 덮개 위에 커서가 칸을 그리면 그 자리의 실제 화면이 드러나고, 끝나면 덮개가 걷힌다.
const root = document.documentElement;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const NS = 'http://www.w3.org/2000/svg';

const ARROW = '<svg viewBox="0 0 20 24" width="20" height="24" aria-hidden="true"><path d="M2 1.5v18.2l4.9-4.6 3.4 7.4 3.2-1.5-3.4-7.3h6.6z" fill="#fff"/></svg>';
const IBEAM = '<svg viewBox="0 0 20 24" width="20" height="24" aria-hidden="true"><path d="M6 2h3l1 1 1-1h3v2h-2.5v16H14v2h-3l-1-1-1 1H6v-2h2.5V4H6z" fill="#fff"/></svg>';

export function introWanted() {
  return root.classList.contains('intro-on');
}

export async function runIntro() {
  const ov = document.getElementById('intro');
  if (!ov) return;
  let done = false, raf = 0;
  const skipBtn = ov.querySelector('.intro-skip');

  function finish(fast) {
    if (done) return;
    done = true;
    try { sessionStorage.setItem('btwt-intro', '1'); } catch (e) {}
    ov.style.transition = `opacity ${fast ? 200 : 450}ms ease`;
    ov.style.opacity = '0';
    setTimeout(() => {
      cancelAnimationFrame(raf);
      ov.remove();
      root.classList.remove('intro-on');
    }, fast ? 210 : 460);
  }
  skipBtn?.addEventListener('click', () => finish(true));
  addEventListener('keydown', e => { if (e.key === 'Escape') finish(true); });
  // 화면 폭이 바뀌면 잰 위치가 틀어지므로 바로 끝낸다 (모바일 주소창 높이 변화는 무시)
  const startW = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - startW) > 40) finish(true); });

  // 글꼴과 글자 맞춤이 끝난 뒤 실제 위치를 잰다
  await Promise.race([document.fonts?.ready || Promise.resolve(), sleep(1200)]);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (done) return;

  const W = innerWidth, H = innerHeight;
  const mob = matchMedia('(max-width:720px)').matches;
  const box = (el, pad = 0) => {
    const r = el.getBoundingClientRect();
    const x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad);
    return { x, y, w: Math.min(W, r.right + pad) - x, h: Math.min(H, r.bottom + pad) - y };
  };
  const ink = document.querySelector('.plane.ink');
  const cells = [...ink.querySelectorAll('.words>span')].map(el => box(el));
  const bunny = box(ink.querySelector('.bunny'));
  const halves = [...ink.querySelectorAll('.half')].map(el => box(el, 6));
  const logo = box(document.querySelector('.logo'), 8);
  const rail = box(document.querySelector('.rail'));
  const white = mob ? { x: 0, y: H / 2, w: W, h: H / 2 } : { x: W / 2, y: 0, w: W / 2, h: H };

  // 그림 층: 검은 바탕 + 커서가 그린 흰 면, 구멍으로 실제 화면이 보인다
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'intro-paint');
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.innerHTML = `<defs><mask id="introMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/></mask></defs>
    <g mask="url(#introMask)"><rect width="${W}" height="${H}" fill="#000"/><rect id="introWhite" fill="#fff" width="0" height="0"/></g>`;
  ov.prepend(svg);
  // 이제부터 검은 바탕은 그림 층이 맡는다. 덮개 자체는 투명해야 구멍으로 실제 화면이 보인다
  ov.style.background = 'transparent';
  const mask = svg.querySelector('#introMask');
  const whiteRect = svg.querySelector('#introWhite');
  const setRect = (el, r) => { el.setAttribute('x', r.x); el.setAttribute('y', r.y); el.setAttribute('width', Math.max(0, r.w)); el.setAttribute('height', Math.max(0, r.h)); };
  const hole = () => { const r = document.createElementNS(NS, 'rect'); r.setAttribute('fill', '#000'); mask.append(r); return r; };

  // 조작 표시 층: 커서·선택 상자·치수 표시는 차이 혼합으로 흑백 어디서나 보인다
  const ui = ov.querySelector('.intro-ui');
  const make = cls => { const d = document.createElement('div'); d.className = cls; ui.append(d); return d; };

  // 커서
  const N = mob ? 8 : 12;
  const cx = W / 2, cy = H / 2;
  const cursors = Array.from({ length: N }, (_, i) => {
    const el = make('intro-cur');
    el.innerHTML = ARROW;
    const a = Math.random() * Math.PI * 2, far = Math.hypot(W, H) * .6;
    const c = { el, i, x: cx + Math.cos(a) * far, y: cy + Math.sin(a) * far, vx: 0, vy: 0, tx: cx, ty: cy, mode: 'orbit', r: 34 + i * (mob ? 7 : 9), sp: .9 + (i % 3) * .25, ph: i / N * Math.PI * 2, hooks: [] };
    return c;
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

  // 커서를 목표까지 부드럽게 옮긴다
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
  const icon = (c, svgText) => { c.el.innerHTML = svgText; };

  // 십자 드래그로 칸을 그린다: 드래그하는 동안 선택 상자와 치수를 보여 준다
  async function drag(c, r, dur = 600) {
    await moveTo(c, r.x, r.y);
    if (done) return;
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
  // 그린 칸을 열어 실제 화면을 보여 준다
  async function reveal(r, dir = 'x', dur = 260) {
    const h = hole(), s = performance.now();
    await new Promise(res => {
      const step = () => {
        const p = done ? 1 : Math.min(1, (performance.now() - s) / dur), e = ease(p);
        setRect(h, dir === 'x' ? { ...r, w: r.w * e } : { ...r, h: r.h * e });
        if (p < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
  }
  // 글자 칸: 상자를 그린 뒤 I자 커서로 한 글자씩 친다
  async function type(c, r, n, per = 110) {
    const sel = await drag(c, r, 520);
    if (done) return;
    icon(c, IBEAM);
    const h = hole(), caret = make('intro-caret');
    caret.style.height = r.h + 'px';
    for (let i = 1; i <= n && !done; i++) {
      const w = r.w * i / n;
      setRect(h, { ...r, w });
      caret.style.transform = `translate(${r.x + w - 1}px,${r.y}px)`;
      c.tx = r.x + w + 6; c.ty = r.y + r.h * .55; c.mode = 'move';
      await sleep(per);
    }
    caret.remove(); sel?.remove();
    icon(c, ARROW);
  }
  async function block(c, r, dir) {
    const sel = await drag(c, r, 420);
    if (done) return;
    await reveal(r, dir, dir === 'y' ? 620 : 240);
    sel?.remove();
  }
  const at = (ms, fn) => sleep(ms).then(() => done ? null : fn());

  // 쓰지 않는 커서는 작업 근처를 맴돈다
  const idle = (c, x, y) => { c.ax = x; c.ay = y; c.mode = 'hover'; };

  const jobs = [
    at(900, async () => {
      const c = cursors[0];
      const sel = await drag(c, white, 700);
      if (done) return;
      whiteRect.style.opacity = 0; setRect(whiteRect, white);
      whiteRect.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'forwards' });
      sel?.remove();
      idle(c, white.x + white.w * .7, white.y + white.h * .3);
    }),
    at(1500, async () => { await block(cursors[1], bunny, 'y'); idle(cursors[1], bunny.x + bunny.w * .5, bunny.y + bunny.h * .4); }),
    at(1850, async () => { await type(cursors[2], cells[0], 5); idle(cursors[2], cells[0].x + cells[0].w * .5, cells[0].y - 30); }),
    at(2100, async () => { await type(cursors[3], cells[1], 6); idle(cursors[3], cells[1].x + cells[1].w * .5, cells[1].y - 30); }),
    at(2600, () => block(cursors[4], halves[0], 'x')),
    at(2750, () => block(cursors[5], halves[1], 'x')),
    at(3000, () => block(cursors[6], logo, 'x')),
    at(3100, () => block(cursors[7], rail, 'x')),
  ];
  // 남는 커서는 토끼와 글자 근처로 흩어진다
  at(1300, () => cursors.slice(8).forEach((c, k) => idle(c, W * (.2 + .2 * k), H * (.35 + .1 * (k % 2)))));

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
