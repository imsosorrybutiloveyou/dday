import { head } from '@vercel/blob';

export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
export const MAX_ATTACHMENTS = 6;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function invalid(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export async function validateAttachments(items = [], uid, inspect = head) {
  if (!Array.isArray(items) || items.length > MAX_ATTACHMENTS) throw invalid('첨부는 최대 6개까지 가능합니다.');
  const urls = new Set();
  const result = [];
  const ids = new Set();
  for (const item of items) {
    let url;
    try { url = new URL(item.url); } catch { throw invalid('잘못된 첨부 주소입니다.'); }
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname) || url.port || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(`/posts/${encodeURIComponent(uid)}/`)) {
      throw invalid('직접 업로드한 파일만 첨부할 수 있습니다.');
    }
    if (urls.has(url.href)) throw invalid('같은 파일을 중복 첨부할 수 없습니다.');
    urls.add(url.href);
    if (item.id !== undefined && (typeof item.id !== 'string' || !/^[a-f0-9-]{36}$/.test(item.id) || ids.has(item.id))) throw invalid('잘못된 첨부 식별자입니다.');
    if (item.id) ids.add(item.id);
    const metadata = await inspect(url.href);
    const type = metadata.contentType;
    if (!MEDIA_TYPES.includes(type)) throw invalid('지원하지 않는 파일 형식입니다.');
    const limit = type.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (!Number.isFinite(metadata.size) || metadata.size <= 0 || metadata.size > limit) throw invalid('사진은 10MB, 영상은 100MB까지 가능합니다.');
    result.push({ ...(item.id ? { id: item.id } : {}), url: url.href, type, size: metadata.size, name: String(item.name || '첨부 파일').slice(0, 160) });
  }
  return result;
}
