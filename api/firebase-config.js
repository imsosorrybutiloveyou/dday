// Only public Firebase web-app fields may leave this endpoint.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }
  try {
    const source = JSON.parse(process.env.FIREBASE_WEB_CONFIG || '{}');
    const config = {};
    for (const key of ['apiKey', 'authDomain', 'projectId', 'appId', 'messagingSenderId', 'storageBucket']) {
      if (typeof source[key] === 'string') config[key] = source[key];
    }
    if (!config.apiKey || !config.authDomain || !config.projectId) throw new Error('Missing web config');
    return res.status(200).json(config);
  } catch {
    return res.status(503).json({ error: 'Firebase 공개 웹 앱 설정이 필요합니다. 관리자에게 문의해 주세요.' });
  }
}
