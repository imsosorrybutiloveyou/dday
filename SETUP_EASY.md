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

추천 중복은 별도 인덱스 설정 없이 서버에서 막습니다. `/api/setup-db`는 조회용 인덱스를 만들 때 관리자 토큰과 함께 호출할 수 있습니다.

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

Vercel → dday 프로젝트 → Storage → Create Database → Blob에서 **Public** 저장소를 만들고 프로젝트의 Production 환경에 연결하세요. OIDC 연결은 `BLOB_STORE_ID`와 `BLOB_WEBHOOK_PUBLIC_KEY`를 사용하며, Vercel이 실행 중 OIDC 인증을 제공합니다. `BLOB_READ_WRITE_TOKEN`이 없어도 됩니다. 이전 토큰 방식도 지원합니다. 연결 후 재배포하세요. 서버 인증값을 공개 웹 설정에 넣지 마세요. Preview에서 시험한다면 해당 환경에도 별도로 연결해야 합니다.

- 사진: JPG, PNG, WebP, GIF / 파일당 10MB
- 영상: MP4, WebM / 파일당 100MB (코덱 재생 지원은 브라우저에 따라 다름)
- 글 하나에 최대 6개. 제목과 첨부만으로도 등록할 수 있습니다.
- Firebase 인증을 받은 사용자(익명 포함)가 Blob으로 직접 업로드합니다. 게시판 API에는 파일 주소만 전달합니다.
- 파일 주소는 공개되므로 비공개 자료를 올리지 마세요. Blob 사용량에 따른 Vercel 요금이 발생할 수 있습니다.
- 업로드 후 글 등록에 실패하면 재시도할 때 업로드한 파일을 재사용합니다. 실패한 글을 포기한 경우 미사용 파일이 남을 수 있으므로 Storage에서 정리할 수 있습니다. 게시글 삭제 시 그 글의 첨부 파일도 삭제합니다.

브라우저용 SDK는 `assets/upload-client.js`에 번들로 포함됩니다. SDK를 변경하면 `npm run bundle:uploads`로 다시 생성하고 함께 커밋하세요. 검사: `npm test`.


## 추천 및 닉네임

- 추천/비추천을 합쳐 로그인 계정당 글 하나에 한 번만 가능합니다. 익명 글쓰기·댓글은 유지되지만 익명 투표는 허용하지 않습니다.
- 추천 수와 투표자 목록을 게시글 한 문서에서 동시에 갱신하므로 연속 클릭·동시 요청도 한 번만 반영됩니다. 별도의 DB 인덱스 생성이 필요하지 않습니다.
- 이전 투표 기록은 게시글을 처음 열거나 투표할 때 계정별 최초 투표로 재집계합니다. 기존 `votes` 기록은 보존합니다. 서로 다른 계정을 같은 사람으로 판별하는 기능은 아닙니다.
- 계정 화면의 닉네임 저장은 `profiles` 컬렉션에 Firebase UID별로 저장됩니다. Google 이름이 바뀌거나 재로그인해도 저장한 닉네임이 우선됩니다.
- 닉네임은 1~16자이며 앞으로 작성하는 글·댓글·반콘에 적용됩니다. 이전 글의 작성자 표시는 변경하지 않습니다. 작성자 이름은 클라이언트 입력 대신 서버 계정 정보로 결정합니다.

`/api/upload`의 `available`은 필요한 설정 항목의 존재 여부만 표시하며 실제 저장소 접근 성공을 보장하지 않습니다. OIDC 설정이면 `mode: "presigned"`, 이전 토큰 설정이면 `mode: "legacy"`를 반환합니다. OIDC 업로드는 Firebase 사용자 인증 후 경로·파일 형식·크기·유효기간을 제한한 업로드 전용 서명을 발급합니다.

## 관리자 공지

`ADMIN_UIDS`에 등록된 계정(또는 `admins` 컬렉션의 활성 관리자)으로 로그인하면 게시판에 **공지쓰기**가 표시됩니다. 전체화면 편집기에서 작성하거나 일반 글쓰기의 **공지로 등록**을 체크하세요. 관리 → 공지에서도 같은 편집기를 열 수 있습니다. 공지는 상단 공지 목록과 공지 탭에 표시되며 서버에서 관리자 권한을 다시 확인합니다.

## Gemini AI 소프트웨어 소식

1. Google AI Studio의 https://aistudio.google.com/apikey 에서 Gemini API 키를 발급합니다.
2. Vercel의 실제 서비스 프로젝트 → Settings → Environment Variables → Production에 `GEMINI_API_KEY`를 등록합니다. 서버 전용 값이며 `FIREBASE_WEB_CONFIG`나 브라우저 코드에 넣으면 안 됩니다.
3. 자동 수집을 쓰려면 `CRON_SECRET`에 충분히 긴 무작위 비밀 문자열을 등록합니다. Vercel Cron이 이 값을 Authorization 헤더로 전달합니다. 값을 채팅·저장소에 올리지 마세요.
4. 재배포 후 관리자 계정으로 **AI 소식 → 새 소식 수집**을 눌러 실제 키와 Google Search grounding 사용 권한/할당량을 확인합니다.

기본 모델은 `gemini-2.5-flash`입니다. 다른 Google Search grounding 지원 모델을 쓰려면 `GEMINI_MODEL`을 설정하세요. Gemini 및 검색 기능의 요금·할당량은 Google 프로젝트 설정에 따릅니다.

매일 **한국시간 오전 8시(UTC 23:00)**에 최대 5건을 수집하도록 Vercel Cron을 설정했습니다. Hobby 플랜의 일일 작업은 정각 실행이 보장되지 않을 수 있습니다. 방문자가 탭을 여는 것만으로 AI 호출은 발생하지 않습니다. 수동 수집은 관리자만 가능하며 성공한 수집 사이에는 10분 간격이 필요합니다.

- 최근 30일의 소프트웨어·개발 도구·오픈소스·보안 업데이트를 검색합니다. 각 글에 원문 링크와 AI 요약 표시가 붙습니다.
- 모델 응답의 출처가 검색 grounding에 있는지 검사하고, Google 검색 리디렉션을 원문 URL로 정규화합니다. 출처나 날짜를 확인할 수 없는 항목은 저장하지 않습니다. 요약·날짜 자체의 오류 가능성은 있어 원문 확인이 필요합니다.
- URL, 정규화 제목, 이벤트 키를 DB 고유 키로 검사합니다. 최근 AI 소식 200건과 게시판 글 300건을 모델에 함께 전달해 같은 주제의 중복 기사도 제외하도록 합니다. 표현이 크게 다른 동일 사건은 AI가 놓칠 수 있습니다.
- `news`, `jobs` 컬렉션과 `settings`의 `news` 항목은 자동 생성됩니다. DB에 고유 인덱스를 생성할 권한이 필요합니다. 실행 잠금은 2분 후 만료되며, 동시 요청이 같은 작업을 중복 실행하지 못하게 합니다.
- 초기에는 뉴스가 비어 있는 것이 정상입니다. API 키를 등록했다고 기존 배포에 자동 적용되지는 않으므로 재배포가 필요합니다.

검사: `npm test`. 테스트에서는 Gemini·MongoDB를 대체하므로 실제 AI 호출과 Cron 실행은 배포 후 위 수동 수집으로 별도 확인하세요.
