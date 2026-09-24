/* Mis pagos: formas de pago de la cuenta y resúmenes de tarjeta */
'use strict';
/* ---------- Mis pagos: formas de pago de la cuenta (users/{uid}/methods), privadas ---------- */
var METHODS=[];
var MTYPES={credito:['💳','Tarjeta de crédito'],debito:['💳','Tarjeta de débito'],banco:['🏦','Cuenta bancaria'],billetera:['📱','Billetera virtual'],efectivo:['💵','Efectivo'],otro:['🧾','Otro']};
var mtype=function(m){return MTYPES[m.type]||MTYPES.otro};
var methodLabel=function(m){return (m.name||'Sin nombre')+(m.last4?' ••'+m.last4:'')};
function totalsText(lines){var t={};lines.forEach(function(l){t[l.cur]=(t[l.cur]||0)+l.amt;});var ks=Object.keys(t);return ks.length?ks.map(function(c){return money(t[c],c);}).join(' + '):money(0);}
/* Reparte los cargos de una tarjeta en sus resúmenes: cada compra (o cuota) cae en el primer resumen
   que cierra el día de la compra o después; la cuota 2 en el siguiente, etc. */
function cardSchedule(m,charges){
  var st=(m.statements||[]).filter(function(x){return x&&x.c;}).slice().sort(function(a,b){return a.c.localeCompare(b.c);});
  var buckets=st.map(function(x){return {s:x,lines:[]};}),none=[];
  charges.forEach(function(ch){
    var d=ch.payDate||ch.date,n=Math.max(1,Math.min(60,parseInt(ch.cuotas,10)||1));
    var i0=d?st.findIndex(function(x){return d<=x.c;}):-1;
    for(var k=0;k<n;k++){
      var line={ch:ch,k:k+1,n:n,amt:ch.amount/n,cur:ch.cur},idx=i0<0?-1:i0+k;
      if(idx>=0&&idx<buckets.length)buckets[idx].lines.push(line);else none.push(line);
    }
  });
  return {buckets:buckets,none:none};
}
function chargeRow(l){
  var c=l.ch,d=c.payDate||c.date;
  return '<div class="exp" role="button" tabindex="0" data-act="edit" data-k="'+c.src+'" data-id="'+c.id+'"><div class="et"><b>'+esc(c.title)+'</b><small>'+(d?'<span>'+esc(fShort(d))+'</span>':'')+(l.n>1?'<span>Cuota '+l.k+'/'+l.n+'</span>':'')+'</small></div><div class="ea"><b>'+money(l.amt,l.cur)+'</b></div></div>';
}
function vPagos(){
  var h='<div class="bar"><h2>Mis pagos</h2><button class="primary" data-act="addmethod">+ Forma de pago</button></div>'
   +'<p class="sub">Tus tarjetas y cuentas son privadas y te sirven en todos tus viajes. Los demás solo ven el nombre en cada gasto. Nunca cargues el número completo: con los últimos 4 alcanza para reconocerla.</p>';
  if(!METHODS.length)return h+empty('Todavía no cargaste formas de pago','Agregá tus tarjetas de crédito (con las fechas de cierre y vencimiento de cada resumen), débito, cuentas o billeteras. Después, al cargar un gasto, elegís con cuál lo pagaste.');
  var cs=costs(),t=today();
  return h+METHODS.map(function(m){
    var ty=mtype(m),charges=cs.filter(function(c){return c.methodId===m.id;});
    var out='<section class="sec"><div class="mhead"><h3>'+ty[0]+' '+esc(m.name||'Sin nombre')+'</h3><small>'+esc([ty[1],m.bank,m.last4?'••'+m.last4:'',m.alias?'Alias '+m.alias+(m.share?' (visible para tus viajes)':''):''].filter(Boolean).join(' · '))+'</small><span class="sp"></span><button type="button" class="ghost" data-act="editmethod" data-id="'+esc(m.id)+'">Editar</button></div>';
    if(m.type==='credito'){
      var sc=cardSchedule(m,charges),shown=sc.buckets.filter(function(b){return b.lines.length||b.s.v>=t||b.s.c>=t;});
      var nextIdx=shown.findIndex(function(b){return (b.s.v||b.s.c)>=t;});
      if(!(m.statements||[]).length)out+='<p class="warn">Cargá las fechas de cierre y vencimiento de los próximos resúmenes (tocá Editar).</p>';
      out+=shown.map(function(b,i){
        return '<div class="stmt'+(i===nextIdx?' next':'')+'"><div class="dh"><span>Cierra <b>'+esc(fShort(b.s.c))+'</b>'+(b.s.v?' · vence <b>'+esc(fShort(b.s.v))+'</b>':'')+'</span><b>'+(b.lines.length?totalsText(b.lines):'—')+'</b></div>'
         +(b.lines.length?b.lines.map(chargeRow).join(''):'<p class="nada">Sin gastos de este viaje en este resumen.</p>')+'</div>';
      }).join('');
      if(sc.none.length)out+='<div class="stmt"><div class="dh"><span><b>Sin resumen cargado</b></span><b>'+totalsText(sc.none)+'</b></div><p class="hint" style="margin:0 0 4px">Estos cargos caen en resúmenes que todavía no cargaste (o no tienen fecha de compra).</p>'+sc.none.map(chargeRow).join('')+'</div>';
      if(!charges.length&&!shown.length)out+='<p class="nada">Todavía no hay gastos de este viaje con esta tarjeta.</p>';
    }else{
      var lines=charges.map(function(c){return {ch:c,k:1,n:1,amt:c.amount,cur:c.cur};});
      out+=lines.length?'<div class="stmt"><div class="dh"><span>En este viaje</span><b>'+totalsText(lines)+'</b></div>'+lines.map(chargeRow).join('')+'</div>':'<p class="nada">Todavía no hay gastos de este viaje con este medio.</p>';
    }
    return out+'</section>';
  }).join('');
}
function openMethod(id){
  var m=id?METHODS.find(function(x){return x.id===id;}):null;
  var v=m?Object.assign({},m):{type:'credito',name:'',bank:'',last4:''};
  var st=((m&&m.statements)||[]).map(function(x){return {c:x.c||'',v:x.v||''};});
  function stRows(){return st.length?st.map(function(x,i){return '<div class="strow"><label>Cierre<input type="date" data-stc="'+i+'" value="'+esc(x.c)+'"></label><label>Vencimiento<input type="date" data-stv="'+i+'" value="'+esc(x.v)+'"></label><button type="button" class="x" data-strm="'+i+'" aria-label="Quitar resumen">✕</button></div>';}).join(''):'<p class="nada">Sin resúmenes cargados.</p>';}
  var fields=[
    {k:'type',l:'Tipo',t:'select',opts:Object.keys(MTYPES).map(function(k){return [k,MTYPES[k][0]+' '+MTYPES[k][1]];})},
    {k:'name',l:'Nombre para reconocerla',t:'text',req:true,ph:'Ej: Visa Galicia, Cuenta Brubank'},
    {k:'bank',l:'Banco o emisor (opcional)',t:'text',half:true},
    {k:'last4',l:'Últimos 4 dígitos (opcional)',t:'text',half:true,ph:'1234'},
    {k:'alias',l:'Alias o CBU/CVU para que te transfieran',t:'text',ph:'Ej: lauti.viajes.mp'},
    {k:'_share',t:'html',html:'<label class="fld pksug" id="shareWrap" style="flex-direction:row;white-space:normal"><input type="checkbox" name="share"'+(v.share?' checked':'')+'> Mostrarlo a los demás de mis viajes, para que vean a dónde pagarme cuando me deban</label>'}
  ];
  var panel=openSheet(m?'Editar forma de pago':'Nueva forma de pago','<form id="mf" class="grid" novalidate>'+fields.map(function(f){return fieldHtml(f,v);}).join('')
    +'<div class="fld" id="stWrap"><span>Resúmenes de la tarjeta</span><p class="hint" style="margin:0 0 6px">Fecha de cierre y de vencimiento (cuándo hay que pagarlo) de cada resumen, como las publica el banco.</p><div id="stRows">'+stRows()+'</div><div><button type="button" class="ghost" id="staddrow" style="padding:6px 12px;font-size:13px">+ Agregar resumen</button></div></div>'
    +'<p class="msg err" id="mmsg" style="grid-column:1/-1;margin:0"></p><div class="acts">'+(m?'<button type="button" class="danger" id="mdel">Eliminar</button>':'')+'<button type="submit" class="primary">Guardar</button></div></form>');
  var f=$('#mf',panel),l4=$('#f_last4',panel);
  l4.setAttribute('inputmode','numeric');l4.setAttribute('maxlength','4');
  function syncType(){
    var t=$('#f_type',panel).value,cobra=t==='banco'||t==='billetera';
    $('#stWrap',panel).hidden=t!=='credito';
    $('#f_alias',panel).closest('.fld').hidden=!cobra;$('#shareWrap',panel).hidden=!cobra;
  }
  syncType();
  panel.addEventListener('change',function(e){if(e.target.id==='f_type')syncType();});
  panel.addEventListener('input',function(e){
    var i=e.target.getAttribute('data-stc');if(i!=null){st[+i].c=e.target.value;return;}
    i=e.target.getAttribute('data-stv');if(i!=null)st[+i].v=e.target.value;
  });
  panel.addEventListener('click',function(e){
    var rm=e.target.closest('[data-strm]');
    if(rm){st.splice(+rm.getAttribute('data-strm'),1);$('#stRows',panel).innerHTML=stRows();return;}
    if(e.target.closest('#staddrow')){st.push({c:'',v:''});$('#stRows',panel).innerHTML=stRows();}
  });
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var d={};new FormData(f).forEach(function(val,kk){d[kk]=String(val).trim();});
    var msg=$('#mmsg',panel);
    if(!d.name){$('#f_name',panel).focus();return;}
    var digits=(d.last4||'').replace(/\D/g,'');
    if(d.last4&&digits.length!==4){msg.textContent='En "últimos 4 dígitos" poné solo 4 números, nunca el número completo.';return;}
    var stc=d.type==='credito'?st.filter(function(x){return x.c;}).sort(function(a,b){return a.c.localeCompare(b.c);}):[];
    if(stc.some(function(x){return x.v&&x.v<x.c;})){msg.textContent='Hay un resumen que vence antes de cerrar. Revisá las fechas.';return;}
    var cobra=d.type==='banco'||d.type==='billetera';
    saveMethod(Object.assign({},m||{},{id:m?m.id:uid(),type:d.type,name:d.name,bank:d.bank||'',last4:digits,statements:stc,alias:cobra?(d.alias||''):'',share:cobra&&d.alias&&d.share?'1':'',u:Date.now()}));
    closeSheet();
  });
  var del=$('#mdel',panel);
  if(del)del.addEventListener('click',function(){
    if(!del.classList.contains('armed')){del.classList.add('armed');del.textContent='¿Seguro? Tocá de nuevo';return;}
    saveMethod(Object.assign({},m,{del:true,u:Date.now()}));closeSheet();
  });
}

var VIEWS={resumen:vResumen,transportes:vTransportes,alojamiento:vAlojamiento,gastos:vGastos,itinerario:vItinerario,mochila:vMochila,pagos:vPagos};

function renderHead(){
  $('#title').textContent=S.trip.name||'Nuestro viaje';
  var tb=$('#themeBtn');if(tb)tb.textContent=themeLabel();
  var lo=$('#logoutBtn');if(lo){lo.hidden=!(ME&&AUTH==='in');if(ME)lo.textContent='Salir'+(ME.name?' ('+ME.name.split(' ')[0]+')':'');}
  $('#who2').innerHTML=(gated()?[]:allPeople()).map(function(p){return '<span class="chip">'+dot(p.id)+esc(p.name)+'</span>';}).join('')+syncChip();
  var s=pd(S.trip.start),e=pd(S.trip.end),w='';
  if(!s){w='<span>Sin fechas todavía</span>';}
  else{
    var d=dayDiff(pd(today()),s),st='';
    if(d>0)st=d===1?'Falta 1 día':'Faltan '+d+' días';
    else if(e&&dayDiff(pd(today()),e)>=0)st='Día '+(1-d)+' de '+(dayDiff(s,e)+1);
    else if(e)st='Viaje terminado';
    else st='Ya empezó';
    w='<span class="cal" aria-hidden="true">📅</span><span>'+esc(fShort(S.trip.start))+(e?' al '+esc(fShort(S.trip.end)):'')+'</span><b>'+st+'</b>';
  }
  $('#when').innerHTML=w;
  document.title=(S.trip.name||'Nuestro viaje');
}
/* Con nube hay que iniciar sesión con Google antes de ver el viaje. Si Firebase ni siquiera cargó
   (sin señal), AUTH queda 'offline' y se muestra lo guardado en el dispositivo. */
var loginMsg='';
/* Logueado pero sin elegir quién es en el viaje: sin eso no aparecen sus formas de pago ni su mochila. */
var whoLater=false;
function whoBanner(){
  if(!cloudMode()||AUTH!=='in'||!claimsLoaded||whoLater||tab==='mochila'||myPersonId())return '';
  var free=allPeople().filter(function(p){return !CLAIMS[p.id]||CLAIMS[p.id].uid===ME.uid;});
  return '<div class="infobox" style="border-left-color:var(--sun)"><h3>¿Quién sos en este viaje?</h3><p style="margin-bottom:10px">Elegilo una vez y queda vinculado a tu cuenta de Google: así los demás pueden elegir tus formas de pago al cargar un gasto, ven tu alias y tenés tu mochila.</p>'
   +'<div class="whopick" style="margin:0">'+free.map(function(p){return '<button type="button" class="primary" data-act="whoami" data-who="'+esc(p.id)+'">Soy '+esc(p.name)+'</button>';}).join('')
   +'<button type="button" class="ghost" data-tab="mochila">No estoy en la lista</button><button type="button" class="ghost" data-act="wholater">Ahora no</button></div>'+(claimMsg?'<p class="msg err">'+esc(claimMsg)+'</p>':'')+'</div>';
}
function gated(){return cloudMode()&&(AUTH==='pending'||AUTH==='out');}
function vGate(){
  if(AUTH!=='out')return '<p class="sub" style="text-align:center;margin-top:30px">Cargando…</p>';
  return '<div class="gate"><h2>Entrá con Google</h2><p>Para ver y editar este viaje, iniciá sesión con tu cuenta de Google.</p>'
   +'<button type="button" class="primary" data-act="login">Continuar con Google</button>'
   +(loginMsg?'<p class="msg err">'+esc(loginMsg)+'</p>':'')
   +'<p class="hint">Si abriste el link desde Instagram o Facebook y no te deja entrar, abrilo en Chrome o Safari.</p></div>';
}
function render(){
  var g=gated();
  document.body.classList.toggle('gated',g);
  renderHead();
  if(g){$('#main').innerHTML=vGate();return;}
  var canPay=cloudMode()&&AUTH==='in';
  $('#tabPagos').hidden=!canPay;
  if(tab==='pagos'&&!canPay)tab='itinerario';
  $('#main').innerHTML=whoBanner()+VIEWS[tab]();
  Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(b){if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
}
