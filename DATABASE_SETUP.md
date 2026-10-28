# DB / NEIS API 연결 설명서

이 문서는 현재 사이트를 **진짜 여러 사람이 함께 사용하는 게시판**으로 만드는 방법입니다.

현재 프로젝트는 Firebase 설정이 없으면 localStorage 데모 모드로 작동합니다.
Firebase 설정을 넣으면 Firestore를 읽는 구조가 활성화됩니다.

---

# 1. 전체 구조

권장 구성:

```text
사용자 브라우저
   │
   ├─ Firebase Authentication
   │       └─ 사용자 로그인
   │
   ├─ Cloud Firestore
   │       ├─ posts
   │       ├─ posts/{id}/comments
   │       ├─ emotes
   │       ├─ settings
   │       └─ admins
   │
   └─ Firebase Function /api/neis
           │
           └─ NEIS Open API
```

NEIS 인증키는 브라우저에 넣지 않습니다.

---

# 2. Firebase 프로젝트 만들기

1. Firebase Console에 접속합니다.
2. `프로젝트 추가`를 누릅니다.
3. 원하는 프로젝트 이름을 지정합니다.
   예: `sf13-community`
4. 프로젝트가 만들어지면 웹 앱 `</>`을 추가합니다.
5. 다음과 같은 설정값이 나옵니다.

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

이 값은 Firebase 웹 클라이언트 식별용 설정이며 NEIS 인증키와 성격이 다릅니다.

프로젝트 루트의:

```text
firebase-config.js
```

를 열고 다음처럼 넣습니다.

```js
window.BANGALL_FIREBASE_CONFIG = {
  apiKey: "발급된 값",
  authDomain: "발급된 값",
  projectId: "발급된 값",
  storageBucket: "발급된 값",
  messagingSenderId: "발급된 값",
  appId: "발급된 값"
};
```

---

# 3. Firestore 만들기

Firebase Console:

```text
Build
→ Firestore Database
→ Create database
```

처음에는 Production mode를 선택하는 것을 권장합니다.

리전은 한국 사용자 중심이면 가능한 경우 서울/아시아 인접 리전을 사용하세요.

---

# 4. Firestore 컬렉션 구조

## posts

예:

```json
{
  "category": "잡담",
  "title": "제목",
  "body": "내용",
  "author": "닉네임",
  "guestCode": "",
  "ownerUid": "Firebase Auth UID",
  "views": 0,
  "up": 0,
  "down": 0,
  "notice": false,
  "image": "",
  "createdAt": "server timestamp"
}
```

## posts/{postId}/comments

```json
{
  "author": "닉네임",
  "guestCode": "",
  "ownerUid": "Firebase Auth UID",
  "text": "댓글 내용",
  "createdAt": "server timestamp"
}
```

## emotes

```json
{
  "name": "개추",
  "char": "👍",
  "order": 0
}
```

## admins

문서 ID를 **관리자 Firebase Auth UID**로 만듭니다.

예:

```text
admins/
  3df4G...관리자UID
```

문서 안에는 단순히 다음처럼 넣어도 됩니다.

```json
{
  "enabled": true
}
```

---

# 5. Firestore Rules

프로젝트에 `firestore.rules` 파일이 포함되어 있습니다.

Firebase CLI를 쓰는 경우:

```bash
firebase deploy --only firestore:rules
```

주의:

현재 예제 규칙은 실제 운영을 위해 `create`도 Firebase 로그인 사용자에게만 허용하는 형태입니다.

사이트에서 **완전 비로그인 작성**까지 서버 DB에 허용하려면 아무나 직접 Firestore에 쓰게 열어두는 방식은 추천하지 않습니다.

권장 방법:

```text
비로그인 사용자
→ Firebase Anonymous Auth
→ 인증된 익명 UID 발급
→ Firestore Rules로 rate limit / ownerUid 검증
```

즉 화면에는 계속 `ㅇㅇ(12.34)`로 보여도 내부적으로는 Firebase Anonymous Authentication을 사용하면 됩니다.

---

# 6. Authentication 설정

Firebase Console:

```text
Build
→ Authentication
→ Get started
```

권장 Provider:

```text
Anonymous
Email/Password
```

이 사이트의 화면상 닉네임 로그인은 현재 데모용 localStorage 로그인입니다.

실제 운영 시에는 다음 구조로 교체하면 됩니다.

```text
닉네임
비밀번호
↓
Firebase Email/Password 또는 자체 계정 매핑
↓
UID
↓
Firestore ownerUid
```

간단하게 운영하려면:

- 일반 비로그인 글: Anonymous Auth
- 고정닉: Email/Password
- 관리자: Email/Password + admins/{uid}

구조를 추천합니다.

---

# 7. NEIS 인증키 안전하게 넣기

중요:

**NEIS 인증키를 index.html, app.js, firebase-config.js에 넣지 마세요.**

GitHub Pages에 들어가는 모든 JS는 공개됩니다.

프로젝트에는 Firebase Function 예제가 포함되어 있습니다.

```text
functions/index.js
```

이 Function은 다음 정보를 이미 사용하도록 작성되어 있습니다.

```text
서울특별시교육청: B10
서울금융고등학교: 7010964
학년: 1
반: 3
```

## Firebase CLI 설치

Node.js 설치 후:

```bash
npm install -g firebase-tools
```

로그인:

```bash
firebase login
```

프로젝트 연결:

```bash
firebase use --add
```

---

# 8. NEIS 키를 Firebase Secret으로 저장

터미널에서:

```bash
firebase functions:secrets:set NEIS_API_KEY
```

값 입력을 요구하면 본인이 발급받은 NEIS 인증키를 붙여넣습니다.

이 키는 GitHub 저장소에 올라가지 않습니다.

그 다음:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

---

# 9. Firebase Hosting까지 같이 쓰는 경우

현재 `firebase.json`에는 다음 rewrite가 포함되어 있습니다.

```text
/api/neis
→ Firebase Function neis
```

사이트 배포:

```bash
firebase deploy --only hosting,functions,firestore:rules
```

그러면 프론트엔드의:

```js
fetch("/api/neis?date=20261028")
```

가 자동으로 Firebase Function으로 연결됩니다.

이 방식이 가장 간단합니다.

---

# 10. GitHub Pages를 계속 사용하는 경우

GitHub Pages에서는 `/api/neis` rewrite를 사용할 수 없습니다.

Function 배포 후 생성된 주소가 예를 들어:

```text
https://asia-northeast3-프로젝트ID.cloudfunctions.net/neis
```

라면 `assets/app.js`에서:

```js
fetch(`/api/neis?date=${date}`)
```

부분을:

```js
fetch(`https://asia-northeast3-프로젝트ID.cloudfunctions.net/neis?date=${date}`)
```

로 바꿉니다.

Function 코드에는 `cors: true`가 설정되어 있습니다.

---

# 11. 현재 NEIS 조회 대상

사이트는 다음 데이터를 조회합니다.

## 시간표

서비스:

```text
hisTimetable
```

조건:

```text
ATPT_OFCDC_SC_CODE=B10
SD_SCHUL_CODE=7010964
GRADE=1
CLASS_NM=3
TI_FROM_YMD=오늘
TI_TO_YMD=오늘
```

## 급식

서비스:

```text
mealServiceDietInfo
```

조건:

```text
ATPT_OFCDC_SC_CODE=B10
SD_SCHUL_CODE=7010964
MLSV_YMD=오늘
```

---

# 12. 게시글을 실시간으로 갱신하려면

현재 Firebase 모드는 처음 페이지를 열 때 Firestore를 읽습니다.

완전 실시간으로 바꾸려면 `getDocs()` 대신 Firestore의:

```js
onSnapshot()
```

을 사용하면 됩니다.

예:

```js
onSnapshot(
  query(collection(db, "posts"), orderBy("createdAt", "desc")),
  snapshot => {
    posts = snapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    }));
    renderPosts();
  }
);
```

---

# 13. 이미지 업로드

현재 글쓰기의 이미지 기능은 URL 입력 방식입니다.

실제 업로드 기능으로 만들려면 Firebase Storage를 추가합니다.

권장 경로:

```text
post-images/{uid}/{uuid}.jpg
```

업로드 후 얻은 Download URL을 posts 문서의 `image`에 저장하면 됩니다.

---

# 14. 운영 전에 꼭 바꿀 것

현재 관리자 데모 비밀번호:

```text
classadmin
```

이 방식은 반드시 제거하세요.

실제 운영:

```text
Firebase Auth 로그인
+
admins/{uid}
+
Firestore Security Rules
```

로 관리자 권한을 검증해야 합니다.

또한 다음 기능을 추가하는 것을 권장합니다.

- 신고
- 관리자 삭제 기록
- 도배 방지
- 글 작성 쿨다운
- Firebase App Check
- 이미지 용량 제한
- 금칙어
- 개인정보 신고 안내

---

# 15. GitHub에 올리면 안 되는 것

절대 커밋하지 말 것:

```text
.env
.env.local
NEIS 실제 인증키
서비스 계정 JSON
Firebase Admin SDK private key
```

Firebase 웹 설정(`firebase-config.js`의 apiKey 등)은 서버 비밀키가 아니지만,
Firestore Rules가 잘못되어 있으면 DB가 노출될 수 있으므로 Rules가 더 중요합니다.

---

# 16. 추천 최종 배포 방식

가장 단순한 운영 구조:

```text
Firebase Hosting
+ Firebase Authentication
+ Firestore
+ Firebase Functions
+ Firebase Storage
```

GitHub는 코드 저장소로만 사용하고 실제 웹 배포는 Firebase Hosting으로 하는 방식입니다.

이렇게 하면:

- DB
- 로그인
- 관리자 권한
- NEIS 키 은닉
- 이미지
- API 프록시

를 한 프로젝트 안에서 처리할 수 있습니다.
