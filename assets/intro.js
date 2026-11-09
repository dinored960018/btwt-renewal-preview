// 페이지 첫 방문 등장 효과: 흑백 커서 여러 개가 빈 페이지를 위에서부터 조립하고,
// 화면이 저절로 내려가며 페이지 끝까지 만든 뒤 덮개가 걷힌다.
// 덮개는 문서 전체 크기이고, 커서가 칸을 그리면 그 자리에 구멍이 나서 실제 화면이 보인다.
//
// 사용: 페이지 head 에서 조건이 맞으면 html 에 intro-on 클래스를 붙이고, 본문 스크립트에서
//   runIntro({ key: 'games', steps: [...] })
// step = { sel, all, kind: 'block' | 'type' | 'paint', dir: 'x' | 'y', fill, n, at }
//   at 이 있으면 첫 화면 단계(시각 지정), 없으면 스크롤하며 차례로 만든다. all 이면 선택자에 맞는 요소 전부.
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
    ov.style.transition = `opacity ${fast ? 200 : 500}ms ease`;
    ov.style.opacity = '0';
    root.classList.remove('intro-on');
    setTimeout(() => {
      cancelAnimationFrame(raf);
      ov.remove();
      // 끝까지 본 경우에는 맨 위로 돌아간다
      if (!fast) scrollTo({ top: 0, behavior: 'smooth' });
    }, fast ? 210 : 650);
  }
  // 키보드로 스크롤하거나 Esc 를 누르면 바로 끝낸다
  addEventListener('keydown', e => { if (['Escape', ' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) finish(true); });
  // 화면 폭이 바뀌면 잰 위치가 틀어지므로 바로 끝낸다 (모바일 주소창 높이 변화는 무시)
  const startW = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - startW) > 40) finish(true); });
  // 직접 스크롤하려는 사람은 막지 않는다
  ov.addEventListener('wheel', () => finish(true), { passive: true, once: true });
  ov.addEventListener('touchmove', () => finish(true), { passive: true, once: true });

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
  // 문서 기준 좌표
  const box = el => {
    const r = el.getBoundingClientRect();
    const x = Math.max(0, r.left), y = r.top + scrollY;
    return { x, y, w: Math.min(W, r.right) - x, h: r.height };
  };
  const expand = s => (s.all ? [...document.querySelectorAll(s.sel)] : [document.querySelector(s.sel)])
    .filter(Boolean).map(el => ({ ...s, r: box(el) }));
  const plan = steps.flatMap(expand).filter(s => s.r.w > 4 && s.r.h > 4);
  const head = plan.filter(s => s.at != null);
  const tour = plan.filter(s => s.at == null).sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x);

  // 덮개를 문서 전체 크기로 펼친다
  ov.style.position = 'absolute';
  ov.style.height = D + 'px';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'intro-paint');
  svg.setAttribute('width', W); svg.setAttribute('height', D);
  svg.innerHTML = `<defs><mask id="introMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${D}"><rect width="${W}" height="${D}" fill="#fff"/></mask></defs>
    <g mask="url(#introMask)" id="introPaint"><rect width="${W}" height="${D}" fill="${base}"/></g>`;
  ov.prepend(svg);
  ov.style.background = 'transparent';
  const mask = svg.querySelector('#introMask');
  const paint = svg.querySelector('#introPaint');
  const setRect = (el, r) => { el.setAttribute('x', r.x); el.setAttribute('y', r.y); el.setAttribute('width', Math.max(0, r.w)); el.setAttribute('height', Math.max(0, r.h)); };
  const hole = () => { const r = document.createElementNS(NS, 'rect'); r.setAttribute('fill', '#000'); mask.append(r); return r; };

  // 조작 표시 층: 커서·선택 상자·치수 표시는 차이 혼합으로 흑백 어디서나 보인다
  const ui = ov.querySelector('.intro-ui');
  const make = cls => { const d = document.createElement('div'); d.className = cls; ui.append(d); return d; };

  // 커서 (좌표는 문서 기준, 맴돌기·흩어지기는 지금 보이는 화면 기준)
  const N = mob ? 8 : 12;
  const cx = W / 2, cy = H / 2;
  const cursors = Array.from({ length: N }, (_, i) => {
    const el = make('intro-cur');
    el.innerHTML = ARROW;
    const a = Math.random() * Math.PI * 2, far = Math.hypot(W, H) * .6;
    return { el, x: cx + Math.cos(a) * far, y: cy + Math.sin(a) * far, vx: 0, vy: 0, tx: cx, ty: cy, mode: 'orbit', busy: false, r: 34 + i * (mob ? 7 : 9), sp: .9 + (i % 3) * .25, ph: i / N * Math.PI * 2, hooks: [] };
  });
  const t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000, sy = scrollY;
    for (const c of cursors) {
      if (c.mode === 'orbit') {
        c.tx = cx + Math.cos(t * c.sp + c.ph) * c.r;
        c.ty = sy + cy + Math.sin(t * c.sp + c.ph) * c.r * .8;
      } else if (c.mode === 'hover') {
        c.tx = c.ax + Math.sin(t * 1.3 + c.ph) * 26;
        c.ty = sy + c.ay + Math.cos(t * 1.1 + c.ph) * 18;
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

  // 스크롤 단계에서는 손이 빨라진다
  let pace = 1;
  function moveTo(c, x, y, dur = 450) {
    dur *= pace;
    c.mode = 'move';
    const sx = c.tx, sy = c.ty, s = performance.now();
    return new Promise(res => {
      const step = () => {
        if (done) return res();
        const p = Math.min(1, (performance.now() - s) / dur), e = ease(p);
        c.tx = sx + (x - sx) * e; c.ty = sy + (y - sy) * e;
        if (p < 1) requestAnimationFrame(step); else setTimeout(res, 50);
      };
      step();
    });
  }
  const press = (c, on) => c.el.classList.toggle('down', on);

  // 십자 드래그로 칸을 그린다: 드래그하는 동안 선택 상자와 치수를 보여 준다
  async function drag(c, r, dur = 520) {
    await moveTo(c, r.x, r.y, 420);
    if (done) return null;
    press(c, true);
    const sel = make('intro-box'), badge = make('intro-badge');
    const hook = () => {
      const w = Math.max(0, c.x - r.x), h = Math.max(0, c.y - r.y);
      sel.style.transform = `translate(${r.x}px,${r.y}px)`;
      sel.style.width = w + 'px'; sel.style.height = h + 'px';
      badge.textContent = `${Math.round(w)} × ${Math.round(h)}`;
      badge.style.transform = `translate(${Math.min(c.x + 14, W - 90)}px,${c.y + 16}px)`;
    };
    c.hooks.push(hook);
    await moveTo(c, r.x + r.w, r.y + r.h, dur);
    c.hooks = c.hooks.filter(h => h !== hook);
    press(c, false);
    badge.remove();
    return sel;
  }
  function reveal(r, dir = 'x', dur = 260) {
    dur *= pace;
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
    c.busy = true;
    const r = s.r;
    if (s.kind === 'paint') {
      const sel = await drag(c, r, 600);
      if (!done) {
        const fill = document.createElementNS(NS, 'rect');
        fill.setAttribute('fill', s.fill);
        setRect(fill, r);
        paint.append(fill);
        fill.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'forwards' });
      }
      sel?.remove();
    } else if (s.kind === 'type') {
      const sel = await drag(c, r, 440);
      if (!done) {
        c.el.innerHTML = IBEAM;
        const h = hole(), caret = make('intro-caret');
        caret.style.height = r.h + 'px';
        const n = s.n || Math.max(3, Math.min(14, (s.text || '').length || 6));
        for (let i = 1; i <= n && !done; i++) {
          const w = r.w * i / n;
          setRect(h, { ...r, w });
          caret.style.transform = `translate(${r.x + w - 1}px,${r.y}px)`;
          c.tx = r.x + w + 6; c.ty = r.y + r.h * .55; c.mode = 'move';
          await sleep((s.per || 90) * pace);
        }
        caret.remove();
        c.el.innerHTML = ARROW;
      }
      sel?.remove();
    } else {
      const sel = await drag(c, r, s.r.h > 300 ? 560 : 380);
      if (!done) await reveal(r, s.dir || 'x', s.dir === 'y' ? 520 : 220);
      sel?.remove();
    }
    // 일을 마치면 지금 보이는 화면 안에서 맴돈다
    c.ax = Math.min(W - 40, r.x + r.w * .5); c.ay = H * (.25 + Math.random() * .5); c.mode = 'hover';
    c.busy = false;
  }

  // 1) 첫 화면: 시각에 맞춰 단계를 시작한다. 같은 칸의 칠하기·열기는 같은 커서가 이어서 한다
  const owner = new Map();
  let next = 0;
  const firstJobs = head.map(s => {
    if (!owner.has(s.sel)) owner.set(s.sel, cursors[next++ % N]);
    const c = owner.get(s.sel);
    return sleep(s.at).then(() => done ? null : run(c, s));
  });
  sleep(1200).then(() => cursors.slice(next).forEach((c, k) => { if (c.mode === 'orbit') { c.ax = W * (.2 + .15 * k); c.ay = H * (.3 + .12 * (k % 3)); c.mode = 'hover'; } }));
  await Promise.all(firstJobs);
  if (done) return;

  // 2) 일정한 속도로 천천히 내려가며, 화면에 들어오는 칸부터 차례로 만든다
  pace = .6;
  const maxScroll = Math.max(0, D - H);
  const SPEED = mob ? 170 : 220;          // 초당 픽셀
  const queue = [], running = [];
  let ti = 0, pos = scrollY, last = performance.now(), vel = 0;
  await new Promise(res => {
    const tick = now => {
      if (done) return res();
      const dt = Math.min(.25, (now - last) / 1000); last = now;
      // 화면 아래쪽 80% 지점까지 들어온 칸을 작업 목록에 넣는다
      while (ti < tour.length && tour[ti].r.y < pos + H * .8) queue.push(tour[ti++]);
      // 쉬는 커서에게 일을 준다
      for (const c of cursors) {
        if (!queue.length) break;
        if (!c.busy) running.push(run(c, queue.shift()));
      }
      // 일이 밀리면 천천히, 아니면 정해진 속도로. 출발과 도착은 부드럽게
      const backlog = queue.length;
      const want = backlog > 2 ? SPEED * .15 : backlog > 0 ? SPEED * .5 : SPEED;
      const near = Math.min(1, (maxScroll - pos) / (H * .5));
      vel += (want * Math.max(.15, near) - vel) * Math.min(1, dt * 2.5);
      pos = Math.min(maxScroll, pos + vel * dt);
      scrollTo({ top: pos, behavior: 'instant' });
      if (pos >= maxScroll - .5 && ti >= tour.length && !queue.length) return res();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await Promise.all(running);
  if (done) return;
  await sleep(300);

  // 3) 마무리: 커서가 화면 바깥으로 흩어지고 덮개가 걷힌다
  const sy = scrollY;
  for (const c of cursors) {
    const a = Math.atan2(c.y - sy - cy, c.x - cx) + (Math.random() - .5) * .6, far = Math.hypot(W, H);
    moveTo(c, cx + Math.cos(a) * far, sy + cy + Math.sin(a) * far, 700);
  }
  await sleep(450);
  finish(false);
}
