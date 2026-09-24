/* Componentes y vistas de cada pestaña */
'use strict';
/* ---------- Componentes ---------- */
var empty=function(t,p){return '<div class="empty"><b>'+t+'</b><p>'+p+'</p></div>'};
function bars(rows){if(!rows.length)return '<p class="sub">Sin datos todavía.</p>';var mx=Math.max.apply(null,rows.map(function(r){return r.v}).concat([1]));return '<ul class="bars">'+rows.map(function(r){return '<li><span class="bl" title="'+esc(r.l)+'">'+esc(r.l)+'</span><span class="bt"><span class="bf" style="width:'+(r.v/mx*100).toFixed(1)+'%;background:'+(r.c||'var(--sea)')+'"></span></span><span class="bv">'+money(r.v)+'</span></li>'}).join('')+'</ul>';}
function costBlock(x){
  var a=parseFloat(x.amount)||0;
  if(a<=0)return '<div class="cost"><span class="pill pend">Sin costo cargado</span></div>';
  var cur=curCode(x.cur,base()),ok=x.status==='pagado',b=toBase(a,cur);
  return '<div class="cost"><b class="amt">'+money(a,cur)+'</b>'+(cur!==base()?'<small>'+(b==null?'sin tipo de cambio':'≈ '+money(b))+'</small>':'')+'<span class="pill '+(ok?'ok':'pend')+'">'+(ok?'Pagado':'Por pagar')+'</span>'+(x.paidBy?'<small class="who">'+dot(x.paidBy)+esc(pn(x.paidBy))+'</small>':'')+(x.method?'<small>'+esc(x.method)+'</small>':'')+(splitLabel(x)?'<small>'+esc(splitLabel(x))+'</small>':'')+'</div>';
}
function totLine(list){var t=sumBase(list),p=sumBase(list.filter(function(c){return c.status==='pagado'}));if(!list.length)return '';return '<div class="tot"><span>Total <b>'+money(t.t)+'</b></span><span>Pagado <b>'+money(p.t)+'</b></span><span>Por pagar <b>'+money(t.t-p.t)+'</b></span></div>'+(t.miss.size?warnMiss(t.miss):'');}

/* ---------- Vistas ---------- */
var tab='itinerario';

function upcoming(){
  var now=today()+'T'+new Date().toTimeString().slice(0,5),ev=[];
  live('transports').forEach(function(t){if(t.dep&&t.dep>=now){var dd=t.dep.slice(0,10),ad=(t.arr||'').slice(0,10),arrTxt=t.arr?('Llega '+(ad!==dd?fShort(ad)+' ':'')+tm(t.arr)+' a '+(t.to||'?')):'';ev.push({k:t.dep,d:dd,t:tm(t.dep),l:(TYPES[t.type]||TYPES.otro)[0]+' Sale '+(t.from||'?')+' → '+(t.to||'?'),sub:arrTxt});}});
  live('plans').forEach(function(p){var k=(p.date||'')+'T'+(p.time||'00:00');if(p.date&&k>=now)ev.push({k:k,d:p.date,t:p.time||'',l:(ITYPES[p.type]||ITYPES.otro)[0]+' '+(p.title||'Plan')});});
  live('lodging').forEach(function(l){if(l.in&&l.in+'T15:00'>=now)ev.push({k:l.in+'T15:00',d:l.in,t:'',l:'🛏️ Check-in: '+(l.name||'')});});
  return ev.sort(function(a,b){return a.k.localeCompare(b.k)}).slice(0,4);
}

function ratesSectionHtml(){
  var cs=costs();
  var curs=Array.from(new Set(cs.map(function(c){return c.cur}))).filter(function(c){return c!==base()});
  ['USD','BRL'].forEach(function(c){if(c!==base()&&curs.indexOf(c)===-1)curs.push(c);});
  if(!curs.length)return '';
  var isArs=base()==='ARS';
  var updBtns=isArs
   ?('<div class="row" style="gap:6px"><button type="button" class="ghost'+(S.trip.dollarType==='blue'?' active':'')+'" data-act="fetchusd" data-type="blue" style="padding:6px 10px;font-size:13px">💵 Blue</button><button type="button" class="ghost'+(S.trip.dollarType==='oficial'?' active':'')+'" data-act="fetchusd" data-type="oficial" style="padding:6px 10px;font-size:13px">💵 Oficial</button><button type="button" class="ghost" data-act="fetchrates" data-codes="BRL" style="padding:6px 10px;font-size:13px">🔄 Real</button></div>')
   :('<button type="button" class="ghost" data-act="fetchrates" data-codes="USD,BRL" style="padding:6px 12px;font-size:13px">🔄 Actualizar cotización</button>');
  return '<section class="sec"><div class="bar" style="margin-bottom:6px"><h2>Tipos de cambio</h2>'+updBtns+'</div><p class="sub">Cuánto vale 1 unidad de cada moneda en '+esc(base())+'. Con esto se suma todo junto.'+(S.trip.ratesUpdatedAt?(isArs?' Dólar ('+(S.trip.dollarType==='blue'?'blue':'oficial')+') y real':' Dólar y real')+' se actualizaron '+relTime(S.trip.ratesUpdatedAt)+'.':'')+'</p>'
   +(ratesFetchMsg?'<p class="msg'+(ratesFetchMsg.indexOf('No se pudo')===0?' err':'')+'">'+esc(ratesFetchMsg)+'</p>':'')
   +'<div class="rates">'+curs.map(function(c){var v=S.trip.rates[c];return '<label class="rate'+(v>0?'':' miss')+'"><span>1 '+esc(c)+' =</span><input type="number" step="any" min="0" inputmode="decimal" data-rate="'+esc(c)+'" value="'+(v>0?v:'')+'" placeholder="0"><span>'+esc(base())+'</span></label>'}).join('')+'</div></section>';
}
function vResumen(){
  var cs=costs(),h='',up=upcoming();
  if(S.trip.info)h+='<div class="infobox"><h3>📌 Info útil</h3><p>'+esc(S.trip.info)+'</p></div>';
  if(up.length){h+='<section class="sec"><h2>Lo que sigue</h2><div>'+up.map(function(e){return '<div class="pl auto"><span class="t">'+esc(fShort(e.d))+(e.t?'<br>'+e.t:'')+'</span><div><b>'+esc(e.l)+'</b>'+(e.sub?'<small>'+esc(e.sub)+'</small>':'')+'</div></div>'}).join('')+'</div></section>';}

  if(!cs.length){h+='<section class="sec">'+empty('Acá va a aparecer el resumen de plata','Cargá transportes, alojamiento o gastos con su monto y vamos sumando el total, lo pagado y lo que falta.')+'</section>';return h;}
  var tot=sumBase(cs),pg=sumBase(cs.filter(function(c){return c.status==='pagado'})),pe=tot.t-pg.t;
  h+='<section class="sec"><div class="bar"><h2>Plata del viaje</h2><button type="button" class="primary" data-act="final">📄 Resumen final</button></div><dl class="stats"><div><dt>Total</dt><dd>'+money(tot.t)+'</dd></div><div><dt>Ya pagado</dt><dd>'+money(pg.t)+'</dd></div><div><dt>Por pagar</dt><dd>'+money(pe)+'</dd></div></dl>'+(tot.miss.size?warnMiss(tot.miss):'')+'</section>';
  var bud=parseFloat(S.trip.budget)||0;
  if(bud>0){
    var bpct=Math.min(100,tot.t/bud*100),bover=tot.t>bud;
    h+='<section class="sec"><h2>Presupuesto total</h2><div class="dh"><span>'+money(tot.t)+' de '+money(bud)+'</span><b class="'+(bover?'over':'')+'">'+Math.round(tot.t/bud*100)+'%</b></div><div class="prog"><span class="'+(bover?'over':'')+'" style="width:'+bpct+'%"></span></div>'+(bover?'<p class="warn">Ya cargaron más de lo presupuestado para todo el viaje.</p>':'')+'</section>';
  }

  var pp=allPeople().map(function(p){return {l:p.name,c:'var('+personColorVar(p.id)+')',v:sumBase(cs.filter(function(c){return c.status==='pagado'&&c.paidBy===p.id})).t}});
  h+='<section class="sec"><h2>Quién puso la plata</h2>'+bars(pp)+'</section>';
  if(allPeople().length>1){
    var parts={};cs.forEach(function(c){var b=toBase(c.amount,c.cur);if(b==null)return;var sm=shareMap(c,b);Object.keys(sm).forEach(function(id){parts[id]=(parts[id]||0)+sm[id];});});
    h+='<section class="sec"><h2>Cuánto le toca a cada uno</h2><p class="sub">Lo que corresponde a cada persona según cómo se repartió cada gasto, lo haya pagado quien sea.</p>'+bars(allPeople().map(function(p){return {l:p.name,c:'var('+personColorVar(p.id)+')',v:parts[p.id]||0};}))+'</section>';
  }

  var byCat={};cs.forEach(function(c){var b=toBase(c.amount,c.cur);if(b!=null)byCat[c.cat]=(byCat[c.cat]||0)+b;});
  h+='<section class="sec"><h2>En qué se va</h2>'+bars(Object.keys(byCat).map(function(k){return {l:catIcon(k)+' '+k,v:byCat[k]}}).sort(function(a,b){return b.v-a.v}))+'</section>';

  var byM={};cs.filter(function(c){return c.status==='pagado'}).forEach(function(c){var b=toBase(c.amount,c.cur);if(b!=null){var m=c.method||'Sin especificar';byM[m]=(byM[m]||0)+b;}});
  h+='<section class="sec"><h2>Cómo lo pagamos</h2>'+bars(Object.keys(byM).map(function(k){return {l:k,v:byM[k],c:'var(--mint)'}}).sort(function(a,b){return b.v-a.v}))+'</section>';
  return h;
}

function attLinkChips(item){
  var n=(item&&item.attachments)?item.attachments.length:0,m=(item&&item.links)?item.links.length:0,out=[];
  if(n)out.push('<span class="chipsm">📎 '+n+'</span>');
  if(m)out.push('<span class="chipsm">🔗 '+m+'</span>');
  return out.join('');
}
function fileIcon(type){return type&&type.indexOf('pdf')>=0?'📄':(type&&type.indexOf('image')>=0?'🖼️':'📎')}
function humanSize(n){n=n||0;if(n<1024)return n+' B';if(n<1048576)return Math.round(n/1024)+' KB';return (n/1048576).toFixed(1)+' MB';}
function ticket(t){
  var ty=TYPES[t.type]||TYPES.otro,dd=(t.dep||'').slice(0,10),ad=(t.arr||'').slice(0,10),dday=pd(dd);
  return '<div class="ticket" role="button" tabindex="0" data-act="edit" data-k="transports" data-id="'+t.id+'">'
   +'<div class="stub"><span class="ic" aria-hidden="true">'+ty[0]+'</span>'+(dday?'<b>'+dday.getDate()+'</b><small>'+esc(mon(dd))+'</small>':'<small>Sin fecha</small>')+'</div>'
   +'<div class="tb"><div class="route">'+esc(t.from||'?')+'<span class="ar">→</span>'+esc(t.to||'?')+'</div>'
   +((t.dep||t.arr)?'<div class="times"><div><span>Sale</span><b>'+(t.dep?esc(fShort(dd))+' '+tm(t.dep):'—')+'</b></div><div><span>Llega</span><b>'+(t.arr?esc(fShort(ad))+' '+tm(t.arr):'—')+'</b></div></div>':'')
   +((t.company||t.ref||(t.attachments&&t.attachments.length)||(t.links&&t.links.length))?'<div class="meta"><span>'+esc(ty[1])+(t.company?' de '+esc(t.company):'')+'</span>'+(t.ref?'<span class="ref">Reserva '+esc(t.ref)+'</span>':'')+attLinkChips(t)+'</div>':'')
   +(t.notes?'<p class="note">'+esc(t.notes)+'</p>':'')
   +costBlock(t)+'</div></div>';
}
function vTransportes(){
  var L=live('transports').sort(function(a,b){return (a.dep||'9999').localeCompare(b.dep||'9999')});
  var h='<div class="bar"><h2>Transportes</h2><button class="primary" data-act="add" data-k="transports">+ Agregar</button></div>';
  if(!L.length)return h+empty('Todavía no cargaron ningún transporte','Vuelos, micros, trenes, barcos, auto alquilado o traslados. Anotá horarios, código de reserva y cuánto costó.');
  return h+totLine(costs().filter(function(c){return c.src==='transports'}))+L.map(ticket).join('');
}

function vAlojamiento(){
  var L=live('lodging').sort(function(a,b){return (a.in||'9999').localeCompare(b.in||'9999')});
  var h='<div class="bar"><h2>Alojamiento</h2><button class="primary" data-act="add" data-k="lodging">+ Agregar</button></div>';
  if(!L.length)return h+empty('Todavía no cargaron dónde van a dormir','Hotel, departamento o hostel: fechas de entrada y salida, dirección, código de reserva y costo.');
  return h+totLine(costs().filter(function(c){return c.src==='lodging'}))+L.map(function(l){
    var n=(l.in&&l.out)?dayDiff(pd(l.in),pd(l.out)):0;
    return '<div class="stay" role="button" tabindex="0" data-act="edit" data-k="lodging" data-id="'+l.id+'"><div class="nm">'+esc(l.name||'Alojamiento')+(safeUrl(l.airbnb)?' <a class="abnb" href="'+esc(safeUrl(l.airbnb))+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">Airbnb ↗</a>':'')+'</div>'
     +(l.address?'<div class="sub" style="margin:2px 0 0">'+esc(l.address)+'</div>':'')
     +'<div class="dates"><span>Entrada <b>'+(l.in?esc(fShort(l.in)):'—')+'</b></span><span>Salida <b>'+(l.out?esc(fShort(l.out)):'—')+'</b></span>'+(n>0?'<span><b>'+n+(n===1?' noche':' noches')+'</b></span>':'')+attLinkChips(l)+'</div>'
     +(l.ref?'<div class="meta"><span class="ref">Reserva '+esc(l.ref)+'</span></div>':'')
     +(l.notes?'<p class="note">'+esc(l.notes)+'</p>':'')+costBlock(l)+'</div>';
  }).join('');
}

function costRow(k,item,desc,icon,catLabel,extra){
  var a=parseFloat(item.amount)||0,cur=curCode(item.cur,base()),b=toBase(a,cur);
  return '<div class="exp" role="button" tabindex="0" data-act="edit" data-k="'+k+'" data-id="'+item.id+'"><span class="ec" aria-hidden="true">'+icon+'</span><div class="et"><b>'+esc(desc)+'</b><small><span>'+esc(catLabel)+'</span>'+(item.paidBy?'<span class="who">'+dot(item.paidBy)+esc(pn(item.paidBy))+'</span>':'')+(item.method?'<span>'+esc(item.method)+'</span>':'')+attLinkChips(item)+(extra||'')+'</small></div><div class="ea"><b>'+money(a,cur)+'</b>'+(cur!==base()?'<small>'+(b==null?'sin tipo de cambio':'≈ '+money(b))+'</small>':'')+(item.status==='pendiente'?'<span class="pill pend">Por pagar</span>':'')+'</div></div>';
}
function expRow(e,extra){return costRow('expenses',e,e.desc||'Gasto',catIcon(e.cat),e.cat||'Otros',extra);}
/* Filtro "Ver gastos de": muestra solo lo que esa persona pagó o donde le toca una parte, y suma su parte. */
var gastosWho='';
function vGastos(){
  var g={},ppl=allPeople();
  if(gastosWho&&!ppl.some(function(p){return p.id===gastosWho;}))gastosWho='';
  var who=gastosWho;
  function add(dateKey,item,rowFn,u){
    var amt=parseFloat(item.amount)||0,extra='';
    if(who){
      var part=shareMap(item,amt)[who]||0,cur=curCode(item.cur,base());
      if(part<=0&&item.paidBy!==who)return;
      extra='<span><b>'+(part>0?'Le toca '+esc(money(part,cur)):'No le toca parte')+'</b></span>';
      amt=part;
    }
    (g[dateKey]=g[dateKey]||[]).push({row:rowFn(extra),amount:amt,cur:item.cur,u:u||0});
  }
  live('expenses').forEach(function(e){add(e.date||'0',e,function(x){return expRow(e,x);},e.u);});
  live('transports').filter(function(t){return (parseFloat(t.amount)||0)>0}).forEach(function(t){
    var ty=TYPES[t.type]||TYPES.otro;
    add((t.dep||'').slice(0,10)||'0',t,function(x){return costRow('transports',t,(t.from||'?')+' → '+(t.to||'?'),ty[0],ty[1],x);},t.u);
  });
  live('lodging').filter(function(l){return (parseFloat(l.amount)||0)>0}).forEach(function(l){
    add(l.in||'0',l,function(x){return costRow('lodging',l,l.name||'Alojamiento','🛏️','Alojamiento',x);},l.u);
  });
  var keys=Object.keys(g).sort().reverse();
  var h='<div class="bar"><h2>Gastos</h2><button class="primary" data-act="add" data-k="expenses">+ Anotar gasto</button></div>';
  if(ppl.length>1)h+='<div class="whopick" style="margin:0 0 14px;gap:6px"><button type="button" class="ghost'+(!who?' active':'')+'" data-act="gwho" data-who="" style="padding:5px 12px;font-size:14px">Todos</button>'
    +ppl.map(function(p){return '<button type="button" class="ghost'+(who===p.id?' active':'')+'" data-act="gwho" data-who="'+esc(p.id)+'" style="padding:5px 12px;font-size:14px">'+dot(p.id)+esc(p.name)+'</button>';}).join('')+'</div>';
  h+=balanceHtml(who);
  if(who&&!keys.length)return h+empty('No hay gastos de '+esc(nameOf(who)),'Ningún gasto cargado lo pagó '+esc(nameOf(who))+' ni le toca una parte.')+paymentsHtml(who)+ratesSectionHtml();
  if(!keys.length)return h+empty('Todavía no anotaron gastos','Cuando estén de viaje, anotá cada gasto: qué fue, cuánto, quién pagó y cómo. Acá se agrupan por día, y también suman los transportes y el alojamiento que cargaste con costo.')+ratesSectionHtml();
  var allEntries=[].concat.apply([],keys.map(function(k){return g[k]}));
  var all=sumBase(allEntries.map(function(x){return {amount:x.amount,cur:x.cur}}).filter(function(c){return c.amount>0}));
  var nd=keys.filter(function(k){return k!=='0'}).length,dl=parseFloat(S.trip.daily)||0;
  if(who){
    var paid=sumBase(costs().filter(function(c){return c.status==='pagado'&&c.paidBy===who;})).t,net=settleUp().net[who]||0;
    h+='<dl class="stats" style="margin-top:12px"><div><dt>Le toca en total</dt><dd>'+money(all.t)+'</dd></div><div><dt>Pagó</dt><dd>'+money(paid)+'</dd></div><div><dt>'+(net>0.5?'Le deben':net<-0.5?'Debe':'Saldo')+'</dt><dd>'+money(Math.abs(net))+'</dd></div></dl>'+(all.miss.size?warnMiss(all.miss):'')+'<div style="height:14px"></div>';
  }else
  h+='<dl class="stats" style="margin-top:12px"><div><dt>Gastos anotados</dt><dd>'+money(all.t)+'</dd></div>'+(nd?'<div><dt>Promedio por día</dt><dd>'+money(all.t/nd)+'</dd></div>':'')+(dl>0?'<div><dt>Presupuesto diario</dt><dd>'+money(dl)+'</dd></div>':'')+'</dl>'+(all.miss.size?warnMiss(all.miss):'')+'<div style="height:14px"></div>';
  h+=keys.map(function(k){
    var items=g[k].slice().sort(function(a,b){return (b.u||0)-(a.u||0)});
    var s=sumBase(items.map(function(x){return {amount:x.amount,cur:x.cur}})),over=dl>0&&s.t>dl;
    return '<section class="day"><div class="dh"><h3>'+(k==='0'?'Sin fecha':esc(fLong(k)))+'</h3><b class="'+(over?'over':'')+'">'+money(s.t)+'</b></div>'+(dl>0?'<div class="prog"><span class="'+(over?'over':'')+'" style="width:'+Math.min(100,s.t/dl*100)+'%"></span></div>':'')+items.map(function(x){return x.row}).join('')+'</section>';
  }).join('');
  h+=paymentsHtml(who)+ratesSectionHtml();
  return h;
}

function daysList(){
  var set=new Set(),s=pd(S.trip.start),e=pd(S.trip.end);
  if(s&&e){var n=dayDiff(s,e);if(n>=0&&n<=120){for(var i=0;i<=n;i++){set.add(iso(new Date(s.getFullYear(),s.getMonth(),s.getDate()+i)));}}}
  live('plans').forEach(function(p){set.add(p.date)});
  live('transports').forEach(function(t){set.add(String(t.dep||'').slice(0,10));set.add(String(t.arr||'').slice(0,10));});
  live('lodging').forEach(function(l){set.add(l.in);set.add(l.out);});
  return Array.from(set).filter(function(d){return pd(d);}).sort();   /* fechas mal cargadas no rompen el itinerario */
}
function autoRow(ic,time,title,sub){return '<div class="pl auto"><span class="t">'+esc(time)+'</span><div><b>'+ic+' '+esc(title)+'<span class="tag">Reserva</span></b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</div></div>';}
function planRow(p){var ty=ITYPES[p.type]||ITYPES.otro;return '<div class="pl" role="button" tabindex="0" data-act="edit" data-k="plans" data-id="'+p.id+'"><span class="t">'+esc(p.time||'')+'</span><div><b>'+ty[0]+' '+esc(p.title||'Plan')+attLinkChips(p)+'</b>'+(p.place?'<small>'+esc(p.place)+'</small>':'')+(p.notes?'<small>'+esc(p.notes)+'</small>':'')+'</div></div>';}
function vItinerario(){
  var days=daysList(),t=today(),s=pd(S.trip.start);
  var wxOn=PREFS.showWeather!==false;
  if(wxOn)loadWeather();
  var h='<div class="bar"><h2>Itinerario</h2><button class="primary" data-act="add" data-k="plans">+ Agregar plan</button></div>'+(wxOn?wxSummary():'');
  if(!days.length)return h+empty('Todavía no hay días armados','Poné las fechas del viaje en Ajustes, o agregá un plan con su fecha. Los transportes y el alojamiento aparecen solos en su día.');
  return h+days.map(function(d){
    var items=[];
    live('plans').filter(function(p){return p.date===d}).forEach(function(p){items.push({k:p.time||'99:98',h:planRow(p)})});
    live('transports').forEach(function(x){
      var ty=TYPES[x.type]||TYPES.otro,dd=(x.dep||'').slice(0,10),ad=(x.arr||'').slice(0,10);
      if(dd===d)items.push({k:tm(x.dep)||'00:00',h:autoRow(ty[0],tm(x.dep),'Sale: '+(x.from||'?')+' → '+(x.to||'?'),[x.company,x.ref?'Reserva '+x.ref:''].filter(Boolean).join(', '))});
      if(ad===d)items.push({k:tm(x.arr)||'00:01',h:autoRow(ty[0],tm(x.arr),'Llega a '+(x.to||'?'),'')});
    });
    live('lodging').forEach(function(l){
      if(l.out===d)items.push({k:'10:00',h:autoRow('🛏️','','Check-out: '+(l.name||''),'')});
      if(l.in===d)items.push({k:'15:00',h:autoRow('🛏️','','Check-in: '+(l.name||''),l.address||'')});
    });
    items.sort(function(a,b){return a.k.localeCompare(b.k)});
    var dn=s?dayDiff(s,pd(d))+1:0;
    return '<section class="iday"><div class="ih"><h3>'+esc(fLong(d))+'</h3>'+(dn>=1?'<span class="dn">Día '+dn+'</span>':'')+(d===t?'<span class="hoy">Hoy</span>':'')+(wxOn?wxChip(d):'')+'<span class="sp"></span><button class="ghost" data-act="add" data-k="plans" data-date="'+esc(d)+'">+ Plan</button></div>'+(items.length?items.map(function(i){return i.h}).join(''):'<div class="nada">Nada planeado todavía.</div>')+'</section>';
  }).join('');
}

var WHOAMI_KEY='viaje-de-a-dos:whoami';
function getWhoAmI(){try{return localStorage.getItem(WHOAMI_KEY)||'';}catch(e){return '';}}
function setWhoAmI(v){try{if(v)localStorage.setItem(WHOAMI_KEY,v);else localStorage.removeItem(WHOAMI_KEY);}catch(e){}}
var packSuggestMsg='',claimMsg='';
/* Personas: todas viven en la lista `people` (1, 2 o las que sean). Los viajes viejos tenían p1/p2 fijos
   en el trip: se muestran igual hasta que migratePeople() los pasa a `people` con esos mismos ids,
   así los gastos (paidBy/split) y las mochilas (owner) siguen apuntando bien. */
function legacyPeople(){return ['p1','p2'].filter(function(k){return S.trip[k]&&!S.people.some(function(x){return x.id===k});}).map(function(k){return {id:k,name:String(S.trip[k]),c:k==='p1'?1:2};});}
function migratePeople(){['p1','p2'].forEach(function(k,i){if(S.trip[k]&&!S.people.some(function(x){return x.id===k}))upsert('people',null,{id:k,name:S.trip[k],c:i+1});});}
function allPeople(){
  return legacyPeople().concat(live('people').map(function(p){return {id:p.id,name:String(p.name||'Sin nombre'),c:+p.c||1e15};}))
    .sort(function(a,b){return (a.c-b.c)||a.id.localeCompare(b.id);});
}
function nameOf(id){var p=allPeople().find(function(x){return x.id===id;});return p?p.name:'';}
function suggesterName(it){
  if(it.from)return nameOf(it.from);
  if(it.suggested){if(it.owner==='p1')return nameOf('p2');if(it.owner==='p2')return nameOf('p1');}
  return '';
}
/* Quién soy: en la nube sale de la cuenta de Google (claims), sin nube es una preferencia del dispositivo. */
function myPersonId(){
  var id=cloudMode()?(AUTH==='in'?myClaim:''):getWhoAmI();
  return id&&allPeople().some(function(p){return p.id===id;})?id:'';
}
function packRow(it){
  var suggester=suggesterName(it);
  return '<div class="pk'+(it.checked?' done':'')+'"><label class="pkchk"><input type="checkbox" data-pkcheck="'+it.id+'"'+(it.checked?' checked':'')+'><span>'+esc(it.text)+'</span></label>'+(it.suggested&&suggester?'<span class="chipsm">💡 Idea de '+esc(suggester)+'</span>':'')+'<button type="button" class="x" data-pkdel="'+it.id+'" aria-label="Quitar">✕</button></div>';
}
function myPackList(owner){
  var items=live('packing').filter(function(x){return x.owner===owner}).sort(function(a,b){return (a.u||0)-(b.u||0)});
  var done=items.filter(function(x){return x.checked}).length;
  return '<div class="pklist"><div class="pkhead"><h3>Tu mochila</h3>'+(items.length?'<span class="pkcount">'+done+'/'+items.length+'</span>':'')+'</div>'
   +(items.length?items.map(packRow).join(''):'<p class="nada">Todavía no hay nada acá.</p>')
   +'<form class="pkadd" data-owner="'+esc(owner)+'"><input type="text" data-pktext placeholder="Agregar algo…" autocomplete="off" required><button type="submit" class="ghost">+ Agregar</button></form></div>';
}
function pickerHtml(people){
  var cloud=cloudMode(),h='<div class="bar"><h2>Mi mochila</h2></div>';
  if(cloud&&AUTH!=='in')return h+'<p class="sub">Sin conexión con la nube: tu mochila aparece cuando vuelva la señal.</p>';
  if(cloud)h+='<p class="sub">Hola'+(ME.name?' '+esc(ME.name):'')+'. Elegí quién sos en este viaje: queda vinculado a tu cuenta de Google, así en cualquier dispositivo ves tu propia lista. Es privada: nadie más la puede ver.</p>';
  else h+='<p class="sub">Elegí quién sos en este dispositivo para armar tu propia lista.</p>';
  h+='<div class="whopick">'+people.map(function(p){
    var cl=cloud?CLAIMS[p.id]:null,taken=!!(cl&&cl.uid!==ME.uid);
    return '<button type="button" class="primary" data-act="whoami" data-who="'+esc(p.id)+'"'+(taken?' disabled title="Ya la eligió otra cuenta"':'')+'>'+esc(p.name)+(taken?' · '+esc(cl.name||'otra cuenta'):'')+'</button>';
  }).join('')+'</div>';
  var sugName=cloud&&ME.name&&!people.some(function(p){return p.name.trim().toLowerCase()===ME.name.trim().toLowerCase();})?ME.name:'';
  h+='<form class="pkadd addperson"><input type="text" data-persontext placeholder="Tu nombre, si no está en la lista" value="'+esc(sugName)+'" autocomplete="off" required><button type="submit" class="ghost">+ Agregarme</button></form>';
  if(claimMsg)h+='<p class="msg err">'+esc(claimMsg)+'</p>';
  if(!cloud)h+='<p class="hint" style="margin-top:14px">Ojo: es solo una preferencia de este dispositivo, no una contraseña. Cualquiera que use este celular puede tocar "cambiar" y ver otra lista.</p>';
  return h;
}
function vMochila(){
  var people=allPeople(),who=myPersonId();
  if(!who)return pickerHtml(people);
  var me=people.find(function(p){return p.id===who;}),others=people.filter(function(p){return p.id!==who;});
  var sug='';
  if(others.length){
    sug='<div class="pklist"><div class="pkhead"><h3>💡 Sugerirle algo'+(others.length===1?(' a '+esc(others[0].name)):'')+'</h3></div>'
     +'<form class="pkadd pksuggest">'
     +(others.length>1?('<select data-sugto>'+others.map(function(o){return '<option value="'+esc(o.id)+'">'+esc(o.name)+'</option>';}).join('')+'</select>'):('<input type="hidden" data-sugto value="'+esc(others[0].id)+'">'))
     +'<input type="text" data-pktext placeholder="Ej: protector solar" autocomplete="off" required>'
     +'<button type="submit" class="ghost">Sugerir</button></form>'
     +(packSuggestMsg?'<p class="msg">'+esc(packSuggestMsg)+'</p>':'')+'</div>';
  }
  return '<div class="bar"><h2>Mi mochila</h2><button type="button" class="ghost" data-act="whoswitch" style="padding:6px 12px;font-size:13px">Sos '+esc(me.name)+' · cambiar</button></div>'
   +'<p class="sub">'+(cloudMode()?'Esta lista es solo tuya: está vinculada a tu cuenta de Google y nadie más la puede ver.':'Esta lista es solo tuya: los demás no la ven.')+(others.length?' Podés sugerirles algo a los demás sin ver lo que tienen en la suya.':'')+'</p>'
   +myPackList(who)+sug;
}
