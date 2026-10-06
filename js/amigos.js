/* Amigos: gente de afuera de los viajes con la que se comparten gastos (una cena, un taxi…).
   Cada amistad es un "libro" en ledgers/{id}: a = la cuenta que lo creó, bName = cómo le dice al amigo,
   b = la cuenta del amigo cuando se vincula (por un link de invitación de un solo uso). Lo leen y
   escriben solo sus miembros. Adentro, entries/{id}: lo compartido, con la parte de cada uno (pa, pb) y
   quién pagó (payer: 'a' | 'b' | 'x' otro del viaje | 'own' cada uno lo suyo | '' sin pagar todavía).
   Los gastos de un viaje con amigos (extF) se copian solos al libro desde el dispositivo del dueño. */
'use strict';
var LEDGERS=[],ledgersReady=false,ledgersUnsub=null;
function listenLedgers(){
  if(ledgersUnsub||!FB||!ME)return;
  var fs=FB.fs;
  ledgersUnsub=fs.onSnapshot(fs.query(fs.collection(FB.db,'ledgers'),fs.where('members','array-contains',ME.uid)),function(snap){
    LEDGERS=snap.docs.map(function(d){return Object.assign({id:d.id},d.data());}).filter(function(L){return !L.del;})
      .sort(function(x,y){return friendName(x).localeCompare(friendName(y));});
    ledgersReady=true;
    syncFriendEntries();
    if(formRefresh)formRefresh();
  },function(err){fbErr(err);});
  maybeInvite();
}
function myRole(L){return L.a===ME.uid?'a':'b';}
function friendName(L){return (L.a===(ME&&ME.uid)?L.bName:(L.aName||L.bAcct))||'Amigo';}
function ledgerById(id){return LEDGERS.find(function(L){return L.id===id;});}
function createFriend(name){
  name=String(name||'').trim().slice(0,40);if(!name||!FB||!ME)return '';
  var id=genCode(),now=Date.now(),L={a:ME.uid,aName:ME.name||'',b:'',bName:name,bAcct:'',members:[ME.uid],inv:'',ct:now,u:now};
  LEDGERS.push(Object.assign({id:id},L));
  FB.fs.setDoc(FB.fs.doc(FB.db,'ledgers',id),L).catch(fbErr);
  return id;
}
var r2=function(n){return Math.round((+n||0)*100)/100;};
/* Cómo queda un amigo anotado en un gasto (extF): "libro~rol~persona del viaje~nombre". Así cualquiera del
   viaje sabe a qué libro va, de quién es el amigo y cómo se llama, aunque no pueda leer ese libro. */
function fTok(L){return L.id+'~'+myRole(L)+'~'+(myPersonId()||'')+'~'+friendName(L).replace(/[~,]/g,' ').slice(0,30);}
function parseTok(t){var p=String(t||'').split('~');return {lid:p[0],r:p[1]==='a'||p[1]==='b'?p[1]:'',pid:p[2]||'',name:p[3]||''};}

/* Saldo con un amigo, por moneda: positivo = el amigo me debe; negativo = le debo. */
function friendBalance(entries,role){
  var o=role==='a'?'b':'a',out={};
  entries.forEach(function(e){
    if(e.del)return;
    var c=curCode(e.cur,'ARS'),v=0;
    if(e.payer===role)v=+e['p'+o]||0;
    else if(e.payer===o)v=-(+e['p'+role]||0);
    if(v)out[c]=r2((out[c]||0)+v);
  });
  Object.keys(out).forEach(function(c){if(Math.abs(out[c])<0.5)delete out[c];});
  return out;
}
function balanceText(bal,name){
  var pos=[],neg=[];Object.keys(bal).forEach(function(c){(bal[c]>0?pos:neg).push(money(Math.abs(bal[c]),c));});
  if(!pos.length&&!neg.length)return 'Están a mano';
  return [pos.length?name+' te debe '+pos.join(' + '):'',neg.length?'Le debés '+neg.join(' + '):''].filter(Boolean).join(' · ');
}

/* ---------- Gastos de viaje con amigos → libro de cada amigo ----------
   Se escribe desde este dispositivo para los amigos propios; si alguien más del viaje edita el gasto,
   se actualiza la próxima vez que el dueño del amigo abra el viaje. */
var FSYNC_KEY=function(){return 'viaje-de-a-dos:fsync:'+(ME?ME.uid:'');};
var fsyncTmr=null;
function syncFriendEntries(){
  clearTimeout(fsyncTmr);
  fsyncTmr=setTimeout(function(){
    if(!FB||!ME||!CODE||!ledgersReady||!itemsReady||!cloudMode())return;
    var map={};try{map=JSON.parse(localStorage.getItem(FSYNC_KEY())||'{}')||{};}catch(e){}
    var mine={};LEDGERS.forEach(function(L){mine[L.id]=L;});
    var changed=false;
    S.expenses.forEach(function(x){
      var key=CODE+'_'+x.id,prev=map[key]||{u:0,l:[]};
      /* amigos propios, y también los de otros del viaje (las reglas dejan escribir a quien está en el viaje) */
      var toks=x.del?[]:idsOf(x.extF).map(parseTok).filter(function(p){return mine[p.lid]||(p.r&&p.pid);});
      var lids=toks.map(function(p){return p.lid;});
      if(prev.u===x.u&&prev.l.join()===lids.join())return;
      toks.forEach(function(p){var L=mine[p.lid];writeTripEntry(p.lid,L?myRole(L):p.r,L?(p.pid||myPersonId()):p.pid,x,key);});
      prev.l.filter(function(id){return lids.indexOf(id)<0;}).forEach(function(id){
        FB.fs.setDoc(FB.fs.doc(FB.db,'ledgers',id,'entries',key),{del:true,u:Date.now(),by:ME.uid},{merge:true}).catch(function(){});
      });
      map[key]={u:x.u,l:lids};changed=true;
    });
    /* Amigos vinculados que también están en este viaje: lo que se deben según las cuentas del viaje. */
    var me=myPersonId(),tr=null;
    LEDGERS.forEach(function(L){
      if(!L.b||!me)return;
      var r=myRole(L),o=r==='a'?'b':'a',other=r==='a'?L.b:L.a;
      var his=Object.keys(CLAIMS).find(function(pid){return CLAIMS[pid].uid===other&&allPeople().some(function(p){return p.id===pid;});});
      if(!his)return;
      tr=tr||settlements().list;
      var owesMe=tr.filter(function(t){return t.fromId===his&&t.toId===me;}).reduce(function(a,t){return a+t.amt;},0);
      var iOwe=tr.filter(function(t){return t.fromId===me&&t.toId===his;}).reduce(function(a,t){return a+t.amt;},0);
      var key='bal|'+CODE+'|'+L.id,sig=[r2(owesMe),r2(iOwe),base(),S.trip.name].join('|');
      if(map[key]===sig)return;
      var e={k:'tripbal',trip:CODE,tripName:S.trip.name||'',desc:'Cuentas del viaje',date:S.trip.start||today(),cur:base(),total:r2(owesMe||iOwe),
        payer:owesMe?r:iOwe?o:'',by:ME.uid,byName:ME.name||'',u:Date.now(),del:false};
      e['p'+o]=r2(owesMe);e['p'+r]=r2(iOwe);
      FB.fs.setDoc(FB.fs.doc(FB.db,'ledgers',L.id,'entries','bal_'+CODE),e).catch(function(){});
      map[key]=sig;changed=true;
    });
    if(changed)try{localStorage.setItem(FSYNC_KEY(),JSON.stringify(map));}catch(e){}
  },400);
}
/* r = rol en el libro de quien tiene al amigo; pid = esa persona en el viaje. */
function writeTripEntry(lid,r,pid,x,eid){
  var o=r==='a'?'b':'a',ep=extPart(x),n=Math.max(1,+x.extN||1);
  var c=itemCost('expenses',x),hisShare=c&&pid?(shareMap(c,c.amount)[pid]||0):0;
  var payer=x.status!=='pagado'?'':x.extPaid==='own'?'own':(pid&&x.paidBy===pid?r:'x');
  var e={k:'trip',trip:CODE,tripName:S.trip.name||'',item:x.id,date:x.date||'',time:x.time||'',desc:x.desc||'Gasto',cat:x.cat||'',cur:curCode(x.cur,base()),
    total:ep.total,payer:payer,payerName:payer==='x'?nameOf(x.paidBy):'',by:ME.uid,byName:ME.name||'',u:Date.now(),del:false};
  e['p'+r]=r2(hisShare);e['p'+o]=r2(ep.ext/n);
  FB.fs.setDoc(FB.fs.doc(FB.db,'ledgers',lid,'entries',eid),e).catch(function(){});
}

/* ---------- Pantallas ---------- */
function loadEntries(id){
  return FB.fs.getDocs(FB.fs.collection(FB.db,'ledgers',id,'entries')).then(function(s){
    return s.docs.map(function(d){return Object.assign({id:d.id},d.data());}).filter(function(e){return !e.del;})
      .sort(function(x,y){return (y.date+(y.time||'')).localeCompare(x.date+(x.time||''))||(y.u||0)-(x.u||0);});
  });
}
function openFriends(){
  if(!FB||AUTH!=='in'){openSheet('Amigos','<p class="nada">Para tener amigos guardados hay que iniciar sesión.</p>');return;}
  var bals={};
  function list(){
    return '<p class="hint">Gente de afuera de tus viajes con la que compartís gastos: una cena, un taxi… Son tuyos y nadie más los ve. Si se hacen cuenta, los podés vincular para que vean lo compartido.</p>'
     +'<div class="row mb10"><button type="button" class="primary sm" id="frAdd">+ Amigo</button></div>'
     +(LEDGERS.length?'<div class="attlist">'+LEDGERS.map(function(L){var b=bals[L.id];return '<div class="exp" role="button" tabindex="0" data-friend="'+esc(L.id)+'"><span class="ec" aria-hidden="true">'+(L.b?'🔗':'👤')+'</span><div class="et"><b>'+esc(friendName(L))+'</b><small><span>'+(b?esc(balanceText(b,friendName(L))):'…')+'</span>'+(L.b?'<span>Vinculado</span>':'')+'</small></div></div>';}).join('')+'</div>'
       :'<p class="nada">'+(ledgersReady?'Todavía no tenés amigos guardados. Los podés crear acá o al cargar un gasto con gente de afuera.':'Cargando…')+'</p>');
  }
  var panel=openSheet('Amigos','<div id="frl">'+list()+'</div>');
  function redraw(){var w=$('#frl',panel);if(w)w.innerHTML=list();}
  formRefresh=function(){redraw();load();};
  function load(){LEDGERS.forEach(function(L){if(bals[L.id])return;loadEntries(L.id).then(function(es){bals[L.id]=friendBalance(es,myRole(L));redraw();}).catch(function(){});});}
  load();
  panel.addEventListener('click',function(e){
    var f=e.target.closest('[data-friend]');if(f){openFriend(f.getAttribute('data-friend'));return;}
    if(e.target.closest('#frAdd')){var nm=window.prompt('¿Cómo se llama tu amigo/a?');var id=createFriend(nm);if(id)openFriend(id);}
  });
}
function entryRow(e,L){
  var r=myRole(L),o=r==='a'?'b':'a',fn=friendName(L);
  var who=e.payer===r?'Pagaste vos':e.payer===o?'Pagó '+fn:e.payer==='x'?'Pagó '+(e.payerName||'otro'):e.payer==='own'?'Cada uno pagó lo suyo':'Sin pagar todavía';
  var eff=e.k==='pay'?(e.payer===r?'Le pasaste '+money(e['p'+o],e.cur):fn+' te pasó '+money(e['p'+r],e.cur))
    :e.payer===r?fn+' te debe '+money(e['p'+o],e.cur):e.payer===o?'Le debés '+money(e['p'+r],e.cur):'';
  if(e.k==='tripbal')return '<div class="exp" role="button" tabindex="0" data-fentry="'+esc(e.id)+'"><span class="ec" aria-hidden="true">🧳</span><div class="et"><b>Cuentas del viaje «'+esc(e.tripName||'')+'»</b><small><span>Los dos están en el viaje: es lo que se deben según sus cuentas</span>'+(eff?'<span><b>'+esc(eff)+'</b></span>':'<span><b>A mano en ese viaje</b></span>')+'</small></div></div>';
  var ic=e.k==='pay'?'🤝':e.k==='trip'?'🧳':catIcon(e.cat);
  return '<div class="exp" role="button" tabindex="0" data-fentry="'+esc(e.id)+'"><span class="ec" aria-hidden="true">'+ic+'</span><div class="et"><b>'+esc(e.k==='pay'?'Devolución':e.desc||'Gasto')+'</b><small>'
    +(e.date?'<span>'+esc(fShort(e.date))+'</span>':'')+(e.k==='trip'&&e.tripName?'<span>🧳 '+esc(e.tripName)+'</span>':'')
    +(e.k!=='pay'?'<span>'+esc(who)+'</span><span>Tu parte '+money(e['p'+r]||0,e.cur)+' · '+esc(fn)+' '+money(e['p'+o]||0,e.cur)+'</span>':'')
    +(eff?'<span><b>'+esc(eff)+'</b></span>':'')+(e.by&&e.by!==ME.uid?'<span>Lo cargó '+esc(e.byName||fn)+'</span>':'')+'</small></div>'
    +(e.k!=='pay'?'<div class="ea"><b>'+money(e.total||0,e.cur)+'</b></div>':'')+'</div>';
}
function openFriend(id){
  var L=ledgerById(id);if(!L)return;
  var entries=null,msg='';
  function body(){
    L=ledgerById(id)||L;
    var fn=friendName(L),mineL=L.a===ME.uid,h='';
    h+='<div class="frhead"><span class="avatar lg">'+initialOf(fn)+'</span><div><b>'+esc(fn)+'</b><small>'+(L.b?'🔗 Vinculado'+(mineL&&L.bAcct?' con la cuenta de '+esc(L.bAcct):''):'Sin cuenta vinculada')+'</small></div></div>';
    if(entries)h+='<div class="balance mt10">'+esc(balanceText(friendBalance(entries,myRole(L)),fn))+'</div>';
    h+='<div class="row mt10 g6"><button type="button" class="primary sm" data-fadd="direct">+ Gasto compartido</button><button type="button" class="ghost sm" data-fadd="pay">🤝 Devolución</button>'
      +(mineL&&!L.b?'<button type="button" class="ghost sm" id="frInv">🔗 Invitar a vincular su cuenta</button>':'')
      +(mineL?'<button type="button" class="ghost sm" id="frRen">Cambiar nombre</button>':'')+'</div>';
    if(msg)h+='<div class="shareBox mt10">'+msg+'</div>';
    h+='<h3 class="mb6 mt14">Lo compartido</h3>'+(entries===null?'<p class="nada">Cargando…</p>':entries.length?entries.map(function(e){return entryRow(e,L);}).join(''):'<p class="nada">Todavía no compartieron nada. Al cargar un gasto de un viaje, tildá "Participaron personas de afuera" y elegí a '+esc(fn)+'.</p>');
    if(L.b)h+='<p class="mt14"><button type="button" class="ghost sm" id="frUnlink">Dejar de compartir con '+esc(fn)+'</button></p>';
    else if(mineL)h+='<p class="mt14"><button type="button" class="danger sm" id="frDel">Borrar a '+esc(fn)+'</button></p>';
    return h;
  }
  var panel=openSheet('Amigo','<div id="frd">'+body()+'</div>');
  function redraw(){var w=$('#frd',panel);if(w)w.innerHTML=body();}
  function reload(){loadEntries(id).then(function(es){entries=es;redraw();}).catch(function(){entries=[];redraw();});}
  formRefresh=redraw;reload();
  panel.addEventListener('click',function(e){
    var a=e.target.closest('[data-fadd]');if(a){openFriendEntry(id,null,a.getAttribute('data-fadd'),reload);return;}
    var en=e.target.closest('[data-fentry]');
    if(en){var x=(entries||[]).find(function(y){return y.id===en.getAttribute('data-fentry');});
      if(x&&(x.k==='trip'||x.k==='tripbal')){msg=x.k==='trip'?'Este gasto es del viaje «'+esc(x.tripName||'')+'»: se edita desde el viaje, y acá se actualiza solo.':'Sale de las cuentas del viaje «'+esc(x.tripName||'')+'» y se actualiza solo. Para saldarlo, registren el pago adentro del viaje.';redraw();return;}
      if(x)openFriendEntry(id,x,x.k,reload);return;}
    if(e.target.closest('#frRen')){var nm=(window.prompt('Nuevo nombre',L.bName)||'').trim().slice(0,40);if(nm){FB.fs.updateDoc(FB.fs.doc(FB.db,'ledgers',id),{bName:nm,u:Date.now()}).catch(fbErr);L.bName=nm;redraw();}return;}
    if(e.target.closest('#frInv')){
      var tok=genCode();
      FB.fs.updateDoc(FB.fs.doc(FB.db,'ledgers',id),{inv:tok,u:Date.now()}).then(function(){
        var link=location.origin+location.pathname+'?f='+id+'.'+tok+'&de='+encodeURIComponent(ME.name||'')+'&como='+encodeURIComponent(L.bName||'');
        msg='<p class="m0 hint">Pasale este link a '+esc(friendName(L))+'. Entra con su Google, acepta y queda vinculado: va a ver todo lo que compartieron, también lo anterior. Sirve una sola vez.</p><div class="row mt8"><input class="box" readonly value="'+esc(link)+'"><button type="button" class="primary" data-copy="'+esc(link)+'">Copiar</button>'
          +(navigator.share?'<button type="button" class="ghost" id="frShare">Compartir</button>':'')+'</div>';
        redraw();
        var sh=$('#frShare',panel);if(sh)sh.addEventListener('click',function(){navigator.share({title:'Viajes',text:'Vinculá tu cuenta para ver lo que compartimos:',url:link}).catch(function(){});});
      }).catch(fbErr);
      return;
    }
    var un=e.target.closest('#frUnlink');
    if(un){
      if(!un.classList.contains('armed')){un.classList.add('armed');un.textContent=L.a===ME.uid?'¿Seguro? '+friendName(L)+' deja de verlo. Tocá de nuevo':'¿Seguro? Dejás de verlo. Tocá de nuevo';return;}
      FB.fs.updateDoc(FB.fs.doc(FB.db,'ledgers',id),{b:'',bAcct:'',members:[L.a],inv:'',u:Date.now()}).then(function(){if(L.a===ME.uid){L.b='';redraw();}else openFriends();}).catch(fbErr);
      return;
    }
    var d=e.target.closest('#frDel');
    if(d){if(!d.classList.contains('armed')){d.classList.add('armed');d.textContent=(entries&&entries.length?'Se borra con todo lo compartido. ':'')+'¿Seguro? Tocá de nuevo';return;}
      FB.fs.deleteDoc(FB.fs.doc(FB.db,'ledgers',id)).catch(fbErr);LEDGERS=LEDGERS.filter(function(x){return x.id!==id;});openFriends();}
  });
}
/* Gasto compartido fuera de un viaje, o una devolución. Lo pueden cargar los dos. */
function openFriendEntry(id,ex,kind,done){
  var L=ledgerById(id);if(!L)return;
  var r=myRole(L),o=r==='a'?'b':'a',fn=friendName(L),pay=kind==='pay';
  var v=ex?{desc:ex.desc,date:ex.date,total:ex.total,cur:ex.cur,payer:ex.payer===r?'me':'them',mode:Math.abs((ex['p'+r]||0)-(ex['p'+o]||0))<0.01?'eq':'amt',mine:ex['p'+r],amt:pay?(ex.payer===r?ex['p'+o]:ex['p'+r]):''}
    :{date:today(),cur:base(),payer:'me',mode:'eq'};
  var fields=pay?[
    {k:'payer',l:'Quién le pasó plata a quién',t:'select',opts:[['them',fn+' me devolvió'],['me','Le devolví a '+fn]]},
    {k:'amt',l:'Monto',t:'number',half:true,req:true,ph:'0'},
    {k:'cur',l:'Moneda',t:'select',half:true,opts:curOpts()},
    {k:'date',l:'Fecha',t:'date',half:true}
  ]:[
    {k:'desc',l:'Qué fue',t:'text',req:true,ph:'Pizza, entradas, taxi…'},
    {k:'date',l:'Fecha',t:'date',half:true},
    {k:'total',l:'Total',t:'number',half:true,req:true,ph:'0'},
    {k:'cur',l:'Moneda',t:'select',half:true,opts:curOpts()},
    {k:'payer',l:'Quién pagó',t:'select',half:true,opts:[['me','Yo'],['them',fn]]},
    {k:'mode',l:'Cómo se divide',t:'select',opts:[['eq','Mitad cada uno'],['amt','Pongo cuánto me toca a mí']]},
    {k:'mine',l:'Mi parte',t:'number',half:true,ph:'0'}
  ];
  sheetForm({title:pay?(ex?'Editar devolución':'Devolución'):(ex?'Editar gasto compartido':'Gasto con '+fn),values:v,fields:fields,
    onReady:function(panel){var sync=function(){var m=$('#f_mode',panel);if(m)$('#f_mine',panel).closest('.fld').hidden=m.value!=='amt';};sync();panel.addEventListener('change',sync);},
    validate:function(d){
      if(pay)return parseFloat(d.amt)>0?'':'Poné un monto mayor a cero.';
      var t=parseFloat(d.total)||0;if(t<=0)return 'Poné el total.';
      if(d.mode==='amt'&&!(parseFloat(d.mine)>=0&&parseFloat(d.mine)<=t))return 'Tu parte tiene que estar entre 0 y el total.';
      return '';
    },
    onSave:function(d){
      var e=Object.assign({},ex||{},{k:pay?'pay':'direct',date:d.date||today(),cur:curCode(d.cur,base()),by:ME.uid,byName:ME.name||'',u:Date.now(),del:false});
      delete e.id;
      if(pay){var a=r2(d.amt);e.desc='Devolución';e.total=a;e.payer=d.payer==='me'?r:o;e['p'+r]=d.payer==='me'?0:a;e['p'+o]=d.payer==='me'?a:0;}
      else{var t=r2(d.total),m=d.mode==='amt'?r2(d.mine):r2(t/2);e.desc=d.desc;e.total=t;e.payer=d.payer==='me'?r:o;e['p'+r]=m;e['p'+o]=r2(t-m);}
      FB.fs.setDoc(FB.fs.doc(FB.db,'ledgers',id,'entries',ex?ex.id:uid()),e).then(function(){openFriend(id);}).catch(fbErr);
    },
    onDelete:ex?function(){FB.fs.setDoc(FB.fs.doc(FB.db,'ledgers',id,'entries',ex.id),{del:true,u:Date.now(),by:ME.uid},{merge:true}).then(function(){openFriend(id);}).catch(fbErr);}:null
  });
}

/* ---------- Invitación para vincular la cuenta ---------- */
var INVITE=null;
try{
  var qf=new URLSearchParams(location.search);
  var fv=qf.get('f');
  if(fv&&/^[a-z0-9]{12,40}\.[a-z0-9]{12,40}$/.test(fv)){
    INVITE={id:fv.split('.')[0],tok:fv.split('.')[1],de:String(qf.get('de')||'').slice(0,60),como:String(qf.get('como')||'').slice(0,40)};
    sessionStorage.setItem('viaje-de-a-dos:invite',JSON.stringify(INVITE));
    history.replaceState(null,'',location.pathname);
  }else INVITE=JSON.parse(sessionStorage.getItem('viaje-de-a-dos:invite')||'null');
}catch(e){}
function maybeInvite(){
  if(!INVITE||!FB||AUTH!=='in')return;
  var inv=INVITE;INVITE=null;try{sessionStorage.removeItem('viaje-de-a-dos:invite');}catch(e){}
  var panel=openSheet('Vincular tu cuenta','<p>'+(inv.de?'<b>'+esc(inv.de)+'</b>':'Alguien')+' te tiene como amigo/a'+(inv.como?' con el nombre <b>«'+esc(inv.como)+'»</b>':'')+'.</p><p class="hint">Si aceptás, vas a ver en tu cuenta todo lo que compartieron (también lo anterior), cuánto le debe uno al otro, y vas a poder sumar gastos.</p>'
    +'<div class="row"><button type="button" class="primary" id="invOk">Aceptar</button><button type="button" class="ghost" data-close>Ahora no</button></div><p class="msg err" id="invMsg"></p>');
  $('#invOk',panel).addEventListener('click',function(){
    var b=this;b.disabled=true;
    FB.fs.updateDoc(FB.fs.doc(FB.db,'ledgers',inv.id),{b:ME.uid,bAcct:ME.name||'',members:FB.fs.arrayUnion(ME.uid),claim:inv.tok,inv:'',u:Date.now()})
      .then(function(){setTimeout(function(){openFriend(inv.id);},800);})
      .catch(function(){b.disabled=false;$('#invMsg',panel).textContent='Este link ya se usó o no es válido. Pedile uno nuevo.';});
  });
}
function friendsSectionHtml(){
  if(!FB||AUTH!=='in')return '';
  return '<section class="psec"><div class="bar"><h3>Amigos</h3><button type="button" class="ghost sm" data-act="friends">Ver'+(LEDGERS.length?' ('+LEDGERS.length+')':'')+'</button></div><p class="m0 hint">Gente de afuera de tus viajes con la que compartís gastos, y cuánto se deben.</p></section>';
}
