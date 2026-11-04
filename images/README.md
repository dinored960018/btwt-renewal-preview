# images/

사이트 정적 이미지(서브 프로젝트 썸네일 등) 보관 폴더.

이 폴더에 파일을 커밋하면 master push 시 Firebase Hosting 으로 자동 배포되어
다음 URL 형식으로 접근 가능합니다:

```
https://blacktokkiwhitetokki.com/images/<파일명>
```

또는 admin 입력란에는 상대 경로로 적어도 됩니다:

```
/images/<파일명>
```

## 권장 규칙
- 형식: `.jpg` / `.png` / `.webp`
- 크기: 가로 ~600px 이하 권장 (서브 카드는 작게 표시됨)
- 파일명: 영문/숫자/하이픈만 사용 (예: `card-pixel-drift.webp`)
