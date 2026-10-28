# 서울금융고 1학년 3반 갤러리 — MongoDB 버전

이 버전은 구조를 단순화했습니다.

```text
Firebase Authentication → 로그인만
MongoDB Atlas          → 게시글/댓글/반콘/관리 데이터
Vercel                 → 웹사이트/API/NEIS
```

## 주요 기능

- 기본 게시글 0개
- MongoDB 공용 게시판
- 댓글
- 개추/비추
- 공지/개념글
- 익명 `ㅇㅇ(IP 일부)`
- 이메일/비밀번호 고정닉
- Firebase Anonymous Auth
- Vercel 서버에서 Firebase ID Token 검증
- 사용자 PNG/JPG/WebP/GIF 반콘 등록
- 반콘 이미지 MongoDB 저장(700KB 이하)
- 관리자 반콘 삭제
- 관리자 공지
- 관리자 글 삭제 / 전체 삭제
- NEIS 시간표/급식
- Discord 링크

## 설정

`SETUP_EASY.md`만 보면 됩니다.

필요한 Vercel 환경변수:

```text
MONGODB_URI
FIREBASE_SERVICE_ACCOUNT_JSON
ADMIN_UIDS
NEIS_API_KEY
```

선택:

```text
MONGODB_DB=sf13
```

## 주의

- `FIREBASE_SERVICE_ACCOUNT_JSON`은 GitHub에 절대 넣지 마세요.
- MongoDB URI도 코드에 넣지 말고 Vercel 환경변수에만 넣으세요.
- `firebase-config.js`의 Firebase 웹 설정은 클라이언트 로그인용이며 기존 설정을 그대로 사용하면 됩니다.
