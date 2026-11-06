// Public-site stand-in for the Claude artifact runtime (window.claude.use).
// The page is the same Bet Ledger that runs in Claude; here its storage comes from:
//   board/nfl  -> lines.json (refreshed every 2 minutes)
//   players    -> Firebase group (Google sign-in) or this browser when signed out
//   bets       -> this browser
(function(){
  "use strict";
  const qs=new URLSearchParams(location.search);
  const LS={bets:"bt-bets",me:"bt-local-id",player:"bt-player"};
  const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(_){return d;}},
            set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}};
  const rid=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>"abcdefghjkmnpqrstuvwxyz23456789"[b%31]).join("");
  const localId=ls.get(LS.me,null)||(()=>{const v="local-"+rid();ls.set(LS.me,v);return v;})();
  const snap=(id,data)=>({id,exists:data!=null,data:()=>data});
  const qsnap=docs=>({docs:docs.map(([id,d])=>snap(id,d)),forEach(f){this.docs.forEach(f);},empty:!docs.length});
  // picks were stored as an object map by the older public board; the page expects an array
  const normPlayer=d=>{if(!d)return d;const o={...d};if(o.picks&&!Array.isArray(o.picks))o.picks=Object.values(o.picks).map(p=>({id:p.id||(p.gameId+"_"+p.side),...p}));return o;};

  /* ---------- a small local collection with listeners ---------- */
  function localCollection(key){
    const subs=new Set();const read=()=>ls.get(key,{});
    const emit=()=>{const all=read();subs.forEach(f=>f(qsnap(Object.entries(all))));};
    return{
      doc:id=>({id,get:async()=>snap(id,read()[id]??null),
        set:async v=>{const all=read();all[id]=JSON.parse(JSON.stringify(v));ls.set(key,all);emit();},
        delete:async()=>{const all=read();delete all[id];ls.set(key,all);emit();},
        onSnapshot(f){const run=()=>f(snap(id,read()[id]??null));run();const s=()=>run();subs.add(s);return()=>subs.delete(s);}}),
      get:async()=>qsnap(Object.entries(read())),
      onSnapshot(f){subs.add(f);setTimeout(()=>f(qsnap(Object.entries(read()))),0);return()=>subs.delete(f);}
    };
  }
  const empty={get:async()=>qsnap([]),onSnapshot(f){setTimeout(()=>f(qsnap([])),0);return()=>{};},doc:id=>({id,get:async()=>snap(id,null),set:async()=>{},delete:async()=>{},onSnapshot(f){f(snap(id,null));return()=>{};}})};

  /* ---------- board from lines.json ---------- */
  const boardSubs=new Set();let lastBoard=null;
  async function pullBoard(){try{const r=await fetch("lines.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)return;const j=await r.json();
    const sig=JSON.stringify([j.updatedAt,(j.games||[]).map(g=>g.live&&g.live.updatedAt)]);if(lastBoard&&lastBoard.sig===sig)return;
    applySharp(j);lastBoard={sig,j};boardSubs.forEach(f=>f(snap("nfl",j)));refreshSharp();}catch(_){}}

  /* ---------- Pinnacle lines on page open (The Odds API), shared 30-minute cache ---------- */
  const SH_TTL=30*60e3,SH_LS="bt-pinnacle";let sharp=null,sharpBusy=false;
  const _k=()=>String.fromCharCode(...[108,37,29,75,112,109,37,74,79,125,57,36,79,30,125,106,42,77,76,119,105,119,24,76,32,56,43,24,26,39,105,32].map((c,i)=>c^[90,19,126,41,68][i%5]));
  function applySharp(j){if(!sharp||!sharp.games||!j||!j.games)return;let n=0;
    for(const g of j.games){const v=sharp.games[g.away+"|"+g.home];if(v){g.b=g.b||{};g.b.Pinnacle=v;n++;}}
    if(n){j.books=j.books||[];if(!j.books.includes("Pinnacle")){const i=j.books.indexOf("Consensus");j.books.splice(i<0?j.books.length:i+1,0,"Pinnacle");}
      j.sharp={Pinnacle:{updatedAt:new Date(sharp.at).toISOString(),source:"The Odds API"}};}}
  const fresh=x=>x&&x.at&&Date.now()-x.at<SH_TTL;
  async function refreshSharp(){if(sharpBusy||fresh(sharp))return;sharpBusy=true;
    try{
      let got=ls.get(SH_LS,null);
      if(!fresh(got)&&fdb){try{const d=await fdb.collection("sharp").doc("pinnacle").get();if(d.exists&&fresh(d.data()))got=d.data();}catch(_){}}
      if(!fresh(got)){
        const u="https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?regions=eu&markets=spreads,totals,h2h&bookmakers=pinnacle&oddsFormat=american&apiKey="+_k();
        const r=await fetch(u);if(!r.ok)throw new Error("odds "+r.status);const ev=await r.json();const games={};
        for(const e of ev){const bk=(e.bookmakers||[]).find(b=>b.key==="pinnacle");if(!bk)continue;const m=k=>(bk.markets.find(x=>x.key===k)||{}).outcomes||[];
          const f=(k,nm)=>m(k).find(o=>o.name===nm);const sa=f("spreads",e.away_team),sh=f("spreads",e.home_team),ov=f("totals","Over"),un=f("totals","Under"),ma=f("h2h",e.away_team),mh=f("h2h",e.home_team);
          games[e.away_team+"|"+e.home_team]=[sa?sa.point:null,sa?sa.price:null,sh?sh.price:null,ov?ov.point:null,ov?ov.price:null,un?un.price:null,ma?ma.price:null,mh?mh.price:null];}
        got={at:Date.now(),games};
        if(fdb){try{await fdb.collection("sharp").doc("pinnacle").set(got);}catch(_){}}
      }
      sharp=got;ls.set(SH_LS,got);
      if(lastBoard){applySharp(lastBoard.j);boardSubs.forEach(f=>f(snap("nfl",lastBoard.j)));}
    }catch(_){}finally{sharpBusy=false;}}
  setInterval(refreshSharp,5*60e3);
  setInterval(pullBoard,120e3);document.addEventListener("visibilitychange",()=>{if(!document.hidden)pullBoard();});

  /* ---------- Firebase sign-in and groups ---------- */
  let fb=null,user=null,group=null,fdb=null,cloudMsg="";
  function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s);});}
  const ready=(async()=>{
    const cfg=window.FIREBASE_CONFIG;if(!cfg||!cfg.apiKey)return;
    try{const v="10.12.2";await loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`);
      await Promise.all([loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-auth-compat.js`),loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore-compat.js`)]);}
    catch(_){cloudMsg="Sign-in couldn't load. Picks are saved in this browser.";return;}
    fb=window.firebase;fb.initializeApp(cfg);fdb=fb.firestore();
    user=await new Promise(res=>{let done=false;const t=setTimeout(()=>{if(!done){done=true;res(null);}},6000);
      fb.auth().onAuthStateChanged(u=>{if(!done){done=true;clearTimeout(t);res(u);}else if(!!u!==!!user||(u&&user&&u.uid!==user.uid))location.reload();});});
    if(user){try{const rawGroup=qs.get("g");const wanted=rawGroup&&rawGroup!=="null"&&rawGroup!=="undefined"?rawGroup:null;group=await joinGroup(wanted);if(qs.has("g")&&!wanted){qs.delete("g");history.replaceState(null,"",location.pathname+(qs.toString()?"?"+qs:""));}}catch(e){cloudMsg="Signed in, but your group couldn't load. Picks are saved in this browser for now.";group=null;}}
  })();
  async function joinGroup(wanted){
    const uref=fdb.collection("users").doc(user.uid);const us=await uref.get();
    const g=wanted||(us.exists&&us.data().group)||rid();
    const gref=fdb.collection("groups").doc(g);const gs=await gref.get();
    if(!gs.exists)await gref.set({owner:user.uid,created:fb.firestore.FieldValue.serverTimestamp()});
    if(!us.exists||us.data().group!==g)await uref.set({group:g});
    const me=gref.collection("players").doc(user.uid);
    if(!(await me.get()).exists){ // bring over picks made while signed out
      const local=normPlayer(ls.get(LS.player,{})[localId]||null)||{};
      await me.set({name:user.displayName||"Player",picks:local.picks||[],conf:local.conf||{},comments:local.comments||{},at:new Date().toISOString()});}
    if(qs.get("g")){qs.delete("g");history.replaceState(null,"",location.pathname+(qs.toString()?"?"+qs:""));}
    return g;
  }
  function cloudPlayers(){
    const col=fdb.collection("groups").doc(group).collection("players");
    return{
      doc:id=>({id,get:async()=>{const s=await col.doc(id).get();return snap(id,s.exists?normPlayer(s.data()):null);},
        set:async v=>col.doc(id).set({name:user.displayName||"Player",picks:v.picks||[],conf:v.conf||{},comments:v.comments||{},at:v.at||new Date().toISOString()}),
        delete:async()=>col.doc(id).delete()}),
      get:async()=>{const s=await col.get();return qsnap(s.docs.map(d=>[d.id,normPlayer(d.data())]));},
      onSnapshot:(f,err)=>col.onSnapshot(s=>f(qsnap(s.docs.map(d=>[d.id,normPlayer(d.data())]))),err)
    };
  }

  /* ---------- the runtime surface the page uses ---------- */
  const names={};
  const db={
    doc(path){if(path==="board/nfl")return{onSnapshot(f){boardSubs.add(f);if(lastBoard)f(snap("nfl",lastBoard.j));else pullBoard();return()=>boardSubs.delete(f);},get:async()=>{await pullBoard();return snap("nfl",lastBoard&&lastBoard.j);}};
      const [c,id]=path.split("/");return db.collection(c).doc(id);},
    collection(path){
      if(path==="bets")return localCollection(LS.bets);
      if(path==="players"){
        if(user&&group){const cp=cloudPlayers();const raw=cp.onSnapshot;cp.onSnapshot=(f,e)=>raw(s=>{s.docs.forEach(d=>{const n=d.data()&&d.data().name;if(n)names[d.id]=n;});f(s);},e);return cp;}
        return localCollection(LS.player);}
      return empty;
    }
  };
  const userApi={
    id:async()=>user?user.uid:localId,
    me:async()=>({id:user?user.uid:localId,name:user?(user.displayName||""):""}),
    isOwner:async()=>true,canEdit:async()=>true,can:()=>true,
    profiles:async ids=>Object.fromEntries(ids.map(i=>[i,{id:i,name:i===(user&&user.uid)?(user.displayName||""):(names[i]||"")}]))
  };
  const downloads={save:async({filename,data})=>{const url=URL.createObjectURL(new Blob([data],{type:"text/csv"}));
    const a=document.createElement("a");a.href=url;a.download=filename||"download.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}};
  window.claude={use:async name=>{
    if(name==="db"){await ready;return db;}
    if(name==="user"){await ready;return userApi;}
    if(name==="downloads")return downloads;
    return null; // mcp, sample, and others are Claude-only
  }};

  /* ---------- sign-in bar ---------- */
  const G='<svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 7.2-9.6 7.2-16.9z"/><path fill="#FBBC05" d="M10.5 28.6A14.4 14.4 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2.2 1.5-5 2.3-8.8 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function bar(){const wrap=document.querySelector(".wrap");if(!wrap)return;let el=document.getElementById("pubAuth");
    if(!el){el=document.createElement("div");el.id="pubAuth";el.className="pubauth";wrap.insertBefore(el,wrap.firstChild);}
    if(!fb){el.innerHTML=cloudMsg?`<span class="note">${esc(cloudMsg)}</span>`:"";el.hidden=!cloudMsg;return;}
    el.hidden=false;
    if(!user){el.innerHTML=`<span class="note">${esc(cloudMsg||"Picks and your bet log are saved in this browser. Sign in to pick with friends and comment.")}</span><button type="button" class="gbtn" id="pubSignIn">${G}Sign in with Google</button>`;
      document.getElementById("pubSignIn").onclick=signIn;return;}
    const link=location.origin+location.pathname+"?g="+encodeURIComponent(group||"");
    el.innerHTML=`<span class="note">${esc(cloudMsg||("Signed in as "+(user.displayName||user.email||"you")+". Your picks sync to your group. Your bet log stays in this browser."))}</span>
      <span class="btns"><span class="note" id="pubToast" aria-live="polite"></span>${group?`<button type="button" class="primary" id="pubInvite">Copy invite link</button>`:""}<button type="button" class="ghost" id="pubSignOut">Sign out</button></span>`;
    const inv=document.getElementById("pubInvite");if(inv)inv.onclick=async()=>{const t=document.getElementById("pubToast");try{await navigator.clipboard.writeText(link);t.textContent="Link copied";}catch(_){window.prompt("Copy this invite link:",link);}setTimeout(()=>{t.textContent="";},2500);};
    document.getElementById("pubSignOut").onclick=()=>fb.auth().signOut().then(()=>location.reload());}
  async function signIn(){try{await fb.auth().signInWithPopup(new fb.auth.GoogleAuthProvider());location.reload();}
    catch(e){if(e&&e.code==="auth/popup-closed-by-user")return;cloudMsg=window.top!==window.self?"Sign-in was blocked inside this page. Open the board in its own tab to sign in.":"Sign-in didn't finish. Allow pop-ups for this site and try again.";bar();}}
  const start=()=>{bar();ready.then(()=>{bar();refreshSharp();});};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
  pullBoard();
})();
