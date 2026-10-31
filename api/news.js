import { timingSafeEqual } from 'node:crypto';
import { getDb } from './_mongo.js';
import { requireUser } from './_firebase-admin.js';
import { refreshNews } from '../lib/news.js';

function cronAuthorized(header) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const supplied = Buffer.from(header), expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const cronRequest = req.method === 'GET' && req.query?.refresh === '1';
    const cron = cronRequest && cronAuthorized(req.headers.authorization);
    if (cronRequest && !cron) return res.status(401).json({ error: '자동 수집 인증 설정을 확인해 주세요.' });
    const db = await getDb();
    if (req.method === 'GET' && !cron) {
      const [items, state] = await Promise.all([
        db.collection('news').find({}, { projection: { eventKey: 0, titleKey: 0 } }).sort({ createdAt: -1 }).limit(100).toArray(),
        db.collection('settings').findOne({ _id: 'news' })
      ]);
      return res.status(200).json({ items, lastCheckedAt: state?.lastCheckedAt || null });
    }
    if (!cron) {
      if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
      const decoded = await requireUser(req);
      const admins = String(process.env.ADMIN_UIDS || '').split(',').map(value=>value.trim()).filter(Boolean);
      const admin = admins.includes(decoded.uid) || await db.collection('admins').findOne({ uid: decoded.uid, enabled: { $ne: false } });
      if (!admin) return res.status(403).json({ error: '관리자만 새 소식을 수집할 수 있습니다.' });
    }
    return res.status(200).json(await refreshNews(db));
  } catch (error) {
    console.error('News request failed:', error.statusCode || 'news_error');
    return res.status(error.statusCode || 500).json({ error: error.message || '소식을 불러오지 못했습니다.' });
  }
}
