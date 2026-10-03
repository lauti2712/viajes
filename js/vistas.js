/* Componentes y vistas de cada pestaña */
'use strict';
/* ---------- Componentes ---------- */
var empty=function(t,p){return '<div class="empty"><b>'+t+'</b><p>'+p+'</p></div>'};
function bars(rows){if(!rows.length)return '<p class="sub">Sin datos todavía.</p>';var mx=Math.max.apply(null,rows.map(function(r){return r.v}).concat([1]));return '<ul class="bars">'+rows.map(function(r){return '<li><span class="bl" title="'+esc(r.l)+'">'+esc(r.l)+'</span><span class="bt"><span class="bf" style="width:'+(r.v/mx*100).toFixed(1)+'%;background:'+(r.c||'var(--sea)')+'"></span></span><span class="bv">'+money(r.v)+'</span></li>'}).join('')+'</ul>';}
function costBlock(x){
  var a=parseFloat(x.amount)||0;
  if(a<=0)return '<div class="cost"><span class="pill pend">Sin costo cargado</span></div>';
  var cur=curCode(x.cur,base()),b=toBase(a,cur);
  return '<div class="cost"><b class="amt">'+(x.status==='comprar'?'~ ':'')+money(a,cur)+'</b>'+(cur!==base()?'<small>'+(b==null?'sin tipo de cambio':'≈ '+money(b))+'</small>':'')+statusPill(x.status)+(x.paidBy&&!solo()?'<small class="who">'+dot(x.paidBy)+esc(pn(x.paidBy))+'</small>':'')+(x.method?'<small>'+esc(x.method)+'</small>':'')+(splitLabel(x)?'<small>'+esc(splitLabel(x))+'</small>':'')+'</div>';
}
/* Estado del pago: pagado · por pagar (comprado, falta pagar) · por comprar (todavía no se compró: el monto es estimado). */
function statusPill(st){return st==='pagado'?'<span class="pill ok">Pagado</span>':st==='comprar'?'<span class="pill buy">Por comprar</span>':'<span class="pill pend">Por pagar</span>';}
function totLine(list){var t=sumBase(list),p=sumBase(list.filter(function(c){return c.status==='pagado'})),q=sumBase(list.filter(function(c){return c.status==='comprar'}));if(!list.length)return '';return '<div class="tot"><span>Total <b>'+money(t.t)+'</b></span><span>Pagado <b>'+money(p.t)+'</b></span><span>Por pagar <b>'+money(t.t-p.t-q.t)+'</b></span>'+(q.t?'<span>Por comprar <b>~'+money(q.t)+'</b></span>':'')+'</div>'+(t.miss.size?warnMiss(t.miss):'');}

/* ---------- Vistas ---------- */
var tab='itinerario';

function upcoming(){
  var now=today()+'T'+new Date().toTimeString().slice(0,5),ev=[];
  live('transports').forEach(function(t){if(t.dep&&t.dep>=now){var dd=t.dep.slice(0,10),ad=(t.arr||'').slice(0,10),arrTxt=t.arr?('Llega '+(ad!==dd?fShort(ad)+' ':'')+hh(tm(t.arr))+' a '+(t.to||'?')):'';if(t.type==='auto'){arrTxt=t.arr?('Devolución '+(ad!==dd?fShort(ad)+' ':'')+hh(tm(t.arr))+' en '+(t.to||t.from||'?')):'';}ev.push({k:t.dep,d:dd,t:hh(tm(t.dep)),l:(TYPES[t.type]||TYPES.otro)[0]+(t.type==='auto'?' Retiro del auto en '+(t.from||'?'):' Sale '+(t.from||'?')+' → '+(t.to||'?')),sub:arrTxt});}});
  live('plans').forEach(function(p){var k=(p.date||'')+'T'+(p.time||'00:00');if(p.date&&k>=now)ev.push({k:k,d:p.date,t:hh(p.time),l:(ITYPES[p.type]||ITYPES.otro)[0]+' '+(p.title||'Plan')});});
  live('lodging').forEach(function(l){var k0=l.in+'T'+(l.inTime||'15:00');if(l.in&&l.hideItin!=='1'&&k0>=now)ev.push({k:k0,d:l.in,t:hh(l.inTime),l:'🛏️ Check-in: '+lodgeName(l)});});
  return ev.sort(function(a,b){return a.k.localeCompare(b.k)}).slice(0,4);
}

function openRates(){
  var panel=openSheet('Tipos de cambio','<div id="ratesl">'+(ratesSectionHtml()||'<p class="nada">Todo está en '+esc(base())+': no hace falta ningún tipo de cambio.</p>')+'</div>');
  formRefresh=function(){var w=$('#ratesl',panel);if(w)w.innerHTML=ratesSectionHtml();};
}
function ratesSectionHtml(){
  var cs=costs();
  var curs=Array.from(new Set(cs.map(function(c){return c.cur}))).filter(function(c){return c!==base()});
  ['USD','BRL'].forEach(function(c){if(c!==base()&&curs.indexOf(c)===-1)curs.push(c);});
  if(!curs.length)return '';
  var isArs=base()==='ARS';
  var updBtns=isArs
   ?('<div class="g6 row"><button type="button" class="sm ghost'+(S.trip.dollarType==='blue'?' active':'')+'" data-act="fetchusd" data-type="blue">💵 Blue</button><button type="button" class="sm ghost'+(S.trip.dollarType==='oficial'?' active':'')+'" data-act="fetchusd" data-type="oficial">💵 Oficial</button><button type="button" class="sm ghost" data-act="fetchrates" data-codes="BRL">🔄 Real</button></div>')
   :('<button type="button" class="sm ghost" data-act="fetchrates" data-codes="USD,BRL">🔄 Actualizar cotización</button>');
  return '<section class="sec"><div class="mb6 bar"><h2>Tipos de cambio</h2>'+updBtns+'</div><p class="sub">Cuánto vale 1 unidad de cada moneda en '+esc(base())+'. Con esto se suma todo junto.'+(S.trip.ratesUpdatedAt?(isArs?' Dólar ('+(S.trip.dollarType==='blue'?'blue':'oficial')+') y real':' Dólar y real')+' se actualizaron '+relTime(S.trip.ratesUpdatedAt)+'.':'')+'</p>'
   +(ratesFetchMsg?'<p class="msg'+(ratesFetchMsg.indexOf('No se pudo')===0?' err':'')+'">'+esc(ratesFetchMsg)+'</p>':'')
   +'<div class="rates">'+curs.map(function(c){var v=S.trip.rates[c];return '<label class="rate'+(v>0?'':' miss')+'"><span>1 '+esc(c)+' =</span><input type="number" step="any" min="0" inputmode="decimal" data-rate="'+esc(c)+'" value="'+(v>0?v:'')+'" placeholder="0"><span>'+esc(base())+'</span></label>'}).join('')+'</div></section>';
}
function vResumen(){
  var cs=costs(),h='',up=upcoming();
  if(S.trip.info)h+='<div class="infobox"><h3>📌 Info útil</h3><p>'+esc(S.trip.info)+'</p></div>';
  if(up.length){h+='<section class="sec"><h2>Lo que sigue</h2><div>'+up.map(function(e){return '<div class="pl auto"><span class="t">'+esc(fShort(e.d))+(e.t?'<br>'+e.t:'')+'</span><div><b>'+esc(e.l)+'</b>'+(e.sub?'<small>'+esc(e.sub)+'</small>':'')+'</div></div>'}).join('')+'</div></section>';}

  if(!cs.length){h+='<section class="sec">'+empty('Acá va a aparecer el resumen de plata','Cargá transportes, alojamiento o gastos con su monto y vamos sumando el total, lo pagado y lo que falta.')+'</section>';return h;}
  var buy=cs.filter(function(c){return c.status==='comprar';}),tot=sumBase(cs),pg=sumBase(cs.filter(function(c){return c.status==='pagado'})),pc=sumBase(buy),pe=tot.t-pg.t-pc.t;
  h+='<section class="sec"><div class="bar"><h2>Plata del viaje</h2><button type="button" class="primary" data-act="final">📄 Resumen final</button></div><dl class="stats"><div><dt>Total</dt><dd>'+money(tot.t)+'</dd></div><div><dt>Ya pagado</dt><dd>'+money(pg.t)+'</dd></div><div><dt>Por pagar</dt><dd>'+money(pe)+'</dd></div>'+(buy.length?'<div><dt>Por comprar</dt><dd>~'+money(pc.t)+'</dd></div>':'')+'</dl>'+(tot.miss.size?warnMiss(tot.miss):'')+'</section>';
  /* Lo que falta comprar (pasajes, entradas…): tocar abre el ítem para marcarlo como comprado. */
  if(buy.length)h+='<section class="sec"><h2>🛒 Por comprar</h2><p class="sub">'+pl('Lo que dejaron anotado para comprar. Cuando lo compren','Lo que dejaste anotado para comprar. Cuando lo compres')+', cambiá el estado a "Por pagar" o "Pagado".</p>'+buy.sort(function(a,b){return (a.date||'9').localeCompare(b.date||'9');}).map(function(c){
    var it=S[c.src].find(function(x){return x.id===c.id;}),ic=c.src==='transports'?(TYPES[it.type]||TYPES.otro)[0]:c.src==='lodging'?'🛏️':catIcon(c.cat);
    return '<div class="exp" role="button" tabindex="0" data-act="edit" data-k="'+c.src+'" data-id="'+esc(c.id)+'"><span class="ec" aria-hidden="true">'+ic+'</span><div class="et"><b>'+esc(c.title)+'</b><small>'+(c.date?'<span>'+esc(fShort(c.date))+'</span>':'')+'<span>'+esc(c.cat)+'</span></small></div><div class="ea"><b>~'+money(c.amount,c.cur)+'</b></div></div>';
  }).join('')+'</section>';
  var bud=parseFloat(S.trip.budget)||0;
  if(bud>0){
    var bpct=Math.min(100,tot.t/bud*100),bover=tot.t>bud;
    h+='<section class="sec"><h2>Presupuesto total</h2><div class="dh"><span>'+money(tot.t)+' de '+money(bud)+'</span><b class="'+(bover?'over':'')+'">'+Math.round(tot.t/bud*100)+'%</b></div><div class="prog"><span class="'+(bover?'over':'')+'" style="width:'+bpct+'%"></span></div>'+(bover?'<p class="warn">'+pl('Ya cargaron','Ya cargaste')+' más de lo presupuestado para todo el viaje.</p>':'')+'</section>';
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
/* Teléfono para un link tel: (solo dígitos y +), así un dato cargado por otro no mete otra cosa en el href. */
function telHref(s){var d=String(s||'').replace(/[^\d+]/g,'');return d.length>=6?'tel:'+d:'';}
function fmtKm(n){return (parseInt(n,10)||0).toLocaleString('es-AR');}
function ticket(t){
  var ty=TYPES[t.type]||TYPES.otro,dd=(t.dep||'').slice(0,10),ad=(t.arr||'').slice(0,10),dday=pd(dd),car=t.type==='auto',same=car&&(t.same==='1'||t.from===t.to);
  return '<div class="ticket" role="button" tabindex="0" data-act="edit" data-k="transports" data-id="'+t.id+'">'
   +'<div class="stub"><span class="ic" aria-hidden="true">'+ty[0]+'</span>'+(dday?'<b>'+dday.getDate()+'</b><small>'+esc(mon(dd))+'</small>':'<small>Sin fecha</small>')+'</div>'
   +'<div class="tb"><div class="route">'+(car?(same?'Retiro y devolución en '+esc(t.from||'?'):esc(t.from||'?')+'<span class="ar">→</span>'+esc(t.to||'?')):esc(t.from||'?')+'<span class="ar">→</span>'+esc(t.to||'?'))+'</div>'
   +((t.dep||t.arr)?'<div class="times"><div><span>'+(car?'Retiro':'Sale')+'</span><b>'+(t.dep?esc(fShort(dd))+' '+hh(tm(t.dep)):'—')+'</b></div><div><span>'+(car?'Devolución':'Llega')+'</span><b>'+(t.arr?esc(fShort(ad))+' '+hh(tm(t.arr)):'—')+'</b></div></div>':'')
   +((t.company||t.ref||(t.attachments&&t.attachments.length)||(t.links&&t.links.length))?'<div class="meta"><span>'+esc(ty[1])+(t.company?' de '+esc(t.company):'')+'</span>'+(t.ref?'<span class="ref">Reserva '+esc(t.ref)+'</span>':'')+attLinkChips(t)+'</div>':'')
   +(car&&(t.kmOut||t.kmIn)?'<div class="meta"><span>🛣️ Km '+(t.kmOut?esc(fmtKm(t.kmOut)):'—')+' → '+(t.kmIn?esc(fmtKm(t.kmIn)):'—')+'</span>'+(t.kmOut&&t.kmIn&&+t.kmIn>=+t.kmOut?'<span><b>'+esc(fmtKm(t.kmIn-t.kmOut))+' km recorridos</b></span>':'')+'</div>':'')
   +(car&&telHref(t.mech)?'<div class="meta"><a class="tel" href="'+telHref(t.mech)+'" onclick="event.stopPropagation()">🔧 Mecánico / asistencia: '+esc(t.mech)+'</a></div>':'')
   +(!car&&!solo()&&paxNames(t.riders).length?'<div class="meta"><span>👥 '+esc(joinNames(paxNames(t.riders)))+'</span></div>':'')
   +(t.notes?'<p class="note">'+esc(t.notes)+'</p>':'')
   +costBlock(t)+'</div></div>';
}
function vTransportes(){
  var L=live('transports').sort(function(a,b){return (a.dep||'9999').localeCompare(b.dep||'9999')});
  var h='<div class="bar"><h2>Transportes</h2><button class="primary" data-act="add" data-k="transports">+ Agregar</button></div>'+vehiclesHtml();
  if(!L.length)return h+empty(pl('Todavía no cargaron ningún transporte','Todavía no cargaste ningún transporte'),'Vuelos, micros, trenes, barcos, auto alquilado o traslados. Anotá horarios, código de reserva y cuánto costó.');
  return h+totLine(costs().filter(function(c){return c.src==='transports'}))+L.map(ticket).join('');
}

/* Botón 📍 que abre la dirección en el mapa del celular. */
function mapBtn(x,key){var u=mapsUrl(x,key);return u?'<a class="mapbtn" href="'+esc(u)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()" aria-label="Abrir en el mapa" title="Abrir en el mapa">📍</a>':'';}
function vAlojamiento(){
  var L=live('lodging').sort(function(a,b){return (a.in||'9999').localeCompare(b.in||'9999')});
  var h='<div class="bar"><h2>Alojamiento</h2><button class="primary" data-act="add" data-k="lodging">+ Agregar</button></div>';
  if(!L.length)return h+empty(pl('Todavía no cargaron dónde van a dormir','Todavía no cargaste dónde vas a dormir'),'Hotel, departamento o hostel: fechas, dirección, reserva y costo.'+pl(' Pueden ser varios: cada uno marca en cuál se queda y el costo se reparte entre los de ese alojamiento.',' Pueden ser varios, uno después del otro.'));
  return h+totLine(costs().filter(function(c){return c.src==='lodging'}))+L.map(function(l){
    var n=(l.in&&l.out)?dayDiff(pd(l.in),pd(l.out)):0;
    return '<div class="stay" role="button" tabindex="0" data-act="edit" data-k="lodging" data-id="'+l.id+'"><div class="nm">'+esc(lodgeName(l))+(bookSite(l.airbnb)?' <a class="abnb" href="'+esc(safeUrl(l.airbnb))+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">'+esc(bookSite(l.airbnb))+' ↗</a>':'')+'</div>'
     +(l.address?'<div class="mt2 sub addr">'+mapBtn(l)+'<span>'+esc(l.address)+'</span></div>':'')
     +'<div class="dates"><span>Entrada <b>'+(l.in?esc(fShort(l.in))+(l.inTime?' '+esc(hh(l.inTime)):''):'—')+'</b></span><span>Salida <b>'+(l.out?esc(fShort(l.out))+(l.outTime?' '+esc(hh(l.outTime)):''):'—')+'</b></span>'+(l.hideItin==='1'?'<span title="No se muestra en el itinerario">🙈 Fuera del itinerario</span>':'')+(n>0?'<span><b>'+n+(n===1?' noche':' noches')+'</b></span>':'')+attLinkChips(l)+'</div>'
     +(l.ref?'<div class="meta"><span class="ref">Reserva '+esc(l.ref)+'</span></div>':'')
     +(l.notes?'<p class="note">'+esc(l.notes)+'</p>':'')+guestsLine(l)+costBlock(l)+'</div>';
  }).join('');
}

function costRow(k,item,desc,icon,catLabel,extra){
  var a=parseFloat(item.amount)||0,cur=curCode(item.cur,base()),b=toBase(a,cur);
  return '<div class="exp" role="button" tabindex="0" data-act="edit" data-k="'+k+'" data-id="'+item.id+'"><span class="ec" aria-hidden="true">'+icon+'</span><div class="et"><b>'+esc(desc)+'</b><small><span>'+esc(catLabel)+'</span>'+(item.paidBy&&!solo()?'<span class="who">'+dot(item.paidBy)+esc(pn(item.paidBy))+'</span>':'')+(item.method?'<span>'+esc(item.method)+'</span>':'')+attLinkChips(item)+(extra||'')+'</small></div><div class="ea"><b>'+money(a,cur)+'</b>'+(cur!==base()?'<small>'+(b==null?'sin tipo de cambio':'≈ '+money(b))+'</small>':'')+(item.status==='pendiente'||item.status==='comprar'?statusPill(item.status):'')+'</div></div>';
}
function expRow(e,extra){return costRow('expenses',e,e.desc||'Gasto',catIcon(e.cat),(e.time?hh(e.time)+' · ':'')+(e.cat||'Otros'),extra);}
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
    (g[dateKey]=g[dateKey]||[]).push({row:rowFn(extra),amount:amt,cur:item.cur,u:u||0,t:item.time||''});
  }
  live('expenses').forEach(function(e){add(e.date||'0',e,function(x){return expRow(e,x);},e.u);});
  live('transports').filter(function(t){return (parseFloat(t.amount)||0)>0}).forEach(function(t){
    var ty=TYPES[t.type]||TYPES.otro;
    add((t.dep||'').slice(0,10)||'0',t,function(x){return costRow('transports',t,(t.from||'?')+' → '+(t.to||'?'),ty[0],ty[1],x);},t.u);
  });
  live('lodging').filter(function(l){return (parseFloat(l.amount)||0)>0}).forEach(function(l){
    add(l.in||'0',l,function(x){return costRow('lodging',l,lodgeName(l),'🛏️','Alojamiento',x);},l.u);
  });
  var keys=Object.keys(g).sort().reverse();
  var h='<div class="bar"><h2>Gastos</h2><button class="primary" data-act="add" data-k="expenses">+ Anotar gasto</button></div>';
  var bal=balanceHtml(who);
  if(bal)h+='<section class="cuentas"><h3>'+(who?'Las cuentas de '+esc(nameOf(who)):'Quién le debe a quién')+'</h3>'+bal+'</section>';
  if(ppl.length>1)h+='<div class="whopick gwho"><span class="lbl">Ver gastos de</span><button type="button" class="ghost sm'+(!who?' active':'')+'" data-act="gwho" data-who="">Todos</button>'
    +ppl.map(function(p){return '<button type="button" class="ghost sm'+(who===p.id?' active':'')+'" data-act="gwho" data-who="'+esc(p.id)+'">'+dot(p.id)+esc(p.name)+'</button>';}).join('')+'</div>';
  if(who&&!keys.length)return h+empty('No hay gastos de '+esc(nameOf(who)),'Ningún gasto cargado lo pagó '+esc(nameOf(who))+' ni le toca una parte.')+paymentsHtml(who);
  if(!keys.length)return h+empty(pl('Todavía no anotaron gastos','Todavía no anotaste gastos'),pl('Cuando estén de viaje, anotá cada gasto: qué fue, cuánto, quién pagó y cómo.','Cuando estés de viaje, anotá cada gasto: qué fue, cuánto y cómo lo pagaste.')+' Acá se agrupan por día, y también suman los transportes y el alojamiento que cargaste con costo.');
  var allEntries=[].concat.apply([],keys.map(function(k){return g[k]}));
  var all=sumBase(allEntries.map(function(x){return {amount:x.amount,cur:x.cur}}).filter(function(c){return c.amount>0}));
  var nd=keys.filter(function(k){return k!=='0'}).length,dl=parseFloat(S.trip.daily)||0;
  if(who){
    var paid=sumBase(costs().filter(function(c){return c.status==='pagado'&&c.paidBy===who;})).t,net=settleUp().net[who]||0;
    h+='<dl class="mt12 stats"><div><dt>Le toca en total</dt><dd>'+money(all.t)+'</dd></div><div><dt>Pagó</dt><dd>'+money(paid)+'</dd></div><div><dt>'+(net>0.5?'Le deben':net<-0.5?'Debe':'Saldo')+'</dt><dd>'+money(Math.abs(net))+'</dd></div></dl>'+(all.miss.size?warnMiss(all.miss):'')+'<div class="sp14"></div>';
  }else
  h+='<dl class="mt12 stats"><div><dt>Gastos anotados</dt><dd>'+money(all.t)+'</dd></div>'+(nd?'<div><dt>Promedio por día</dt><dd>'+money(all.t/nd)+'</dd></div>':'')+(dl>0?'<div><dt>Presupuesto diario</dt><dd>'+money(dl)+'</dd></div>':'')+'</dl>'+(all.miss.size&&!bal?warnMiss(all.miss):'')+'<div class="sp14"></div>';
  h+=keys.map(function(k){
    var items=g[k].slice().sort(function(a,b){return (b.t||'').localeCompare(a.t||'')||(b.u||0)-(a.u||0)});
    var s=sumBase(items.map(function(x){return {amount:x.amount,cur:x.cur}})),over=dl>0&&s.t>dl;
    return '<section class="day"><div class="dh"><h3>'+(k==='0'?'Sin fecha':esc(fLong(k)))+'</h3><b class="'+(over?'over':'')+'">'+money(s.t)+'</b></div>'+(dl>0?'<div class="prog"><span class="'+(over?'over':'')+'" style="width:'+Math.min(100,s.t/dl*100)+'%"></span></div>':'')+items.map(function(x){return x.row}).join('')+'</section>';
  }).join('');
  h+=paymentsHtml(who);
  return h;
}

function daysList(){
  var set=new Set(),s=pd(S.trip.start),e=pd(S.trip.end);
  if(s&&e){var n=dayDiff(s,e);if(n>=0&&n<=120){for(var i=0;i<=n;i++){set.add(iso(new Date(s.getFullYear(),s.getMonth(),s.getDate()+i)));}}}
  live('plans').forEach(function(p){set.add(p.date)});
  live('transports').forEach(function(t){set.add(String(t.dep||'').slice(0,10));set.add(String(t.arr||'').slice(0,10));});
  live('lodging').forEach(function(l){if(l.hideItin!=='1'){set.add(l.in);set.add(l.out);}});
  return Array.from(set).filter(function(d){return pd(d);}).sort();   /* fechas mal cargadas no rompen el itinerario */
}
function autoRow(ic,time,title,sub){return '<div class="pl auto"><span class="t">'+esc(time)+'</span><div><b>'+ic+' '+esc(title)+'<span class="tag">Reserva</span></b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</div></div>';}
function planRow(p){var ty=ITYPES[p.type]||ITYPES.otro;return '<div class="pl" role="button" tabindex="0" data-act="edit" data-k="plans" data-id="'+p.id+'"><span class="t">'+esc(hh(p.time))+(p.endTime?'<small class="tend">a '+esc(hh(p.endTime))+'</small>':'')+'</span><div><b>'+ty[0]+' '+esc(p.title||'Plan')+attLinkChips(p)+'</b>'+(p.place?'<small class="addr">'+mapBtn(p,'place')+'<span>'+esc(p.place)+'</span></small>':'')+(p.notes?'<small>'+esc(p.notes)+'</small>':'')+'</div></div>';}
function paxNames(r){return livingIds(r).map(nameOf).filter(Boolean);}
function joinNames(a){return a.length<2?a.join(''):a.slice(0,-1).join(', ')+' y '+a[a.length-1];}
/* Pasajes del día: cada uno carga el suyo, así que los que salen y llegan igual (mismo horario y tramo) se juntan
   en una sola fila con todos los que viajan. */
function paxRows(d){
  var g={},out=[];
  live('transports').forEach(function(x){
    var dd=(x.dep||'').slice(0,10),ad=(x.arr||'').slice(0,10);
    [['dep',dd],['arr',ad]].forEach(function(e){
      if(e[1]!==d)return;
      var key=e[0]+'|'+x.type+'|'+(x[e[0]]||'')+'|'+String(x.from||'').toLowerCase()+'|'+String(x.to||'').toLowerCase();
      if(!g[key]){g[key]={end:e[0],x:x,ids:[],refs:[],cos:[]};out.push(g[key]);}
      livingIds(x.riders).forEach(function(id){if(g[key].ids.indexOf(id)<0)g[key].ids.push(id);});
      if(x.ref&&g[key].refs.indexOf(x.ref)<0)g[key].refs.push(x.ref);
      if(x.company&&g[key].cos.indexOf(x.company)<0)g[key].cos.push(x.company);
    });
  });
  return out.map(function(r){
    var x=r.x,ty=TYPES[x.type]||TYPES.otro,car=x.type==='auto',dep=r.end==='dep',n=r.ids.map(nameOf).filter(Boolean);
    var sub=[r.cos.join(', '),r.refs.length?'Reserva '+r.refs.join(', '):''].filter(Boolean).join(' · ');
    var who=n.length&&(dep||!car)&&!solo()?(car?(dep?'Van: ':''):(dep?(n.length>1?'Se van: ':'Se va: '):(n.length>1?'Llegan: ':'Llega: ')))+joinNames(n):'';
    var title=car?(dep?'Retiro del auto en '+(x.from||'?'):'Devolución del auto en '+(x.to||x.from||'?')):(dep?'Sale: '+(x.from||'?')+' → '+(x.to||'?'):'Llega a '+(x.to||'?'));
    return {k:tm(x[r.end])||(dep?'00:00':'00:01'),h:autoRow(ty[0],hh(tm(x[r.end])),title,[who,dep||car?sub:''].filter(Boolean).join(' · '))};
  });
}
/* Tarjeta "Hoy" (solo durante el viaje): lo próximo que sale, dónde duermen esta noche, el plan que
   sigue y el clima. Prioriza lo de uno (pasajes donde viaja, alojamiento donde se queda). */
function hoyHtml(wxOn){
  var t=today(),s=S.trip.start,e=S.trip.end||s;
  if(!s||t<s||t>e)return '';
  var me=myPersonId(),d=new Date(),hm=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'),now=t+'T'+hm;
  var tmw=iso(new Date(d.getFullYear(),d.getMonth(),d.getDate()+1)),rows=[];
  var row=function(ic,lbl,main,sub){return '<div class="hrow"><span class="hic" aria-hidden="true">'+ic+'</span><div><small>'+esc(lbl)+'</small><b>'+esc(main)+'</b>'+(sub?'<span>'+esc(sub)+'</span>':'')+'</div></div>';};
  var when=function(dt){var dd=dt.slice(0,10);return (dd===t?'hoy':dd===tmw?'mañana':fShort(dd))+(tm(dt)?' a las '+hh(tm(dt)):'');};
  var mineOr=function(list,f){var m=me?list.filter(function(x){return idsOf(x[f]).indexOf(me)>=0;}):[];return m.length?m:list;};
  /* Plan que sigue hoy */
  var P=live('plans').filter(function(p){return p.date===t;}).sort(function(a,b){return (a.time||'99').localeCompare(b.time||'99');});
  /* un plan con hora de fin sigue "en curso" hasta que termina */
  var up=P.filter(function(p){return !p.time||p.time>=hm||(p.endTime&&p.endTime>=hm);});
  if(up.length){var p0=up[0],now0=p0.time&&p0.time<hm;rows.push(row((ITYPES[p0.type]||ITYPES.otro)[0],now0?'Ahora, hasta las '+hh(p0.endTime):p0.time?'Hoy a las '+hh(p0.time)+(p0.endTime?' a '+hh(p0.endTime):''):'Hoy',p0.title||'Plan',[p0.place,up.length>1?'y '+(up.length-1)+' más hoy':''].filter(Boolean).join(' · ')));}
  if(up.length&&mapsUrl(up[0],'place'))rows[rows.length-1]=rows[rows.length-1].replace('</div></div>','</div>'+mapBtn(up[0],'place')+'</div>');
  else if(P.length)rows.push(row('✅','Hoy','Ya pasaron los planes de hoy',''));
  /* Próximo transporte */
  var T=live('transports').filter(function(x){return x.dep&&x.dep>=now;}).sort(function(a,b){return a.dep.localeCompare(b.dep);});
  var nx=mineOr(T.filter(function(x){return !x.riders||idsOf(x.riders).length;}),'riders')[0];
  if(nx){var ty=TYPES[nx.type]||TYPES.otro,car=nx.type==='auto',pax=paxNames(nx.riders);
    rows.push(row(ty[0],'Próximo, '+when(nx.dep),car?'Retiro del auto en '+(nx.from||'?'):(nx.from||'?')+' → '+(nx.to||'?'),[nx.company,pax.length&&!solo()?(car?'Van ':'Viajan ')+joinNames(pax):''].filter(Boolean).join(' · ')));}
  /* Dónde duermen esta noche */
  var L=mineOr(live('lodging').filter(function(l){return l.in&&l.out&&l.in<=t&&t<l.out;}),'guests');
  L.forEach(function(l){var r0=row('🛏️','Esta noche',lodgeName(l),[l.address,l.out===tmw?'Check-out mañana'+(l.outTime?' a las '+hh(l.outTime):''):''].filter(Boolean).join(' · '));rows.push(mapsUrl(l)?r0.replace('</div></div>','</div>'+mapBtn(l)+'</div>'):r0);});
  var dn=dayDiff(pd(s),pd(t))+1,tot=dayDiff(pd(s),pd(e))+1;
  return '<section class="hoy"><div class="hh"><b>Hoy</b><span>Día '+dn+' de '+tot+'</span>'+(wxOn?wxChip(t):'')+'</div>'
   +(rows.length?rows.join(''):'<p class="nada">Nada cargado para hoy. Día libre.</p>')+'</section>';
}
/* El itinerario arranca en hoy: los días que ya pasaron se ven con "Ver días anteriores". */
var itinPast=false;
function vItinerario(){
  var days=daysList(),t=today(),s=pd(S.trip.start);
  var wxOn=PREFS.showWeather!==false;
  if(wxOn)loadWeather();
  var h='<div class="bar"><h2>Itinerario</h2>'+wxNowChip()+'<button class="primary" data-act="add" data-k="plans">+ Agregar plan</button></div>'+hoyHtml(wxOn);
  if(!days.length)return h+empty('Todavía no hay días armados','Poné las fechas del viaje en Ajustes, o agregá un plan con su fecha. Los transportes y el alojamiento aparecen solos en su día.');
  var past=days.filter(function(d){return d<t;}).length;
  if(past===days.length)past=0;   /* viaje terminado: se ve completo */
  if(past)h+='<button type="button" class="ghost itpast" data-act="itinpast">'+(itinPast?'Ocultar días anteriores':'Ver días anteriores ('+past+')')+'</button>';
  if(past&&!itinPast)days=days.slice(past);
  return h+days.map(function(d){
    var items=[];
    live('plans').filter(function(p){return p.date===d}).forEach(function(p){items.push({k:p.time||'99:98',h:planRow(p)})});
    items=items.concat(paxRows(d));
    /* Gastos marcados "Mostrarlo en el itinerario" */
    live('expenses').filter(function(x){return x.inItin==='1'&&x.date===d;}).forEach(function(x){
      var a=parseFloat(x.amount)||0;
      items.push({k:x.time||'99:97',h:'<div class="pl" role="button" tabindex="0" data-act="edit" data-k="expenses" data-id="'+x.id+'"><span class="t">'+esc(hh(x.time))+'</span><div><b>'+catIcon(x.cat)+' '+esc(x.desc||'Gasto')+'<span class="tag gasto">Gasto</span></b>'+(a>0?'<small>'+money(a,curCode(x.cur,base()))+(x.status==='comprar'?' · por comprar':'')+'</small>':'')+'</div></div>'});
    });
    live('lodging').forEach(function(l){
      if(l.hideItin==='1')return;
      if(l.out===d)items.push({k:l.outTime||'10:00',h:autoRow('🛏️',hh(l.outTime),'Check-out: '+lodgeName(l),'')});
      if(l.in===d)items.push({k:l.inTime||'15:00',h:autoRow('🛏️',hh(l.inTime),'Check-in: '+lodgeName(l),l.address||'')});
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
/* Modo solo: con una persona (o ninguna todavía) se esconde todo lo de repartir y los textos van en singular.
   Apenas se suma otra persona, vuelve todo lo de grupo. */
function solo(){return allPeople().length<=1;}
function pl(grupo,uno){return solo()?uno:grupo;}
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
  if(!cloud)h+='<p class="mt14 hint">Ojo: es solo una preferencia de este dispositivo, no una contraseña. Cualquiera que use este celular puede tocar "cambiar" y ver otra lista.</p>';
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
  return '<div class="bar"><h2>Mi mochila</h2><button type="button" class="sm ghost" data-act="whoswitch">Sos '+esc(me.name)+' · cambiar</button></div>'
   +'<p class="sub">'+(cloudMode()?'Esta lista es solo tuya: está vinculada a tu cuenta de Google y nadie más la puede ver.':'Esta lista es solo tuya: los demás no la ven.')+(others.length?' Podés sugerirles algo a los demás sin ver lo que tienen en la suya.':'')+'</p>'
   +myPackList(who)+sug;
}
