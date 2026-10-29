// Only public Firebase web-app fields may leave this endpoint.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }
  const unavailable = error => res.status(503).json({ error });
  const raw = process.env.FIREBASE_WEB_CONFIG;
  if (!raw?.trim()) {
    return unavailable('이 배포에 FIREBASE_WEB_CONFIG가 없습니다. Vercel에서 배포 환경(Production/Preview)을 확인하고 등록 후 재배포해 주세요.');
  }
  let source;
  try {
    source = JSON.parse(raw);
  } catch {
    return unavailable('FIREBASE_WEB_CONFIG가 올바른 JSON이 아닙니다. const firebaseConfig = 부분 없이, 키와 값을 큰따옴표로 감싼 JSON 객체만 등록해 주세요.');
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return unavailable('FIREBASE_WEB_CONFIG에는 공개 웹 설정 JSON 객체를 등록해 주세요.');
  }
  if (source.private_key || source.type === 'service_account') {
    return unavailable('FIREBASE_WEB_CONFIG에 서버 서비스 계정이 등록되어 있습니다. Firebase 콘솔의 공개 웹 앱 설정으로 교체해 주세요.');
  }
  const config = {};
  for (const key of ['apiKey', 'authDomain', 'projectId', 'appId', 'messagingSenderId', 'storageBucket']) {
    if (typeof source[key] === 'string') config[key] = source[key].trim();
  }
  const missing = ['apiKey', 'authDomain', 'projectId'].filter(key => !config[key]);
  if (missing.length) {
    return unavailable(`Firebase 공개 웹 설정에 ${missing.join(', ')} 항목이 없습니다. 필드명은 대소문자를 구분합니다.`);
  }
  return res.status(200).json(config);
}
