import assert from 'node:assert/strict';
import { validateAttachments, MAX_VIDEO_BYTES, MAX_IMAGE_BYTES } from '../api/_media.js';
const url='https://test.public.blob.vercel-storage.com/posts/user-1/file.mp4';
const inspect=async()=>({contentType:'video/mp4',size:1024});
assert.deepEqual(await validateAttachments(undefined,'user-1',inspect),[]);
const valid=await validateAttachments([{url,name:'clip.mp4',type:'image/png',size:1}],'user-1',inspect);
assert.equal(valid[0].type,'video/mp4','Type must come from storage, not request');
assert.equal(valid[0].size,1024,'Size must come from storage, not request');
for(const items of [null,{},Array(7).fill({url}),[{url},{url}],[{url:'https://example.com/file.mp4'}],[{url:url.replace('/user-1/','/user-2/')}],[{url:url+'?fake=1'}],[{url:url.replace('https:','http:')}],[{url:url.replace('test.public','test.public.evil')}],[null]]){
 await assert.rejects(()=>validateAttachments(items,'user-1',inspect));
}
for(const metadata of [{contentType:'image/svg+xml',size:100},{contentType:'video/mp4',size:MAX_VIDEO_BYTES+1},{contentType:'image/jpeg',size:MAX_IMAGE_BYTES+1},{contentType:'image/jpeg',size:0}]){
 await assert.rejects(()=>validateAttachments([{url}],'user-1',async()=>metadata));
}
await assert.rejects(()=>validateAttachments([{url}],'user-1',async()=>{throw Error('Missing blob');}),/Missing blob/);
assert.equal((await validateAttachments([{url}],'user-1',async()=>({contentType:'image/jpeg',size:MAX_IMAGE_BYTES})))[0].type,'image/jpeg');
console.log('Media checks passed: ownership, URL restrictions, duplicate/count limits, stored type/size verification.');

// Exercise the upload endpoint's authorization and constraints without signing real tokens.
const { readFileSync } = await import('node:fs');
const vm = await import('node:vm');
let policy;
const context=vm.createContext({
  process:{env:{BLOB_READ_WRITE_TOKEN:'test-only'}},console:{error(){}},
  MEDIA_TYPES:['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'],MAX_IMAGE_BYTES,MAX_VIDEO_BYTES,
  requireUser:async req=>{
    if(req.headers.authorization!=='Bearer test')throw Object.assign(Error('Authentication required'),{statusCode:401});
    return {uid:'user-1'};
  },
  handleUpload:async options=>{policy=await options.onBeforeGenerateToken(options.body.payload.pathname,options.body.payload.clientPayload);return {ok:true};}
});
vm.runInContext(readFileSync(new URL('../api/upload.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function','async function'),context);
const invoke=async(headers,pathname,type)=>{
 const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await context.handler({method:'POST',headers,body:{type:'blob.generate-client-token',payload:{pathname,clientPayload:JSON.stringify({type})}}},res);return res;
};
const path='posts/user-1/12345678-1234-1234-1234-123456789012.mp4';
assert.equal((await invoke({},path,'video/mp4')).code,401);
assert.equal((await invoke({authorization:'Bearer test'},path.replace('user-1','other'),'video/mp4')).code,400);
assert.equal((await invoke({authorization:'Bearer test'},path,'image/svg+xml')).code,400);
assert.equal((await invoke({authorization:'Bearer test'},path,'video/mp4')).code,200);
assert.equal(policy.maximumSizeInBytes,MAX_VIDEO_BYTES);assert.equal(policy.allowOverwrite,false);assert.equal(policy.addRandomSuffix,true);
assert.deepEqual([...policy.allowedContentTypes],['video/mp4']);
context.process.env.BLOB_READ_WRITE_TOKEN='';
assert.equal((await invoke({authorization:'Bearer test'},path,'video/mp4')).code,503);
console.log('Upload endpoint checks passed: authenticated grants only, owner path, type/size policy, storage setup error.');

// OIDC connections have a store ID and webhook public key, without a read-write token.
context.process.env.BLOB_STORE_ID='store_test';
context.process.env.BLOB_WEBHOOK_PUBLIC_KEY='public-test-key';
let delegated;
context.issueSignedToken=async options=>{delegated=options;return {testSignedToken:true};};
context.handleUploadPresigned=async options=>{
  const signed=await options.getSignedToken(options.body.payload.pathname,options.body.payload.clientPayload);
  assert.equal(signed.token.testSignedToken,true);
  assert.equal(signed.urlOptions.allowOverwrite,false);
  assert.equal(signed.urlOptions.addRandomSuffix,true);
  return {type:'blob.generate-presigned-url',presignedUrlPayload:{test:true}};
};
const status=response();await context.handler({method:'GET'},status);
assert.equal(status.body.available,true);assert.equal(status.body.mode,'presigned');
async function presignedRequest(headers,pathname=path){
 const res=response();
 await context.handler({method:'POST',headers,body:{type:'blob.generate-presigned-url',payload:{pathname,clientPayload:JSON.stringify({type:'video/mp4'})}}},res);
 return res;
}
assert.equal((await presignedRequest({})).code,401);
assert.equal((await presignedRequest({authorization:'Bearer test'},path.replace('user-1','other'))).code,400);
assert.equal((await presignedRequest({authorization:'Bearer test'})).code,200);
assert.equal(delegated.pathname,path);assert.deepEqual([...delegated.operations],['put']);
assert.equal(delegated.maximumSizeInBytes,MAX_VIDEO_BYTES);
assert.deepEqual([...delegated.allowedContentTypes],['video/mp4']);
assert.ok(delegated.validUntil>Date.now()&&delegated.validUntil<=Date.now()+15*60*1000);
assert.ok(!('token' in delegated),'Let the SDK use platform OIDC instead of requiring a legacy token');
console.log('OIDC upload checks passed without a read-write token: readiness, Firebase authorization, scoped signed uploads and limits. SDK network calls stubbed.');
function response(){return {setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}

const mediaId='12345678-1234-1234-1234-123456789012';
assert.equal((await validateAttachments([{id:mediaId,url}],'user-1',inspect))[0].id,mediaId);
await assert.rejects(()=>validateAttachments([{id:'<img onerror=alert(1)>',url}],'user-1',inspect),{statusCode:400});
await assert.rejects(()=>validateAttachments([{id:mediaId,url},{id:mediaId,url:url.replace('file.mp4','other.mp4')}],'user-1',inspect),{statusCode:400});
console.log('Inline media identifiers preserved and validated.');
