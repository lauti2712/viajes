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
  var c=l.ch,d=c.payDate||c.date,other=c.trip&&c.trip!==CODE;
  /* Los de otro viaje llevan a ese viaje; los de este abren el gasto. */
  var act=other?'data-act="gotrip" data-code="'+esc(c.trip)+'"':'data-act="edit" data-k="'+c.src+'" data-id="'+c.id+'"';
  return '<div class="exp" role="button" tabindex="0" '+act+'><div class="et"><b>'+esc(c.title)+'</b><small>'+(d?'<span>'+esc(fShort(d))+'</span>':'')+(l.n>1?'<span>Cuota '+l.k+'/'+l.n+'</span>':'')+(pagosScope==='all'?'<span>🧳 '+esc(c.tripName||'Este viaje')+'</span>':'')+'</small></div><div class="ea"><b>'+money(l.amt,l.cur)+'</b></div></div>';
}
/* Mis pagos de todos los viajes: en cada viaje de "Mis viajes" se buscan los gastos pagados con mis
   formas de pago (consulta en vivo, sin copias). El viaje abierto sale de los datos locales. */
var pagosScope='trip',OTHER_CHARGES=[],otherState='';
async function loadOtherCharges(quiet){
  if(!FB||AUTH!=='in')return;
  var ids=METHODS.map(function(m){return m.id;}),trips=MYTRIPS.filter(function(t){return t.code!==CODE;});
  if(!ids.length)return;
  if(!quiet){otherState='loading';render();}
  var out=[],fs=FB.fs,failed=0;
  for(var i=0;i<trips.length;i++){
    for(var j=0;j<ids.length;j+=30){
      try{
        var snap=await fs.getDocs(fs.query(fs.collection(FB.db,'trips',trips[i].code,'items'),fs.where('methodId','in',ids.slice(j,j+30))));
        snap.forEach(function(d){var x=d.data();var c=itemCost(x.k,x,'ARS');if(c){c.trip=trips[i].code;c.tripName=trips[i].name||'Viaje';out.push(c);}});
      }catch(e){failed++;}
    }
  }
  OTHER_CHARGES=out;otherState=failed?'partial':'ok';render();
}
function myCharges(){
  var here=costs().map(function(c){c.trip=CODE;c.tripName=S.trip.name||'Este viaje';return c;});
  return pagosScope==='all'?here.concat(OTHER_CHARGES):here;
}
function vPagos(){
  var h='<div class="bar"><h2>Mis pagos</h2><button class="primary" data-act="addmethod">+ Forma de pago</button></div>'
   +'<p class="sub">Tus tarjetas y cuentas son privadas y te sirven en todos tus viajes. Los demás solo ven el nombre en cada gasto. Nunca cargues el número completo: con los últimos 4 alcanza para reconocerla.</p>';
  if(!METHODS.length)return h+empty('Todavía no cargaste formas de pago','Agregá tus tarjetas de crédito (con las fechas de cierre y vencimiento de cada resumen), débito, cuentas o billeteras. Después, al cargar un gasto, elegís con cuál lo pagaste.');
  var all=pagosScope==='all',donde=all?'de tus viajes':'de este viaje';
  h+='<div class="whopick" style="margin:0 0 6px;gap:6px"><button type="button" class="ghost'+(!all?' active':'')+'" data-act="pscope" data-scope="trip" style="padding:5px 12px;font-size:14px">Este viaje</button><button type="button" class="ghost'+(all?' active':'')+'" data-act="pscope" data-scope="all" style="padding:5px 12px;font-size:14px">Todos mis viajes</button>'
    +(all?'<button type="button" class="ghost" data-act="pscope" data-scope="all" data-reload="1" style="padding:5px 12px;font-size:14px">🔄 Actualizar</button>':'')+'</div>';
  if(all&&otherState==='loading')h+='<p class="hint">Buscando en tus '+MYTRIPS.length+' viajes…</p>';
  if(all&&otherState==='partial')h+='<p class="warn">No se pudo leer alguno de tus viajes. Probá "Actualizar".</p>';
  if(all&&MYTRIPS.length<2)h+='<p class="hint">Por ahora solo tenés este viaje en "Mis viajes". Cada viaje que abras se suma acá.</p>';
  var cs=myCharges(),t=today();
  return h+METHODS.map(function(m){
    var ty=mtype(m),charges=cs.filter(function(c){return c.methodId===m.id;});
    var out='<section class="sec"><div class="mhead"><h3>'+ty[0]+' '+esc(m.name||'Sin nombre')+'</h3><small>'+esc([ty[1],m.bank,m.last4?'••'+m.last4:'',m.alias?'Alias '+m.alias+(m.share?' (visible para tus viajes)':''):''].filter(Boolean).join(' · '))+'</small><span class="sp"></span><button type="button" class="ghost" data-act="editmethod" data-id="'+esc(m.id)+'">Editar</button></div>';
    if(m.type==='credito'){
      var sc=cardSchedule(m,charges),shown=sc.buckets.filter(function(b){return b.lines.length||b.s.v>=t||b.s.c>=t;});
      var nextIdx=shown.findIndex(function(b){return (b.s.v||b.s.c)>=t;});
      if(!(m.statements||[]).length)out+='<p class="warn">Cargá las fechas de cierre y vencimiento de los próximos resúmenes (tocá Editar).</p>';
      out+=shown.map(function(b,i){
        return '<div class="stmt'+(i===nextIdx?' next':'')+'"><div class="dh"><span>Cierra <b>'+esc(fShort(b.s.c))+'</b>'+(b.s.v?' · vence <b>'+esc(fShort(b.s.v))+'</b>':'')+'</span><b>'+(b.lines.length?totalsText(b.lines):'—')+'</b></div>'
         +(b.lines.length?b.lines.map(chargeRow).join(''):'<p class="nada">Sin gastos '+donde+' en este resumen.</p>')+'</div>';
      }).join('');
      if(sc.none.length)out+='<div class="stmt"><div class="dh"><span><b>Sin resumen cargado</b></span><b>'+totalsText(sc.none)+'</b></div><p class="hint" style="margin:0 0 4px">Estos cargos caen en resúmenes que todavía no cargaste (o no tienen fecha de compra).</p>'+sc.none.map(chargeRow).join('')+'</div>';
      if(!charges.length&&!shown.length)out+='<p class="nada">Todavía no hay gastos '+donde+' con esta tarjeta.</p>';
    }else{
      var lines=charges.map(function(c){return {ch:c,k:1,n:1,amt:c.amount,cur:c.cur};});
      out+=lines.length?'<div class="stmt"><div class="dh"><span>'+(all?'En tus viajes':'En este viaje')+'</span><b>'+totalsText(lines)+'</b></div>'+lines.map(chargeRow).join('')+'</div>':'<p class="nada">Todavía no hay gastos '+donde+' con este medio.</p>';
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
