
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const SITE = {
  schoolName: "서울금융고등학교",
  grade: 1,
  classNo: 3,
  atptCode: "B10",
  schoolCode: "7010964",
  discord: "https://discord.gg/DrwYjf2fYM"
};

const KEYS = {
  posts:"sf13_posts_v3", emotes:"sf13_emotes_v3", user:"sf13_user_v3",
  accounts:"sf13_accounts_v3", guest:"sf13_guest_v3", votes:"sf13_votes_v3",
  settings:"sf13_settings_v3", favorite:"sf13_favorite_v3"
};

const DEFAULT_EMOTES = [
  {name:"개추",char:"👍"},{name:"억까",char:"🤦"},{name:"킹받음",char:"😤"},
  {name:"ㅋㅋ",char:"😂"},{name:"급식",char:"🍱"},{name:"공부",char:"📚"},
  {name:"꿀잠",char:"😴"},{name:"반장",char:"😎"},{name:"몰루",char:"🤷"},
  {name:"망함",char:"💀"},{name:"인정",char:"👌"},{name:"박수",char:"👏"}
];

const N = Date.now();
const DEFAULT_POSTS = [
  {
    id:132, category:"공지", title:"갤러리 이용 규칙 / 개인정보 관련 필독",
    body:"1. 실명, 전화번호, 집 주소, 개인 SNS 같은 개인정보를 허락 없이 올리지 마세요.\n2. 특정 학생을 지속적으로 괴롭히거나 사칭하는 글은 삭제될 수 있습니다.\n3. 도배와 광고는 삭제 대상입니다.\n4. 나머지는 자유롭게 이용하세요.",
    author:"관리자", guestCode:"", createdAt:N-86400000*4, views:181, up:29, down:0, notice:true,
    comments:[{author:"ㅇㅇ",guestCode:"31.47",text:"확인",createdAt:N-3600000*2}]
  },
  {
    id:131, category:"공지", title:"반 Discord 링크",
    body:"반 디스코드: https://discord.gg/DrwYjf2fYM\n\n오른쪽 아래 Discord 카드에서도 바로 들어갈 수 있습니다.",
    author:"관리자", guestCode:"", createdAt:N-86400000*2, views:119, up:17, down:0, notice:true, comments:[]
  },
  {
    id:130, category:"잡담", title:"오늘 1교시 뭐였지",
    body:"시간표 보려고 들어옴", author:"ㅇㅇ", guestCode:"17.42",
    createdAt:N-1000*60*19, views:41, up:4, down:0,
    comments:[{author:"ㅇㅇ",guestCode:"22.18",text:"오른쪽에 뜸",createdAt:N-1000*60*12}]
  },
  {
    id:129, category:"정보", title:"수행평가 있으면 여기다 정리하자",
    body:"공지 말고 정보 말머리로 하나씩 올려두면 찾기 편할 듯", author:"고정닉",
    guestCode:"", createdAt:N-1000*60*63, views:70, up:14, down:0, comments:[]
  },
  {
    id:128, category:"급식", title:"오늘 급식 기대해도 됨?",
    body:"사이트 오른쪽에 급식 자동으로 뜨게 해놨네", author:"ㅇㅇ", guestCode:"48.21",
    createdAt:N-1000*60*95, views:56, up:8, down:1, comments:[]
  },
  {
    id:127, category:"짤", title:"7교시 내 상태",
    body:"😴", author:"ㅇㅇ", guestCode:"09.66",
    createdAt:N-1000*60*150, views:88, up:24, down:0, comments:[]
  }
];

const local = {
  get(k,fallback){try{return JSON.parse(localStorage.getItem(k)) ?? fallback}catch{return fallback}},
  set(k,v){localStorage.setItem(k,JSON.stringify(v))}
};

let dbMode = "local";
let firestoreApi = null;
let firebaseUid = null;
let posts = local.get(KEYS.posts, DEFAULT_POSTS);
let emotes = local.get(KEYS.emotes, DEFAULT_EMOTES);
let user = local.get(KEYS.user, null);
let votes = local.get(KEYS.votes, {});
let settings = local.get(KEYS.settings, {discord:SITE.discord});
let guestCode = local.get(KEYS.guest, null);

if(!guestCode){
  guestCode = `${String(Math.floor(Math.random()*90)+10)}.${String(Math.floor(Math.random()*90)+10)}`;
  local.set(KEYS.guest, guestCode);
}

let state = {
  tab:"all", category:"전체", search:"", searchType:"all",
  page:1, size:30, currentPost:null, emoteTarget:null, admin:false
};

function esc(v=""){
  return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}
function safeUrl(v){
  try{const u=new URL(v);return ["http:","https:"].includes(u.protocol)?u.href:""}catch{return ""}
}
function currentName(){return user?.nickname || "ㅇㅇ"}
function currentCode(){return user ? "" : guestCode}
function identityHTML(name,code){return code?`${esc(name)}<span class="guest-code">(${esc(code)})</span>`:esc(name)}
function dateShort(ts){
  const d=new Date(ts), n=new Date();
  if(d.toDateString()===n.toDateString()) return d.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",hour12:false});
  return `${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}
function dateFull(ts){return new Date(ts).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
function ymd(d=new Date()){return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`}
function toast(msg){
  const t=$("#toast");t.textContent=msg;t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),1700);
}
function persistLocal(){
  local.set(KEYS.posts,posts);local.set(KEYS.emotes,emotes);local.set(KEYS.votes,votes);local.set(KEYS.settings,settings);
}

/* ---------------- Firebase optional mode ---------------- */

async function initFirebase(){
  const cfg=window.BANGALL_FIREBASE_CONFIG;
  if(!cfg) return false;
  try{
    const appMod=await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js");
    const fsMod=await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js");
    const authMod=await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js");

    const app=appMod.initializeApp(cfg);
    const db=fsMod.getFirestore(app);
    const auth=authMod.getAuth(app);

    firestoreApi={...fsMod,...authMod,db,auth};

    // 화면상으로는 계속 ㅇㅇ/닉네임을 사용하지만,
    // DB 권한과 작성자 소유권을 위해 내부적으로 Firebase Anonymous Auth UID를 사용합니다.
    if(!auth.currentUser){
      await authMod.signInAnonymously(auth);
    }
    firebaseUid = auth.currentUser?.uid || null;

    dbMode="firebase";
    await loadFirebaseData();
    return true;
  }catch(err){
    console.error("Firebase 초기화 실패",err);
    return false;
  }
}

async function loadFirebaseData(){
  if(dbMode!=="firebase")return;
  const A=firestoreApi;
  const q=A.query(A.collection(A.db,"posts"),A.orderBy("createdAt","desc"),A.limit(200));
  const snap=await A.getDocs(q);
  if(!snap.empty){
    posts=snap.docs.map(d=>{
      const x=d.data();
      return {...x,docId:d.id,createdAt:x.createdAt?.toMillis?.() ?? x.createdAt ?? Date.now()};
    });
  }
  const emoteSnap=await A.getDocs(A.query(A.collection(A.db,"emotes"),A.orderBy("order","asc")));
  if(!emoteSnap.empty) emotes=emoteSnap.docs.map(d=>({...d.data(),docId:d.id}));
}

async function savePost(post){
  if(dbMode==="firebase"){
    const A=firestoreApi;
    const payload={...post,ownerUid:firebaseUid,createdAt:A.serverTimestamp()};
    delete payload.id;
    const ref=await A.addDoc(A.collection(A.db,"posts"),payload);
    post.docId=ref.id;
    post.createdAt=Date.now();
    posts.unshift(post);
  }else{
    posts.push(post);persistLocal();
  }
}
async function saveComment(post,comment){
  if(dbMode==="firebase" && post.docId){
    const A=firestoreApi;
    await A.addDoc(A.collection(A.db,"posts",post.docId,"comments"),{...comment,createdAt:A.serverTimestamp()});
  }
  post.comments ||= [];post.comments.push(comment);
  if(dbMode==="local")persistLocal();
}
async function updateVote(post,kind){
  if(dbMode==="firebase" && post.docId){
    const A=firestoreApi;
    const ref=A.doc(A.db,"posts",post.docId);
    await A.updateDoc(ref,{[kind]:A.increment(1)});
  }
  post[kind]=(post[kind]||0)+1;
  if(dbMode==="local")persistLocal();
}
async function deletePostData(post){
  if(dbMode==="firebase" && post.docId){
    const A=firestoreApi;await A.deleteDoc(A.doc(A.db,"posts",post.docId));
  }
  posts=posts.filter(p=>p!==post);
  if(dbMode==="local")persistLocal();
}

/* ---------------- NEIS ---------------- */

async function fetchSchoolData(){
  const status=$("#neisStatus");
  status.className="api-status";
  status.textContent="NEIS 학교 정보 불러오는 중";

  const date=ymd();
  // 1) 권장: Firebase Function 프록시
  try{
    const res=await fetch(`/api/neis?date=${date}`);
    if(res.ok){
      const data=await res.json();
      applySchoolData(data.timetable||[],data.meals||[]);
      status.className="api-status ok";
      status.textContent="NEIS 실시간 데이터";
      return;
    }
  }catch{}

  // 2) GitHub Pages 등 정적 배포에서는 샘플 키 호출 시도.
  // 제한 때문에 일부 교시만 올 수 있으며 운영용은 functions 프록시 사용 권장.
  try{
    const base="https://open.neis.go.kr/hub/";
    const common=`Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${SITE.atptCode}&SD_SCHUL_CODE=${SITE.schoolCode}`;
    const timetableUrl=`${base}hisTimetable?${common}&AY=${new Date().getFullYear()}&GRADE=${SITE.grade}&CLASS_NM=${SITE.classNo}&TI_FROM_YMD=${date}&TI_TO_YMD=${date}`;
    const mealUrl=`${base}mealServiceDietInfo?${common}&MLSV_YMD=${date}`;
    const [tRes,mRes]=await Promise.all([fetch(timetableUrl),fetch(mealUrl)]);
    const [t,m]=await Promise.all([tRes.json(),mRes.json()]);
    const timetable=t?.hisTimetable?.[1]?.row?.map(x=>({period:Number(x.PERIO),subject:x.ITRT_CNTNT})) || [];
    const meals=m?.mealServiceDietInfo?.[1]?.row?.map(x=>x.DDISH_NM) || [];
    applySchoolData(timetable,meals);
    status.className="api-status";
    status.textContent="NEIS 공개 샘플 연결 · 운영 시 API 프록시 권장";
    return;
  }catch(err){
    console.warn("NEIS fallback failed",err);
  }

  applySchoolData([],[]);
  status.className="api-status error";
  status.textContent="학교 정보 연결 실패 · DATABASE_SETUP.md 확인";
}

function applySchoolData(timetable,meals){
  timetable=[...timetable].sort((a,b)=>(a.period||0)-(b.period||0));
  $("#timetableList").innerHTML=timetable.length
    ? timetable.map(x=>`<div class="timetable-item"><b>${x.period}</b><span>${esc(x.subject||"-")}</span></div>`).join("")
    : `<div style="padding:12px;color:#888">오늘 시간표 정보 없음</div>`;
  $("#firstClass").textContent=timetable[0]?.subject || "정보 없음";

  let dishes=[];
  meals.forEach(x=>{
    const cleaned=String(x).replace(/<br\s*\/?>/gi,"\n").split("\n").map(s=>s.replace(/\s*\([^)]*\)\s*/g,"").trim()).filter(Boolean);
    dishes.push(...cleaned);
  });
  $("#mealList").innerHTML=dishes.length?dishes.map(x=>`<div>· ${esc(x)}</div>`).join(""):`<span style="color:#888">오늘 급식 정보 없음</span>`;
  $("#mealSummary").textContent=dishes[0] || "정보 없음";
}

/* ---------------- rendering ---------------- */

function renderIdentity(){
  $("#identityName").innerHTML=identityHTML(currentName(),currentCode());
  $("#identitySub").textContent=user ? "닉네임 로그인 중" : "비로그인 · 익명";
  $("#writeAuthor").innerHTML=identityHTML(currentName(),currentCode());
  $("#commentAuthor").innerHTML=identityHTML(currentName(),currentCode());
  $("#guestSample").innerHTML=identityHTML("ㅇㅇ",guestCode);
  $("#loginOpen").textContent=user?user.nickname:"로그인";
  $("#sideLogin").textContent=user?"계정 관리":"닉네임 로그인";
  $("#logoutBtn").classList.toggle("hidden",!user);
}

function categories(){return ["전체","잡담","질문","정보","급식","짤","투표"]}
function renderCategories(){
  $("#categoryBar").innerHTML=categories().map(c=>`<button type="button" class="category-btn ${state.category===c?"active":""}" data-category="${c}">${c}</button>`).join("");
  $("#writeCategory").innerHTML=categories().filter(x=>x!=="전체").map(c=>`<option>${c}</option>`).join("");
  $$("[data-category]").forEach(b=>b.onclick=()=>{
    state.category=b.dataset.category;state.page=1;renderCategories();renderPosts();
  });
}

function filteredPosts(){
  let list=[...posts];
  if(state.tab==="concept") list=list.filter(p=>(p.up||0)-(p.down||0)>=10&&!p.notice);
  if(state.tab==="notice") list=list.filter(p=>p.notice);
  if(state.tab==="all"){
    list.sort((a,b)=>{
      if(Boolean(a.notice)!==Boolean(b.notice))return a.notice?-1:1;
      return (b.createdAt||0)-(a.createdAt||0);
    });
  }
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

function postNumber(p,i){return p.notice?"-":(p.id||Math.max(1,posts.length-i))}
function renderPosts(){
  const list=filteredPosts();
  const pages=Math.max(1,Math.ceil(list.length/state.size));
  state.page=Math.min(state.page,pages);
  const visible=list.slice((state.page-1)*state.size,state.page*state.size);

  $("#postList").innerHTML=visible.length?visible.map((p,i)=>{
    const concept=(p.up||0)-(p.down||0)>=10&&!p.notice;
    return `<div class="board-row post-row ${p.notice?"notice":""} ${concept?"concept":""}">
      <span>${postNumber(p,i)}</span>
      <span class="post-category">${p.notice?"공지":esc(p.category)}</span>
      <span class="title-cell">
        <button type="button" class="post-title" data-open-post="${p.docId||p.id}" data-category="[${esc(p.notice?"공지":p.category)}]">${esc(p.title)}</button>
        ${(p.comments?.length||0)?`<span class="reply-count">[${p.comments.length}]</span>`:""}
      </span>
      <span class="post-author">${identityHTML(p.author,p.guestCode)}</span>
      <span class="post-date">${dateShort(p.createdAt||Date.now())}</span>
      <span class="post-views">${p.views||0}</span>
      <span class="post-up">${p.up||0}</span>
    </div>`;
  }).join(""):`<div style="padding:42px;text-align:center;color:#888;border-bottom:1px solid #ddd">게시물이 없습니다.</div>`;

  $$("[data-open-post]").forEach(b=>b.onclick=()=>openPost(b.dataset.openPost));
  $("#pagination").innerHTML=Array.from({length:Math.min(pages,10)},(_,i)=>i+1).map(n=>`<button class="page-btn ${n===state.page?"active":""}" data-page="${n}" type="button">${n}</button>`).join("");
  $$("[data-page]").forEach(b=>b.onclick=()=>{state.page=Number(b.dataset.page);renderPosts()});
  renderNotices();renderHot();
}

function renderNotices(){
  const n=posts.filter(p=>p.notice).slice(0,3);
  $("#noticeList").innerHTML=n.map(p=>`<button class="notice-link" type="button" data-notice="${p.docId||p.id}">[공지] ${esc(p.title)}</button>`).join("");
  $$("[data-notice]").forEach(b=>b.onclick=()=>openPost(b.dataset.notice));
}

function renderHot(){
  const h=[...posts].filter(p=>!p.notice).sort((a,b)=>(((b.up||0)-(b.down||0))*5+(b.views||0))-(((a.up||0)-(a.down||0))*5+(a.views||0))).slice(0,5);
  $("#hotList").innerHTML=h.map((p,i)=>`<div class="hot-row"><span class="hot-rank">${i+1}</span><button type="button" class="hot-link" data-hot="${p.docId||p.id}">${esc(p.title)}</button></div>`).join("");
  $$("[data-hot]").forEach(b=>b.onclick=()=>openPost(b.dataset.hot));
}

function renderEmotes(){
  $("#emotePreview").innerHTML=emotes.slice(0,8).map(e=>`<div class="preview-emote" title="${esc(e.name)}">${esc(e.char)}</div>`).join("");
  $("#emotePicker").innerHTML=emotes.map((e,i)=>`<button type="button" class="emote-choice" data-emote-index="${i}"><strong>${esc(e.char)}</strong><span>${esc(e.name)}</span></button>`).join("");
  $$("[data-emote-index]").forEach(b=>b.onclick=()=>insertEmote(Number(b.dataset.emoteIndex)));
}

function findPost(key){
  return posts.find(p=>String(p.docId||p.id)===String(key));
}
async function loadFirebaseComments(p){
  if(dbMode!=="firebase"||!p.docId)return;
  const A=firestoreApi;
  const q=A.query(A.collection(A.db,"posts",p.docId,"comments"),A.orderBy("createdAt","asc"));
  const snap=await A.getDocs(q);
  p.comments=snap.docs.map(d=>{const x=d.data();return {...x,docId:d.id,createdAt:x.createdAt?.toMillis?.()??Date.now()}});
}

async function openPost(key){
  const p=findPost(key);if(!p)return;
  state.currentPost=key;
  p.views=(p.views||0)+1;
  if(dbMode==="firebase"&&p.docId){
    try{
      const A=firestoreApi;await A.updateDoc(A.doc(A.db,"posts",p.docId),{views:A.increment(1)});
    }catch{}
    await loadFirebaseComments(p);
  }else persistLocal();

  $("#viewCategory").textContent=p.notice?"공지":p.category;
  $("#viewTitle").textContent=p.title;
  $("#viewAuthor").innerHTML=identityHTML(p.author,p.guestCode);
  $("#viewDate").textContent=dateFull(p.createdAt||Date.now());
  $("#viewViews").textContent=p.views||0;$("#viewUp").textContent=p.up||0;
  $("#upCount").textContent=p.up||0;$("#downCount").textContent=p.down||0;
  $("#viewBody").textContent=p.body||"";
  const img=safeUrl(p.image||"");
  $("#viewImage").innerHTML=img?`<img src="${esc(img)}" alt="첨부 이미지" referrerpolicy="no-referrer">`:"";
  const own=(dbMode==="firebase" && firebaseUid && p.ownerUid===firebaseUid) || (user&&p.author===user.nickname);
  $("#deletePost").classList.toggle("hidden",!(state.admin||own));
  renderComments(p);renderPosts();
  $("#postDialog").showModal();
}

function renderComments(p){
  const cs=p.comments||[];
  $("#commentCount").textContent=cs.length;
  $("#commentList").innerHTML=cs.length?cs.map(c=>`<div class="comment-row">
    <div class="comment-writer">${identityHTML(c.author,c.guestCode)}</div>
    <div class="comment-text">${esc(c.text)}</div>
    <div class="comment-time">${dateShort(c.createdAt||Date.now())}</div>
  </div>`).join(""):`<div style="padding:18px;text-align:center;color:#999;border-bottom:1px solid #eee">아직 댓글이 없습니다.</div>`;
}

function insertEmote(i){
  const e=emotes[i];if(!e)return;
  const target=state.emoteTarget==="comment"?$("#commentInput"):$("#writeBody");
  target.value+=(target.value&&!target.value.endsWith(" ")?" ":"")+e.char+" ";
  target.dispatchEvent(new Event("input"));
  $("#emoteDialog").close();
}

function renderAdminEmotes(){
  $("#adminEmoteList").innerHTML=emotes.map((e,i)=>`<div class="admin-emote-row"><span>${esc(e.char)} ${esc(e.name)}</span><button type="button" class="danger-btn" data-del-emote="${i}">삭제</button></div>`).join("");
  $$("[data-del-emote]").forEach(b=>b.onclick=async()=>{
    const idx=Number(b.dataset.delEmote);
    if(dbMode==="firebase"&&emotes[idx]?.docId){
      const A=firestoreApi;await A.deleteDoc(A.doc(A.db,"emotes",emotes[idx].docId));
    }
    emotes.splice(idx,1);
    if(dbMode==="local")persistLocal();
    renderEmotes();renderAdminEmotes();
  });
}

function bind(){
  $$(".dialog-close").forEach(b=>b.onclick=()=>b.closest("dialog").close());
  $$(".dialog-cancel").forEach(b=>b.onclick=()=>b.closest("dialog").close());
  $$("[data-scroll]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.scroll).scrollIntoView({behavior:"smooth"}));

  $("#writeOpen").onclick=$("#writeBottom").onclick=()=>$("#writeDialog").showModal();
  $("#loginOpen").onclick=$("#sideLogin").onclick=()=>$("#loginDialog").showModal();
  $("#adminOpen").onclick=()=>$("#adminDialog").showModal();
  $("#openEmotesFromSide").onclick=()=>{state.emoteTarget="write";$("#emoteDialog").showModal()};

  $$(".tab").forEach(b=>b.onclick=()=>{
    $$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");
    state.tab=b.dataset.tab;state.page=1;renderPosts();
  });
  $("#pageSize").onchange=e=>{state.size=Number(e.target.value);state.page=1;renderPosts()};
  $("#reloadBtn").onclick=async()=>{if(dbMode==="firebase")await loadFirebaseData();renderPosts();toast("새로고침했습니다.")};

  $("#boardSearch").onsubmit=e=>{
    e.preventDefault();state.search=$("#boardSearchInput").value.trim();state.searchType=$("#searchType").value;state.page=1;renderPosts();
  };
  $("#topSearch").onsubmit=e=>{
    e.preventDefault();state.search=$("#topSearchInput").value.trim();state.searchType="all";state.page=1;
    $("#boardSearchInput").value=state.search;renderPosts();document.querySelector(".board-top").scrollIntoView({behavior:"smooth"});
  };

  $("#writeBody").oninput=e=>$("#writeCount").textContent=`${e.target.value.length} / 5000`;
  $("#writeForm").onsubmit=async e=>{
    e.preventDefault();
    const title=$("#writeTitle").value.trim(),body=$("#writeBody").value.trim();if(!title||!body)return;
    const p={
      id:Math.max(132,...posts.map(x=>Number(x.id)||0))+1,
      category:$("#writeCategory").value,title,body,author:currentName(),guestCode:currentCode(),
      ownerUid: firebaseUid,
      createdAt:Date.now(),views:0,up:0,down:0,notice:false,comments:[],image:safeUrl($("#writeImageUrl").value.trim())
    };
    try{
      await savePost(p);e.target.reset();$("#writeCount").textContent="0 / 5000";$("#writeDialog").close();renderPosts();toast("글이 등록되었습니다.");
    }catch(err){console.error(err);toast("글 등록에 실패했습니다. DB 권한을 확인하세요.")}
  };

  $("#commentForm").onsubmit=async e=>{
    e.preventDefault();const text=$("#commentInput").value.trim();if(!text)return;
    const p=findPost(state.currentPost);if(!p)return;
    const c={author:currentName(),guestCode:currentCode(),ownerUid:firebaseUid,text,createdAt:Date.now()};
    try{
      await saveComment(p,c);$("#commentInput").value="";renderComments(p);renderPosts();toast("댓글이 등록되었습니다.");
    }catch(err){console.error(err);toast("댓글 등록에 실패했습니다.")}
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
    try{await deletePostData(p);$("#postDialog").close();renderPosts();toast("삭제했습니다.")}catch{toast("삭제에 실패했습니다.")}
  };

  $("#loginForm").onsubmit=e=>{
    e.preventDefault();
    const nick=$("#nicknameInput").value.trim(),pw=$("#passwordInput").value;
    const accounts=local.get(KEYS.accounts,{});
    if(accounts[nick]&&accounts[nick]!==pw)return toast("비밀번호가 다릅니다.");
    accounts[nick]=pw;local.set(KEYS.accounts,accounts);user={nickname:nick};local.set(KEYS.user,user);
    renderIdentity();$("#loginDialog").close();toast(`${nick}으로 로그인했습니다.`);
  };
  $("#logoutBtn").onclick=()=>{user=null;localStorage.removeItem(KEYS.user);renderIdentity();$("#loginDialog").close();toast("로그아웃했습니다.")};
  $("#memberMode").onclick=()=>{
    $("#memberMode").classList.add("active");$("#guestMode").classList.remove("active");$("#loginForm").classList.remove("hidden");$("#guestInfo").classList.add("hidden");
  };
  $("#guestMode").onclick=()=>{
    $("#guestMode").classList.add("active");$("#memberMode").classList.remove("active");$("#guestInfo").classList.remove("hidden");$("#loginForm").classList.add("hidden");
  };

  $("#favoriteBtn").onclick=()=>{
    const on=!local.get(KEYS.favorite,false);local.set(KEYS.favorite,on);$("#favoriteBtn").textContent=on?"★ 즐겨찾기":"☆ 즐겨찾기";toast(on?"즐겨찾기에 추가했습니다.":"즐겨찾기에서 해제했습니다.");
  };

  $("#refreshSchoolData").onclick=()=>fetchSchoolData();

  $("#adminGate").onsubmit=e=>{
    e.preventDefault();
    if($("#adminPassword").value!=="classadmin")return toast("관리자 암호가 다릅니다.");
    state.admin=true;$("#adminGate").classList.add("hidden");$("#adminPanel").classList.remove("hidden");renderAdminEmotes();toast("관리자 모드");
  };
  $$(".admin-tab").forEach(b=>b.onclick=()=>{
    $$(".admin-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");
    $$(".admin-section").forEach(x=>x.classList.add("hidden"));$("#admin-"+b.dataset.adminTab).classList.remove("hidden");
  });
  $("#addEmote").onclick=async()=>{
    const name=$("#newEmoteName").value.trim(),char=$("#newEmoteChar").value.trim();if(!name||!char)return toast("이름과 표시를 입력하세요.");
    const e={name,char,order:emotes.length};
    if(dbMode==="firebase"){
      const A=firestoreApi;const ref=await A.addDoc(A.collection(A.db,"emotes"),e);e.docId=ref.id;
    }
    emotes.push(e);if(dbMode==="local")persistLocal();$("#newEmoteName").value="";$("#newEmoteChar").value="";renderEmotes();renderAdminEmotes();toast("반콘을 추가했습니다.");
  };
  $("#addNotice").onclick=async()=>{
    const title=$("#noticeTitle").value.trim(),body=$("#noticeBody").value.trim();if(!title||!body)return toast("제목과 내용을 입력하세요.");
    const p={id:Math.max(132,...posts.map(x=>Number(x.id)||0))+1,category:"공지",title,body,author:"관리자",guestCode:"",ownerUid:firebaseUid,createdAt:Date.now(),views:0,up:0,down:0,notice:true,comments:[]};
    await savePost(p);$("#noticeTitle").value="";$("#noticeBody").value="";renderPosts();toast("공지를 등록했습니다.");
  };
  $("#saveSettings").onclick=()=>{
    settings.discord=$("#discordSetting").value.trim()||SITE.discord;
    if(dbMode==="local")persistLocal();
    $("#discordHeader").href=settings.discord;toast("저장했습니다.");
  };
  $("#resetSite").onclick=()=>{
    if(!confirm("로컬 데모 데이터를 초기화할까요?"))return;
    posts=structuredClone(DEFAULT_POSTS);emotes=structuredClone(DEFAULT_EMOTES);votes={};settings={discord:SITE.discord};
    persistLocal();renderPosts();renderEmotes();renderAdminEmotes();toast("초기화했습니다.");
  };
}

async function vote(kind){
  const p=findPost(state.currentPost);if(!p)return;
  const k=String(p.docId||p.id);
  if(votes[k])return toast("이미 투표한 글입니다.");
  try{
    await updateVote(p,kind);votes[k]=kind;local.set(KEYS.votes,votes);
    $("#upCount").textContent=p.up||0;$("#downCount").textContent=p.down||0;renderPosts();
    toast(kind==="up"?"개추했습니다.":"비추했습니다.");
  }catch(err){console.error(err);toast("투표에 실패했습니다.")}
}

async function init(){
  bind();
  $("#todayDate").textContent=new Date().toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"});
  $("#discordHeader").href=settings.discord||SITE.discord;
  $("#discordSetting").value=settings.discord||SITE.discord;
  $("#favoriteBtn").textContent=local.get(KEYS.favorite,false)?"★ 즐겨찾기":"☆ 즐겨찾기";
  $("#onlineCount").textContent=String(11+Math.floor(Math.random()*13));
  renderIdentity();renderCategories();renderEmotes();

  const firebaseReady=await initFirebase();
  renderPosts();
  if(firebaseReady){
    $("#neisStatus").textContent="DB 연결됨 · 학교 정보 확인 중";
  }
  await fetchSchoolData();

  if(location.hash.startsWith("#post-")){
    const key=decodeURIComponent(location.hash.slice(6));
    if(findPost(key))openPost(key);
  }
}
init();
