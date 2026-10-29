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

## 로그인/회원가입/익명 글쓰기가 모두 안 될 때

`firebase-config.js`에는 서비스 계정 JSON을 넣으면 안 됩니다. 이 파일은 누구나 볼 수 있는 공개 파일입니다. 이미 키를 넣었다면 Firebase/Google Cloud 콘솔에서 해당 서비스 계정 키를 폐기하고 새 키를 Vercel의 서버 전용 `FIREBASE_SERVICE_ACCOUNT_JSON`에 등록하세요. 파일에서 삭제해도 이전 Git 기록과 배포본의 키는 폐기되지 않습니다.

1. Firebase 콘솔 → 프로젝트 설정 → 내 앱 → 웹 앱의 **공개 웹 설정**을 복사합니다. 서버 서비스 계정과 같은 Firebase 프로젝트를 사용하세요.
2. Vercel 환경변수 `FIREBASE_WEB_CONFIG`에 다음 형태의 실제 웹 설정 JSON을 등록합니다. `apiKey`, `authDomain`, `projectId`는 필수입니다. 서비스 계정 JSON이나 `private_key`는 넣지 마세요.

   ```json
   {"apiKey":"웹 앱 API 키","authDomain":"프로젝트.firebaseapp.com","projectId":"프로젝트 ID","appId":"웹 앱 ID"}
   ```

   또는 공개 설정 객체를 `firebase-config.js`의 `null` 자리에 넣을 수 있습니다. `/api/firebase-config`는 공개 필드만 반환하며 서버 서비스 계정 환경변수는 읽지 않습니다.
3. Firebase 콘솔 → Authentication → Sign-in method에서 **이메일/비밀번호**, **Google**, **익명(Anonymous)**을 활성화합니다. Google 공급자의 지원 이메일도 설정합니다.
4. Authentication → Settings → Authorized domains에 실제 Vercel 서비스 도메인과 사용하는 커스텀 도메인을 추가합니다.
5. Vercel에서 환경변수가 적용되는 배포 환경을 확인한 뒤 재배포합니다.

검증: 시크릿 창에서 익명 글쓰기 → 이메일 회원가입/로그인 → 로그아웃 후 익명 글쓰기 → Google 로그인 순서로 확인하세요. 계정 로그인 실패나 Google 팝업 취소 후에도 기존 익명 글쓰기가 가능해야 합니다. 게시글 저장에는 `MONGODB_URI`, 서버 토큰 검증에는 `FIREBASE_SERVICE_ACCOUNT_JSON`이 별도로 필요합니다.

로컬 회귀 검사: `node tests/auth.test.mjs` (Firebase SDK 동작을 대체한 검사이며 실제 외부 연동 검증은 별도입니다.)

## 사진·영상 파일 첨부

Vercel → dday 프로젝트 → Storage → Create Database → Blob에서 **Public** 저장소를 만들고 프로젝트의 Production 환경에 연결하세요. `BLOB_READ_WRITE_TOKEN`이 자동으로 연결된 것을 확인한 뒤 재배포합니다. 이 값은 서버 전용이므로 공개 웹 설정에 넣지 마세요. Preview에서 시험한다면 해당 환경에도 별도로 연결해야 합니다.

- 사진: JPG, PNG, WebP, GIF / 파일당 10MB
- 영상: MP4, WebM / 파일당 100MB (코덱 재생 지원은 브라우저에 따라 다름)
- 글 하나에 최대 6개. 제목과 첨부만으로도 등록할 수 있습니다.
- Firebase 인증을 받은 사용자(익명 포함)가 Blob으로 직접 업로드합니다. 게시판 API에는 파일 주소만 전달합니다.
- 파일 주소는 공개되므로 비공개 자료를 올리지 마세요. Blob 사용량에 따른 Vercel 요금이 발생할 수 있습니다.
- 업로드 후 글 등록에 실패하면 재시도할 때 업로드한 파일을 재사용합니다. 실패한 글을 포기한 경우 미사용 파일이 남을 수 있으므로 Storage에서 정리할 수 있습니다. 게시글 삭제 시 그 글의 첨부 파일도 삭제합니다.

브라우저용 SDK는 `assets/upload-client.js`에 번들로 포함됩니다. SDK를 변경하면 `npm run bundle:uploads`로 다시 생성하고 함께 커밋하세요. 검사: `npm test`.
