/* Nube: Firebase Auth + Firestore, vínculos, mochila privada, actualización forzada */
'use strict';
/* ---------- Nube (Firestore + Auth) ---------- */
var SYNC={ok:['var(--mint)','Sincronizado'],saving:['var(--sun)','Guardando…'],connecting:['var(--sun)','Conectando…'],offline:['var(--rose)','Sin conexión'],err:['var(--rose)','Error de conexión'],denied:['var(--rose)','Sin permiso: revisá las reglas de Firestore'],local:['var(--muted)','Solo en este dispositivo'],none:['var(--rose)','Sin conectar'],login:['var(--muted)','Falta iniciar sesión']};
function syncChip(){var x=SYNC[syncState==='connecting'&&navigator.onLine===false?'offline':syncState];return x?'<span class="chip" role="status"><i class="dot" style="background:'+x[0]+'"></i>'+x[1]+'</span>':'';}
function setSync(st){syncState=st;renderHead();}
var clean=function(o){return JSON.parse(JSON.stringify(o))};
function fbErr(e){if(e&&e.code==='permission-denied')setSync('denied');}
/* AUTH: '' sin nube · 'pending' esperando Firebase · 'out' sin sesión · 'in' logueado · 'offline' Firebase no cargó */
var AUTH='',ME=null,loggingOut=false;
/* CLAIMS: personId -> {uid,name}. Cada persona del viaje la puede "reclamar" una sola cuenta de Google;
   las reglas usan ese vínculo para que la mochila de cada uno sea privada. */
var claimsLoaded=false,CLAIMS={},myClaim='',packUnsub=null,itemsReady=false;
var fdoc=function(){return FB.fs.doc.apply(null,[FB.db,'trips',CODE].concat([].slice.call(arguments)))};
function pushItem(k,it){
  if(!FB||!CODE||AUTH!=='in')return;
  if(k==='packing'){pushPacking(it);return;}
  if(isPriv(k,it)){pushPriv(k,it);return;}
  try{FB.fs.setDoc(fdoc('items',it.id),clean(Object.assign({k:k},it))).catch(fbErr);}catch(e){}
}
function pushPacking(it){
  if(!myClaim||it.owner!==myClaim)return; /* solo la propia; las sugerencias van por sendSuggestion */
  try{FB.fs.setDoc(fdoc('packing',it.id),clean(it)).catch(fbErr);}catch(e){}
}
/* Sin `patch` se manda el viaje entero; con `patch` solo esos campos (merge), para que si dos personas
   cambian cosas distintas a la vez (el nombre y el dólar, por ejemplo) no se pise ninguna. */
/* El viaje entero se reescribe (sin merge, para que se vayan las cotizaciones viejas al cambiar de moneda);
   owner y locked salen de lo último que dijo el servidor: las reglas no dejan cambiarlos sin ser el organizador. */
var TRIP_SRV={owner:'',locked:false};
function pushTrip(patch){
  if(!FB||!CODE||AUTH!=='in')return;
  var body;
  if(patch)body=Object.assign({u:S.trip.u},patch);
  else{body=Object.assign({},S.trip);if(TRIP_SRV.owner)body.owner=TRIP_SRV.owner;body.locked=TRIP_SRV.owner===ME.uid?!!S.trip.locked:TRIP_SRV.locked;if(!body.owner)delete body.owner;}
  try{FB.fs.setDoc(fdoc(),clean(body),{merge:!!patch}).catch(fbErr);}catch(e){}
}
/* srv: el dato viene confirmado por el servidor (no es un eco de un cambio propio pendiente). Ante empate
   de u gana el servidor: así, si dos personas editan lo mismo a la vez, todos terminan viendo lo mismo. */
function applyItem(k,d,srv){
  var it={};
  Object.keys(d).forEach(function(key){
    if(key==='k')return;
    var v=d[key];
    if(key==='attachments'||key==='links'||key==='shares'){it[key]=Array.isArray(v)?v.map(function(x){return Object.assign({},x)}):[];return;}
    if(v!==null&&typeof v==='object')return;
    it[key]=(key==='amount'||key==='u'||key==='del'||key==='c'||key==='ct'||key==='ra')?v:String(v);
  });
  if(!/^[a-z0-9]{1,24}$/i.test(it.id||''))return false;
  var i=S[k].findIndex(function(x){return x.id===it.id});
  if(i<0){S[k].push(it);return true;}
  var ru=+it.u||0,lu=+S[k][i].u||0;
  if(ru>lu||(srv&&ru===lu&&JSON.stringify(it)!==JSON.stringify(S[k][i]))){S[k][i]=it;return true;}
  return false;
}
function sendSuggestion(owner,text){
  var it={id:uid(),u:Date.now(),owner:owner,text:text,checked:'',suggested:'1',from:myPersonId()};
  if(!cloudMode()){S.packing.push(it);save();return;}
  /* No se guarda localmente: es de la mochila del otro, que no podemos leer. */
  try{FB.fs.setDoc(fdoc('packing',it.id),it).catch(fbErr);}catch(e){}
}
/* Se copian al vínculo (claims) de este viaje, que ven los demás: los alias marcados como visibles y
   nombre+tipo de cada forma de pago (para elegirla cuando cargan un gasto que pagaste vos). */
function myMethodsPub(){return METHODS.map(function(m){return {id:m.id,n:String(m.name||''),t:m.type||'otro'};});}
function myCobro(){return METHODS.filter(function(m){return m.share&&m.alias&&(m.type==='banco'||m.type==='billetera');}).map(function(m){return {n:String(m.name||''),a:String(m.alias)};});}
var methodsReady=false;
function syncCobro(){
  if(!FB||AUTH!=='in'||!methodsReady||!myClaim||!CLAIMS[myClaim])return;
  var want=myCobro(),wm=myMethodsPub(),c=CLAIMS[myClaim];
  if(JSON.stringify(want)===JSON.stringify(c.cobro||[])&&JSON.stringify(wm)===JSON.stringify(c.methods||[]))return;
  try{FB.fs.updateDoc(fdoc('claims',myClaim),{cobro:want,methods:wm}).catch(fbErr);}catch(e){}
}
function saveMethod(m){
  if(!FB||AUTH!=='in')return;
  var i=METHODS.findIndex(function(x){return x.id===m.id;});
  if(m.del){if(i>=0)METHODS.splice(i,1);}else if(i>=0)METHODS[i]=m;else METHODS.push(m);
  try{FB.fs.setDoc(FB.fs.doc(FB.db,'users',ME.uid,'methods',m.id),clean(m)).catch(fbErr);}catch(e){}
  syncCobro();
}
function claimPerson(pid){
  claimMsg='';
  if(!FB||AUTH!=='in'||!pid)return;
  if(myClaim&&myClaim!==pid)releaseClaim();
  if(CLAIMS[pid]&&CLAIMS[pid].uid===ME.uid)return;
  FB.fs.setDoc(fdoc('claims',pid),{uid:ME.uid,name:ME.name||'',cobro:myCobro(),methods:myMethodsPub(),u:Date.now()}).catch(function(e){
    claimMsg=e&&e.code==='permission-denied'?'Esa persona ya la eligió otra cuenta. Elegí otra o agregate con tu nombre.':'No se pudo guardar. Probá de nuevo.';
    render();
  });
}
function releaseClaim(){
  if(!FB||!myClaim)return;
  var pid=myClaim;
  try{FB.fs.deleteDoc(fdoc('claims',pid)).catch(fbErr);}catch(e){}
}
function subscribePacking(){
  if(packUnsub){packUnsub();packUnsub=null;}
  /* Lo propio que había localmente (p. ej. un viaje "solo en este dispositivo" que pasó a la nube) se
     sube si el servidor no lo tiene o lo tiene más viejo; lo de los demás se descarta. */
  if(!myClaim)return;   /* sin saber quién sos todavía, no se toca lo local (no se muestra igual) */
  var mine=S.packing.filter(function(x){return x.owner===myClaim;}),first=true;
  S.packing=[];save();
  var fs=FB.fs,owner=myClaim;
  packUnsub=fs.onSnapshot(fs.query(fs.collection(FB.db,'trips',CODE,'packing'),fs.where('owner','==',owner)),{includeMetadataChanges:true},function(snap){
    if(first&&!snap.metadata.fromCache){
      first=false;
      var rem={};snap.docs.forEach(function(x){rem[x.id]=x.data().u||0;});
      mine.forEach(function(it){if(rem[it.id]===undefined||(it.u||0)>rem[it.id]){S.packing.push(it);pushPacking(it);}});
    }
    var changed=false;
    snap.docChanges().forEach(function(ch){if(ch.type!=='removed'&&applyItem('packing',ch.doc.data(),!snap.metadata.fromCache&&!ch.doc.metadata.hasPendingWrites))changed=true;});
    if(changed){save();render();checkNewAvisos();}
  },function(err){fbErr(err);});
}
async function startCloud(){
  setSync('connecting');
  AUTH='pending';render();
  try{
    var root='https://www.gstatic.com/firebasejs/'+FB_VER+'/';
    var mods=await Promise.all([import(root+'firebase-app.js'),import(root+'firebase-firestore.js'),import(root+'firebase-storage.js'),import(root+'firebase-auth.js')]);
    var app=mods[0].initializeApp(FIREBASE_CONFIG),fs=mods[1],st=mods[2],au=mods[3],db;
    try{db=fs.initializeFirestore(app,{localCache:fs.persistentLocalCache({tabManager:fs.persistentMultipleTabManager()})});}catch(e){db=fs.getFirestore(app);}
    FB={db:db,fs:fs,storage:st.getStorage(app),st:st,au:au,auth:au.getAuth(app)};
    /* Desarrollo: abierta desde localhost usa los emuladores de Firebase (npm run emu), nunca la base real. */
    if(DEV){
      au.connectAuthEmulator(FB.auth,'http://127.0.0.1:9099',{disableWarnings:true});
      fs.connectFirestoreEmulator(db,'127.0.0.1',8085);st.connectStorageEmulator(FB.storage,'127.0.0.1',9199);
      window.__FB=FB;
      window.__signIn=function(sub,email,name){return au.signInWithCredential(FB.auth,au.GoogleAuthProvider.credential(JSON.stringify({sub:sub,email:email,email_verified:true,name:name})));};
    }
  }catch(e){AUTH='offline';setSync('err');render();return;}

  var listening=false;
  FB.au.onAuthStateChanged(FB.auth,function(u){
    if(u){
      ME={uid:u.uid,name:u.displayName||'',email:u.email||''};AUTH='in';loginMsg='';
      if(!listening){listening=true;listenTrips();listenMeta();listenPrefs();listenMyVehicles();listenLedgers();if(CODE)enterTrip();}
      render();
    }else{
      if(AUTH==='in'){if(!loggingOut)location.reload();return;}
      ME=null;AUTH='out';setSync('login');render();
    }
  });
}
var RELOAD_KEY='viaje-de-a-dos:reloadToken',reloadPending='';
function forceReload(tok){try{localStorage.setItem(RELOAD_KEY,tok);}catch(e){}location.replace(location.pathname+'?v='+encodeURIComponent(tok));}
/* ---------- Mis viajes: users/{uid}/trips/{code}, se anota solo cada viaje que se abre ---------- */
/* tripsLoaded: ya hay lista para mostrar (aunque sea de caché). tripsServer: confirmada por el servidor;
   recién ahí se puede decidir si un viaje ya tenía "visto" (una caché vacía no lo sabe). */
var MYTRIPS=[],tripsLoaded=false,tripsServer=false,lastTripRec='';
function listenTrips(){
  FB.fs.onSnapshot(FB.fs.collection(FB.db,'users',ME.uid,'trips'),{includeMetadataChanges:true},function(snap){
    MYTRIPS=snap.docs.map(function(x){return x.data()||{};}).filter(function(t){return /^[a-z0-9]{12,40}$/.test(t.code||'');})
      .sort(function(a,b){return (b.lastOpen||0)-(a.lastOpen||0);});
    tripsLoaded=true;
    if(!snap.metadata.fromCache)tripsServer=true;
    if(recordPending)recordTrip();
    if(homeMode())setSync('');
    render();if(formRefresh)formRefresh();
    maybeLoadOthers();
  },function(err){fbErr(err);});
}
/* Para los avisos de vencimiento hacen falta los gastos de los otros viajes: se buscan una vez. */
var othersAsked=false;
function maybeLoadOthers(){if(othersAsked||!CODE||!tripsServer||!methodsReady||!METHODS.some(function(m){return m.type==='credito';}))return;othersAsked=true;loadOtherCharges(true);}
var recordPending=false;
function recordTrip(){
  if(!FB||AUTH!=='in'||!CODE)return;
  if(!tripsServer){recordPending=true;return;}   /* hay que saber si ya tenía "visto" antes de escribir */
  recordPending=false;
  var t=S.trip,cy=cleanCity(t.city),key=[t.name,t.start,t.end,cy?cy.lat+','+cy.lng:''].join('|');
  if(key===lastTripRec)return;
  lastTripRec=key;
  var prev=MYTRIPS.find(function(x){return x.code===CODE;}),data={code:CODE,name:t.name||'',start:t.start||'',end:t.end||'',city:cy,lastOpen:Date.now()};
  if(!prev||!prev.seen)data.seen=Date.now();   /* los avisos arrancan desde que se abre el viaje por primera vez */
  try{FB.fs.setDoc(FB.fs.doc(FB.db,'users',ME.uid,'trips',CODE),data,{merge:true}).catch(fbErr);}catch(e){}
}
function forgetTrip(code){
  MYTRIPS=MYTRIPS.filter(function(t){return t.code!==code;});
  try{FB.fs.deleteDoc(FB.fs.doc(FB.db,'users',ME.uid,'trips',code)).catch(fbErr);}catch(e){}
}
function tripsListHtml(){
  if(!tripsLoaded)return '<p class="nada">'+(AUTH==='offline'?'Sin conexión: tu lista de viajes aparece cuando vuelva la señal.':'Cargando…')+'</p>';
  if(!MYTRIPS.length)return empty('Todavía no tenés viajes','Armá uno nuevo o abrí el link que te pasaron: cada viaje que abras queda anotado acá.');
  return MYTRIPS.map(function(t){
    var fechas=t.start?fShort(t.start)+(t.end?' al '+fShort(t.end):''):'Sin fechas';
    return '<div class="exp trow" role="button" tabindex="0" data-act="gotrip" data-code="'+esc(t.code)+'"><span class="ec" aria-hidden="true">🧳</span><div class="et"><b>'+esc(t.name||'Viaje sin nombre')+(t.code===CODE?'<span class="here">Estás acá</span>':'')+'</b><small><span>'+esc(fechas)+'</span>'+(t.lastOpen?'<span>Abierto '+esc(relTime(t.lastOpen))+'</span>':'')+'</small></div>'
     +'<div class="ea"><button type="button" class="sm ghost" data-forget="'+esc(t.code)+'" aria-label="Quitar de mi lista">✕</button></div></div>';
  }).join('');
}
function vHome(){
  return '<div class="bar"><h2>Tus viajes</h2><button class="primary" data-act="newtrip">+ Viaje nuevo</button></div>'
   +tripsListHtml()
   +'<section class="sec"><h2>¿Te pasaron un link?</h2><form class="pplform" id="joinform"><input type="text" id="joinc" placeholder="Pegá el link o el código" autocomplete="off" required><button type="submit" class="ghost">Abrir</button></form><p class="msg err" id="joinmsg"></p></section>';
}
function openTrips(){
  var panel=openSheet('Mis viajes','<div class="mb12 row"><button type="button" class="primary" data-act="newtrip">+ Viaje nuevo</button></div><div id="tripsl">'+tripsListHtml()+'</div><p class="mt12 hint">El ✕ solo lo saca de tu lista; el viaje sigue existiendo para los demás.</p>');
  formRefresh=function(){var w=$('#tripsl',panel);if(w)w.innerHTML=tripsListHtml();};
}
function login(){
  loginMsg='';
  if(!FB){loginMsg='Todavía se está conectando. Probá de nuevo en un segundo.';render();return;}
  var p=new FB.au.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});
  FB.au.signInWithPopup(FB.auth,p).catch(function(e){
    var c=e&&e.code||'';
    if(c==='auth/popup-closed-by-user'||c==='auth/cancelled-popup-request')return;
    loginMsg=c==='auth/popup-blocked'?'El navegador bloqueó la ventana de Google. Permití ventanas emergentes y tocá de nuevo.'
      :c==='auth/unauthorized-domain'?'Este sitio no está autorizado en Firebase (Authentication → Settings → Dominios autorizados).'
      :c==='auth/operation-not-allowed'?'Falta habilitar el acceso con Google en Firebase Authentication.'
      :c==='auth/network-request-failed'?'Sin conexión. Probá de nuevo cuando tengas señal.'
      :'No se pudo iniciar sesión ('+(c||'error')+').';
    render();
  });
}
/* Al salir se borra lo guardado en este dispositivo (la copia local y la caché de Firestore):
   todo sigue en la nube, y así quien use el dispositivo después no ve la mochila de otro. */
function logout(){
  if(!FB)return;
  loggingOut=true;
  FB.au.signOut(FB.auth).catch(function(){}).then(function(){
    try{Object.keys(localStorage).forEach(function(k){if(k.indexOf(LS_BASE+':')===0)localStorage.removeItem(k);});localStorage.removeItem('viaje-de-a-dos:dueAck');}catch(e){}
    return FB.fs.terminate(FB.db).then(function(){return FB.fs.clearIndexedDbPersistence(FB.db);}).catch(function(){});
  }).then(function(){location.reload();});
}
function listen(){
  var fs=FB.fs,db=FB.db;

  fs.onSnapshot(fdoc(),{includeMetadataChanges:true},function(snap){
    if(snap.exists()){
      var r=fix({trip:snap.data()}).trip,srv=!snap.metadata.fromCache;
      if(srv){TRIP_SRV={owner:r.owner||'',locked:r.locked===true};}
      /* El viaje se guarda por partes (merge): lo del servidor puede traer cambios de otros con el mismo u. */
      if((!S.trip.setup&&r.setup)||(r.u||0)>(S.trip.u||0)||(srv&&(r.u||0)===(S.trip.u||0)&&JSON.stringify(r)!==JSON.stringify(S.trip))){S.trip=r;save();render();}
      else if(S.trip.setup&&(S.trip.u||0)>(r.u||0)&&!snap.metadata.fromCache)pushTrip();
    }else if(!snap.metadata.fromCache){
      if(S.trip.setup)pushTrip();else if($('#sheet').hidden)openSettings();
    }
    if(!snap.metadata.fromCache&&snap.exists())recordTrip();
  },function(err){if(err&&err.code==='permission-denied'){deniedTrip();return;}fbErr(err);setSync('err');});
  listenMembers();
  listenPrivate();

  fs.onSnapshot(fs.collection(db,'trips',CODE,'items'),{includeMetadataChanges:true},function(snap){
    var changed=false;
    snap.docChanges().forEach(function(ch){
      if(ch.type==='removed')return;
      var d=ch.doc.data();
      if(!d)return;
      if(d.k==='packing')return;   /* restos de cuando la mochila vivía acá */
      if(d.gone){var loc=S[d.k]&&S[d.k].find(function(x){return x.id===d.id;});if(loc&&isPriv(d.k,loc))return;}
      if(CLOUD_KEYS.indexOf(d.k)>=0&&applyItem(d.k,d,!snap.metadata.fromCache&&!ch.doc.metadata.hasPendingWrites))changed=true;
    });
    if(!itemsReady&&!snap.metadata.fromCache){
      itemsReady=true;
      var rem={};snap.docs.forEach(function(x){rem[x.id]=x.data().u||0});
      /* Lo que este celular tiene y el servidor no: si es de antes de la última vez que estuvo al día,
         es algo borrado de verdad (papelera vencida) y se descarta; si es más nuevo, se cargó sin señal y se sube. */
      var lastSync=0;try{lastSync=+localStorage.getItem(SYNCAT_KEY())||0;}catch(e){}
      CLOUD_KEYS.forEach(function(k){
        S[k]=S[k].filter(function(it){return isPriv(k,it)||rem[it.id]!==undefined||!lastSync||(it.u||0)>lastSync;});
        S[k].forEach(function(it){if(isPriv(k,it))return;if(rem[it.id]===undefined||(it.u||0)>rem[it.id])pushItem(k,it);});
      });
      save();
      migratePrivate();purgeOld();
    }
    if(changed){save();render();checkNewAvisos();}
    if(itemsReady&&(changed||!snap.metadata.fromCache))syncFriendEntries();
    if(!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites)try{localStorage.setItem(SYNCAT_KEY(),String(Date.now()));}catch(e){}
    setSync(snap.metadata.fromCache?(navigator.onLine?'connecting':'offline'):(snap.metadata.hasPendingWrites?'saving':'ok'));
  },function(err){fbErr(err);if(!err||err.code!=='permission-denied')setSync('err');});

  fs.onSnapshot(fs.collection(db,'users',ME.uid,'methods'),function(snap){
    METHODS=snap.docs.map(function(x){return x.data()||{};}).filter(function(m){return m.id&&!m.del&&/^[a-z0-9]{1,24}$/i.test(m.id);})
      .sort(function(a,b){return String(a.name).localeCompare(String(b.name));});
    if(!snap.metadata.fromCache){methodsReady=true;syncCobro();maybeLoadOthers();}
    render();if(formRefresh)formRefresh();
  },function(err){fbErr(err);});

  var claimsSeen=false;
  /* La mochila se suscribe recién cuando el vínculo está confirmado por el servidor: si la consulta
     sale antes, las reglas todavía no lo ven, la rechazan y el listener muere. */
  fs.onSnapshot(fs.collection(db,'trips',CODE,'claims'),{includeMetadataChanges:true},function(snap){
    var c={},mine='';
    snap.docs.forEach(function(x){var d=x.data()||{};c[x.id]={uid:d.uid||'',name:d.name||'',cobro:Array.isArray(d.cobro)?d.cobro.filter(function(y){return y&&typeof y.a==='string'&&y.a;}).map(function(y){return {n:String(y.n||''),a:y.a};}):[],
      methods:Array.isArray(d.methods)?d.methods.filter(function(y){return y&&typeof y.id==='string'&&/^[a-z0-9]{1,24}$/i.test(y.id);}).map(function(y){return {id:y.id,n:String(y.n||''),t:String(y.t||'otro')};}):[]};if(d.uid===ME.uid&&!x.metadata.hasPendingWrites&&(!mine||x.id<mine))mine=x.id;});
    CLAIMS=c;
    if(mine!==myClaim||!claimsSeen){claimsSeen=true;myClaim=mine;subscribePacking();migratePrivate();}
    if(!snap.metadata.hasPendingWrites)syncCobro();
    claimsLoaded=true;
    if(!snap.metadata.fromCache){maybeAdoptOwner();syncFriendEntries();}
    render();if(formRefresh)formRefresh();
  },function(err){fbErr(err);});

  window.addEventListener('offline',function(){setSync('offline')});
  window.addEventListener('online',function(){setSync('connecting')});
}
function listenPrefs(){
  FB.fs.onSnapshot(FB.fs.doc(FB.db,'users',ME.uid,'prefs','app'),function(snap){
    if(!snap.exists())return;var d=snap.data()||{};
    var ch=false;['showWeather','wxShort','h12'].forEach(function(k){if(typeof d[k]==='boolean'&&d[k]!==!!PREFS[k]){PREFS[k]=d[k];ch=true;}});
    if(ch){try{localStorage.setItem('viaje-de-a-dos:prefs',JSON.stringify(PREFS));}catch(e){}render();}
  },function(){});
}
/* Se escucha siempre (también en la pantalla de inicio), no solo dentro de un viaje. */
function listenMeta(){
  /* Actualización forzada desde admin.html: meta/app.reloadToken cambia -> cada app abierta se recarga.
     El ?v= evita que el navegador o GitHub Pages devuelvan el HTML viejo desde caché. */
  FB.fs.onSnapshot(FB.fs.doc(FB.db,'meta','app'),{includeMetadataChanges:true},function(snap){
    if(snap.metadata.fromCache&&!snap.exists())return;
    var tok=(snap.exists()&&snap.data().reloadToken)||'-';  /* '-' = todavía nunca se forzó */
    var seen='';try{seen=localStorage.getItem(RELOAD_KEY)||'';}catch(e){}
    if(!seen){try{localStorage.setItem(RELOAD_KEY,tok);}catch(e){}return;}
    if(tok===seen)return;
    if($('#sheet').hidden)forceReload(tok);
    else{reloadPending=tok;var b=$('#updbar');if(b)b.hidden=false;}
  },function(){});
}
function parseCode(v){v=String(v||'').trim();try{var t=new URL(v).searchParams.get('t');if(t)v=t;}catch(e){}v=v.toLowerCase();return /^[a-z0-9]{12,40}$/.test(v)?v:'';}
function genCode(){var a='abcdefghjkmnpqrstuvwxyz23456789',b=new Uint8Array(20),c='';window.crypto.getRandomValues(b);for(var i=0;i<20;i++)c+=a[b[i]%a.length];return c;}
function connectTo(code){setCode(code);location.href=location.pathname;}

/* ---------- Miembros: quiénes entraron al viaje con el link ----------
   Las reglas solo dejan ver y editar el viaje a sus miembros (trips/{code}/members/{uid}). Abrir el link
   te anota; el organizador puede sacar a alguien (queda en banned y no puede volver) o cerrar el link. */
var MEMBERS={},BANNED={},NOACCESS=false,JOINED_KEY='viaje-de-a-dos:joined';
function joinedList(){try{var l=JSON.parse(localStorage.getItem(JOINED_KEY)||'[]');return Array.isArray(l)?l:[];}catch(e){return [];}}
function markJoined(on){var l=joinedList().filter(function(c){return c!==CODE;});if(on)l.push(CODE);try{localStorage.setItem(JOINED_KEY,JSON.stringify(l.slice(-200)));}catch(e){}}
/* Resuelve true si quedó anotado; false si las reglas no lo dejan (lo sacaron o el viaje está cerrado). */
function joinTrip(){
  var p=FB.fs.setDoc(fdoc('members',ME.uid),{uid:ME.uid,name:ME.name||'',at:Date.now()},{merge:true})
    .then(function(){markJoined(true);return true;},function(e){return !(e&&e.code==='permission-denied');});
  /* sin señal no hay respuesta del servidor: se sigue con lo guardado en el dispositivo */
  return Promise.race([p,new Promise(function(r){setTimeout(function(){r(true);},6000);})]);
}
function enterTrip(){
  if(joinedList().indexOf(CODE)>=0||navigator.onLine===false){listen();return;}
  joinTrip().then(function(){listen();});
}
/* Sin permiso para leer el viaje: o se anotó recién (se reintenta una vez), o lo sacaron / está cerrado. */
function deniedTrip(){
  var k='viaje-de-a-dos:rejoin:'+CODE,tried=false;try{tried=sessionStorage.getItem(k)==='1';}catch(e){}
  if(!tried){try{sessionStorage.setItem(k,'1');}catch(e){}joinTrip().then(function(ok){if(ok)location.reload();else noAccess();});return;}
  noAccess();
}
function noAccess(){
  NOACCESS=true;markJoined(false);
  try{localStorage.removeItem(LS);}catch(e){}   /* la copia local de un viaje al que ya no tiene acceso */
  S=blank();setSync('');render();
}
function vNoAccess(){
  return '<div class="gate"><h2>No tenés acceso a este viaje</h2><p>Quien organiza el viaje te sacó, o cerró el link para que no entre gente nueva. Si creés que es un error, pedile que te vuelva a habilitar.</p>'
   +'<button type="button" class="primary" data-act="gohome">Ir a mis viajes</button>'
   +'<p class="hint"><button type="button" class="sm ghost" data-forget="'+esc(CODE)+'">Quitarlo de mi lista</button></p></div>';
}
function listenMembers(){
  var fs=FB.fs;
  fs.onSnapshot(fs.collection(FB.db,'trips',CODE,'members'),function(snap){
    var m={};snap.docs.forEach(function(x){var d=x.data()||{};m[x.id]={uid:x.id,name:String(d.name||''),at:+d.at||0};});
    MEMBERS=m;if(formRefresh)formRefresh();
  },function(){});
  fs.onSnapshot(fs.collection(FB.db,'trips',CODE,'banned'),function(snap){
    var b={};snap.docs.forEach(function(x){var d=x.data()||{};b[x.id]={uid:x.id,name:String(d.name||'')};});
    BANNED=b;if(formRefresh)formRefresh();
  },function(){});
}
/* Sacar a alguien: queda bloqueado, deja de ser miembro y se sueltan sus vínculos con personas del viaje
   (sus gastos quedan; la persona queda libre). */
function kickMember(uid){
  if(!isOrganizer()||uid===ME.uid)return Promise.resolve();
  var fs=FB.fs,b=fs.writeBatch(FB.db),m=MEMBERS[uid]||{};
  b.set(fdoc('banned',uid),{uid:uid,name:m.name||'',at:Date.now(),by:ME.uid});
  b.delete(fdoc('members',uid));
  Object.keys(CLAIMS).forEach(function(pid){if(CLAIMS[pid].uid===uid)b.delete(fdoc('claims',pid));});
  return b.commit().catch(fbErr);
}
function unbanMember(uid){if(!isOrganizer())return;FB.fs.deleteDoc(fdoc('banned',uid)).catch(fbErr);}
function setLocked(on){if(!isOrganizer())return;S.trip.locked=!!on;S.trip.u=nextU(S.trip.u);save();pushTrip({locked:!!on});}

/* ---------- Gastos propios privados ----------
   Un gasto "Para mí" pagado por uno mismo se guarda en trips/{code}/private/{id} (ouid = la cuenta):
   solo esa cuenta lo lee, como la mochila. Si antes estaba compartido, en `items` queda una lápida
   sin texto ni monto (gone), así los demás lo dejan de ver. */
var PRIV_KEYS=['transports','lodging','expenses'],privUnsub=null;
function isPriv(k,x){
  if(!x||PRIV_KEYS.indexOf(k)<0||x.split!=='self'||!cloudMode())return false;
  if(x.ouid)return !!ME&&x.ouid===ME.uid;
  return !!(ME&&x.paidBy&&x.paidBy===myPersonId());
}
function pushPriv(k,it){
  if(!it.ouid){it.ouid=ME.uid;save();}
  try{FB.fs.setDoc(fdoc('private',it.id),clean(Object.assign({k:k},it))).catch(fbErr);}catch(e){}
}
function tombstone(k,it){try{FB.fs.setDoc(fdoc('items',it.id),{k:k,id:it.id,u:it.u,del:true,gone:true}).catch(fbErr);}catch(e){}}
/* Lo llama upsert (core.js): un gasto que pasa de compartido a propio, o al revés. */
function privMove(k,prev,it){
  if(!FB||!CODE||AUTH!=='in'||!prev||PRIV_KEYS.indexOf(k)<0)return;
  var was=isPriv(k,prev)||(prev.split==='self'&&prev.ouid===ME.uid),now=isPriv(k,it);
  if(!was&&now)tombstone(k,it);
  if(was&&!now){if(it.ouid){delete it.ouid;save();pushItem(k,it);}try{FB.fs.deleteDoc(fdoc('private',it.id)).catch(fbErr);}catch(e){}}
}
/* Gastos "Para mí" cargados antes de que fueran privados: se mudan apenas se sabe quién es uno. */
function migratePrivate(){
  if(!myClaim||!itemsReady)return;
  PRIV_KEYS.forEach(function(k){S[k].forEach(function(it){
    if(it.ouid||it.del||!isPriv(k,it))return;
    it.ouid=ME.uid;it.u=nextU(it.u);save();pushPriv(k,it);tombstone(k,it);
  });});
}
function listenPrivate(){
  if(privUnsub)return;
  var fs=FB.fs,first=true;
  privUnsub=fs.onSnapshot(fs.query(fs.collection(FB.db,'trips',CODE,'private'),fs.where('ouid','==',ME.uid)),{includeMetadataChanges:true},function(snap){
    if(first&&!snap.metadata.fromCache){
      first=false;
      var rem={};snap.docs.forEach(function(x){rem[x.id]=x.data().u||0;});
      PRIV_KEYS.forEach(function(k){S[k].forEach(function(it){if(it.ouid===ME.uid&&(rem[it.id]===undefined||(it.u||0)>rem[it.id]))pushPriv(k,it);});});
    }
    var changed=false;
    snap.docChanges().forEach(function(ch){if(ch.type==='removed')return;var d=ch.doc.data();if(d&&PRIV_KEYS.indexOf(d.k)>=0&&applyItem(d.k,d,!snap.metadata.fromCache&&!ch.doc.metadata.hasPendingWrites))changed=true;});
    if(changed){save();render();}
  },function(err){fbErr(err);});
}

/* ---------- Papelera vencida ----------
   Lo borrado queda TRASH_DAYS días en la papelera; después se elimina de verdad (las reglas solo dejan
   borrar lápidas así de viejas), así no se vuelve a leer cada vez que se abre el viaje. */
var SYNCAT_KEY=function(){return 'viaje-de-a-dos:syncat:'+CODE;};
function purgeOld(){
  if(!FB||!CODE||AUTH!=='in')return;
  var lim=Date.now()-TRASH_DAYS*864e5-36e5,gone=false;   /* 1 h de margen por relojes atrasados */
  CLOUD_KEYS.forEach(function(k){
    S[k]=S[k].filter(function(it){
      if(!it.del||(it.u||0)>=lim)return true;
      var col=isPriv(k,it)||it.ouid?'private':'items';
      FB.fs.deleteDoc(fdoc(col,it.id)).catch(function(){});gone=true;return false;
    });
  });
  S.packing=S.packing.filter(function(it){if(!it.del||(it.u||0)>=lim)return true;FB.fs.deleteDoc(fdoc('packing',it.id)).catch(function(){});gone=true;return false;});
  if(gone)save();
}
