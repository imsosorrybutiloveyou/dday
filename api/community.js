import { castVote, initializeVotes } from "./_votes.js";
import { accountNickname, saveNickname, isAnonymous } from "./_profiles.js";
import { del } from "@vercel/blob";
import { validateAttachments } from "./_media.js";

import { ObjectId } from "mongodb";
import { getDb } from "./_mongo.js";
import { requireUser } from "./_firebase-admin.js";

const MAX_TEXT = 5000;
const MAX_EMOTE_BYTES = 700 * 1024;

function json(res, status, data) {
  res.status(status).json(data);
}

function text(v, max = MAX_TEXT) {
  return String(v ?? "").trim().slice(0, max);
}

function objectId(v) {
  try { return new ObjectId(String(v)); }
  catch { return null; }
}

function publicPost(p) {
  return {
    id: String(p._id),
    docId: String(p._id),
    category: p.category || "잡담",
    title: p.title || "",
    body: p.body || "",
    author: p.author || "ㅇㅇ",
    guestCode: p.guestCode || "",
    ownerUid: p.ownerUid || "",
    createdAt: new Date(p.createdAt || Date.now()).getTime(),
    views: Number(p.views || 0),
    up: Number(p.up || 0),
    down: Number(p.down || 0),
    notice: Boolean(p.notice),
    image: p.image || "",
    attachments: p.attachments || [],
    commentCount: Number(p.commentCount || 0),
    comments: []
  };
}

function publicComment(c) {
  return {
    id: String(c._id),
    author: c.author || "ㅇㅇ",
    guestCode: c.guestCode || "",
    ownerUid: c.ownerUid || "",
    text: c.text || "",
    createdAt: new Date(c.createdAt || Date.now()).getTime()
  };
}

function publicEmote(e) {
  return {
    id: String(e._id),
    docId: String(e._id),
    name: e.name || "반콘",
    type: "image",
    url: e.dataUrl || "",
    ownerUid: e.ownerUid || "",
    ownerName: e.ownerName || "",
    order: Number(e.order || 0),
    createdAt: new Date(e.createdAt || Date.now()).getTime()
  };
}

async function isAdmin(db, uid) {
  const envAdmins = String(process.env.ADMIN_UIDS || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);

  if (envAdmins.includes(uid)) return true;

  const row = await db.collection("admins").findOne({ uid, enabled: { $ne: false } });
  return Boolean(row);
}

async function authContext(req, db) {
  const decoded = await requireUser(req);
  return {
    decoded,
    uid: decoded.uid,
    nickname: await accountNickname(db, decoded),
    admin: await isAdmin(db, decoded.uid)
  };
}

function validateDataUrl(dataUrl) {
  const value = String(dataUrl || "");
  const match = value.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return { ok: false, error: "PNG/JPG/WebP/GIF 이미지만 사용할 수 있습니다." };
  const bytes = Math.floor(match[2].length * 3 / 4);
  if (bytes > MAX_EMOTE_BYTES) return { ok: false, error: "반콘은 700KB 이하만 가능합니다." };
  return { ok: true, bytes, mime: match[1] };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    const db = await getDb();
    const action = String(req.query.action || req.body?.action || "bootstrap");

    if (req.method === "GET" && action === "bootstrap") {
      const [posts, emotes, settings] = await Promise.all([
        db.collection("posts").find({}).sort({ notice: -1, createdAt: -1 }).limit(300).toArray(),
        db.collection("emotes").find({}).sort({ order: 1, createdAt: 1 }).limit(100).toArray(),
        db.collection("settings").findOne({ _id: "site" })
      ]);

      return json(res, 200, {
        posts: posts.map(publicPost),
        emotes: emotes.map(publicEmote),
        settings: settings || {}
      });
    }

    if (req.method === "GET" && action === "post") {
      const id = objectId(req.query.id);
      if (!id) return json(res, 400, { error: "잘못된 게시글 ID" });

      await initializeVotes(db, id);
      const post = await db.collection("posts").findOneAndUpdate(
        { _id: id },
        { $inc: { views: 1 } },
        { returnDocument: "after" }
      );
      if (!post) return json(res, 404, { error: "게시글을 찾을 수 없습니다." });

      const comments = await db.collection("comments")
        .find({ postId: id })
        .sort({ createdAt: 1 })
        .limit(1000)
        .toArray();

      return json(res, 200, {
        post: { ...publicPost(post), comments: comments.map(publicComment) }
      });
    }

    if (req.method !== "POST") {
      return json(res, 405, { error: "Method not allowed" });
    }

    const { decoded, uid, admin, nickname } = await authContext(req, db);
    const body = req.body || {};

    if (action === "me") {
      return json(res, 200, { uid, isAdmin: admin, nickname });
    }

    if (action === "updateNickname") {
      const saved = await saveNickname(db, decoded, body.nickname);
      return json(res, 200, { nickname: saved });
    }

    if (action === "createPost") {
      if (typeof body.body === "string" && body.body.length > 5000) return json(res, 400, { error: "본문은 5000자까지 입력할 수 있습니다." });
      const title = text(body.title, 80);
      const postBody = text(body.body, 5000);
      if (!title) return json(res, 400, { error: "제목을 입력하세요." });
      const attachments = await validateAttachments(body.attachments, uid);
      if (!postBody && !attachments.length) return json(res, 400, { error: "내용을 입력하거나 파일을 첨부하세요." });
      const doc = {
        attachments,
        category: text(body.category, 20) || "잡담",
        title,
        body: postBody,
        author: nickname,
        guestCode: text(body.guestCode, 40),
        ownerUid: uid,
        createdAt: new Date(),
        views: 0,
        voterUids: [],
        up: 0,
        down: 0,
        notice: false,
        image: text(body.image, 1200),
        commentCount: 0
      };
      const result = await db.collection("posts").insertOne(doc);
      return json(res, 201, { post: publicPost({ ...doc, _id: result.insertedId }) });
    }

    if (action === "createNotice") {
      if (!admin) return json(res, 403, { error: "관리자 권한이 필요합니다." });
      if (typeof body.body === "string" && body.body.length > 5000) return json(res, 400, { error: "본문은 5000자까지 입력할 수 있습니다." });
      const attachments = await validateAttachments(body.attachments, uid);
      const title = text(body.title, 80);
      const postBody = text(body.body, 5000);
      if (!title || (!postBody && !attachments.length)) return json(res, 400, { error: "제목과 내용 또는 첨부를 입력하세요." });

      const doc = {
        attachments,
        category: "공지",
        title,
        body: postBody,
        author: "관리자",
        guestCode: "",
        ownerUid: uid,
        createdAt: new Date(),
        views: 0,
        voterUids: [],
        up: 0,
        down: 0,
        notice: true,
        image: text(body.image, 1200),
        commentCount: 0
      };
      const result = await db.collection("posts").insertOne(doc);
      return json(res, 201, { post: publicPost({ ...doc, _id: result.insertedId }) });
    }

    if (action === "createComment") {
      const postId = objectId(body.postId);
      const commentText = text(body.text, 500);
      if (!postId || !commentText) return json(res, 400, { error: "댓글을 입력하세요." });

      const post = await db.collection("posts").findOne({ _id: postId });
      if (!post) return json(res, 404, { error: "게시글이 없습니다." });

      const doc = {
        postId,
        author: nickname,
        guestCode: text(body.guestCode, 40),
        ownerUid: uid,
        text: commentText,
        createdAt: new Date()
      };
      const result = await db.collection("comments").insertOne(doc);
      await db.collection("posts").updateOne({ _id: postId }, { $inc: { commentCount: 1 } });
      return json(res, 201, { comment: publicComment({ ...doc, _id: result.insertedId }) });
    }

    if (action === "vote") {
      if (isAnonymous(decoded)) return json(res, 403, { error: "추천·비추천은 로그인 후 이용할 수 있습니다." });
      const postId = objectId(body.postId);
      if (!postId) return json(res, 400, { error: "잘못된 게시글입니다." });
      const post = await castVote(db, postId, uid, body.kind);
      return json(res, 200, { post: publicPost(post) });
    }

    if (action === "deletePost") {
      const postId = objectId(body.postId);
      if (!postId) return json(res, 400, { error: "잘못된 게시글입니다." });
      const post = await db.collection("posts").findOne({ _id: postId });
      if (!post) return json(res, 404, { error: "게시글이 없습니다." });
      if (!admin && post.ownerUid !== uid) return json(res, 403, { error: "삭제 권한이 없습니다." });

      if (post.attachments?.length) await del(post.attachments.map(media => media.url));
      await Promise.all([
        db.collection("posts").deleteOne({ _id: postId }),
        db.collection("comments").deleteMany({ postId }),
        db.collection("votes").deleteMany({ postId })
      ]);
      return json(res, 200, { ok: true });
    }

    if (action === "deleteAllPosts") {
      if (!admin) return json(res, 403, { error: "관리자 권한이 필요합니다." });
      const attached = await db.collection("posts").find({ "attachments.0": { $exists: true } }, { projection: { attachments: 1 } }).toArray();
      const urls = attached.flatMap(post => post.attachments.map(media => media.url));
      if (urls.length) await del(urls);
      await Promise.all([
        db.collection("posts").deleteMany({}),
        db.collection("comments").deleteMany({}),
        db.collection("votes").deleteMany({})
      ]);
      return json(res, 200, { ok: true });
    }

    if (action === "createEmote") {
      const name = text(body.name, 20);
      const check = validateDataUrl(body.dataUrl);
      if (!name) return json(res, 400, { error: "반콘 이름을 입력하세요." });
      if (!check.ok) return json(res, 400, { error: check.error });

      const count = await db.collection("emotes").countDocuments();
      const doc = {
        name,
        dataUrl: body.dataUrl,
        mime: check.mime,
        bytes: check.bytes,
        ownerUid: uid,
        ownerName: nickname || "ㅇㅇ",
        order: count,
        createdAt: new Date()
      };
      const result = await db.collection("emotes").insertOne(doc);
      return json(res, 201, { emote: publicEmote({ ...doc, _id: result.insertedId }) });
    }

    if (action === "deleteEmote") {
      if (!admin) return json(res, 403, { error: "관리자 권한이 필요합니다." });
      const id = objectId(body.emoteId);
      if (!id) return json(res, 400, { error: "잘못된 반콘 ID" });
      await db.collection("emotes").deleteOne({ _id: id });
      return json(res, 200, { ok: true });
    }

    if (action === "saveSettings") {
      if (!admin) return json(res, 403, { error: "관리자 권한이 필요합니다." });
      const discord = text(body.discord, 500);
      await db.collection("settings").updateOne(
        { _id: "site" },
        { $set: { discord, updatedAt: new Date() } },
        { upsert: true }
      );
      return json(res, 200, { ok: true, settings: { discord } });
    }

    return json(res, 400, { error: "Unknown action" });
  } catch (err) {
    console.error(err);
    return json(res, err.statusCode || 500, { error: err.message || "Server error" });
  }
}
