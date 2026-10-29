// Keep the voter set and counters on the same document for an atomic vote.
// ponytail: suitable for this class board; very large voter sets need a transactional ledger before MongoDB's 16MB document limit.
export async function initializeVotes(db, postId) {
  const posts = db.collection('posts');
  const post = await posts.findOne({ _id: postId }, { projection: { voterUids: 1 } });
  if (!post) return false;
  if (Array.isArray(post.voterUids)) return true;

  // Legacy records may contain repeated votes because the unique index was optional.
  // Keep the first vote per account, then initialize exactly once under concurrency.
  const records = await db.collection('votes').find({ postId }).sort({ createdAt: 1, _id: 1 }).toArray();
  const voters = new Set();
  let up = 0, down = 0;
  for (const record of records) {
    if (typeof record.uid !== 'string' || !record.uid || voters.has(record.uid) || !['up', 'down'].includes(record.kind)) continue;
    voters.add(record.uid);
    if (record.kind === 'up') up++; else down++;
  }
  await posts.updateOne(
    { _id: postId, voterUids: { $exists: false } },
    { $set: { voterUids: [...voters], up, down } }
  );
  return true;
}

export async function castVote(db, postId, uid, kind) {
  if (!['up', 'down'].includes(kind)) throw Object.assign(new Error('잘못된 투표입니다.'), { statusCode: 400 });
  if (!await initializeVotes(db, postId)) throw Object.assign(new Error('게시글이 없습니다.'), { statusCode: 404 });
  const post = await db.collection('posts').findOneAndUpdate(
    { _id: postId, voterUids: { $ne: uid } },
    { $inc: { [kind]: 1 }, $addToSet: { voterUids: uid } },
    { returnDocument: 'after' }
  );
  if (!post) throw Object.assign(new Error('이미 투표했거나 삭제된 글입니다.'), { statusCode: 409 });
  return post;
}
