export function validateNickname(value) {
  const nickname = typeof value === 'string' ? value.trim() : '';
  if (!nickname || nickname.length > 16 || /[\u0000-\u001f\u007f]/.test(nickname)) {
    throw Object.assign(new Error('닉네임은 공백만 입력할 수 없으며, 1~16자로 입력하세요.'), { statusCode: 400 });
  }
  return nickname;
}

export function isAnonymous(decoded) {
  return decoded.firebase?.sign_in_provider === 'anonymous';
}

export async function accountNickname(db, decoded) {
  if (isAnonymous(decoded)) return 'ㅇㅇ';
  const profile = await db.collection('profiles').findOne({ _id: decoded.uid });
  return profile?.nickname || String(decoded.name || decoded.email?.split('@')[0] || '고정닉').slice(0, 16);
}

export async function saveNickname(db, decoded, value) {
  if (isAnonymous(decoded)) throw Object.assign(new Error('로그인 후 닉네임을 설정하세요.'), { statusCode: 403 });
  const nickname = validateNickname(value);
  await db.collection('profiles').updateOne({ _id: decoded.uid }, { $set: { nickname, updatedAt: new Date() } }, { upsert: true });
  return nickname;
}
