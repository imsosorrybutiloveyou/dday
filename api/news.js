import { validateAttachments } from "./_media.js";
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
      if (req.query?.id !== undefined) {
        if (typeof req.query.id !== 'string' || !/^[a-f0-9]{64}$/.test(req.query.id)) return res.status(400).json({ error: '잘못된 소식 주소입니다.' });
        const item = await db.collection('news').findOne({ _id: req.query.id }, { projection: { eventKey: 0, titleKey: 0 } });
        return item ? res.status(200).json({ item }) : res.status(404).json({ error: '소식을 찾을 수 없습니다.' });
      }
      const [items, state] = await Promise.all([
        db.collection('news').find({}, { projection: { eventKey: 0, titleKey: 0, body: 0 } }).sort({ createdAt: -1 }).limit(100).toArray(),
        db.collection('settings').findOne({ _id: 'news' })
      ]);
      return res.status(200).json({ items, lastCheckedAt: state?.lastCheckedAt || null });
    }
    if (!cron) {
      if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
      const decoded = await requireUser(req);
      const admins = String(process.env.ADMIN_UIDS || '').split(',').map(value=>value.trim()).filter(Boolean);
      const admin = admins.includes(decoded.uid) || await db.collection('admins').findOne({ uid: decoded.uid, enabled: { $ne: false } });
      if (!admin) return res.status(403).json({ error: '관리자만 소식을 수집하거나 사진을 첨부할 수 있습니다.' });
      if (req.body?.action === 'attachPhotos') {
        const id = req.body.id;
        if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) return res.status(400).json({ error: '잘못된 소식 주소입니다.' });
        const existing = await db.collection('news').findOne({ _id: id });
        if (!existing) return res.status(404).json({ error: '소식을 찾을 수 없습니다.' });
        const photos = await validateAttachments(req.body.attachments, decoded.uid);
        if (!photos.length || photos.some(photo=>!photo.type.startsWith('image/'))) return res.status(400).json({ error: '사진 파일만 첨부할 수 있습니다.' });
        const item = await db.collection('news').findOneAndUpdate(
          { _id: id, 'attachments.url': { $nin: photos.map(photo=>photo.url) }, $expr: { $lte: [{ $size: { $ifNull: ['$attachments', []] } }, 6-photos.length] } },
          { $push: { attachments: { $each: photos } }, $set: { updatedAt: new Date() } },
          { returnDocument: 'after', projection: { eventKey: 0, titleKey: 0 } }
        );
        if (!item) return res.status(409).json({ error: '이미 첨부된 사진이거나 최대 6개 제한을 초과했습니다. 글을 다시 열어 확인하세요.' });
        return res.status(200).json({ item });
      }
      if (req.body?.action && req.body.action !== 'refresh') return res.status(400).json({ error: '지원하지 않는 요청입니다.' });
    }
    return res.status(200).json(await refreshNews(db));
  } catch (error) {
    console.error('News request failed:', error.statusCode || 'news_error');
    return res.status(error.statusCode || 500).json({ error: error.message || '소식을 불러오지 못했습니다.' });
  }
}
