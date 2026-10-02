/* Historial de cambios y papelera.
   Cada alta, cambio, borrado o restauración de algo compartido deja una línea en trips/{code}/log
   (las reglas solo dejan agregar: nadie la edita ni la borra). Lo borrado nunca se borra de verdad
   (queda con del:true), así que la papelera lo muestra 30 días y se puede restaurar. */
'use strict';
var LOG_KEYS=['transports','lodging','expenses','plans','payments','people','vehicles'];
var LOG_SKIP={u:1,eb:1,ct:1,ra:1,id:1,del:1,k:1};
var LOG_LBL={amount:'Monto',cur:'Moneda',desc:'Qué fue',date:'Fecha',cat:'Categoría',paidBy:'Pagó',status:'Estado',split:'Reparto',splitWith:'Entre',shares:'Montos por persona',guests:'Se quedan',riders:'Viajan',method:'Cómo se pagó',methodId:'Forma de pago',cuotas:'Cuotas',payDate:'Fecha de pago',
  from:'Origen',to:'Destino',dep:'Sale',arr:'Llega',type:'Tipo',company:'Empresa',ref:'Reserva',notes:'Notas',seats:'Asientos',kmOut:'Km al retirar',kmIn:'Km al devolver',mech:'Mecánico',same:'Mismo lugar',
  name:'Nombre',address:'Dirección',in:'Entrada',out:'Salida',airbnb:'Airbnb',title:'Qué',time:'Hora',place:'Lugar',note:'Nota',
  attachments:'Archivos',links:'Links',plate:'Patente',detail:'Detalle',owner:'Dueño',c:'Orden'};
var LOG_PEOPLE={paidBy:1,from:1,to:1,owner:1},LOG_PLIST={splitWith:1,guests:1,riders:1};
var LOG_ACT={new:'agregó',edit:'cambió',del:'borró',restore:'restauró'};
var LOG_KIND={transports:'el transporte',lodging:'el alojamiento',expenses:'el gasto',plans:'el plan',payments:'el pago',people:'a la persona',vehicles:'el auto'};

function itemTitle(k,x){
  if(!x)return '';
  if(k==='transports')return (TYPES[x.type]||TYPES.otro)[0]+' '+(x.type==='auto'?rentalName(x):(x.from||'?')+' → '+(x.to||'?'));
  if(k==='lodging')return '🛏️ '+(x.name||'Alojamiento');
  if(k==='expenses')return catIcon(x.cat)+' '+(x.desc||'Gasto');
  if(k==='plans')return (ITYPES[x.type]||ITYPES.otro)[0]+' '+(x.title||'Plan');
  if(k==='payments')return '🤝 '+(nameOf(x.from)||'?')+' → '+(nameOf(x.to)||'?');
  if(k==='people')return '👤 '+(x.name||'');
  if(k==='vehicles')return '🚗 '+(x.name||'Auto');
  return '';
}
/* Valor de un campo legible y corto (así el historial no guarda textos largos). */
function logVal(f,v){
  if(v==null||v==='')return '';
  if(Array.isArray(v))return f==='shares'?v.filter(function(s){return (parseFloat(s.a)||0)>0;}).map(function(s){return nameOf(s.p)+' '+s.a;}).join(', '):String(v.length);
  if(typeof v==='object')return '';
  v=String(v);
  if(LOG_PEOPLE[f])return nameOf(v)||'?';
  if(LOG_PLIST[f])return idsOf(v).map(nameOf).filter(Boolean).join(', ');
  if(f==='status')return v==='pagado'?'Pagado':'Por pagar';
  if(f==='split')return {equal:'Todos por igual',self:'Gasto propio',some:'Algunos',amounts:'Por montos',guests:'Los que se quedan',riders:'Los que viajan'}[v]||('Solo '+nameOf(v));
  if(f==='type')return (TYPES[v]||ITYPES[v]||['',v])[1];
  if(f==='dep'||f==='arr')return fShort(v)+(tm(v)?' '+tm(v):'');
  if(/^(date|in|out|payDate)$/.test(f))return fShort(v)||v;
  return v.length>60?v.slice(0,57)+'…':v;
}
function logDiff(prev,cur){
  var out=[],keys={};
  Object.keys(prev||{}).concat(Object.keys(cur||{})).forEach(function(f){keys[f]=1;});
  Object.keys(keys).forEach(function(f){
    if(LOG_SKIP[f]||!LOG_LBL[f])return;
    var a=prev?prev[f]:undefined,b=cur?cur[f]:undefined;
    if(JSON.stringify(a==null?'':a)===JSON.stringify(b==null?'':b))return;
    var la=logVal(f,a),lb=logVal(f,b);
    if(la===lb)return;
    out.push({f:f,a:la,b:lb});
  });
  return out.slice(0,12);
}
/* Lo llaman upsert/remove (core.js). Los cambios "de sistema" (ra) no se anotan. */
function logChange(k,prev,cur){
  if(!FB||!CODE||AUTH!=='in'||LOG_KEYS.indexOf(k)<0||!cur||cur.ra===cur.u)return;
  if(isPriv(k,cur)||(prev&&isPriv(k,prev)))return;   /* lo privado no deja rastro compartido */
  var act=!prev?'new':(prev.del&&!cur.del?'restore':(!prev.del&&cur.del?'del':'edit'));
  var ch=act==='edit'?logDiff(prev,cur):[];
  if(act==='edit'&&!ch.length)return;
  if(act==='new'&&cur.del)return;
  var by=editorId();
  var d={uid:ME.uid,by:by,byName:nameOf(by)||ME.name||'',k:k,id:cur.id,t:Date.now(),act:act,title:itemTitle(k,cur),cur:curCode(cur.cur,base()),ch:ch};
  try{FB.fs.addDoc(FB.fs.collection(FB.db,'trips',CODE,'log'),clean(d)).catch(function(){});}catch(e){}
}

function logRowHtml(l,withTitle){
  var ch=(l.ch||[]).map(function(c){
    var fmt=function(v){return c.f==='amount'&&v!==''&&!isNaN(+v)?money(+v,l.cur):v;};
    return '<li><b>'+esc(LOG_LBL[c.f]||c.f)+':</b> '+(c.a!==''?'<s>'+esc(fmt(c.a))+'</s> → ':'')+esc(fmt(c.b)||'(vacío)')+'</li>';
  }).join('');
  return '<div class="logrow"><div class="lh"><b>'+esc(l.byName||'Alguien')+'</b> '+esc(LOG_ACT[l.act]||l.act)+(withTitle?' '+esc(LOG_KIND[l.k]||'')+' <b>'+esc(l.title||'')+'</b>':'')+'<small>'+esc(relTime(l.t||0))+'</small></div>'+(ch?'<ul>'+ch+'</ul>':'')+'</div>';
}
function readLog(docs){return docs.map(function(x){return x.data()||{};}).filter(function(l){return l.t&&LOG_ACT[l.act];});}
/* Historial de un ítem, dentro de su formulario (se carga al abrirlo). */
function itemLogHtml(){return '<details class="sideSec logbox" id="itemLog"><summary>🕘 Historial de cambios</summary><div class="logl"><p class="nada">Cargando…</p></div></details>';}
function bindItemLog(panel,id){
  var box=$('#itemLog',panel);if(!box)return;
  if(!FB||!CODE||AUTH!=='in'||!id){box.remove();return;}
  box.addEventListener('toggle',function once(){
    if(!box.open)return;box.removeEventListener('toggle',once);
    var fs=FB.fs,w=$('.logl',box);
    fs.getDocs(fs.query(fs.collection(FB.db,'trips',CODE,'log'),fs.where('id','==',id))).then(function(snap){
      var l=readLog(snap.docs).sort(function(a,b){return b.t-a.t;});
      w.innerHTML=l.length?l.map(function(x){return logRowHtml(x,false);}).join(''):'<p class="nada">Sin cambios anotados (el historial arranca desde esta versión de la app).</p>';
    }).catch(function(){w.innerHTML='<p class="nada">No se pudo cargar el historial.</p>';});
  });
}
/* Últimos cambios de todo el viaje. */
function openHistory(){
  var panel=openSheet('Últimos cambios','<div id="histl"><p class="nada">Cargando…</p></div>');
  if(!FB||!CODE||AUTH!=='in'){$('#histl',panel).innerHTML='<p class="nada">El historial está disponible con el viaje en la nube.</p>';return;}
  var fs=FB.fs;
  fs.getDocs(fs.query(fs.collection(FB.db,'trips',CODE,'log'),fs.orderBy('t','desc'),fs.limit(80))).then(function(snap){
    var l=readLog(snap.docs),w=$('#histl',panel);if(!w)return;
    w.innerHTML=l.length?l.map(function(x){return logRowHtml(x,true);}).join(''):'<p class="nada">Todavía no hay cambios anotados.</p>';
  }).catch(function(){var w=$('#histl',panel);if(w)w.innerHTML='<p class="nada">No se pudo cargar el historial.</p>';});
}

/* ---------- Papelera ---------- */
var TRASH_DAYS=30;
function trashItems(){
  var lim=Date.now()-TRASH_DAYS*864e5,o=[];
  LOG_KEYS.forEach(function(k){S[k].forEach(function(x){if(x.del&&!x.gone&&(x.u||0)>=lim)o.push({k:k,x:x});});});
  return o.sort(function(a,b){return (b.x.u||0)-(a.x.u||0);});
}
function trashHtml(){
  var L=trashItems();
  if(!L.length)return '<p class="nada">La papelera está vacía.</p>';
  return L.map(function(t){
    var by=t.x.eb?nameOf(t.x.eb):'';
    return '<div class="pplrow mbr"><span class="mbn"><b>'+esc(itemTitle(t.k,t.x))+'</b><small>Borrado '+esc(relTime(t.x.u||0))+(by?' por '+esc(by):'')+'</small></span><button type="button" class="ghost sm" data-restore="'+esc(t.k)+'" data-id="'+esc(t.x.id)+'">Restaurar</button></div>';
  }).join('');
}
function openTrash(){
  var panel=openSheet('Papelera','<p class="hint">Lo que se borró en los últimos '+TRASH_DAYS+' días. Al restaurarlo vuelve para todos, con sus montos y repartos.</p><div class="attlist" id="trashl">'+trashHtml()+'</div>');
  panel.addEventListener('click',function(e){
    var b=e.target.closest('[data-restore]');if(!b)return;
    var k=b.getAttribute('data-restore'),id=b.getAttribute('data-id');
    if(LOG_KEYS.indexOf(k)<0)return;
    upsert(k,id,{del:false});render();
    $('#trashl',panel).innerHTML=trashHtml();
  });
  formRefresh=function(){var w=$('#trashl',panel);if(w)w.innerHTML=trashHtml();};
}
