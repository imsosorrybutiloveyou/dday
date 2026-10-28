# 이것만 하면 됨

이미 Firebase 로그인까지 해놨다면, 아래 **3가지만** Vercel에 넣으면 됩니다.

## 1. MongoDB 연결

가장 쉬운 방법:

Vercel 프로젝트 → **Storage / Marketplace** → `MongoDB Atlas` 검색 → Install → 현재 프로젝트 연결.

정상 연결되면 Vercel 환경변수에 보통:

```text
MONGODB_URI
```

가 자동으로 생깁니다.

직접 Atlas에서 연결 문자열을 받았다면:

Vercel → Project → Settings → Environment Variables

```text
이름: MONGODB_URI
값: mongodb+srv://...
```

그리고 하나 더:

```text
이름: MONGODB_DB
값: sf13
```

`MONGODB_DB`는 없어도 기본값이 `sf13`이라 필수는 아닙니다.

---

## 2. Firebase 서버 인증키 넣기

Firebase Console:

```text
프로젝트 설정(톱니바퀴)
→ 서비스 계정
→ 새 비공개 키 생성
```

JSON 파일이 다운로드됩니다.

그 JSON 파일 **전체 내용**을 복사합니다.

Vercel:

```text
Project
→ Settings
→ Environment Variables
```

추가:

```text
이름: FIREBASE_SERVICE_ACCOUNT_JSON
값: JSON 파일 전체 내용
```

예:

```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...",
  ...
}
```

이 파일은 절대로 GitHub에 올리지 마세요.

---

## 3. 관리자 UID 넣기

사이트에 네 관리자 계정으로 로그인합니다.

```text
로그인 → 내 UID → 복사
```

Vercel Environment Variables에:

```text
이름: ADMIN_UIDS
값: 복사한 UID
```

관리자가 여러 명이면:

```text
UID1,UID2,UID3
```

처럼 쉼표로 적으면 됩니다.

---

# 이미 쓰던 NEIS 키

Vercel에 기존처럼:

```text
이름: NEIS_API_KEY
값: 네 NEIS API 키
```

가 있으면 그대로 두면 됩니다.

---

# 최종적으로 Vercel 환경변수 목록

```text
MONGODB_URI
MONGODB_DB=sf13              (선택)
FIREBASE_SERVICE_ACCOUNT_JSON
ADMIN_UIDS
NEIS_API_KEY
```

이것뿐입니다.

---

# 설정 후

Vercel에서:

```text
Deployments → 최신 배포 → Redeploy
```

합니다.

사이트 로그인 후 관리자라면 `관리` 버튼이 열립니다.

## DB 인덱스 생성

사이트가 배포된 뒤 브라우저 개발자 도구에서 할 필요 없습니다.

관리자 로그인 후 아래 주소에 POST 요청을 1번 보내면 되는데 번거로우므로,
초기에는 인덱스 없이도 사이트가 작동합니다.

나중에 투표 중복 방지를 더 확실히 적용하려면 `/api/setup-db`를 관리자 토큰과 함께 호출하면 됩니다.

---

# MongoDB Atlas에서 직접 뭘 만들 필요가 있나?

없습니다.

사이트에서 첫 글을 쓰면 자동으로:

```text
sf13
├─ posts
├─ comments
├─ emotes
├─ votes
└─ settings
```

컬렉션이 생성됩니다.

---

# 반콘

사용자가 올린 PNG/JPG/WebP/GIF는 별도 이미지 API 없이 MongoDB에 저장됩니다.

제한:

```text
700KB 이하
```

관리자는 사이트의:

```text
관리 → 반콘
```

에서 삭제할 수 있습니다.

---

# Firebase는 이제 뭐에 쓰나?

Firebase는 **로그인만** 담당합니다.

```text
Firebase → 로그인
MongoDB → 게시글/댓글/반콘/설정
Vercel → 서버 API + NEIS
```

Firestore와 Firebase Storage는 이 버전에서는 필요 없습니다.
