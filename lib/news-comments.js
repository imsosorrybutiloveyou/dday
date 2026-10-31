import { createHash } from 'node:crypto';
import { accountNickname } from '../api/_profiles.js';

export function publicNewsComment(comment){
  return {id:comment._id,author:comment.author,text:comment.text,createdAt:comment.createdAt};
}
export async function addNewsComment(db,decoded,input){
  if(typeof input.id!=='string'||!/^[a-f0-9]{64}$/.test(input.id))throw Object.assign(Error('잘못된 글 주소입니다.'),{statusCode:400});
  const text=typeof input.text==='string'?input.text.trim():'';
  if(!text||text.length>1000)throw Object.assign(Error('댓글은 1~1000자로 입력하세요.'),{statusCode:400});
  if(typeof input.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(input.requestId))throw Object.assign(Error('잘못된 댓글 요청입니다.'),{statusCode:400});
  if(!await db.collection('news').findOne({_id:input.id}))throw Object.assign(Error('글을 찾을 수 없습니다.'),{statusCode:404});
  const collection=db.collection('newsComments');
  await collection.createIndex({newsId:1,createdAt:-1});
  const comment={_id:createHash('sha256').update(JSON.stringify([input.id,decoded.uid,input.requestId])).digest('hex'),newsId:input.id,ownerUid:decoded.uid,author:await accountNickname(db,decoded),text,createdAt:new Date()};
  try{await collection.insertOne(comment);return publicNewsComment(comment);}
  catch(error){if(error.code!==11000)throw error;return publicNewsComment(await collection.findOne({_id:comment._id}));}
}
