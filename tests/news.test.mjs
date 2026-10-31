import assert from 'node:assert/strict';
import {canonicalUrl, topicKey, groundedNews, refreshNews, NEWS_TAGS} from '../lib/news.js';
const now=new Date('2026-10-31T09:00:00Z');
function envelope(items,uris=items.map(item=>item.sourceUrl)){
 return {candidates:[{content:{parts:[{text:JSON.stringify({items})}]},groundingMetadata:{groundingChunks:uris.map(uri=>({web:{uri,title:'Official release'}}))}}]};
}
const item={title:'도구 2.0 출시',summary:'개발 도구의 변경 사항과 영향입니다.',body:'검증된 릴리스 변경 사항과 개발 환경에 미치는 영향을 설명합니다. '.repeat(20),eventKey:'tool-v2.0-release',publishedDate:'2026-10-30',sourceUrl:'https://example.com/release?utm_source=test&id=2#section'};
assert.equal(canonicalUrl(item.sourceUrl),'https://example.com/release?id=2');
assert.notEqual(topicKey('C++ 1.0'),topicKey('C 10'));
assert.throws(()=>canonicalUrl('javascript:alert(1)'));
assert.equal((await groundedNews(envelope([item]),now))[0].body,item.body.trim());
await assert.rejects(()=>groundedNews(envelope([{...item,body:'too short'}]),now));
assert.equal((await groundedNews(envelope([item]),now))[0].sourceUrl,'https://example.com/release?id=2');
assert.deepEqual(await groundedNews(envelope([],[]),now),[]);
await assert.rejects(()=>groundedNews(envelope([item],[]),now),/출처/);
await assert.rejects(()=>groundedNews(envelope([{...item,sourceUrl:'https://invented.example/news'}],[item.sourceUrl]),now));
await assert.rejects(()=>groundedNews(envelope([{...item,publishedDate:'2025-01-01'}]),now));
await assert.rejects(()=>groundedNews(envelope([{...item,publishedDate:'2026-11-05'}]),now));
const redirect='https://vertexaisearch.cloud.google.com/grounding-api-redirect/example';
let redirectCalls=0;
const resolved=await groundedNews(envelope([{...item,sourceUrl:'https://example.com/release?id=2'}],[redirect]),now,async(url,options)=>{
 redirectCalls++;assert.equal(url,redirect);assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://example.com/release?id=2'}});
});
assert.equal(redirectCalls,1);assert.equal(resolved[0].sourceUrl,'https://example.com/release?id=2');

function database(){
 const rows=[],settings=new Map();let lock=null;
 return {rows,collection(name){
  if(name==='news')return {async createIndex(){},find(){return {sort(){return {limit(){return {async toArray(){return [...rows];}};}};}};},async insertOne(item){if(rows.some(row=>row._id===item._id||row.titleKey===item.titleKey||row.eventKey===item.eventKey))throw Object.assign(Error('duplicate'),{code:11000});rows.push(item);}};
  if(name==='posts')return {find(){return {sort(){return {limit(){return {async toArray(){return [{title:'이미 있는 글'}];}};}};}};}};
  if(name==='jobs')return {async findOneAndUpdate(filter,update){if(lock&&lock.expiresAt>filter.expiresAt.$lte)throw Object.assign(Error('busy'),{code:11000});lock=update.$set;return lock;},async deleteOne(filter){if(lock?.owner===filter.owner)lock=null;}};
  if(name==='settings')return {async findOne(filter){return settings.get(filter._id);},async updateOne(filter,update){settings.set(filter._id,update.$set);}};
  throw Error(name);
 }};
}
const oldKey=process.env.GEMINI_API_KEY;
try{
 delete process.env.GEMINI_API_KEY;
 await assert.rejects(()=>refreshNews(database()),{statusCode:503});
 process.env.GEMINI_API_KEY='test-only';
 const db=database();let calls=0;
 const request=async(url,options)=>{
  if(!url.includes('generativelanguage.googleapis.com'))return Response.json({query:{pages:{}}});
  calls++;assert.match(url,/generativelanguage.googleapis.com/);assert.equal(options.headers['x-goog-api-key'],'test-only');
  assert.deepEqual(JSON.parse(options.body).tools,[{google_search:{}}]);
  return Response.json(envelope([item,{...item,title:'같은 사건 다른 제목',sourceUrl:'https://example.com/another'}, {...item,title:'이미 있는 글',eventKey:'existing-post',sourceUrl:'https://example.com/existing'}]));
 };
 const results=await Promise.allSettled([refreshNews(db,{request,now}),refreshNews(db,{request,now})]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.equal(calls,1);assert.equal(db.rows.length,1);
 assert.equal(results.find(result=>result.status==='fulfilled').value.skipped,2);
 await assert.rejects(()=>refreshNews(db,{request,now}),{statusCode:429});
 const repeat=await refreshNews(db,{request,now:new Date(now.getTime()+20*60*1000)});
 assert.equal(repeat.added,0);assert.equal(db.rows.length,1);
 const failing=database();
 await assert.rejects(()=>refreshNews(failing,{now,request:async()=>new Response('',{status:429})}),/사용량/);
 assert.equal((await refreshNews(failing,{now,request:async()=>Response.json(envelope([]))})).added,0,'Failure must release lock');
}finally{if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;}
console.log('News checks passed: grounding/date validation, canonical source URLs, duplicate event/title/source rejection, existing posts, concurrent refresh lock, cooldown, provider errors. External services stubbed.');

const {readFileSync}=await import('node:fs');
const vm=await import('node:vm');
const {timingSafeEqual}=await import('node:crypto');
let refreshed=0;
const {publicNewsComment}=await import('../lib/news-comments.js');
const apiDb={collection(name){
 if(name==='news')return {find(){return {sort(){return {limit(){return {async toArray(){return []}}}}}}}};
 return {async findOne(){return null}};
}};
const context=vm.createContext({publicNewsComment,NEWS_TAGS,Buffer,timingSafeEqual,console:{error(){}},process:{env:{ADMIN_UIDS:'admin',CRON_SECRET:'test-cron-secret'}},getDb:async()=>apiDb,requireUser:async req=>{if(!req.headers.authorization)throw Object.assign(Error('auth required'),{statusCode:401});return {uid:req.headers.authorization.replace('Bearer ','')};},refreshNews:async()=>{refreshed++;return {added:1};}});
vm.runInContext(readFileSync(new URL('../api/news.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function','async function'),context);
const response=()=>({setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}});
async function invoke(method,authorization,query={}){const res=response();await context.handler({method,headers:{authorization},query,body:{action:"refresh"}},res);return res;}
assert.equal((await invoke('GET')).code,200);assert.equal(refreshed,0);
assert.equal((await invoke('POST')).code,401);
assert.equal((await invoke('POST','Bearer member')).code,403);assert.equal(refreshed,0);
assert.equal((await invoke('GET','Bearer wrong-secret')).code,200);assert.equal(refreshed,0);
assert.equal((await invoke('GET','Bearer wrong-secret',{refresh:'1'})).code,401);
assert.equal((await invoke('POST','Bearer admin')).code,200);assert.equal(refreshed,1);
assert.equal((await invoke('GET','Bearer test-cron-secret',{refresh:'1'})).code,200);assert.equal(refreshed,2);
delete context.process.env.CRON_SECRET;
assert.equal((await invoke('GET','Bearer undefined',{refresh:'1'})).code,401);assert.equal(refreshed,2);

const {ObjectId}=await import('mongodb');
let notice;
const noticeDb={collection(name){if(name==='posts')return {async insertOne(doc){notice=doc;return {insertedId:new ObjectId()}}};return {async findOne(){return null}};}};
const noticeContext=vm.createContext({ObjectId,console:{error(){}},process:{env:{ADMIN_UIDS:'admin'}},getDb:async()=>noticeDb,requireUser:async req=>({uid:req.headers.authorization}),accountNickname:async()=> 'nickname',validateAttachments:async()=>[]});
vm.runInContext(readFileSync(new URL('../api/community.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function','async function'),noticeContext);
async function createNotice(uid,body){const res=response();await noticeContext.handler({method:'POST',headers:{authorization:uid},query:{action:'createNotice'},body},res);return res;}
assert.equal((await createNotice('member',{title:'title',body:'body'})).code,403);assert.equal(notice,undefined);
assert.equal((await createNotice('admin',{title:' ',body:'body'})).code,400);
assert.equal((await createNotice('admin',{title:'공지 제목',body:'공지 내용'})).code,201);
assert.equal(notice.notice,true);assert.equal(notice.ownerUid,'admin');assert.equal(notice.category,'공지');
console.log('Notice/news authorization checks passed: admin-only notices and collection, public read-only feed, cron secret verification.');

const articleId='a'.repeat(64);
let article={_id:articleId,title:'긴 소식',summary:'이전 요약',body:'자세한 본문',attachments:[]};
let photoType='image/png';
context.validateAttachments=async entries=>entries.map(entry=>({...entry,type:photoType,size:100}));
context.getDb=async()=>({collection(name){
 if(name==='newsComments')return {find(){return {sort(){return {limit(){return {async toArray(){return []}}}}}}}};
 if(name==='admins')return {async findOne(){return null}};
 if(name==='news')return {
  async findOne(filter){return filter._id===article._id?structuredClone(article):null},
  async findOneAndUpdate(filter,update){
   const photos=update.$push.attachments.$each;
   assert.equal(filter.$expr.$lte[1],6-photos.length);
   assert.deepEqual([...filter['attachments.url'].$nin],photos.map(photo=>photo.url));
   if(article.attachments.length+photos.length>6||photos.some(photo=>article.attachments.some(old=>old.url===photo.url)))return null;
   article.attachments.push(...photos);return structuredClone(article);
  }
 };
 throw Error(name);
}});
assert.equal((await invoke('GET',undefined,{id:'bad'})).code,400);
assert.equal((await invoke('GET',undefined,{id:'b'.repeat(64)})).code,404);
assert.equal((await invoke('GET',undefined,{id:articleId})).body.item.body,'자세한 본문');
async function attach(uid,attachments){const res=response();await context.handler({method:'POST',headers:{authorization:`Bearer ${uid}`},body:{action:'attachPhotos',id:articleId,attachments}},res);return res;}
const photo={url:'https://test.public.blob.vercel-storage.com/posts/admin/photo.png',name:'사진'};
assert.equal((await attach('member',[photo])).code,403);assert.equal(article.attachments.length,0);
assert.equal((await attach('admin',[photo])).code,200);assert.equal(article.attachments.length,1);
assert.equal((await attach('admin',[photo])).code,409);assert.equal(article.attachments.length,1);
photoType='video/mp4';assert.equal((await attach('admin',[{...photo,url:photo.url+'2'}])).code,400);
photoType='image/png';article.attachments=Array.from({length:6},(_,i)=>({url:'https://example.com/'+i}));
assert.equal((await attach('admin',[photo])).code,409);assert.equal(article.attachments.length,6);
console.log('News detail/photo checks passed: public detail lookup, admin-only images, duplicate and concurrent count guard, video rejection.');

// Timeless knowledge is allowed without a recent publication date, but still needs grounding.
const knowledge={...item,kind:'knowledge',title:'모듈러 편향은 왜 생길까',publishedDate:null,tags:['알고리즘','개념·원리','unknown','알고리즘']};
const knowledgeResult=await groundedNews(envelope([knowledge]),now);
assert.equal(knowledgeResult[0].kind,'knowledge');assert.equal(knowledgeResult[0].publishedDate,null);
assert.deepEqual(knowledgeResult[0].tags,['알고리즘','개념·원리']);
assert.equal((await groundedNews(envelope([item]),now))[0].tags[0],'최신 소식');

const {findNewsImage}=await import('../lib/news-images.js');
const imageInfo={mime:'image/png',thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/test.png',descriptionurl:'https://commons.wikimedia.org/wiki/File:TempleOS.png',extmetadata:{Artist:{value:'<a href="https://example.com">Creator</a>'},LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'}}};
const imageRequest=info=>async(url,options)=>{
 assert.equal(new URL(url).hostname,'commons.wikimedia.org');assert.equal(options.signal.aborted,false);
 return Response.json({query:{pages:{1:{title:'File:TempleOS.png',index:1,imageinfo:[info]}}}});
};
const image=await findNewsImage('TempleOS screenshot',imageRequest(imageInfo));
assert.equal(image.credit,'Creator');assert.equal(image.license,'CC BY-SA 4.0');assert.equal(image.sourceUrl,imageInfo.descriptionurl);
assert.equal(await findNewsImage('query',imageRequest({...imageInfo,extmetadata:{...imageInfo.extmetadata,LicenseShortName:{value:'CC BY-NC 4.0'}}})),null);
assert.equal(await findNewsImage('query',imageRequest({...imageInfo,thumburl:'https://evil.example/image.png'})),null);
assert.equal((await findNewsImage('query',imageRequest({...imageInfo,mime:'image/svg+xml'}))).url,imageInfo.thumburl);
assert.equal(await findNewsImage('query',imageRequest({...imageInfo,mime:'image/svg+xml',thumburl:'https://upload.wikimedia.org/raw.svg'})),null);
assert.equal(await findNewsImage('query',async()=>{throw Error('offline')}),null);

const {addNewsComment}=await import('../lib/news-comments.js');
const commentRows=new Map();
const commentDb={collection(name){
 if(name==='news')return {async findOne(filter){return filter._id===articleId?{_id:articleId}:null}};
 if(name==='profiles')return {async findOne(){return {nickname:'저장된닉네임'}}};
 if(name==='newsComments')return {async createIndex(){},async insertOne(row){if(commentRows.has(row._id))throw Object.assign(Error('duplicate'),{code:11000});commentRows.set(row._id,row);},async findOne(filter){return commentRows.get(filter._id)}};
 throw Error(name);
}};
const commentInput={id:articleId,text:' 댓글 내용 ',requestId:'12345678-1234-1234-1234-123456789012',author:'위조닉네임'};
const commentUser={uid:'user',firebase:{sign_in_provider:'google.com'}};
const posted=await addNewsComment(commentDb,commentUser,commentInput);
assert.equal(posted.author,'저장된닉네임');assert.equal(posted.text,'댓글 내용');assert.ok(!('ownerUid' in posted));
assert.equal((await addNewsComment(commentDb,commentUser,commentInput)).id,posted.id);assert.equal(commentRows.size,1);
assert.equal((await addNewsComment(commentDb,{uid:'anon',firebase:{sign_in_provider:'anonymous'}},commentInput)).author,'ㅇㅇ');
await assert.rejects(()=>addNewsComment(commentDb,commentUser,{...commentInput,text:' '}),{statusCode:400});
await assert.rejects(()=>addNewsComment(commentDb,commentUser,{...commentInput,text:'x'.repeat(1001)}),{statusCode:400});
await assert.rejects(()=>addNewsComment(commentDb,commentUser,{...commentInput,id:'b'.repeat(64)}),{statusCode:404});
context.addNewsComment=async(db,decoded,input)=>{assert.equal(decoded.uid,'member');return posted;};
const commentResponse=response();await context.handler({method:'POST',headers:{authorization:'Bearer member'},body:{action:'comment',...commentInput}},commentResponse);assert.equal(commentResponse.code,201);
const unauthenticated=response();await context.handler({method:'POST',headers:{},body:{action:'comment',...commentInput}},unauthenticated);assert.equal(unauthenticated.code,401);
console.log('Knowledge, licensed-image and comment checks passed: timeless grounding, tags, attribution, rejected images, graceful fallback, user/anonymous comments and retry deduplication.');

const savedGeminiKey=process.env.GEMINI_API_KEY;
try{
 process.env.GEMINI_API_KEY='test-only';
 const mixedDb=database();
 await refreshNews(mixedDb,{now,request:async(url,options)=>{
  if(new URL(url).hostname==='generativelanguage.googleapis.com')return Response.json(envelope([{...knowledge,eventKey:'modulo-bias-explainer',imageQuery:'random number diagram'}]));
  return imageRequest(imageInfo)(url,options);
 }});
 assert.equal(mixedDb.rows.length,1);assert.equal(mixedDb.rows[0].kind,'knowledge');assert.equal(mixedDb.rows[0].automaticImage.license,'CC BY-SA 4.0');assert.equal(mixedDb.rows[0].imageQuery,'random number diagram');
}finally{if(savedGeminiKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=savedGeminiKey;}
let queriedFilter;
context.getDb=async()=>({collection(name){
 if(name==='settings')return {async findOne(){return null}};
 return {find(filter){queriedFilter=filter;return {sort(){return {limit(){return {async toArray(){return []}}}}}}}};
}});
assert.equal((await invoke('GET',undefined,{tag:'운영체제'})).code,200);assert.equal(queriedFilter.tags,'운영체제');
assert.equal((await invoke('GET',undefined,{tag:'최신 소식'})).code,200);assert.equal(queriedFilter.$or[1].tags.$exists,false);
assert.equal((await invoke('GET',undefined,{tag:'unknown'})).code,400);
console.log('Integrated collection keeps knowledge tags and automatic credits; tag queries include legacy news and reject unknown tags.');

// Topic lookup can recover an image when Commons full-text search misses it.
let imageCalls=0,imageState;
const recovered=await findNewsImage('TempleOS',async url=>{
 imageCalls++;
 const u=new URL(url);
 if(u.hostname==='en.wikipedia.org')return Response.json({query:{pages:{1:{pageimage:'TempleOS.png'}}}});
 if(u.searchParams.has('titles'))return Response.json({query:{pages:{1:{title:'File:TempleOS.png',imageinfo:[imageInfo]}}}});
 return Response.json({query:{pages:{}}});
},status=>imageState=status);
assert.equal(imageCalls,3);assert.equal(imageState,'found');assert.equal(recovered.credit,'Creator');
await findNewsImage('TempleOS',async()=>{throw Error('offline')},status=>imageState=status);
assert.equal(imageState,'unavailable');
let hiddenEmote;
noticeContext.getDb=async()=>({collection(){return {findOne:async()=>null,updateOne:async(filter,update)=>{hiddenEmote=update.$addToSet.hiddenBaseEmotes;}};}});
for(const [uid,expected] of [['member',403],['admin',200]]){
 const res=response();await noticeContext.handler({method:'POST',headers:{authorization:uid},query:{action:'deleteEmote'},body:{emoteId:'base-like'}},res);assert.equal(res.code,expected);
}
assert.equal(hiddenEmote,'base-like');
console.log('Image fallback/status and admin-only default emote removal passed.');
let imageUpdate;
context.fetch=async()=>{};
context.findNewsImage=async(query,request,report)=>{assert.equal(query,'TempleOS');report('found');return image;};
context.getDb=async()=>({collection(name){return {
 findOne:async()=>name==='admins'?null:{_id:articleId,title:'Title',imageQuery:'TempleOS'},
 findOneAndUpdate:async(filter,update)=>{imageUpdate=update.$set;return {_id:articleId,...update.$set};}
};}});
for(const [uid,expected] of [['member',403],['admin',200]]){
 const res=response();await context.handler({method:'POST',headers:{authorization:`Bearer ${uid}`},query:{},body:JSON.stringify({action:'refreshImage',id:articleId})},res);assert.equal(res.code,expected);
}
assert.equal(imageUpdate.automaticImage.credit,'Creator');assert.equal(imageUpdate.imageStatus,'found');
context.findNewsImage=async(query,request,report)=>{report('unavailable');return null;};
const imageRetry=response();await context.handler({method:'POST',headers:{authorization:'Bearer admin'},query:{},body:{action:'refreshImage',id:articleId}},imageRetry);
assert.equal(imageRetry.code,200);assert.equal(imageUpdate.imageStatus,'unavailable');assert.ok(!('automaticImage' in imageUpdate));
