import { firebaseConfig, SITE_CONFIG_PATH, SITE_CONFIG_DEFAULT } from '../firebase-config.js';

// 관리자 값의 /로 시작하는 주소를 배포 위치에 맞춘다
const BASE = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
export const siteUrl = p => (p && p.startsWith('/') && !p.startsWith('//')) ? BASE + p : p;

// 이름 세 가지를 번갈아 쓰는 기존 브랜드 동작
export function applyBrandName() {
  const names = [['검토흰토', 'ko'], ['黑兔白兔', 'zh'], ['BTWT', 'en']];
  const [name, lang] = names[Math.floor(Math.random() * names.length)];
  document.querySelectorAll('[data-brand]').forEach(el => {
    el.textContent = name;
    el.closest('.mark')?.classList.add('lang-' + lang);
  });
}

// 글자를 칸 너비에 정확히 맞춘다
export function fitText(root = document) {
  const items = [...root.querySelectorAll('[data-fit]')];
  const run = () => items.forEach(el => {
    const box = el.parentElement;
    el.style.fontSize = '100px';
    const w = el.scrollWidth || el.getBoundingClientRect().width;
    const target = box.clientWidth;
    if (w && target) el.style.fontSize = (100 * target / w) + 'px';
  });
  run();
  document.fonts?.ready.then(run);
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(run, 80); });
}

export function applySocial(social = {}) {
  document.querySelectorAll('[data-social]').forEach(a => {
    const url = social[a.dataset.social];
    if (url) { a.href = url; a.hidden = false; } else { a.removeAttribute('href'); a.hidden = true; }
  });
}

// 관리자 페이지 값 구독. 실패해도 기본값으로 화면을 그린다.
export async function subscribeConfig(onData) {
  onData(SITE_CONFIG_DEFAULT);
  try {
    const [{ initializeApp }, { getFirestore, doc, onSnapshot }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'),
    ]);
    const db = getFirestore(initializeApp(firebaseConfig));
    onSnapshot(doc(db, SITE_CONFIG_PATH.collection, SITE_CONFIG_PATH.doc), snap => {
      if (snap.exists()) onData({ ...SITE_CONFIG_DEFAULT, ...snap.data() });
    }, err => console.warn('[btwt] 설정을 읽지 못해 기본값을 씁니다.', err.code));
  } catch (err) {
    console.warn('[btwt] Firebase 연결 실패, 기본값을 씁니다.', err);
  }
}
