import { issueSignedToken } from '@vercel/blob';
import { handleUpload, handleUploadPresigned } from '@vercel/blob/client';
import { requireUser } from './_firebase-admin.js';
import { MEDIA_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from './_media.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const presigned = Boolean(process.env.BLOB_STORE_ID?.trim() && process.env.BLOB_WEBHOOK_PUBLIC_KEY?.trim());
  const available = presigned || Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  if (req.method === 'GET') return res.status(200).json({ available, mode: presigned ? 'presigned' : 'legacy' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!available) {
    return res.status(503).json({ error: '첨부 저장소가 연결되지 않았습니다. Vercel Storage에서 Public Blob을 연결한 뒤 재배포해 주세요.' });
  }
  try {
    const authorize = async (pathname, clientPayload) => {
      const user = await requireUser(req);
      const prefix = `posts/${encodeURIComponent(user.uid)}/`;
      const filename = pathname.slice(prefix.length);
      if (!pathname.startsWith(prefix) || !/^[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm)$/.test(filename)) {
        throw Object.assign(new Error('잘못된 업로드 경로입니다.'), { statusCode: 400 });
      }
      const type = JSON.parse(clientPayload || '{}').type;
      if (!MEDIA_TYPES.includes(type)) throw Object.assign(new Error('지원하지 않는 파일 형식입니다.'), { statusCode: 400 });
      return {
        allowedContentTypes: [type],
        maximumSizeInBytes: type.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES,
        validUntil: Date.now() + 15 * 60 * 1000,
        addRandomSuffix: true,
        allowOverwrite: false
      };
    };
    const result = req.body?.type === 'blob.generate-presigned-url'
      ? await handleUploadPresigned({
          request: req,
          body: req.body,
          getSignedToken: async (pathname, clientPayload) => {
            const policy = await authorize(pathname, clientPayload);
            const token = await issueSignedToken({
              pathname,
              operations: ['put'],
              allowedContentTypes: policy.allowedContentTypes,
              maximumSizeInBytes: policy.maximumSizeInBytes,
              validUntil: policy.validUntil
            });
            return { token, urlOptions: policy };
          }
        })
      : await handleUpload({ request: req, body: req.body, onBeforeGenerateToken: authorize });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Upload authorization failed:', error.code || error.statusCode || 'upload_error');
    return res.status(error.statusCode || 400).json({ error: error.statusCode ? error.message : '업로드를 시작하지 못했습니다. 저장소 설정과 파일 형식을 확인해 주세요.' });
  }
}
