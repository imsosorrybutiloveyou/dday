
import { getDb } from "./_mongo.js";
import { requireUser } from "./_firebase-admin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const decoded = await requireUser(req);

    const adminUids = String(process.env.ADMIN_UIDS || "")
      .split(",").map(v => v.trim()).filter(Boolean);

    if (!adminUids.includes(decoded.uid)) {
      return res.status(403).json({ error: "ADMIN_UIDS에 등록된 관리자만 실행할 수 있습니다." });
    }

    const db = await getDb();
    await db.collection("votes").createIndex({ postId: 1, uid: 1 }, { unique: true });
    await db.collection("posts").createIndex({ createdAt: -1 });
    await db.collection("comments").createIndex({ postId: 1, createdAt: 1 });
    await db.collection("emotes").createIndex({ order: 1 });

    return res.status(200).json({ ok: true, message: "MongoDB 인덱스 생성 완료" });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({ error: err.message || "setup failed" });
  }
}
