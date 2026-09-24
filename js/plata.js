/* Fechas, montos, reparto de gastos, balance y pagos entre personas */
'use strict';
/* ---------- Fechas y plata ---------- */
var pd=function(s){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s||'');return m?new Date(+m[1],+m[2]-1,+m[3]):null};
var iso=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
var today=function(){return iso(new Date())};
var cap=function(s){return s.charAt(0).toUpperCase()+s.slice(1)};
var fLong=function(s){var d=pd(s);return d?cap(d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})):''};
var fShort=function(s){var d=pd(s);return d?d.toLocaleDateString('es-AR',{day:'numeric',month:'short'}).replace('.',''):''};
var mon=function(s){var d=pd(s);return d?d.toLocaleDateString('es-AR',{month:'short'}).replace('.',''):''};
var tm=function(s){var m=/T(\d{2}:\d{2})/.exec(s||'');return m?m[1]:''};
var dayDiff=function(a,b){return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/864e5)};
var base=function(){return (S.trip.base||'ARS').toUpperCase()};
var fmtC={};
function money(n,cur){cur=(cur||base()).toUpperCase();try{var f=fmtC[cur]||(fmtC[cur]=new Intl.NumberFormat('es-AR',{style:'currency',currency:cur,minimumFractionDigits:0,maximumFractionDigits:2}));return f.format(n);}catch(e){return cur+' '+(Math.round(n*100)/100).toLocaleString('es-AR');}}
function toBase(a,cur){cur=(cur||base()).toUpperCase();if(cur===base())return a;var r=parseFloat(S.trip.rates[cur]);return r>0?a*r:null;}
var pn=function(p){return nameOf(p);};
function personColorVar(id){var idx=allPeople().findIndex(function(x){return x.id===id;});return idx>=0?'--p'+((idx%8)+1):'';}
var dot=function(p){var v=personColorVar(p);return v?'<i class="dot" style="background:var('+v+')"></i>':'';};

function costs(){
  var o=[];
  function add(src,x,title,date,cat){var a=parseFloat(x.amount)||0;if(a<=0)return;o.push({id:x.id,src:src,title:title,date:date,cat:cat,amount:a,cur:(x.cur||base()).toUpperCase(),status:x.status||'pendiente',paidBy:x.paidBy||'',method:(x.method||'').trim(),split:x.split||'equal',splitWith:x.splitWith||'',shares:Array.isArray(x.shares)?x.shares:[],methodId:x.methodId||'',cuotas:x.cuotas||'',payDate:x.payDate||''});}
  live('transports').forEach(function(t){add('transports',t,(t.from||'?')+' → '+(t.to||'?'),(t.dep||'').slice(0,10),'Transporte')});
  live('lodging').forEach(function(l){add('lodging',l,l.name||'Alojamiento',l.in||'','Alojamiento')});
  live('expenses').forEach(function(e){add('expenses',e,e.desc||'Gasto',e.date||'',e.cat||'Otros')});
  return o;
}
function sumBase(list){var t=0,miss=new Set();list.forEach(function(c){var b=toBase(c.amount,c.cur);if(b==null)miss.add((c.cur||'').toUpperCase());else t+=b;});return {t:t,miss:miss};}
/* Reparto de un costo (ya pasado a moneda base `b`) entre personas.
   split: 'equal' = las personas que había al cargarlo (splitWith; vacío en gastos viejos = todas) ·
   'some' = las de splitWith, por igual · 'amounts' = proporcional a shares [{p,a}] ·
   un id de persona = viejo "solo de X". */
function splitIds(x){return String(x.splitWith||'').split(',').filter(Boolean);}
function shareMap(c,b){
  var ids=allPeople().map(function(p){return p.id;}),out={},sp=c.split||'equal';
  if(sp==='amounts'){
    var sh=(c.shares||[]).filter(function(x){return (parseFloat(x.a)||0)>0;}),tot=sh.reduce(function(t,x){return t+parseFloat(x.a);},0);
    if(tot>0){sh.forEach(function(x){out[x.p]=(out[x.p]||0)+b*parseFloat(x.a)/tot;});return out;}
  }
  var who=(sp==='some'||(sp==='equal'&&c.splitWith))?splitIds(c).filter(function(id){return ids.indexOf(id)>=0;}):(sp!=='equal'&&sp!=='amounts'&&ids.indexOf(sp)>=0?[sp]:ids);
  if(!who.length)who=ids;
  who.forEach(function(id){out[id]=b/who.length;});
  return out;
}
function splitLabel(x){
  var sp=x.split||'equal';
  if(sp==='equal')return '';
  if(sp==='amounts')return 'Por montos';
  if(sp==='some')return 'Entre '+splitIds(x).map(nameOf).filter(Boolean).join(', ');
  return 'Solo '+nameOf(sp);
}
function settleUp(){
  var people=allPeople(),net={},any=false,miss=new Set();
  people.forEach(function(p){net[p.id]=0;});
  costs().forEach(function(c){
    if(c.status!=='pagado'||!c.paidBy)return;
    any=true;
    var b=toBase(c.amount,c.cur);
    if(b==null){miss.add(c.cur);return;}
    var sm=shareMap(c,b);
    Object.keys(sm).forEach(function(id){if(net.hasOwnProperty(id))net[id]-=sm[id];});
    if(net.hasOwnProperty(c.paidBy))net[c.paidBy]+=b;
  });
  /* Pagos entre personas (saldar deudas): no son gastos, solo mueven el balance. */
  live('payments').forEach(function(x){
    var a=parseFloat(x.amount)||0;if(a<=0||!x.from||!x.to)return;
    any=true;
    var b=toBase(a,x.cur);
    if(b==null){miss.add((x.cur||'').toUpperCase());return;}
    if(net.hasOwnProperty(x.from))net[x.from]+=b;
    if(net.hasOwnProperty(x.to))net[x.to]-=b;
  });
  return {net:net,any:any,miss:miss,people:people};
}
/* Quién le paga a quién para quedar a mano, con la menor cantidad de transferencias.
   Se buscan grupos de personas cuyos saldos se cancelan entre sí (cada grupo de k personas
   se salda con k-1 transferencias); cuantos más grupos, menos transferencias. Exacto hasta
   16 personas con saldo; con más, se usa directamente el método simple. */
function settlements(){
  var b=settleUp(),nm={};
  b.people.forEach(function(p){nm[p.id]=p.name;});
  var bal=b.people.map(function(p){return {id:p.id,v:Math.round((b.net[p.id]||0)*100)};}).filter(function(x){return Math.abs(x.v)>=50;});
  if(bal.length){  /* los redondeos no pueden dejar plata suelta */
    var res=-bal.reduce(function(t,x){return t+x.v;},0);
    bal.slice().sort(function(x,y){return Math.abs(y.v)-Math.abs(x.v);})[0].v+=res;
  }
  var groups=[bal];
  var n=bal.length;
  if(n>2&&n<=16){
    var full=(1<<n)-1,sum=new Array(full+1),dp=new Array(full+1);
    sum[0]=0;dp[0]=0;
    for(var m=1;m<=full;m++){
      var low=m&-m,i=31-Math.clz32(low);
      sum[m]=sum[m^low]+bal[i].v;
      var best=-1;
      for(var j=0;j<n;j++)if(m&(1<<j)){var d=dp[m^(1<<j)];if(d>best)best=d;}
      dp[m]=best+(sum[m]===0?1:0);
    }
    groups=[];var cur=full,g=[];
    while(cur){
      var add=sum[cur]===0?1:0;
      for(var k=0;k<n;k++)if((cur&(1<<k))&&dp[cur^(1<<k)]+add===dp[cur]){g.push(bal[k]);cur^=1<<k;break;}
      if(sum[cur]===0){groups.push(g);g=[];}
    }
  }
  var out=[];
  groups.forEach(function(grp){
    var cred=grp.filter(function(x){return x.v>0;}).map(function(x){return {id:x.id,amt:x.v};}).sort(function(x,y){return y.amt-x.amt;});
    var deb=grp.filter(function(x){return x.v<0;}).map(function(x){return {id:x.id,amt:-x.v};}).sort(function(x,y){return y.amt-x.amt;});
    var i=0,j=0;
    while(i<deb.length&&j<cred.length){
      var pay=Math.min(deb[i].amt,cred[j].amt);
      if(pay>0)out.push({fromId:deb[i].id,toId:cred[j].id,from:nm[deb[i].id],to:nm[cred[j].id],amt:pay/100});
      deb[i].amt-=pay;cred[j].amt-=pay;
      if(deb[i].amt<=0)i++;
      if(cred[j].amt<=0)j++;
    }
  });
  out.sort(function(x,y){return y.amt-x.amt;});
  return {list:out,any:b.any,miss:b.miss};
}
/* Datos para cobrar que cada uno publica en el viaje (alias/CBU), vía su vínculo con la cuenta. */
function cobroOf(pid){var c=cloudMode()?CLAIMS[pid]:null;return c&&c.cobro&&c.cobro.length?c.cobro:[];}
function cobroHtml(pid){
  var l=cobroOf(pid);if(!l.length)return '';
  return '<span class="cobro">'+l.map(function(x){return esc(x.n?x.n+': ':'')+'<b>'+esc(x.a)+'</b> <button type="button" class="ghost" data-copy="'+esc(x.a)+'">Copiar</button>';}).join(' · ')+'</span>';
}
function balanceHtml(who){
  if(allPeople().length<2)return '';
  var s=settlements();if(!s.any)return '';
  if(who){s.list=s.list.filter(function(x){return x.fromId===who||x.toId===who;});if(!s.list.length)return '<div class="balance">'+esc(nameOf(who))+' está a mano con todos.</div>';}
  if(!s.list.length)return '<div class="balance">Están a mano. Nadie le debe nada a nadie.</div>'+(s.miss.size?warnMiss(s.miss):'');
  return '<div class="balance">'+s.list.map(function(x){
    return '<div class="bline"><span>'+esc(x.from)+' le debe <b>'+money(x.amt)+'</b> a '+esc(x.to)+'</span>'
     +'<button type="button" class="ghost" data-act="settle" data-from="'+esc(x.fromId)+'" data-to="'+esc(x.toId)+'" data-amt="'+x.amt+'">Registrar pago</button>'
     +cobroHtml(x.toId)+'</div>';
  }).join('')+'</div>'+(s.miss.size?warnMiss(s.miss):'');
}
function payRow(x){
  return '<div class="exp" role="button" tabindex="0" data-act="editpay" data-id="'+x.id+'"><span class="ec" aria-hidden="true">🤝</span><div class="et"><b>'+esc(nameOf(x.from)||'?')+' le pagó a '+esc(nameOf(x.to)||'?')+'</b><small>'+(x.date?'<span>'+esc(fShort(x.date))+'</span>':'')+(x.method?'<span>'+esc(x.method)+'</span>':'')+(x.note?'<span>'+esc(x.note)+'</span>':'')+'</small></div><div class="ea"><b>'+money(parseFloat(x.amount)||0,x.cur)+'</b></div></div>';
}
function paymentsHtml(who){
  var L=live('payments').filter(function(x){return !who||x.from===who||x.to===who;}).sort(function(a,b){return (b.date||'').localeCompare(a.date||'')||(b.u||0)-(a.u||0);});
  if(!L.length)return '';
  return '<section class="sec"><h2>Pagos entre ustedes</h2><p class="sub">Lo que se fueron devolviendo para saldar deudas. No cuenta como gasto del viaje.</p>'+L.map(payRow).join('')+'</section>';
}
function openPayment(id,pre){
  var ex=id?S.payments.find(function(x){return x.id===id;}):null,ppl=allPeople().map(function(p){return [p.id,p.name];});
  var v=ex||Object.assign({date:today(),cur:base()},pre||{});
  var intro=function(to){var c=cobroHtml(to);return c?'<p class="hint">Datos de '+esc(nameOf(to))+' para transferirle: '+c+'</p>':'';};
  sheetForm({title:ex?'Editar pago':'Registrar pago',values:v,
    intro:'<div id="payintro">'+intro(v.to)+'</div>',
    fields:[
      {k:'from',l:'Quién pagó',t:'select',half:true,opts:ppl},
      {k:'to',l:'A quién',t:'select',half:true,opts:ppl},
      {k:'amount',l:'Monto',t:'number',half:true,req:true,ph:'0'},
      {k:'cur',l:'Moneda',t:'text',list:'curs',half:true},
      {k:'date',l:'Fecha',t:'date',half:true},
      {k:'method',l:'Cómo',t:'text',half:true,list:'methods',ph:'Transferencia, efectivo…'},
      {k:'note',l:'Nota (opcional)',t:'text'}
    ],
    onReady:function(panel){panel.addEventListener('change',function(e){if(e.target.name==='to')$('#payintro',panel).innerHTML=intro(e.target.value);});},
    validate:function(d){if(d.from===d.to)return 'Quién paga y quién recibe tienen que ser personas distintas.';if(!(parseFloat(d.amount)>0))return 'Poné un monto mayor a cero.';return '';},
    onSave:function(d){d.amount=parseFloat(d.amount)||0;d.cur=(d.cur||base()).toUpperCase().slice(0,6);upsert('payments',ex?ex.id:null,d);},
    onDelete:ex?function(){remove('payments',ex.id);}:null
  });
}

function warnMiss(set){var l=Array.from(set).filter(Boolean);return l.length?'<p class="warn">Falta el tipo de cambio de '+esc(l.join(', '))+'. Cargalo en Resumen para que la suma sea correcta.</p>':'';}
function relTime(ts){
  var s=Math.floor((Date.now()-ts)/1000);
  if(s<60)return 'recién';
  var m=Math.floor(s/60);if(m<60)return 'hace '+m+(m===1?' minuto':' minutos');
  var hh=Math.floor(m/60);if(hh<24)return 'hace '+hh+(hh===1?' hora':' horas');
  var dd=Math.floor(hh/24);return 'hace '+dd+(dd===1?' día':' días');
}
var ratesFetchMsg='';
async function fetchBlueUsd(type){
  ratesFetchMsg='Actualizando cotización…';render();
  try{
    var res=await fetch('https://api.bluelytics.com.ar/v2/latest');
    var j=await res.json();
    var v=j&&j[type]&&j[type].value_sell;
    if(typeof v==='number'&&v>0){
      S.trip.rates.USD=v;S.trip.dollarType=type;S.trip.ratesUpdatedAt=Date.now();S.trip.u=Date.now();
      save();pushTrip();
      ratesFetchMsg='Cotización actualizada.';
    }else ratesFetchMsg='No se pudo leer la cotización. Probá de nuevo en un rato.';
  }catch(e){ratesFetchMsg='No se pudo actualizar la cotización. Probá de nuevo en un rato.';}
  render();
}
async function fetchRates(codes){
  codes=codes.filter(function(c){return c!==base();});
  if(!codes.length)return;
  ratesFetchMsg='Actualizando cotización…';render();
  var ok=[],fail=[];
  for(var i=0;i<codes.length;i++){
    var c=codes[i];
    try{
      var res=await fetch('https://open.er-api.com/v6/latest/'+c);
      var j=await res.json();
      if(j&&j.result==='success'&&j.rates&&typeof j.rates[base()]==='number'){S.trip.rates[c]=j.rates[base()];ok.push(c);}
      else fail.push(c);
    }catch(e){fail.push(c);}
  }
  if(ok.length){S.trip.ratesUpdatedAt=Date.now();S.trip.u=Date.now();save();pushTrip();}
  ratesFetchMsg=fail.length?('No se pudo actualizar la cotización de '+fail.join(' y ')+'. Probá de nuevo en un rato.'):'Cotización actualizada.';
  render();
}
