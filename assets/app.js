const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const SITE = {
  schoolName:"서울금융고등학교",
  grade:1,
  classNo:3,
  atptCode:"B10",
  schoolCode:"7010964",
  discord:"https://discord.gg/DrwYjf2fYM"
};

const KEYS = { favorite:"sf13_favorite_mongo", votes:"sf13_votes_mongo" };
const local = {
  get(k,f){ try{return JSON.parse(localStorage.getItem(k)) ?? f}catch{return f} },
  set(k,v){ localStorage.setItem(k,JSON.stringify(v)) }
};

let authApi=null;
let auth=null;
let authInitError=null;
let anonymousLogin;
let firebaseUid=null;
let user=null;
let guestCode="?.?";
let posts=[];
let pendingMedia=[];
let editorRange=null;
let currentNews=null;
let newsPhotoDraft=null;
let newsUploading=false;
let submittingPost=false;
const votingPosts=new Set();
let emotes=[];
let settings={discord:SITE.discord};
let votes=local.get(KEYS.votes,{});

let state={
  tab:"all",category:"전체",search:"",searchType:"all",
  page:1,size:30,currentPost:null,emoteTarget:null,admin:false
};

const BASE_EMOTES = [
  {id:"base-like",name:"개추",type:"text",char:"👍"},
  {id:"base-lol",name:"ㅋㅋ",type:"text",char:"😂"},
  {id:"base-sleep",name:"꿀잠",type:"text",char:"😴"},
  {id:"base-study",name:"공부",type:"text",char:"📚"}
];

function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function safeUrl(v){try{const u=new URL(v);return ["http:","https:"].includes(u.protocol)?u.href:""}catch{return ""}}
function currentName(){return user?.nickname||"ㅇㅇ"}
function currentCode(){return user?"":guestCode}
function identityHTML(name,code){return code?`${esc(name)}<span class="guest-code">(${esc(code)})</span>`:esc(name)}
function dateShort(ts){
  const d=new Date(ts),n=new Date();
  if(d.toDateString()===n.toDateString()) return d.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",hour12:false});
  return `${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}
function dateFull(ts){return new Date(ts).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
function ymd(d=new Date()){return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),4500)}
function emoteKey(e){return String(e.docId||e.id)}
function allEmotes(){return [...BASE_EMOTES,...emotes]}
function findEmote(id){return allEmotes().find(e=>emoteKey(e)===String(id))}
function emoteMarkup(e,cls="inline-emote"){
  if(e?.type==="image"&&e.url)return `<img class="${cls}" src="${esc(e.url)}" alt="${esc(e.name||"반콘")}" loading="lazy">`;
  return esc(e?.char||"");
}
function renderRichText(text=""){
  let src=String(text),out="",last=0,m;
  const re=/\[\[emote:([^\]]+)\]\]/g;
  while((m=re.exec(src))){
    out+=esc(src.slice(last,m.index));
    const e=findEmote(m[1]);
    out+=e?emoteMarkup(e):`<span class="guest-code">[삭제된 반콘]</span>`;
    last=re.lastIndex;
  }
  out+=esc(src.slice(last));
  return out.replace(/\n/g,"<br>");
}

async function loadGuestCode(){
  try{
    const r=await fetch("/api/anon-id",{cache:"no-store"});
    const j=await r.json();
    if(j.id)guestCode=String(j.id);
  }catch{}
}

async function initFirebase(){
  let cfg=window.BANGALL_FIREBASE_CONFIG;
  if(!cfg){
    const response=await fetch("/api/firebase-config",{cache:"no-store"});
    try{cfg=await response.json();}
    catch{throw new Error(`로그인 설정 API가 JSON을 반환하지 않았습니다 (HTTP ${response.status}). 최신 배포를 확인해 주세요.`);}
    if(!response.ok)throw new Error(cfg.error||"로그인 설정을 불러오지 못했습니다.");
  }
  if(!cfg?.apiKey||!cfg.authDomain||!cfg.projectId||cfg.private_key){
    throw new Error("Firebase 공개 웹 앱 설정이 필요합니다. 서비스 계정 키는 사용할 수 없습니다.");
  }
  const appMod=await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js");
  authApi=await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js");
  auth=authApi.getAuth(appMod.initializeApp(cfg));
  await auth.authStateReady();
  if(!auth.currentUser){
    try{await ensureAnonymous();}
    catch(err){toast(authError(err));}
  }
  await applyAccount(auth.currentUser);
}

function requireAuth(){
  if(authInitError)throw authInitError;
  if(!auth||!authApi)throw new Error("로그인 설정을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
}

function authError(err){
  const messages={
    "auth/operation-not-allowed":"이 로그인 방식이 아직 활성화되지 않았습니다. 관리자에게 문의해 주세요.",
    "auth/admin-restricted-operation":"익명 로그인이 활성화되지 않았습니다. 관리자에게 문의해 주세요.",
    "auth/unauthorized-domain":"이 사이트에서 로그인이 허용되지 않았습니다. 관리자에게 문의해 주세요.",
    "auth/invalid-api-key":"로그인 설정이 올바르지 않습니다. 관리자에게 문의해 주세요.",
    "auth/invalid-credential":"이메일 또는 비밀번호를 확인해 주세요.",
    "auth/email-already-in-use":"이미 사용 중인 이메일입니다.",
    "auth/invalid-email":"올바른 이메일 주소를 입력해 주세요.",
    "auth/weak-password":"비밀번호는 6자리 이상이어야 합니다.",
    "auth/popup-blocked":"팝업을 허용한 뒤 다시 시도해 주세요.",
    "auth/popup-closed-by-user":"로그인 창이 닫혔습니다.",
    "auth/network-request-failed":"네트워크 연결을 확인해 주세요."
  };
  return messages[err.code]||err.message||"로그인에 실패했습니다. 다시 시도해 주세요.";
}

async function ensureAnonymous(){
  requireAuth();
  await auth.authStateReady();
  if(auth.currentUser)return auth.currentUser;
  anonymousLogin ||= authApi.signInAnonymously(auth).finally(()=>{anonymousLogin=null;});
  return (await anonymousLogin).user;
}

async function token(){
  requireAuth();
  const account=await ensureAnonymous();
  return account.getIdToken();
}

async function api(action,payload={},method="POST"){
  const headers={"Content-Type":"application/json"};
  if(method!=="GET")headers.Authorization=`Bearer ${await token()}`;

  const url=method==="GET"
    ? `/api/community?action=${encodeURIComponent(action)}${payload.id?`&id=${encodeURIComponent(payload.id)}`:""}`
    : `/api/community?action=${encodeURIComponent(action)}`;

  const r=await fetch(url,{
    method,
    headers,
    body:method==="GET"?undefined:JSON.stringify(payload)
  });
  let j={};
  try{j=await r.json()}catch{}
  if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);
  return j;
}

async function applyAccount(u){
  firebaseUid=u?.uid||null;
  if(!u||u.isAnonymous){
    user=null;
  }else{
    user={
      uid:u.uid,
      email:u.email||"",
      nickname:u.displayName||u.email?.split("@")[0]||"고정닉"
    };
  }
  try{
    const me=u?await api("me",{}):{};
    state.admin=Boolean(me.isAdmin);
    if(user&&me.nickname)user.nickname=me.nickname;
  }catch{state.admin=false}
  renderIdentity();
  renderAccountStatus();
}

async function loadCommunity(){
  const r=await fetch("/api/community?action=bootstrap",{cache:"no-store"});
  if(!r.ok)throw new Error("MongoDB 데이터를 불러오지 못했습니다.");
  const data=await r.json();
  posts=data.posts||[];
  emotes=data.emotes||[];
  settings={discord:SITE.discord,...(data.settings||{})};
  $("#discordHeader").href=settings.discord||SITE.discord;
  $("#discordSetting").value=settings.discord||SITE.discord;
  renderPosts();
  renderEmotes();
}

async function loadNews(){
  $("#newsStatus").textContent="소식을 불러오는 중…";
  try{
    const response=await fetch("/api/news",{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"소식을 불러오지 못했습니다.");
    $("#newsList").innerHTML=(data.items||[]).map(item=>`<article class="news-item news-row">
      <div class="news-row-content"><div class="news-meta"><time>${esc(item.publishedDate)}</time><span>AI 소식 · Gemini</span></div>
      <h3><button class="news-title" type="button" data-news-id="${esc(item._id)}">${esc(item.title)}</button></h3>
      <p class="news-excerpt">${esc(String(item.summary||"").slice(0,220))}</p></div>
      ${item.attachments?.[0]?`<img class="news-thumbnail" src="${esc(safeUrl(item.attachments[0].url))}" alt="첨부 사진" loading="lazy">`:""}
    </article>`).join("")||'<div class="empty-state">등록된 소식이 없습니다. 관리자가 새 소식을 수집하면 여기에 표시됩니다.</div>';
    $$("[data-news-id]").forEach(button=>button.onclick=()=>openNews(button.dataset.newsId));
    $("#newsStatus").textContent=data.lastCheckedAt?`마지막 수집 확인: ${dateFull(data.lastCheckedAt)}`:"";
  }catch(error){$("#newsStatus").textContent=error.message;}
}

function renderNewsDetail(){
  const item=currentNews;if(!item)return;
  $("#newsDetailTitle").textContent=item.title;
  $("#newsDetailMeta").textContent=`${item.publishedDate} · AI 소식 · Gemini`;
  $("#newsDetailBody").innerHTML=renderRichText(item.body||item.summary||"");
  $("#newsDetailPhotos").innerHTML=(item.attachments||[]).map(mediaHTML).join("");
  $("#newsDetailSource").href=safeUrl(item.sourceUrl);
  $("#newsDetailSource").textContent=`${item.sourceName||"원문 보기"} ↗`;
  $("#newsPhotoTools").classList.toggle("hidden",!state.admin);
  $("#retryNewsPhotos").classList.toggle("hidden",newsPhotoDraft?.id!==item._id);
}
async function openNews(id){
  if(newsUploading)return;
  try{
    const response=await fetch(`/api/news?id=${encodeURIComponent(id)}`,{cache:"no-store"});
    const data=await response.json();if(!response.ok)throw new Error(data.error||"소식을 불러오지 못했습니다.");
    currentNews=data.item;$("#newsPhotoStatus").textContent="";renderNewsDetail();
    if(!$("#newsDialog").open)$("#newsDialog").showModal();
  }catch(error){toast(error.message);}
}
async function saveNewsPhotos(){
  if(newsUploading||!newsPhotoDraft||newsPhotoDraft.id!==currentNews?._id)return;
  newsUploading=true;
  $$("#newsDialog button,#newsDialog input").forEach(element=>element.disabled=true);
  try{
    const response=await fetch("/api/upload",{cache:"no-store"});const storage=await response.json();
    if(!response.ok||!storage.available)throw new Error("첨부 저장소가 연결되지 않았습니다.");
    const {upload,uploadPresigned}=await import("/assets/upload-client.js");
    const send=storage.mode==="presigned"?uploadPresigned:upload;
    const extensions={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"};
    for(const [index,photo] of newsPhotoDraft.photos.entries()){
      if(photo.url)continue;
      const bearer=await token();
      const path=`posts/${encodeURIComponent(auth.currentUser.uid)}/${photo.id}.${extensions[photo.file.type]}`;
      const result=await send(path,photo.file,{access:"public",handleUploadUrl:"/api/upload",multipart:true,contentType:photo.file.type,clientPayload:JSON.stringify({type:photo.file.type}),headers:{Authorization:`Bearer ${bearer}`},onUploadProgress:({percentage})=>{$("#newsPhotoStatus").textContent=`사진 ${index+1}/${newsPhotoDraft.photos.length} · ${Math.round(percentage)}%`;}});
      photo.url=result.url;
    }
    const result=await fetch("/api/news",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${await token()}`},body:JSON.stringify({action:"attachPhotos",id:newsPhotoDraft.id,attachments:newsPhotoDraft.photos.map(photo=>({id:photo.id,url:photo.url,name:photo.file.name}))})});
    const data=await result.json();if(!result.ok)throw new Error(data.error||"사진 저장 실패");
    currentNews=data.item;newsPhotoDraft=null;renderNewsDetail();$("#newsPhotoStatus").textContent="사진을 첨부했습니다.";await loadNews();
  }catch(error){$("#newsPhotoStatus").textContent=error.message;$("#retryNewsPhotos").classList.remove("hidden");}
  finally{newsUploading=false;$$("#newsDialog button,#newsDialog input").forEach(element=>element.disabled=false);}
}

async function fetchSchoolData(){
  const status=$("#neisStatus");
  status.className="api-status";
  status.textContent="NEIS 학교 정보 불러오는 중";
  try{
    const r=await fetch(`/api/neis?date=${ymd()}`,{cache:"no-store"});
    if(!r.ok)throw new Error("NEIS");
    const data=await r.json();
    applySchoolData(data.timetable||[],data.meals||[]);
    status.className="api-status ok";
    status.textContent="NEIS 실시간 데이터";
  }catch{
    applySchoolData([],[]);
    status.className="api-status error";
    status.textContent="NEIS 연결 실패 · Vercel 환경변수 확인";
  }
}

function applySchoolData(timetable,meals){
  timetable=[...timetable].sort((a,b)=>(a.period||0)-(b.period||0));
  $("#timetableList").innerHTML=timetable.length
    ? timetable.map(x=>`<div class="timetable-item"><b>${x.period}</b><span>${esc(x.subject||"-")}</span></div>`).join("")
    : `<div style="padding:12px;color:#888">오늘 시간표 정보 없음</div>`;
  $("#firstClass").textContent=timetable[0]?.subject||"정보 없음";

  const dishes=[];
  meals.forEach(x=>{
    String(x).replace(/<br\s*\/?>/gi,"\n").split("\n")
      .map(s=>s.replace(/\s*\([^)]*\)\s*/g,"").trim()).filter(Boolean)
      .forEach(v=>dishes.push(v));
  });
  $("#mealList").innerHTML=dishes.length?dishes.map(x=>`<div>· ${esc(x)}</div>`).join(""):`<span style="color:#888">오늘 급식 정보 없음</span>`;
  $("#mealSummary").textContent=dishes[0]||"정보 없음";
}

function renderIdentity(){
  $("#noticeWriteOpen").classList.toggle("hidden",!state.admin);
  $("#writeNoticeRow").classList.toggle("hidden",!state.admin);
  $("#refreshNews").classList.toggle("hidden",!state.admin);
  $("#identityName").innerHTML=identityHTML(currentName(),currentCode());
  let sub=user?"고정닉 로그인 중":"비로그인 · 익명";
  if(state.admin)sub+=" · 관리자";
  $("#identitySub").textContent=sub;
  $("#writeAuthor").innerHTML=identityHTML(currentName(),currentCode());
  $("#commentAuthor").innerHTML=identityHTML(currentName(),currentCode());
  $("#guestSample").innerHTML=identityHTML("ㅇㅇ",guestCode);
  $("#loginOpen").textContent=user?user.nickname:"로그인";
  $("#sideLogin").textContent=user?"계정 관리":"고정닉 로그인";
  $("#logoutBtn").classList.toggle("hidden",!user);
}

function renderAccountStatus(){
  if(!$("#accountStatus"))return;
  $("#profilePanel").classList.toggle("hidden",!user);
  $("#loginFields").classList.toggle("hidden",Boolean(user));
  $("#emailInput").disabled=Boolean(user);
  $("#passwordInput").disabled=Boolean(user);
  if(user)$("#profileNickname").value=user.nickname;
  if(!user){
    $("#accountStatus").textContent="현재 익명 계정입니다. 고정닉이 필요하면 이메일 계정으로 로그인하세요.";
    $("#uidBox").classList.add("hidden");
  }else{
    $("#accountStatus").textContent=state.admin?"관리자 계정입니다.":"고정닉 계정입니다.";
    $("#uidValue").textContent=firebaseUid||"";
    $("#uidBox").classList.remove("hidden");
  }
}

function categories(){return ["전체","잡담","질문","정보","급식","짤","투표"]}
function renderCategories(){
  $("#categoryBar").innerHTML=categories().map(c=>`<button type="button" class="category-btn ${state.category===c?"active":""}" data-category="${c}">${c}</button>`).join("");
  $("#writeCategory").innerHTML=categories().filter(c=>c!=="전체").map(c=>`<option>${c}</option>`).join("");
  $$("[data-category]").forEach(b=>b.onclick=()=>{state.category=b.dataset.category;state.page=1;renderCategories();renderPosts()});
}

function filteredPosts(){
  let list=[...posts];
  if(state.tab==="concept")list=list.filter(p=>(p.up||0)-(p.down||0)>=10&&!p.notice);
  if(state.tab==="notice")list=list.filter(p=>p.notice);
  list.sort((a,b)=>{
    if(state.tab==="all"&&Boolean(a.notice)!==Boolean(b.notice))return a.notice?-1:1;
    return (b.createdAt||0)-(a.createdAt||0);
  });
  if(state.category!=="전체")list=list.filter(p=>p.category===state.category);
  if(state.search){
    const q=state.search.toLowerCase();
    list=list.filter(p=>{
      if(state.searchType==="title")return String(p.title).toLowerCase().includes(q);
      if(state.searchType==="body")return String(p.body).toLowerCase().includes(q);
      if(state.searchType==="author")return String(p.author).toLowerCase().includes(q);
      return `${p.title} ${p.body}`.toLowerCase().includes(q);
    });
  }
  return list;
}

function renderPosts(){
  const list=filteredPosts();
  const pages=Math.max(1,Math.ceil(list.length/state.size));
  state.page=Math.min(state.page,pages);
  const visible=list.slice((state.page-1)*state.size,state.page*state.size);

  $("#postList").innerHTML=visible.length?visible.map((p,i)=>{
    const concept=(p.up||0)-(p.down||0)>=10&&!p.notice;
    return `<div class="board-row post-row ${p.notice?"notice":""} ${concept?"concept":""}">
      <span>${p.notice?"-":posts.length-i}</span>
      <span class="post-category">${p.notice?"공지":esc(p.category)}</span>
      <span class="title-cell">
        <button type="button" class="post-title" data-open-post="${esc(p.id)}" data-category="[${esc(p.notice?"공지":p.category)}]">${esc(p.title)}</button>
        ${(p.commentCount||0)?`<span class="reply-count">[${p.commentCount}]</span>`:""}
      </span>
      <span class="post-author">${identityHTML(p.author,p.guestCode)}</span>
      <span class="post-date">${dateShort(p.createdAt)}</span>
      <span class="post-views">${p.views||0}</span>
      <span class="post-up">${p.up||0}</span>
    </div>`;
  }).join(""):`<div class="empty-state"><strong>${state.search||state.category!=="전체"||state.tab!=="all"?"검색 결과가 없습니다.":"등록된 글이 없습니다."}</strong><p>${state.search||state.category!=="전체"||state.tab!=="all"?"검색어나 말머리를 바꿔 주세요.":"글쓰기 버튼을 눌러 글을 남겨 주세요."}</p></div>`;

  $$("[data-open-post]").forEach(b=>b.onclick=()=>openPost(b.dataset.openPost));
  $("#pagination").innerHTML=Array.from({length:Math.min(pages,10)},(_,i)=>i+1).map(n=>`<button class="page-btn ${n===state.page?"active":""}" data-page="${n}" type="button">${n}</button>`).join("");
  $$("[data-page]").forEach(b=>b.onclick=()=>{state.page=Number(b.dataset.page);renderPosts()});
  renderNotices();renderHot();
}

function renderNotices(){
  const n=posts.filter(p=>p.notice).slice(0,3);
  $("#noticeList").innerHTML=n.map(p=>`<button class="notice-link" type="button" data-notice="${esc(p.id)}">${esc(p.title)}</button>`).join("")||`<p class="quiet-message">등록된 공지가 없습니다.</p>`;
  $$("[data-notice]").forEach(b=>b.onclick=()=>openPost(b.dataset.notice));
}
function renderHot(){
  const h=[...posts].filter(p=>!p.notice).sort((a,b)=>(((b.up||0)-(b.down||0))*5+(b.views||0))-(((a.up||0)-(a.down||0))*5+(a.views||0))).slice(0,5);
  $("#hotList").innerHTML=h.map((p,i)=>`<div class="hot-row"><span class="hot-rank">${i+1}</span><button type="button" class="hot-link" data-hot="${esc(p.id)}">${esc(p.title)}</button></div>`).join("")||`<p class="quiet-message">등록된 글이 없습니다.</p>`;
  $$("[data-hot]").forEach(b=>b.onclick=()=>openPost(b.dataset.hot));
}
function renderEmotes(){
  const list=allEmotes();
  $("#emotePreview").innerHTML=list.slice(0,8).map(e=>`<div class="preview-emote" title="${esc(e.name)}">${emoteMarkup(e,"emote-image")}</div>`).join("");
  $("#emotePicker").innerHTML=list.map((e,i)=>`<button type="button" class="emote-choice" data-emote-index="${i}">${e.type==="image"?emoteMarkup(e,"emote-image"):`<strong>${esc(e.char||"")}</strong>`}<span>${esc(e.name)}</span></button>`).join("");
  $$("[data-emote-index]").forEach(b=>b.onclick=()=>insertEmote(Number(b.dataset.emoteIndex)));
}
function insertEmote(i){
  const e=allEmotes()[i];if(!e)return;
  const value=e.type==="image"?`[[emote:${emoteKey(e)}]]`:(e.char||"");
  if(state.emoteTarget==="comment"){
    const target=$("#commentInput");target.value+=(target.value?" ":"")+value+" ";target.dispatchEvent(new Event("input"));
  }else insertEditorNode(document.createTextNode(value+" "));
  $("#emoteDialog").close();
}
function findPost(id){return posts.find(p=>String(p.id)===String(id))}

async function openPost(id){
  try{
    const data=await api("post",{id},"GET");
    const p=data.post;
    const idx=posts.findIndex(x=>x.id===p.id);
    if(idx>=0)posts[idx]={...posts[idx],...p};
    state.currentPost=p.id;
    $("#upvoteBtn").disabled=$("#downvoteBtn").disabled=votingPosts.has(p.id);

    $("#viewCategory").textContent=p.notice?"공지":p.category;
    $("#viewTitle").textContent=p.title;
    $("#viewAuthor").innerHTML=identityHTML(p.author,p.guestCode);
    $("#viewDate").textContent=dateFull(p.createdAt);
    $("#viewViews").textContent=p.views||0;
    $("#viewUp").textContent=p.up||0;
    $("#upCount").textContent=p.up||0;
    $("#downCount").textContent=p.down||0;
    $("#viewBody").innerHTML=renderPostContent(p.body||"",p.attachments||[]);
    const img=safeUrl(p.image||"");
    $("#viewImage").innerHTML=img?`<img src="${esc(img)}" alt="첨부 이미지" referrerpolicy="no-referrer">`:"";
    $("#deletePost").classList.toggle("hidden",!(state.admin||p.ownerUid===firebaseUid));
    renderComments(p);
    renderPosts();
    $("#postDialog").showModal();
  }catch(err){toast(err.message)}
}
function renderComments(p){
  const cs=p.comments||[];
  $("#commentCount").textContent=cs.length;
  $("#commentList").innerHTML=cs.length?cs.map(c=>`<div class="comment-row">
    <div class="comment-writer">${identityHTML(c.author,c.guestCode)}</div>
    <div class="comment-text">${renderRichText(c.text)}</div>
    <div class="comment-time">${dateShort(c.createdAt)}</div>
  </div>`).join(""):`<div style="padding:18px;text-align:center;color:#999;border-bottom:1px solid #eee">아직 댓글이 없습니다.</div>`;
}

async function openAdminDialog(){
  if(!user){
    $("#adminGateMessage").textContent="관리자 계정으로 먼저 로그인하세요.";
    $("#adminUidBox").classList.add("hidden");
    $("#adminPanel").classList.add("hidden");
    $("#adminGate").classList.remove("hidden");
    $("#adminDialog").showModal();
    return;
  }
  $("#adminUidValue").textContent=firebaseUid||"";
  $("#adminUidBox").classList.remove("hidden");
  if(!state.admin){
    $("#adminGateMessage").innerHTML="이 계정은 관리자가 아닙니다.<br>Vercel 환경변수 <code>ADMIN_UIDS</code>에 아래 UID를 넣고 재배포하세요.";
    $("#adminPanel").classList.add("hidden");
    $("#adminGate").classList.remove("hidden");
  }else{
    $("#adminGate").classList.add("hidden");
    $("#adminPanel").classList.remove("hidden");
    renderAdminEmotes();
  }
  $("#adminDialog").showModal();
}
function renderAdminEmotes(){
  $("#adminEmoteList").innerHTML=emotes.map(e=>`<div class="admin-emote-row">
    ${emoteMarkup(e,"admin-emote-thumb")}
    <span>${esc(e.name)}${e.ownerName?` · ${esc(e.ownerName)}`:""}</span>
    <button type="button" class="danger-btn" data-del-emote="${esc(e.id)}">삭제</button>
  </div>`).join("")||`<div style="padding:12px;color:#888">사용자 반콘이 없습니다.</div>`;
  $$("[data-del-emote]").forEach(b=>b.onclick=async()=>{
    if(!state.admin)return toast("관리자 권한이 필요합니다.");
    if(!confirm("이 반콘을 삭제할까요?"))return;
    try{
      await api("deleteEmote",{emoteId:b.dataset.delEmote});
      emotes=emotes.filter(e=>e.id!==b.dataset.delEmote);
      renderEmotes();renderAdminEmotes();toast("삭제했습니다.");
    }catch(err){toast(err.message)}
  });
}

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(String(r.result));
    r.onerror=reject;
    r.readAsDataURL(file);
  });
}

function editorBody(){
  const editor=$("#writeBody");
  function text(node){
    if(node.nodeType===3)return node.nodeValue;
    if(node.dataset?.mediaId)return `\n[[media:${node.dataset.mediaId}]]\n`;
    if(node.nodeName==="BR")return "\n";
    const content=[...node.childNodes].map(text).join("");
    return node!==editor&&["DIV","P"].includes(node.nodeName)?`\n${content}\n`:content;
  }
  return text(editor).replace(/\n{3,}/g,"\n\n").trim();
}
function editorCount(){
  $("#writeCount").textContent=`${editorBody().length} / 5000`;
}
function rememberEditorRange(){
  const selection=window.getSelection();
  if(selection?.rangeCount&&$("#writeBody").contains(selection.getRangeAt(0).commonAncestorContainer)){
    editorRange=selection.getRangeAt(0).cloneRange();
    const node=editorRange.commonAncestorContainer;
    const figure=(node.nodeType===1?node:node.parentElement)?.closest?.("[data-media-id]");
    if(figure){editorRange.setStartAfter(figure);editorRange.collapse(true);}
  }
}
function insertEditorNode(node){
  const editor=$("#writeBody");
  let range=editorRange;
  if(!range||!editor.contains(range.commonAncestorContainer)){range=document.createRange();range.selectNodeContents(editor);range.collapse(false);}
  range.deleteContents();range.insertNode(node);range.setStartAfter(node);range.collapse(true);
  const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
  editorRange=range.cloneRange();editorCount();
}
function dropEditorRange(event){
  const editor=$("#writeBody");
  const figure=event.target.closest?.("[data-media-id]");
  if(figure){
    editorRange=document.createRange();
    if(event.clientY<figure.getBoundingClientRect().top+figure.offsetHeight/2)editorRange.setStartBefore(figure);else editorRange.setStartAfter(figure);
    editorRange.collapse(true);return;
  }
  let range=document.caretRangeFromPoint?.(event.clientX,event.clientY);
  if(!range&&document.caretPositionFromPoint){const pos=document.caretPositionFromPoint(event.clientX,event.clientY);if(pos){range=document.createRange();range.setStart(pos.offsetNode,pos.offset);range.collapse(true);}}
  editorRange=range&&editor.contains(range.commonAncestorContainer)?range:null;
}
function addEditorFiles(files){
  if(submittingPost)return;
  if($$("#writeBody [data-media-id]").length+files.length>6)return toast("파일은 최대 6개까지 첨부할 수 있습니다.");
  const types=["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm"];
  for(const file of files){
    if(!types.includes(file.type))return toast("JPG, PNG, WebP, GIF 사진과 MP4, WebM 영상만 가능합니다.");
    if(!file.size||file.size>(file.type.startsWith("video/")?100:10)*1024*1024)return toast("사진은 10MB, 영상은 100MB까지 가능합니다.");
  }
  for(const file of files){
    const media={id:crypto.randomUUID(),file,preview:URL.createObjectURL(file)};pendingMedia.push(media);
    const figure=document.createElement("figure");figure.className="editor-media";figure.dataset.mediaId=media.id;figure.contentEditable="false";figure.draggable=true;
    figure.innerHTML=`${file.type.startsWith("video/")?`<video src="${esc(media.preview)}" preload="metadata" controls playsinline draggable="false"></video>`:`<img src="${esc(media.preview)}" alt="${esc(file.name)}" draggable="false">`}
      <figcaption><span>${esc(file.name)}</span><span class="media-actions"><button type="button" data-move-media="up" aria-label="첨부 위로 이동">↑</button><button type="button" data-move-media="down" aria-label="첨부 아래로 이동">↓</button><button type="button" data-remove-media>삭제</button></span></figcaption>`;
    insertEditorNode(figure);
    const paragraph=document.createElement("div");paragraph.append(document.createElement("br"));insertEditorNode(paragraph);
    editorRange=document.createRange();editorRange.setStart(paragraph,0);editorRange.collapse(true);
    const selection=window.getSelection();selection.removeAllRanges();selection.addRange(editorRange);
  }
  editorCount();
}
function mediaHTML(media){
  const url=safeUrl(media.url);if(!url)return "";
  return media.type?.startsWith("video/")?`<figure class="post-media"><video src="${esc(url)}" controls playsinline preload="metadata" aria-label="${esc(media.name||"첨부 영상")}"></video></figure>`:`<figure class="post-media"><img src="${esc(url)}" alt="${esc(media.name||"첨부 사진")}" loading="lazy"></figure>`;
}
function renderPostContent(body,attachments=[]){
  const used=new Set();let last=0,result="";
  for(const match of String(body).matchAll(/\[\[media:([a-f0-9-]{36})\]\]/g)){
    result+=renderRichText(String(body).slice(last,match.index));
    const media=attachments.find(item=>item.id===match[1]);
    if(media){if(!used.has(media)){result+=mediaHTML(media);used.add(media);}}
    else result+=esc(match[0]);
    last=match.index+match[0].length;
  }
  result+=renderRichText(String(body).slice(last));
  return result+attachments.filter(media=>!used.has(media)).map(mediaHTML).join("");
}

function bind(){
  $("#newsDialog").oncancel=event=>{if(newsUploading)event.preventDefault();};
  $("#retryNewsPhotos").onclick=saveNewsPhotos;
  $("#newsPhotoFiles").onchange=async event=>{
    const files=[...event.target.files];event.target.value="";
    if(!state.admin||!currentNews||!files.length||newsUploading)return;
    if(newsPhotoDraft&&newsPhotoDraft.photos.some(photo=>photo.url))return toast("이전 첨부를 먼저 다시 저장해 주세요.");
    if((currentNews.attachments||[]).length+files.length>6)return toast("사진은 글당 6개까지 가능합니다.");
    if(files.some(file=>!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)||!file.size||file.size>10*1024*1024))return toast("JPG, PNG, WebP, GIF 사진을 파일당 10MB 이하로 선택하세요.");
    newsPhotoDraft={id:currentNews._id,photos:files.map(file=>({id:crypto.randomUUID(),file}))};await saveNewsPhotos();
  };
  $$(".dialog-close").forEach(b=>b.onclick=()=>b.closest("dialog").close());
  $$(".dialog-cancel").forEach(b=>b.onclick=()=>b.closest("dialog").close());
  $$("[data-scroll]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.scroll).scrollIntoView({behavior:"smooth"}));

  $("#writeOpen").onclick=$("#writeBottom").onclick=()=>{$("#writeNotice").checked=false;$("#writeDialog").showModal();};
  const openNotice=()=>{
    if(!state.admin)return toast("관리자 권한이 필요합니다.");
    $("#adminDialog").close();$("#writeNotice").checked=true;$("#writeDialog").showModal();
  };
  $("#noticeWriteOpen").onclick=$("#openNoticeEditor").onclick=openNotice;
  $$("[data-admin-tab]").forEach(button=>button.onclick=()=>{
    $$("[data-admin-tab]").forEach(tab=>tab.classList.toggle("active",tab===button));
    $$("#adminPanel .admin-section").forEach(panel=>panel.classList.toggle("hidden",panel.id!==`admin-${button.dataset.adminTab}`));
  });
  $("#loginOpen").onclick=$("#sideLogin").onclick=()=>$("#loginDialog").showModal();
  $("#adminOpen").onclick=()=>openAdminDialog();
  $("#adminLoginOpen").onclick=()=>{$("#adminDialog").close();$("#loginDialog").showModal()};
  $("#openEmotesFromSide").onclick=()=>{state.emoteTarget="write";$("#emoteDialog").showModal()};

  $$(".tab").forEach(b=>b.onclick=()=>{
    $$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");
    state.tab=b.dataset.tab;state.page=1;
    const news=state.tab==="news";
    $("#newsPanel").classList.toggle("hidden",!news);
    $("#boardContent").classList.toggle("hidden",news);
    $(".notice-strip").classList.toggle("hidden",news);
    $(".board-top-actions").classList.toggle("hidden",news);
    if(news)loadNews();else renderPosts();
  });
  $("#pageSize").onchange=e=>{state.size=Number(e.target.value);state.page=1;renderPosts()};
  $("#reloadBtn").onclick=async()=>{try{await loadCommunity();toast("새로고침했습니다.")}catch(err){toast(err.message)}};

  $("#boardSearch").onsubmit=e=>{
    e.preventDefault();state.search=$("#boardSearchInput").value.trim();state.searchType=$("#searchType").value;state.page=1;renderPosts();
  };
  $("#topSearch").onsubmit=e=>{
    e.preventDefault();state.search=$("#topSearchInput").value.trim();state.searchType="all";state.page=1;
    $("#boardSearchInput").value=state.search;renderPosts();document.querySelector(".board-top").scrollIntoView({behavior:"smooth"});
  };

  const editor=$("#writeBody");
  editor.oninput=()=>{editorCount();rememberEditorRange();};
  editor.onkeyup=editor.onmouseup=editor.onblur=rememberEditorRange;
  editor.onpaste=e=>{
    e.preventDefault();if(submittingPost)return;
    rememberEditorRange();
    if(e.clipboardData.files.length)addEditorFiles([...e.clipboardData.files]);
    else insertEditorNode(document.createTextNode(e.clipboardData.getData("text/plain")));
  };
  editor.ondragstart=e=>{
    const figure=e.target.closest?.("[data-media-id]");
    if(!figure)return;
    e.dataTransfer.setData("application/x-dday-media",figure.dataset.mediaId);e.dataTransfer.effectAllowed="move";
  };
  editor.ondragover=e=>{e.preventDefault();};
  editor.ondrop=e=>{
    e.preventDefault();if(submittingPost)return;
    dropEditorRange(e);
    if(e.dataTransfer.files.length){addEditorFiles([...e.dataTransfer.files]);return;}
    const id=e.dataTransfer.getData("application/x-dday-media");
    const figure=$$("#writeBody [data-media-id]").find(node=>node.dataset.mediaId===id);
    if(figure){if(editorRange&&figure.contains(editorRange.commonAncestorContainer))return;figure.remove();insertEditorNode(figure);}
    else insertEditorNode(document.createTextNode(e.dataTransfer.getData("text/plain")));
  };
  editor.onclick=e=>{
    const button=e.target.closest?.("[data-remove-media], [data-move-media]");if(!button||submittingPost)return;
    const figure=button.closest("[data-media-id]");
    if(button.hasAttribute("data-remove-media"))figure.remove();
    else if(button.dataset.moveMedia==="up"&&figure.previousSibling)figure.parentNode.insertBefore(figure,figure.previousSibling);
    else if(button.dataset.moveMedia==="down"&&figure.nextSibling)figure.parentNode.insertBefore(figure,figure.nextSibling.nextSibling);
    editorCount();
  };
  $("#writeFiles").onchange=e=>{const files=[...e.target.files];e.target.value="";addEditorFiles(files);};
  $("#postDialog").onclose=()=>{$$("#postDialog video").forEach(video=>video.pause());};
  $("#writeDialog").oncancel=e=>{if(submittingPost)e.preventDefault();};
  $("#writeForm").onsubmit=async e=>{
    e.preventDefault();
    if(submittingPost)return;
    const body=editorBody();
    if(body.length>5000)return toast("본문은 5000자까지 입력할 수 있습니다.");
    const activeIds=new Set($$("#writeBody [data-media-id]").map(node=>node.dataset.mediaId));
    const activeMedia=pendingMedia.filter(media=>activeIds.has(media.id));
    submittingPost=true;$("#writeBody").contentEditable="false";
    $$("#writeDialog button, #writeDialog input, #writeDialog textarea, #writeDialog select").forEach(el=>el.disabled=true);
    try{
      await token();
      const attachments=[];
      let uploadMode="legacy";
      if(activeMedia.some(media=>!media.url)){
        const response=await fetch("/api/upload",{cache:"no-store"});
        const storage=await response.json();
        uploadMode=storage.mode||"legacy";
        if(!response.ok||!storage.available)throw new Error("첨부 저장소가 아직 연결되지 않았습니다. 관리자에게 문의해 주세요.");
      }
      for(const [index,media] of activeMedia.entries()){
        if(!media.url){
          const {upload,uploadPresigned}=await import("/assets/upload-client.js");
          const uploadFile=uploadMode==="presigned"?uploadPresigned:upload;
          const extensions={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","video/mp4":"mp4","video/webm":"webm"};
          const pathname=`posts/${encodeURIComponent(auth.currentUser.uid)}/${crypto.randomUUID()}.${extensions[media.file.type]}`;
          const result=await uploadFile(pathname,media.file,{
            access:"public",handleUploadUrl:"/api/upload",multipart:true,
            contentType:media.file.type,clientPayload:JSON.stringify({type:media.file.type}),
            headers:{Authorization:`Bearer ${await token()}`},
            onUploadProgress:({percentage})=>{$("#uploadStatus").textContent=`첨부 ${index+1}/${activeMedia.length} 업로드 중 · ${Math.round(percentage)}%`;}
          });
          media.url=result.url;
        }
        attachments.push({id:media.id,url:media.url,name:media.file.name});
      }
      $("#uploadStatus").textContent="글 저장 중…";
      const data=await api(state.admin&&$("#writeNotice").checked?"createNotice":"createPost",{
        category:$("#writeCategory").value,
        title:$("#writeTitle").value.trim(),body,
        author:currentName(),guestCode:currentCode(),
        image:safeUrl($("#writeImageUrl").value.trim()),attachments
      });
      posts.unshift(data.post);
      pendingMedia.forEach(media=>URL.revokeObjectURL(media.preview));pendingMedia=[];$("#writeBody").replaceChildren();editorRange=null;
      e.target.reset();$("#writeCount").textContent="0 / 5000";$("#uploadStatus").textContent="";
      $("#writeDialog").close();renderPosts();toast("글이 등록되었습니다.");
    }catch(err){
      $("#uploadStatus").textContent=`등록 실패: ${err.message} · 작성 내용과 첨부는 유지됩니다.`;
      toast(err.message);
    }finally{
      submittingPost=false;$("#writeBody").contentEditable="true";
      $$("#writeDialog button, #writeDialog input, #writeDialog textarea, #writeDialog select").forEach(el=>el.disabled=false);
    }
  };

  $("#commentForm").onsubmit=async e=>{
    e.preventDefault();
    const p=findPost(state.currentPost);if(!p)return;
    try{
      const data=await api("createComment",{
        postId:p.id,text:$("#commentInput").value.trim(),
        author:currentName(),guestCode:currentCode()
      });
      p.comments ||= [];p.comments.push(data.comment);p.commentCount=(p.commentCount||0)+1;
      $("#commentInput").value="";renderComments(p);renderPosts();toast("댓글이 등록되었습니다.");
    }catch(err){toast(err.message)}
  };

  $("#writeEmoteOpen").onclick=()=>{state.emoteTarget="write";$("#emoteDialog").showModal()};
  $("#commentEmoteOpen").onclick=()=>{state.emoteTarget="comment";$("#emoteDialog").showModal()};

  $("#upvoteBtn").onclick=()=>vote("up");
  $("#downvoteBtn").onclick=()=>vote("down");

  $("#copyPostLink").onclick=async()=>{
    const url=location.href.split("#")[0]+`#post-${state.currentPost}`;
    try{await navigator.clipboard.writeText(url);toast("주소를 복사했습니다.")}catch{toast(url)}
  };
  $("#deletePost").onclick=async()=>{
    const p=findPost(state.currentPost);if(!p)return;
    if(!confirm("게시글을 삭제할까요?"))return;
    try{
      await api("deletePost",{postId:p.id});
      posts=posts.filter(x=>x.id!==p.id);
      $("#postDialog").close();renderPosts();toast("삭제했습니다.");
    }catch(err){toast(err.message)}
  };

  $("#loginForm").onsubmit=async e=>{
    e.preventDefault();
    if(user){await saveProfileNickname();return;}
    const email=$("#emailInput").value.trim(),pw=$("#passwordInput").value;
    try{
      requireAuth();
      const cred=await authApi.signInWithEmailAndPassword(auth,email,pw);
      await applyAccount(cred.user);
      $("#loginDialog").close();toast(state.admin?"관리자 로그인":"로그인했습니다.");
    }catch(err){
      toast(authError(err));
    }
  };

  $("#signUpBtn").onclick=async()=>{
    const email=$("#emailInput").value.trim(),pw=$("#passwordInput").value,nick=$("#nicknameInput").value.trim();
    if(!email||pw.length<6||!nick)return toast("이메일, 6자 이상 비밀번호, 닉네임을 입력하세요.");
    try{
      requireAuth();
      const cred=await authApi.createUserWithEmailAndPassword(auth,email,pw);
      await authApi.updateProfile(cred.user,{displayName:nick});
      await cred.user.getIdToken(true);
      await api("updateNickname",{nickname:nick});
      await applyAccount(cred.user);
      $("#loginDialog").close();toast(`${nick} 계정을 만들었습니다.`);
    }catch(err){
      toast(authError(err));
    }
  };

  const googleLoginBtn = $("#googleLoginBtn");
  if(googleLoginBtn){
    googleLoginBtn.onclick = async () => {
      try{
        requireAuth();
        const provider = new authApi.GoogleAuthProvider();
        const cred = await authApi.signInWithPopup(auth, provider);
        await applyAccount(cred.user);
        $("#profileNickname").focus();
        toast("로그인했습니다. 닉네임을 설정하거나 변경할 수 있습니다.");
      }catch(err){
        toast(authError(err));
      }
    };
  }

  $("#saveNicknameBtn").onclick=saveProfileNickname;

  $("#logoutBtn").onclick=async()=>{
    try{
      requireAuth();
      await authApi.signOut(auth);
      await applyAccount(null);
      const account=await ensureAnonymous();
      await applyAccount(account);
      $("#loginDialog").close();toast("익명 모드로 전환했습니다.");
    }catch(err){toast(authError(err));}
  };

  $("#copyUidBtn").onclick=$("#copyAdminUidBtn").onclick=async()=>{
    const uid=firebaseUid||"";
    if(!uid)return;
    try{await navigator.clipboard.writeText(uid);toast("UID를 복사했습니다.")}catch{toast(uid)}
  };

  $("#memberMode").onclick=()=>{
    $("#memberMode").classList.add("active");$("#guestMode").classList.remove("active");
    $("#loginForm").classList.remove("hidden");$("#guestInfo").classList.add("hidden");
  };
  $("#guestMode").onclick=()=>{
    $("#guestMode").classList.add("active");$("#memberMode").classList.remove("active");
    $("#guestInfo").classList.remove("hidden");$("#loginForm").classList.add("hidden");
  };

  $("#userEmoteForm").onsubmit=async e=>{
    e.preventDefault();
    const name=$("#userEmoteName").value.trim(),file=$("#userEmoteFile").files?.[0];
    if(!name||!file)return toast("이름과 이미지를 선택하세요.");
    if(!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type))return toast("PNG/JPG/WebP/GIF만 가능합니다.");
    if(file.size>700*1024)return toast("반콘은 700KB 이하만 가능합니다.");
    try{
      const dataUrl=await fileToDataUrl(file);
      const data=await api("createEmote",{name,dataUrl,ownerName:currentName()});
      emotes.push(data.emote);
      e.target.reset();renderEmotes();if(state.admin)renderAdminEmotes();toast("반콘을 등록했습니다.");
    }catch(err){toast(err.message)}
  };

  $("#refreshNews").onclick=async()=>{
    const button=$("#refreshNews");if(button.disabled)return;
    button.disabled=true;$("#newsStatus").textContent="검색과 중복 확인 중… 최대 1분 정도 걸릴 수 있습니다.";
    try{
      const response=await fetch("/api/news",{method:"POST",headers:{Authorization:`Bearer ${await token()}`}});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"소식 수집 실패");
      await loadNews();
      $("#newsStatus").textContent=`새 소식 ${data.added}개 등록 · 중복 ${data.skipped}개 제외`;
    }catch(error){$("#newsStatus").textContent=error.message;}
    finally{button.disabled=false;}
  };

  $("#saveSettings").onclick=async()=>{
    if(!state.admin)return toast("관리자 권한이 필요합니다.");
    try{
      const discord=$("#discordSetting").value.trim()||SITE.discord;
      await api("saveSettings",{discord});
      settings.discord=discord;$("#discordHeader").href=discord;toast("저장했습니다.");
    }catch(err){toast(err.message)}
  };

  $("#deleteAllPosts").onclick=async()=>{
    if(!state.admin)return toast("관리자 권한이 필요합니다.");
    if(!confirm("모든 게시글과 댓글을 삭제할까요?"))return;
    try{
      await api("deleteAllPosts",{});
      posts=[];votes={};local.set(KEYS.votes,votes);renderPosts();toast("전체 게시글을 삭제했습니다.");
    }catch(err){toast(err.message)}
  };

  $("#favoriteBtn").onclick=()=>{
    const on=!local.get(KEYS.favorite,false);local.set(KEYS.favorite,on);
    $("#favoriteBtn").textContent=on?"★ 즐겨찾기":"☆ 즐겨찾기";
  };
  $("#refreshSchoolData").onclick=()=>fetchSchoolData();

  $("#resetSite")?.classList.add("hidden");
}

async function saveProfileNickname(){
  const button=$("#saveNicknameBtn");
  if(button.disabled)return;
  const nickname=$("#profileNickname").value.trim();
  if(!nickname||nickname.length>16)return toast("닉네임을 1~16자로 입력하세요.");
  button.disabled=true;
  try{
    const data=await api("updateNickname",{nickname});
    user.nickname=data.nickname;
    renderIdentity();renderAccountStatus();toast("닉네임을 변경했습니다.");
  }catch(err){toast(err.message);}
  finally{button.disabled=false;}
}

async function vote(kind){
  const p=findPost(state.currentPost);if(!p)return;
  if(!user){toast("추천·비추천은 로그인 후 이용할 수 있습니다.");$("#loginDialog").showModal();return;}
  if(votingPosts.has(p.id))return;
  votingPosts.add(p.id);
  $("#upvoteBtn").disabled=$("#downvoteBtn").disabled=true;
  try{
    const data=await api("vote",{postId:p.id,kind});
    Object.assign(p,{up:data.post.up,down:data.post.down});
    if(state.currentPost===p.id){$("#upCount").textContent=p.up||0;$("#downCount").textContent=p.down||0;}
    renderPosts();toast(kind==="up"?"개추했습니다.":"비추했습니다.");
  }catch(err){toast(err.message);}
  finally{
    votingPosts.delete(p.id);
    if(state.currentPost===p.id)$("#upvoteBtn").disabled=$("#downvoteBtn").disabled=false;
  }
}

async function init(){
  bind();
  $("#todayDate").textContent=new Date().toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"});
  $("#favoriteBtn").textContent=local.get(KEYS.favorite,false)?"★ 즐겨찾기":"☆ 즐겨찾기";

  await loadGuestCode();
  renderCategories();
  renderIdentity();

  try{
    await initFirebase();
  }catch(err){
    authInitError=err;
    $("#accountStatus").textContent=authError(err);
    toast(authError(err));
  }

  try{
    await loadCommunity();
    $("#neisStatus").textContent="MongoDB 연결됨 · 학교 정보 확인 중";
  }catch(err){
    console.error(err);
    $("#neisStatus").className="api-status error";
    $("#neisStatus").textContent="설정 필요 · SETUP_EASY.md 확인";
    toast("Firebase/MongoDB 설정을 확인하세요.");
  }

  await fetchSchoolData();

  if(location.hash.startsWith("#post-")){
    const id=decodeURIComponent(location.hash.slice(6));
    if(posts.some(p=>p.id===id))openPost(id);
  }
}
init();
