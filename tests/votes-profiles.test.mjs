import assert from 'node:assert/strict';
import { castVote, initializeVotes } from '../api/_votes.js';
import { accountNickname, saveNickname, validateNickname } from '../api/_profiles.js';

// In-memory Mongo adapter honors the conditional-update contract; no live database required.
function database(initial, records = []) {
  let post = structuredClone(initial);
  const profiles = new Map();
  const same = filter => post && String(post._id) === String(filter._id);
  return {
    snapshot: () => structuredClone(post),
    collection(name) {
      if (name === 'posts') return {
        async findOne(filter) { return same(filter) ? structuredClone(post) : null; },
        async updateOne(filter, update) {
          assert.equal(filter.voterUids.$exists, false);
          if (same(filter) && !Object.hasOwn(post, 'voterUids')) Object.assign(post, structuredClone(update.$set));
        },
        async findOneAndUpdate(filter, update, options) {
          assert.equal(options.returnDocument, 'after');
          const uid = filter.voterUids.$ne;
          assert.equal(update.$addToSet.voterUids, uid);
          if (!same(filter) || post.voterUids.includes(uid)) return null;
          for (const [key, amount] of Object.entries(update.$inc)) post[key] += amount;
          post.voterUids.push(uid);
          return structuredClone(post);
        }
      };
      if (name === 'votes') return { find() { return { sort() { return { async toArray() { return structuredClone(records); } }; } }; } };
      if (name === 'profiles') return {
        async findOne(filter) { return profiles.get(filter._id) || null; },
        async updateOne(filter, update, options) { assert.equal(options.upsert, true); profiles.set(filter._id, structuredClone(update.$set)); }
      };
      if (name === 'admins') return { async findOne() { return null; } };
      throw Error('Unexpected collection: '+name);
    }
  };
}
const db=database({_id:'post',up:5,down:2},[
  {uid:'old',kind:'up'},{uid:'old',kind:'up'},{uid:'old',kind:'down'},
  {uid:'other',kind:'down'},{uid:'other',kind:'down'}
]);
const results=await Promise.allSettled(Array.from({length:50},()=>castVote(db,'post','new','up')));
assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.statusCode===409));
assert.deepEqual(db.snapshot(),{_id:'post',up:2,down:1,voterUids:['old','other','new']});
await assert.rejects(()=>castVote(db,'post','new','down'),{statusCode:409});
await assert.rejects(()=>castVote(db,'post','old','up'),{statusCode:409});
await initializeVotes(db,'post');assert.equal(db.snapshot().up,2,'Migration must not reset newer votes');
await castVote(db,'post','fourth','down');assert.equal(db.snapshot().down,2);
await assert.rejects(()=>castVote(db,'missing','new','up'),{statusCode:404});
await assert.rejects(()=>castVote(db,'post','new','invalid'),{statusCode:400});

const google={uid:'google-user',name:'Google Name',firebase:{sign_in_provider:'google.com'}};
assert.equal(await accountNickname(db,google),'Google Name');
assert.equal(await saveNickname(db,google,'  새닉네임  '),'새닉네임');
assert.equal(await accountNickname(db,{...google,name:'Provider changed name'}),'새닉네임');
await saveNickname(db,google,'다시변경');assert.equal(await accountNickname(db,google),'다시변경');
assert.equal(await accountNickname(db,{...google,uid:'other-user'}),'Google Name');
for(const value of ['', '   ', 'x'.repeat(17), 'bad\nname', {}, null])assert.throws(()=>validateNickname(value),{statusCode:400});
const anonymous={uid:'anon',firebase:{sign_in_provider:'anonymous'}};
await assert.rejects(()=>saveNickname(db,anonymous,'name'),{statusCode:403});
assert.equal(await accountNickname(db,anonymous),'ㅇㅇ');

// Check the actual HTTP handler denies anonymous votes and ignores a forged nickname owner.
const {readFileSync}=await import('node:fs');
const vm=await import('node:vm');
const {ObjectId}=await import('mongodb');
let identity=anonymous;
const postId=new ObjectId();
const apiDb=database({_id:String(postId),voterUids:[],up:0,down:0,createdAt:new Date()});
const context=vm.createContext({console:{error(){}},ObjectId,process:{env:{}},getDb:async()=>apiDb,requireUser:async()=>identity,castVote,initializeVotes,accountNickname,saveNickname,isAnonymous:d=>d.firebase?.sign_in_provider==='anonymous'});
vm.runInContext(readFileSync(new URL('../api/community.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function','async function'),context);
async function request(action,body){
 const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await context.handler({method:'POST',headers:{},query:{action},body},res);return res;
}
assert.equal((await request('vote',{postId:String(postId),kind:'up'})).code,403);
assert.equal(apiDb.snapshot().up,0);
identity=google;
assert.equal((await request('vote',{postId:String(postId),kind:'up'})).code,200);
assert.equal((await request('vote',{postId:String(postId),kind:'down'})).code,409);
assert.equal((await request('updateNickname',{uid:'someone-else',nickname:'앱닉네임'})).code,200);
assert.equal((await request('me',{})).body.nickname,'앱닉네임');
assert.equal(await accountNickname(apiDb,{...google,uid:'someone-else'}),'Google Name');
console.log('Vote/profile checks passed: 50 concurrent votes count once, cross-direction duplicates, legacy deduplication, anonymous denial, nickname persistence and account isolation. MongoDB contract simulated.');
