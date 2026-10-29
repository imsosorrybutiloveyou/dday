import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import configHandler from '../api/firebase-config.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'All DOM IDs must be unique');
const configSource=readFileSync(new URL('../firebase-config.js',import.meta.url),'utf8');
assert.ok(!configSource.includes('BEGIN PRIVATE KEY'),'No private key in public config');
const oldConfig=process.env.FIREBASE_WEB_CONFIG;
function response(){return {setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
try {
  for(const raw of ['', '{invalid', 'null', '[]', '{"type":"service_account"}', '{"apiKey":"   "}']){
    process.env.FIREBASE_WEB_CONFIG=raw;
    const res=response();configHandler({method:'GET'},res);assert.equal(res.code,503);
  }
  process.env.FIREBASE_WEB_CONFIG=JSON.stringify({apiKey:'public-key',authDomain:'example.firebaseapp.com',projectId:'example',unexpected:'must-not-leak'});
  const res=response();configHandler({method:'GET'},res);
  assert.equal(res.code,200);assert.equal(res.body.apiKey,'public-key');assert.ok(!('unexpected' in res.body));
  process.env.FIREBASE_WEB_CONFIG=JSON.stringify({...res.body,private_key:'must-not-leak'});
  const secret=response();configHandler({method:'GET'},secret);assert.equal(secret.code,503);assert.ok(!JSON.stringify(secret.body).includes('must-not-leak'));
  delete process.env.FIREBASE_WEB_CONFIG;
  const absent=response();configHandler({method:'GET'},absent);assert.match(absent.body.error,/Production/);
  process.env.FIREBASE_WEB_CONFIG='const firebaseConfig = {}';
  const invalid=response();configHandler({method:'GET'},invalid);assert.match(invalid.body.error,/JSON/);
  assert.notEqual(absent.body.error,invalid.body.error);
  const post=response();configHandler({method:'POST'},post);assert.equal(post.code,405);
} finally {if(oldConfig===undefined)delete process.env.FIREBASE_WEB_CONFIG;else process.env.FIREBASE_WEB_CONFIG=oldConfig;}

const elements=new Map(ids.map(id=>['#'+id,{value:'',classList:{add(){},remove(){},toggle(){}},close(){},focus(){}}]));
const context=vm.createContext({console,URL,URLSearchParams,setTimeout(){},localStorage:{getItem(){return null;}},document:{querySelector:s=>elements.get(s),querySelectorAll:()=>[]}});
const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8').replace(/\ninit\(\);\s*$/,'');
vm.runInContext(source,context);
await vm.runInContext(`
(async()=>{
  authInitError=new Error('Configuration failure from server');
  try{requireAuth();throw Error('Expected initialization error');}catch(err){if(err!==authInitError)throw err;}
  authInitError=null;
  const calls=[];
  const guest={uid:'guest',isAnonymous:true,getIdToken:async()=>'guest-token'};
  auth={currentUser:guest,authStateReady:async()=>{}};
  authApi={
    signOut:async()=>{calls.push('signOut');auth.currentUser=null;},
    signInAnonymously:async()=>{calls.push('anonymous');auth.currentUser=guest;return {user:guest};},
    signInWithEmailAndPassword:async()=>{throw {code:'auth/invalid-credential'};},
    createUserWithEmailAndPassword:async()=>{throw {code:'auth/email-already-in-use'};},
    GoogleAuthProvider:class {},
    signInWithPopup:async()=>{calls.push('popup');throw {code:'auth/popup-closed-by-user'};}
  };
  bind();
  $('#emailInput').value='test@example.com';$('#passwordInput').value='password';$('#nicknameInput').value='test';
  await $('#loginForm').onsubmit({preventDefault(){}});
  await $('#signUpBtn').onclick();
  const popup=$('#googleLoginBtn').onclick();
  if(calls[0]!=='popup')throw Error('Popup must open synchronously from the click');
  await popup;
  if(auth.currentUser!==guest||calls.includes('signOut'))throw Error('Failed authentication lost existing anonymous session');
  auth.currentUser=null;
  const tokens=await Promise.all([token(),token()]);
  if(tokens.some(t=>t!=='guest-token')||calls.filter(c=>c==='anonymous').length!==1)throw Error('Anonymous writes must share one valid login');
  auth.currentUser=null;
  authApi.signInAnonymously=async()=>{throw {code:'auth/operation-not-allowed'};};
  try{await token();throw Error('Expected auth failure');}catch(err){if(err.code!=='auth/operation-not-allowed')throw err;}
  authApi.signInAnonymously=async()=>{auth.currentUser=guest;return {user:guest};};
  if(await token()!=='guest-token')throw Error('Anonymous login must recover after failure');
  const member={uid:'member',email:'test@example.com',displayName:'test',getIdToken:async()=>'member-token'};
  globalThis.fetch=async(url,options)=>{
    if(options.headers.Authorization!=='Bearer member-token')throw Error('Missing member bearer token');
    return {ok:true,json:async()=>({isAdmin:false})};
  };
  authApi.signInWithEmailAndPassword=async()=>{auth.currentUser=member;return {user:member};};
  await $('#loginForm').onsubmit({preventDefault(){}});
  if(user?.uid!=='member')throw Error('Email login must update account UI');
  auth.currentUser=guest;
  authApi.createUserWithEmailAndPassword=async()=>{auth.currentUser=member;return {user:member};};
  authApi.updateProfile=async(account,profile)=>{account.displayName=profile.displayName;};
  $('#nicknameInput').value='new nickname';
  await $('#signUpBtn').onclick();
  if(user?.nickname!=='new nickname')throw Error('Signup must apply nickname');
  auth.currentUser=guest;
  authApi.signInWithPopup=async()=>{auth.currentUser=member;return {user:member};};
  await $('#googleLoginBtn').onclick();
  if(user?.uid!=='member')throw Error('Google login must update account UI');
  globalThis.fetch=async(url,options)=>({ok:true,json:async()=>({isAdmin:false,nickname:JSON.parse(options.body).nickname||'앱닉네임'})});
  $('#profileNickname').value='앱닉네임';
  await $('#saveNicknameBtn').onclick();
  if(user.nickname!=='앱닉네임')throw Error('Nickname save must update displayed account');
  member.displayName='Google name after another login';
  await applyAccount(member);
  if(user.nickname!=='앱닉네임')throw Error('Saved nickname must win over provider display name');


})();`,context);
console.log('Auth regression checks passed: unique controls, public config, session preservation, popup timing, anonymous token concurrency/retry.');
