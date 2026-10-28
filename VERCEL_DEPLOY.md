# Vercel 배포 설명서

## 이번에 화면이 CSS 없이 나온 원인

스크린샷은 HTML 자체는 로드됐지만 CSS/JS 정적 파일이 적용되지 않은 상태입니다.
이 프로젝트는 이를 방지하기 위해 정적 파일 경로를 다음처럼 루트 절대경로로 고쳤습니다.

```html
<link rel="stylesheet" href="/assets/style.css">
<script src="/firebase-config.js"></script>
<script src="/assets/app.js" type="module"></script>
```

Vercel 프로젝트의 **Root Directory는 이 폴더 자체**로 지정해야 합니다.
즉 Vercel이 보는 루트에 반드시 다음 파일이 바로 있어야 합니다.

```text
index.html
vercel.json
assets/
api/
firebase-config.js
```

`seoulfinance-1-3-vercel` 폴더를 다시 한 번 감싼 상위 폴더를 Root Directory로 잡으면 안 됩니다.

---

## 권장 Vercel 설정

Vercel → Project → Settings → Build and Deployment

- Framework Preset: `Other`
- Build Command: 비워두기
- Output Directory: 비워두기
- Install Command: 비워두기
- Root Directory: `index.html`이 있는 폴더

GitHub 저장소 루트에 이 프로젝트 파일을 그대로 올렸다면 Root Directory는 `./` 그대로 사용합니다.

---

## NEIS API 키 설정

NEIS 인증키는 코드에 직접 넣지 않습니다.

Vercel → Project → Settings → Environment Variables 에서:

```text
Name: NEIS_API_KEY
Value: 본인이 발급받은 NEIS 인증키
```

Production / Preview / Development 중 필요한 환경에 체크하고 저장합니다.

그 뒤 반드시 Redeploy 하세요.

사이트는 브라우저에서 `/api/neis?date=YYYYMMDD`를 호출하며,
`api/neis.js`가 서버에서 NEIS API를 호출합니다. 따라서 인증키가 브라우저에 노출되지 않습니다.

---

## 정상 배포 확인 방법

배포 후 브라우저에서 아래 주소들을 직접 열어봅니다.

```text
https://내도메인.vercel.app/assets/style.css
https://내도메인.vercel.app/assets/app.js
https://내도메인.vercel.app/api/neis?date=20261028
```

첫 두 주소가 404면 Root Directory / GitHub 파일 업로드 구조 문제입니다.

`/api/neis`에서 `NEIS_API_KEY is not configured on Vercel`이 나오면 Environment Variable을 설정하지 않은 것입니다.

---

## GitHub 저장소 구조

다음 구조를 권장합니다.

```text
repo-root/
├─ index.html
├─ vercel.json
├─ firebase-config.js
├─ assets/
│  ├─ style.css
│  ├─ app.js
│  └─ favicon.svg
├─ api/
│  └─ neis.js
├─ data/
├─ firestore.rules
└─ DATABASE_SETUP.md
```

GitHub에서 `index.html`만 올리고 `assets` 폴더를 빠뜨리면 이번 스크린샷과 정확히 같은 화면이 나옵니다.

---

## DB 연결

게시글/댓글 DB는 기존 `DATABASE_SETUP.md`의 Firebase Firestore 구성을 사용할 수 있습니다.
Vercel은 프론트엔드와 NEIS 프록시를 담당하고, Firebase는 Authentication/Firestore를 담당하면 됩니다.

Firebase Hosting 관련 단계는 무시하고 다음만 사용하세요.

- Firebase Authentication
- Firestore
- Firestore Rules
- 필요 시 Firebase Storage

프론트의 `firebase-config.js`에 Firebase 웹 앱 설정값을 넣고 Vercel에 다시 배포하면 됩니다.
