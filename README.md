# 금융고 1-3 갤러리

서울금융고등학교 1학년 3반을 중심으로 한 게시판형 커뮤니티입니다.

디시인사이드 계열 커뮤니티의 조밀한 게시판 사용성을 참고하되, 원본 로고/상표/에셋을 복제하지 않고 별도 디자인으로 만들었습니다.

## 기본 설정

- 학교: 서울금융고등학교
- 학년/반: 1학년 3반
- 서울특별시교육청 코드: `B10`
- 학교 행정표준코드: `7010964`
- Discord: `https://discord.gg/DrwYjf2fYM`

## 주요 기능

- 전체글 / 개념글 / 공지
- 말머리
- 게시글 / 댓글
- 개추 / 비추
- 검색 / 인기글
- 로그인 선택제
- 비로그인 `ㅇㅇ(랜덤 코드)`
- 반콘
- 관리자 공지 / 반콘 관리
- NEIS 시간표
- NEIS 급식
- Discord 바로가기
- Firebase 연결 시 다중 사용자 DB 사용
- Firebase 미연결 시 브라우저 localStorage 데모 모드

## 관리자 데모 암호

`classadmin`

이 암호는 정적 JS 파일에서 확인 가능하므로 실제 보안 기능이 아닙니다.

실제 관리자 권한은 `DATABASE_SETUP.md`의 Firebase 관리자 UID 방식으로 바꾸세요.

## NEIS API 키 주의

사용자가 제공한 NEIS 인증키는 **프로젝트의 공개 프론트엔드 파일에 넣지 않았습니다.**

GitHub Pages에 JavaScript로 키를 넣으면 누구나 개발자 도구와 저장소에서 키를 볼 수 있습니다.

이 프로젝트의 `functions/index.js`가 Firebase Secret에서 인증키를 읽어 NEIS를 대신 호출하도록 구성되어 있습니다.

설정 방법은 `DATABASE_SETUP.md`를 참고하세요.

## 로컬 실행

정적 서버를 사용하세요.

VS Code:
1. Live Server 설치
2. `index.html` 우클릭
3. Open with Live Server

단순히 `file://`로 열면 JSON/API 요청이 브라우저 정책에 막힐 수 있습니다.

## GitHub Pages

DB 없이 데모 화면만 배포하려면 GitHub Pages에 그대로 업로드할 수 있습니다.

DB + 안전한 NEIS 키 프록시까지 사용할 거라면 Firebase Hosting을 권장합니다.
GitHub Pages를 계속 쓸 경우 NEIS 프록시는 별도 Firebase Function URL을 사용하도록 `assets/app.js`의 API 주소를 수정하면 됩니다.

자세한 과정은 `DATABASE_SETUP.md`에 있습니다.


## Firebase 연결 시 익명 사용자

Firebase를 연결하면 사이트는 화면에는 기존처럼 `ㅇㅇ(랜덤 코드)`를 표시하지만,
DB 권한을 위해 내부적으로 Firebase Anonymous Authentication UID를 발급받습니다.
따라서 Firestore를 완전히 공개 쓰기로 열지 않아도 익명 게시판을 운영할 수 있습니다.
