/* Avisos: lo que hicieron los demás y te afecta, desde la última vez que los miraste
   (users/{uid}/trips/{code}.seen, así se comparte entre dispositivos), más los vencimientos de
   tus tarjetas de los próximos 7 días. Sin servidor: se ven con la app abierta. */
'use strict';
var seenLocal=0,dueAck={},NOTIFIED=null;
try{dueAck=JSON.parse(localStorage.getItem('viaje-de-a-dos:dueAck')||'{}')||{};}catch(e){}
function tripSeen(){
  var t=MYTRIPS.find(function(x){return x.code===CODE;});
  return Math.max(seenLocal,(t&&t.seen)||0);
}
function avisosList(){
  var me=myPersonId();
  if(!cloudMode()||AUTH!=='in'||!me||!tripsServer)return [];
  var seen=tripSeen(),out=[];
  var t0=MYTRIPS.find(function(x){return x.code===CODE;});
  if(!t0||!t0.seen)return [];   /* primera vez: sin historial viejo */
  ['expenses','transports','lodging'].forEach(function(k){S[k].forEach(function(x){
    if(!x.eb||x.eb===me||(x.u||0)<=seen)return;
    var c=itemCost(k,Object.assign({},x,{del:false}));if(!c)return;
    var part=shareMap(c,c.amount)[me]||0;
    if(part<=0&&c.paidBy!==me)return;
    var verb=x.del?'borró':((x.ct||0)>seen?'cargó':'editó');
    out.push({u:x.u,k:k,id:x.id,del:!!x.del,ic:x.del?'🗑️':'🧾',txt:nameOf(x.eb)+' '+verb+' «'+c.title+'»'+(part>0?' · te toca '+money(part,c.cur):c.paidBy===me?' · figura que lo pagaste vos':'')});
  });});
  S.payments.forEach(function(x){
    if(!x.eb||x.eb===me||(x.u||0)<=seen||x.del||(x.from!==me&&x.to!==me))return;
    var amt=money(parseFloat(x.amount)||0,x.cur);
    out.push({u:x.u,k:'payments',id:x.id,ic:'🤝',txt:x.to===me?nameOf(x.eb)+' registró que '+(x.from===x.eb?'te pagó':nameOf(x.from)+' te pagó')+' '+amt:nameOf(x.eb)+' registró que le pagaste '+amt+' a '+nameOf(x.to)});
  });
  S.packing.forEach(function(x){
    if(x.owner!==me||!x.suggested||!x.from||x.from===me||(x.u||0)<=seen||x.del)return;
    out.push({u:x.u,k:'packing',id:x.id,ic:'💡',txt:nameOf(x.from)+' te sugirió llevar: '+x.text});
  });
  return out.sort(function(a,b){return b.u-a.u;}).slice(0,50);
}
function dueSoon(){
  if(!cloudMode()||AUTH!=='in')return [];
  var t=today(),lim=iso(new Date(Date.now()+7*864e5)),charges=costs().concat(OTHER_CHARGES.filter(function(c){return c.trip!==CODE;})),res=[];
  METHODS.filter(function(m){return m.type==='credito';}).forEach(function(m){
    cardSchedule(m,charges.filter(function(c){return c.methodId===m.id;})).buckets.forEach(function(b){
      if(b.s.v&&b.s.v>=t&&b.s.v<=lim&&b.lines.length)res.push({key:m.id+'|'+b.s.v,m:m,v:b.s.v,total:totalsText(b.lines)});
    });
  });
  return res;
}
function avisosCount(){return avisosList().length+dueSoon().filter(function(d){return !dueAck[d.key];}).length;}
function openAvisos(){
  var list=avisosList(),due=dueSoon(),h='';
  if(due.length)h+='<h3 style="margin-bottom:6px">Vencimientos de tus tarjetas</h3>'+due.map(function(d){
    var dd=dayDiff(pd(today()),pd(d.v));
    return '<div class="exp" role="button" tabindex="0" data-act="gopagos"><span class="ec" aria-hidden="true">💳</span><div class="et"><b>'+esc(d.m.name)+' vence '+(dd===0?'hoy':dd===1?'mañana':'el '+esc(fShort(d.v)))+'</b><small><span>Gastos de tus viajes en ese resumen</span></small></div><div class="ea"><b>'+d.total+'</b></div></div>';
  }).join('')+'<hr>';
  h+=list.length?list.map(function(a){
    var act=a.k==='packing'?'data-act="gomochila"':a.k==='payments'?'data-act="editpay" data-id="'+esc(a.id)+'"':a.del?'':'data-act="edit" data-k="'+a.k+'" data-id="'+esc(a.id)+'"';
    return '<div class="exp" role="button" tabindex="0" '+act+'><span class="ec" aria-hidden="true">'+a.ic+'</span><div class="et"><b>'+esc(a.txt)+'</b><small><span>'+esc(relTime(a.u))+'</span></small></div><div class="ea"></div></div>';
  }).join(''):'<p class="nada">No hay novedades desde la última vez que miraste.</p>';
  var np=('Notification' in window)?Notification.permission:'na';
  h+='<hr><p class="hint">'+(np==='granted'?'Los avisos del navegador están activados: te llegan mientras la app esté abierta, aunque estés en otra pestaña.'
    :np==='denied'?'Bloqueaste los avisos del navegador para este sitio; se pueden volver a permitir desde la configuración del navegador.'
    :np==='default'?'<button type="button" class="ghost" data-act="notifon" style="padding:6px 12px;font-size:13px">Activar avisos del navegador</button> Te avisa aunque estés en otra pestaña (con la app abierta).':'')+'</p>';
  openSheet('Avisos',h);
  markSeen(due);
}
function markSeen(due){
  seenLocal=Date.now();
  (due||[]).forEach(function(d){dueAck[d.key]=1;});
  try{localStorage.setItem('viaje-de-a-dos:dueAck',JSON.stringify(dueAck));}catch(e){}
  if(FB&&AUTH==='in'&&CODE){try{FB.fs.setDoc(FB.fs.doc(FB.db,'users',ME.uid,'trips',CODE),{seen:seenLocal},{merge:true}).catch(fbErr);}catch(e){}}
}
/* Aviso del navegador para lo nuevo que llega mientras la app está en segundo plano. */
function checkNewAvisos(){
  var list=avisosList(),keys=list.map(function(a){return a.k+a.id+a.u;});
  if(NOTIFIED===null){NOTIFIED={};keys.forEach(function(k){NOTIFIED[k]=1;});return;}
  list.forEach(function(a,i){
    if(NOTIFIED[keys[i]])return;NOTIFIED[keys[i]]=1;
    if(document.visibilityState!=='hidden'||!('Notification' in window)||Notification.permission!=='granted')return;
    try{new Notification(S.trip.name||'Nuestro viaje',{body:a.txt,tag:keys[i]});}catch(e){}
  });
}
