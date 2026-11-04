// ─────────────────────────────────────────────
// Firebase 설정값
// Firebase Console → 프로젝트 설정 → 일반 →
// "내 앱" 섹션의 웹 앱(</> 아이콘) 설정값에서
// 아래 REPLACE_ME 항목들을 발급받은 실제 값으로 교체하세요.
//
// 이 파일은 클라이언트에 노출되어도 안전합니다.
// 보안은 firestore.rules 에서 제어됩니다.
// ─────────────────────────────────────────────

export const firebaseConfig = {
  apiKey: "AIzaSyDZouOXhmxiYx2FxoJXh808G-ds8Vb8sYc",
  authDomain: "blacktokki-whitetokki.firebaseapp.com",
  projectId: "blacktokki-whitetokki",
  storageBucket: "blacktokki-whitetokki.firebasestorage.app",
  messagingSenderId: "11554873720",
  appId: "1:11554873720:web:3a8a8e4c3267408065e88d"
};

// Firebase Auth 에 만든 관리자 계정 이메일 화이트리스트.
// 새 관리자를 추가하려면:
//   1) Firebase Console → Authentication → Users → Add user 로 계정 생성
//   2) 아래 ADMIN_EMAILS 배열에 이메일 추가
//   3) firestore.rules 의 동일한 배열도 같이 갱신 후 재배포
//      (firebase deploy --only firestore:rules)
export const ADMIN_EMAILS = [
  "kdhyun070714@gmail.com",
  "blacktokkiwhitetokki@gmail.com"
];

// site_config 문서 경로 (collection / document id)
export const SITE_CONFIG_PATH = { collection: "site_config", doc: "main" };

// 기본값 — Firestore 문서가 아직 없을 때 사용
export const SITE_CONFIG_DEFAULT = {
  video: {
    youtubeId: "A9EQE2kU318",
    clickUrl: ""
  },
  social: {
    discord: "",
    instagram: "",
    youtube: ""
  },
  subProjects: [
    {
      tag: "PC · ROGUELITE FLIGHT ACTION",
      title: "AIRDRIVE",
      desc: "손을 기울여 전투기를 조종하는 맨손 비행 액션 로그라이트.",
      link: "/airdrive/",
      thumbnail: "/images/airdrive-steam-header.jpg"
    },
    { tag: "Game Jam",  title: "Untitled", desc: "Untitled", link: "", thumbnail: "" },
    { tag: "Tech Demo", title: "Untitled", desc: "Untitled", link: "", thumbnail: "" },
    { tag: "Mini Game", title: "Untitled", desc: "Untitled", link: "", thumbnail: "" }
  ]
};

// Studio 페이지 연결 정보
// githubUrl 에 저장소 주소를 넣으면 "공개 준비 중" 표시가 실제 링크로 바뀝니다.
export const STUDIO_LINKS = {
  githubUrl: "",
  contactEmail: "blacktokkiwhitetokki@gmail.com"
};

// 서브 프로젝트 카드 슬롯 수 (UI 가 항상 이 개수만큼 렌더됨)
export const SUB_PROJECT_SLOTS = 4;
