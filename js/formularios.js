/* Hojas y formularios (gastos, ajustes, personas) */
'use strict';
/* ---------- Formularios ---------- */
function fieldHtml(f,v){
  if(f.t==='html')return f.html;
  var val=v[f.k]!=null?v[f.k]:(f.def!=null?f.def:''),id='f_'+f.k,inp;
  if(f.t==='select')inp='<select id="'+id+'" name="'+f.k+'">'+f.opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(val)?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select>';
  else if(f.t==='textarea')inp='<textarea id="'+id+'" name="'+f.k+'" rows="3" placeholder="'+esc(f.ph||'')+'">'+esc(val)+'</textarea>';
  else inp='<input id="'+id+'" name="'+f.k+'" type="'+f.t+'" value="'+esc(val)+'"'+(f.list?' list="'+f.list+'"':'')+(f.t==='number'?' step="any" inputmode="decimal" min="0"':'')+' placeholder="'+esc(f.ph||'')+'"'+(f.req?' required':'')+' autocomplete="off">';
  return '<label class="fld'+(f.half?' half':'')+'"><span>'+esc(f.l)+'</span>'+inp+'</label>';
}
function openSheet(title,body){
  formRefresh=null;
  var host=$('#sheet');
  host.innerHTML='<div class="scrim" data-close></div><div class="panel" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="ph"><h2>'+esc(title)+'</h2><button type="button" class="x" data-close aria-label="Cerrar">✕</button></div>'+body+'</div>';
  host.hidden=false;document.body.classList.add('lock');
  return $('.panel',host);
}
var formRefresh=null;
function closeSheet(){formRefresh=null;var h=$('#sheet');h.hidden=true;h.innerHTML='';document.body.classList.remove('lock');if(reloadPending){forceReload(reloadPending);return;}render();if(pendingJoin.length)setTimeout(askJoin,0);}
function sheetForm(o){
  var v=o.values||{};
  var panel=openSheet(o.title,(o.intro||'')+'<form id="sf" class="grid" novalidate>'+o.fields.map(function(f){return fieldHtml(f,v)}).join('')+'<p class="msg err" id="sfmsg" style="grid-column:1/-1;margin:0"></p><div class="acts">'+(o.onDelete?'<button type="button" class="danger" id="del">Eliminar</button>':'')+'<button type="submit" class="primary">Guardar</button></div></form>'+(o.extra||''));
  var f=$('#sf',panel);
  if(o.onReady)o.onReady(panel);
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var d={};new FormData(f).forEach(function(val,k){d[k]=String(val).trim()});
    var req=o.fields.filter(function(x){return x.req&&!d[x.k]})[0];
    if(req){var el=$('#f_'+req.k,panel);if(el)el.focus();return;}
    var bad=o.validate?o.validate(d):'';
    if(bad){var m=$('#sfmsg',panel);if(m)m.textContent=bad;return;}
    o.onSave(d);closeSheet();
  });
  var del=$('#del',panel);
  if(del)del.addEventListener('click',function(){
    if(!del.classList.contains('armed')){del.classList.add('armed');del.textContent='¿Seguro? Tocá de nuevo';return;}
    o.onDelete();closeSheet();
  });
  if(!o.noFocus){var first=$('input:not([type=hidden]),select',f);if(first&&!v.id&&window.matchMedia('(min-width:700px)').matches)first.focus();}
}

function costF(){
  var f=[
    {k:'amount',l:'Monto',t:'number',half:true,ph:'0'},
    {k:'cur',l:'Moneda',t:'text',list:'curs',half:true,def:base()},
    {k:'status',l:'Estado del pago',t:'select',half:true,opts:[['pendiente','Por pagar'],['pagado','Pagado']]},
    {k:'paidBy',l:'Quién pagó',t:'select',half:true,opts:buildPaidByOptions()}
  ];
  /* Se elige entre las formas de pago de quien pagó (payerMethods); "Otro" deja escribirla a mano. */
  if(cloudMode())f.push({k:'methodId',l:'Con qué pagó',t:'select',opts:[['','Elegí…']]});
  return f.concat([
    {k:'method',l:'Cómo se pagó',t:'text',list:'methods',ph:'Efectivo, Visa 3 cuotas, transferencia…'},
    {k:'cuotas',l:'Cuotas',t:'number',half:true,ph:'1'},
    {k:'payDate',l:'Fecha de la compra',t:'date',half:true},
    {k:'split',l:'Para quién es',t:'select',opts:[['equal','Todos, a partes iguales'],['some','Algunos, a partes iguales'],['amounts','Por montos']]},
    {k:'_splitbox',t:'html',html:'<div class="fld" id="splitBox"></div>'}
  ]);
}
/* Formas de pago de una persona del viaje: las propias salen de Mis pagos; las de los demás, de lo
   que cada uno publica en su vínculo (solo nombre y tipo). null = sin nube, se escribe a mano. */
function payerMethods(pid){
  if(!cloudMode()||!pid)return null;
  if(pid===myPersonId())return METHODS.map(function(m){return {id:m.id,name:m.name||'',type:m.type,label:methodLabel(m)};});
  var c=CLAIMS[pid];
  return c&&c.methods?c.methods.map(function(m){return {id:m.id,name:m.n,type:m.t,label:m.n};}):[];
}
function buildPaidByOptions(){return [['','Sin definir']].concat(allPeople().map(function(p){return [p.id,p.name];})).concat([['__new__','+ Agregar otra persona…']]);}
/* Pasa el formulario de costo a datos: montos, reparto y forma de pago. `ex` es el ítem que se edita. */
function normalizeCost(d,ex){
  if(!('amount' in d))return d;
  d.amount=parseFloat(d.amount)||0;d.cur=curCode(d.cur,base());
  var sw=[],sh=[];
  Object.keys(d).forEach(function(k){
    if(k.indexOf('sw_')===0){sw.push(k.slice(3));delete d[k];}
    else if(k.indexOf('sh_')===0){var a=parseFloat(d[k])||0;if(a>0)sh.push({p:k.slice(3),a:a});delete d[k];}
  });
  /* "Todos" guarda quiénes eran: si después se suma alguien, se pregunta (askJoin) en vez de sumarlo solo. */
  d.splitWith=d.split==='some'?sw.join(','):d.split==='equal'?((ex&&(ex.split||'equal')==='equal'&&ex.splitWith)?ex.splitWith:allPeople().map(function(p){return p.id;}).join(',')):'';
  d.shares=d.split==='amounts'?sh:[];
  if('methodId' in d){
    if(d.methodId==='__other')d.methodId='';
    var m=(payerMethods(d.paidBy)||[]).find(function(x){return x.id===d.methodId;});
    if(m){d.method=m.name;if(m.type!=='credito')d.cuotas='';}
    else if(!(ex&&d.methodId&&d.methodId===ex.methodId))d.cuotas='';
  }else if(cloudMode()&&!d.paidBy){
    d.methodId='';d.cuotas='';   /* sin quién pagó no hay forma de pago de nadie */
  }
  return d;
}
function splitProblem(d){
  var amt=parseFloat(d.amount)||0,keys=Object.keys(d);
  if(d.split==='some'&&!keys.some(function(k){return k.indexOf('sw_')===0;}))return 'Tildá al menos a una persona.';
  if(d.split==='amounts'){
    var sum=keys.filter(function(k){return k.indexOf('sh_')===0;}).reduce(function(t,k){return t+(parseFloat(d[k])||0);},0);
    if(Math.abs(sum-amt)>0.009)return 'Los montos suman '+money(sum,d.cur)+' y el gasto es de '+money(amt,d.cur)+'. Tienen que coincidir.';
  }
  return '';
}
var SPECS={
  transports:function(){return {title:['Nuevo transporte','Editar transporte'],fields:[
    {k:'type',l:'Tipo',t:'select',opts:Object.keys(TYPES).map(function(k){return [k,TYPES[k][0]+' '+TYPES[k][1]]})},
    {k:'from',l:'Origen',t:'text',half:true,req:true,ph:'Ej: Rosario'},
    {k:'to',l:'Destino',t:'text',half:true,req:true,ph:'Ej: Bariloche'},
    {k:'dep',l:'Sale',t:'datetime-local'},
    {k:'arr',l:'Llega',t:'datetime-local'},
    {k:'company',l:'Empresa',t:'text',half:true,ph:'Aerolínea, bus…'},
    {k:'ref',l:'Código de reserva',t:'text',half:true},
    {k:'notes',l:'Notas',t:'textarea',ph:'Terminal, asiento, equipaje, hora de check-in…'}
  ].concat(costF())}},
  lodging:function(){return {title:['Nuevo alojamiento','Editar alojamiento'],fields:[
    {k:'name',l:'Nombre',t:'text',req:true,ph:'Hotel, depto, hostel…'},
    {k:'airbnb',l:'Link de Airbnb (opcional)',t:'text',ph:'https://www.airbnb.com.ar/rooms/…'},
    {k:'address',l:'Dirección',t:'text'},
    {k:'in',l:'Entrada',t:'date',half:true},
    {k:'out',l:'Salida',t:'date',half:true},
    {k:'ref',l:'Código de reserva',t:'text'},
    {k:'notes',l:'Notas',t:'textarea',ph:'Horario de check-in, contacto, cómo llegar…'}
  ].concat(costF())}},
  expenses:function(){return {title:['Anotar gasto','Editar gasto'],fields:[
    {k:'desc',l:'Qué fue',t:'text',req:true,ph:'Almuerzo, taxi, entradas…'},
    {k:'date',l:'Fecha',t:'date',half:true},
    {k:'cat',l:'Categoría',t:'select',half:true,opts:Object.keys(catAll()).map(function(k){return [k,catAll()[k]+' '+k]})}
  ].concat(costF())}},
  plans:function(){return {title:['Nuevo plan','Editar plan'],fields:[
    {k:'title',l:'Qué van a hacer',t:'text',req:true,ph:'Ej: Cena en el puerto'},
    {k:'date',l:'Fecha',t:'date',half:true,req:true},
    {k:'time',l:'Hora',t:'time',half:true},
    {k:'type',l:'Tipo',t:'select',opts:Object.keys(ITYPES).map(function(k){return [k,ITYPES[k][0]+' '+ITYPES[k][1]]})},
    {k:'place',l:'Lugar',t:'text'},
    {k:'notes',l:'Notas',t:'textarea',ph:'Reserva, cómo llegar, qué llevar…'}
  ]}}
};
var DEFAULTS={
  transports:function(){return {type:'vuelo',cur:base(),status:'pendiente',split:'equal',paidBy:myPersonId(),payDate:today()}},
  lodging:function(){return {cur:base(),status:'pendiente',split:'equal',paidBy:myPersonId(),payDate:today()}},
  expenses:function(){return {date:today(),cat:'Comida',cur:base(),status:'pagado',split:'equal',paidBy:myPersonId(),payDate:today()}},
  plans:function(){var s=S.trip.start;return {type:'paseo',date:s&&s>today()?s:today()}}
};
function attRow(a){
  return '<div class="attitem"><a href="'+esc(safeUrl(a.url)||'#')+'" target="_blank" rel="noopener"><span class="aic" aria-hidden="true">'+fileIcon(a.type)+'</span><span class="anm">'+esc(a.name||'Archivo')+'</span>'+(a.size?'<span class="asz">'+humanSize(a.size)+'</span>':'')+'</a><button type="button" class="x" data-rmatt="'+esc(a.id)+'" aria-label="Quitar archivo">✕</button></div>';
}
function lnkRow(l){
  return '<div class="lnkitem"><a href="'+esc(safeUrl(l.url)||'#')+'" target="_blank" rel="noopener">🔗 '+esc(l.label||l.url)+'</a><button type="button" class="x" data-rmlink="'+esc(l.id)+'" aria-label="Quitar link">✕</button></div>';
}
function attsBlock(item){
  var list=(item&&item.attachments)||[];
  return '<div class="sideSec" id="attsWrap"><h3>Archivos y fotos</h3><div class="attlist">'+(list.length?list.map(attRow).join(''):'<p class="nada">Sin archivos todavía.</p>')+'</div><label class="ghost filebtn">📎 Agregar archivo o foto<input type="file" data-file accept="image/*,application/pdf" multiple hidden></label><p class="msg" data-attmsg></p></div>';
}
function linksBlock(item){
  var list=(item&&item.links)||[];
  return '<div class="sideSec" id="lnksWrap"><h3>Links</h3><div class="lnklist">'+(list.length?list.map(lnkRow).join(''):'<p class="nada">Sin links.</p>')+'</div><div class="row"><input data-linklabel placeholder="Título (opcional)" autocomplete="off"><input data-linkurl placeholder="https://…" inputmode="url" autocomplete="off"></div><button type="button" class="ghost" id="addlink">+ Agregar link</button><p class="msg" data-linkmsg></p></div>';
}
function addLink(k,id,label,url){
  var it=S[k].find(function(x){return x.id===id}),links=(it&&it.links)?it.links.slice():[];
  links.push({id:uid(),label:label||'',url:url});
  upsert(k,id,{links:links});
}
function removeLink(k,id,linkId){
  var it=S[k].find(function(x){return x.id===id});if(!it)return;
  upsert(k,id,{links:(it.links||[]).filter(function(l){return l.id!==linkId})});
}
function removeAttachment(k,id,attId){
  var it=S[k].find(function(x){return x.id===id});if(!it)return;
  var att=(it.attachments||[]).find(function(a){return a.id===attId});
  upsert(k,id,{attachments:(it.attachments||[]).filter(function(a){return a.id!==attId})});
  if(att&&att.path&&FB&&FB.st){try{FB.st.deleteObject(FB.st.ref(FB.storage,att.path)).catch(function(){});}catch(e){}}
}
async function uploadFiles(k,id,files,onDone,onMsg){
  if(!FB||!FB.st){onMsg(FIREBASE_CONFIG.apiKey?'Se está conectando con la nube todavía. Probá de nuevo en un segundo.':'Para adjuntar archivos, primero hay que conectar el viaje a la nube.',true);return;}
  for(var i=0;i<files.length;i++){
    var file=files[i];
    if(file.size>20*1024*1024){onMsg('"'+file.name+'" pesa más de 20 MB, no se pudo subir.',true);continue;}
    onMsg('Subiendo '+file.name+'…');
    try{
      var path='trips/'+CODE+'/'+k+'/'+id+'/'+uid()+'_'+file.name.replace(/[^\w.\-]+/g,'_');
      var r=FB.st.ref(FB.storage,path);
      await FB.st.uploadBytes(r,file);
      var url=await FB.st.getDownloadURL(r);
      var it=S[k].find(function(x){return x.id===id}),atts=(it&&it.attachments)?it.attachments.slice():[];
      atts.push({id:uid(),name:file.name,url:url,path:path,size:file.size,type:file.type||''});
      upsert(k,id,{attachments:atts});
      onDone();
    }catch(e){onMsg('No se pudo subir "'+file.name+'". Revisá que Storage esté habilitado y las reglas publicadas.',true);}
  }
  onMsg('');
}
function openItem(k,id,pre){
  var sp=SPECS[k](),ex=id?S[k].find(function(x){return x.id===id}):null;
  var vals=Object.assign({},ex||Object.assign({},DEFAULTS[k](),pre||{}));
  /* Gastos viejos "solo de X": se muestran como "algunos" con esa sola persona. */
  if(vals.split&&['equal','some','amounts'].indexOf(vals.split)<0){vals.splitWith=vals.split;vals.split='some';}
  if(!vals.methodId&&vals.method&&cloudMode()&&ex)vals.methodId='__other';
  var curId=id||null;
  var tk=k==='expenses'?'<div class="row" style="margin:-4px 0 12px"><label class="ghost filebtn">📷 Leer ticket<input type="file" accept="image/*" capture="environment" data-ticket hidden></label><span class="hint" id="tkmsg" style="margin:0"></span></div>':'';
  var body=tk+'<form id="sf" class="grid" novalidate>'+sp.fields.map(function(f){return fieldHtml(f,vals)}).join('')+'<p class="msg err" id="formmsg" role="status" style="grid-column:1/-1;margin:0"></p><div class="acts">'+(ex?'<button type="button" class="danger" id="del">Eliminar</button>':'')+'<button type="submit" class="primary">Guardar</button></div></form>'
   +'<hr>'+attsBlock(ex)+'<hr>'+linksBlock(ex);
  var panel=openSheet(sp.title[ex?1:0],body);
  var f=$('#sf',panel);
  var el=function(nm){return f.querySelector('[name='+nm+']');};
  function showFld(input,on){if(!input)return;var w=input.closest('.fld');if(w)w.hidden=!on;input.disabled=!on;}

  function readForm(){var d={};new FormData(f).forEach(function(val,kk){d[kk]=String(val).trim();});return d;}
  function ensureId(){
    if(curId)return curId;
    var d=normalizeCost(readForm(),null);
    curId=upsert(k,null,d);
    return curId;
  }
  function redraw(){
    var it=curId?S[k].find(function(x){return x.id===curId}):null;
    var aw=$('#attsWrap',panel),lw=$('#lnksWrap',panel);
    if(aw)aw.outerHTML=attsBlock(it);
    if(lw)lw.outerHTML=linksBlock(it);
  }

  /* --- Reparto --- */
  var box=$('#splitBox',panel);
  function splitState(){
    var st={sel:{},amt:{}};
    if(!box.firstChild){splitIds(vals).forEach(function(id){st.sel[id]=true;});(vals.shares||[]).forEach(function(x){st.amt[x.p]=x.a;});st.init=true;return st;}
    Array.prototype.forEach.call(box.querySelectorAll('[name^=sw_]'),function(c){if(c.checked)st.sel[c.name.slice(3)]=true;});
    Array.prototype.forEach.call(box.querySelectorAll('[name^=sh_]'),function(c){if(c.value)st.amt[c.name.slice(3)]=c.value;});
    return st;
  }
  function drawSplit(){
    if(!box)return;
    var mode=el('split').value,ppl=allPeople(),st=splitState(),h='';
    if(mode==='equal'){
      var fixed=ex&&(ex.split||'equal')==='equal'&&ex.splitWith?splitIds(ex).map(nameOf).filter(Boolean):null;
      h='<p class="hint" style="margin:0">'+(fixed?'Se divide entre '+esc(fixed.join(', '))+' (los que estaban cuando se cargó). Para sumar o sacar a alguien, elegí "Algunos".'
        :'Se divide entre todas las personas del viaje'+(ppl.length?' ('+ppl.map(function(p){return esc(p.name);}).join(', ')+')':'')+'. Si después se suma alguien, te vamos a preguntar si entra en este gasto.')+'</p>';
    }
    else if(mode==='some'){
      var none=!Object.keys(st.sel).length;
      h='<div class="row">'+ppl.map(function(p){return '<label class="pksug"><input type="checkbox" name="sw_'+esc(p.id)+'"'+(st.sel[p.id]||none?' checked':'')+'>'+esc(p.name)+'</label>';}).join('')+'</div>';
    }else if(mode==='amounts'){
      var had=Object.keys(st.amt).length;
      lastEdited=had?ppl.length-1:-1;
      h='<div class="rates">'+ppl.map(function(p){return '<label class="rate"><span style="min-width:90px">'+dot(p.id)+esc(p.name)+'</span><input type="number" step="any" min="0" inputmode="decimal" name="sh_'+esc(p.id)+'" value="'+esc(st.amt[p.id]||'')+'" placeholder="0"></label>';}).join('')+'</div>'
       +'<p class="hint" style="margin:8px 0 0">Al escribir el monto de alguien, lo que falta se reparte en partes iguales entre los que siguen. <span id="shsum"></span></p>';
    }
    box.innerHTML=h;
    if(mode==='amounts'&&lastEdited<0)spread(-1);
    updSum();
  }
  function updSum(){
    var out=$('#shsum',panel);if(!out)return;
    var amt=parseFloat(el('amount').value)||0,cur=(el('cur').value||base()).toUpperCase(),sum=0;
    Array.prototype.forEach.call(box.querySelectorAll('[name^=sh_]'),function(c){sum+=parseFloat(c.value)||0;});
    var rest=Math.round((amt-sum)*100)/100;
    out.textContent='Suman '+money(sum,cur)+' de '+money(amt,cur)+(rest>0?' · falta '+money(rest,cur):rest<0?' · sobran '+money(-rest,cur):' ✓');
  }
  /* Por montos: lo que queda después de la persona `upto` (y las anteriores) se divide en partes
     iguales entre las que siguen; la última absorbe los centavos. */
  var lastEdited=-1;
  function spread(upto){
    var amt=parseFloat(el('amount').value)||0,ins=Array.prototype.slice.call(box.querySelectorAll('[name^=sh_]'));
    var rest=ins.slice(0,upto+1).reduce(function(t,c){return t+(parseFloat(c.value)||0);},amt*0);
    rest=Math.round((amt-rest)*100)/100;
    var next=ins.slice(upto+1);if(!next.length)return;
    if(rest<=0){next.forEach(function(c){c.value=0;});return;}
    var each=Math.floor(rest/next.length*100)/100;
    next.forEach(function(c,i){c.value=i===next.length-1?Math.round((rest-each*(next.length-1))*100)/100:each;});
  }

  /* --- Forma de pago --- */
  var lastPayer=null;
  function fillMethods(payer,keep){
    var ms=el('methodId'),list=payerMethods(payer)||[];
    var cur=keep?ms.value:(lastPayer===null?(vals.methodId||''):'');
    var opts=[['','Elegí…']].concat(list.map(function(m){return [m.id,(MTYPES[m.type]||MTYPES.otro)[0]+' '+m.label];}));
    if(cur&&cur!=='__other'&&!list.some(function(m){return m.id===cur;}))opts.push([cur,'💳 '+(vals.method||'Forma de pago')]);
    opts.push(['__other','Otro (escribir)']);
    ms.innerHTML=opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(o[0]===cur?' selected':'')+'>'+esc(o[1])+'</option>';}).join('');
    var w=ms.closest('.fld'),hint=w.querySelector('.mhint');
    if(!hint){hint=document.createElement('small');hint.className='mhint hint';hint.style.margin='0';w.appendChild(hint);}
    var nm=esc(nameOf(payer)),linked=!!CLAIMS[payer];
    hint.innerHTML=list.length?'':payer===myPersonId()?'Todavía no cargaste tus formas de pago: agregalas en "Mis pagos".'
      :linked?nm+' todavía no cargó sus formas de pago en la app.'
      :nm+' todavía no vinculó su cuenta de Google en este viaje.'+(!myPersonId()?' <button type="button" class="ghost" data-claimhere="'+esc(payer)+'" style="padding:3px 10px;font-size:13px">Soy '+nm+'</button>':'');
  }
  /* Si llegan formas de pago o vínculos con el formulario abierto, se actualiza el desplegable. */
  formRefresh=function(){var ms=el('methodId'),pb=el('paidBy');if(ms&&pb&&pb.value){fillMethods(pb.value,true);syncPay();}};
  function syncPay(){
    var pb=el('paidBy'),ms=el('methodId'),payer=pb?pb.value:'';
    if(ms&&payer!==lastPayer){fillMethods(payer);lastPayer=payer;}
    showFld(ms,!!ms&&!!payer);
    showFld(el('method'),!ms||!payer||ms.value==='__other');
    var m=ms&&payer?(payerMethods(payer)||[]).find(function(x){return x.id===ms.value;}):null;
    var credit=!!(m&&m.type==='credito');
    showFld(el('cuotas'),credit);showFld(el('payDate'),credit);
  }
  if(el('amount')){drawSplit();syncPay();}

  f.addEventListener('submit',function(e){
    e.preventDefault();
    var d=readForm(),fm=$('#formmsg',panel);
    var req=sp.fields.filter(function(x){return x.req&&!d[x.k]})[0];
    if(req){var r=$('#f_'+req.k,panel);if(r)r.focus();return;}
    var prob='amount' in d?splitProblem(d):'';
    if(prob){fm.textContent=prob;return;}
    upsert(k,curId,normalizeCost(d,ex));
    closeSheet();
  });
  var del=$('#del',panel);
  if(del)del.addEventListener('click',function(){
    if(!del.classList.contains('armed')){del.classList.add('armed');del.textContent='¿Seguro? Tocá de nuevo';return;}
    remove(k,curId);closeSheet();
  });

  panel.addEventListener('click',function(e){
    var ch=e.target.closest('[data-claimhere]');
    if(ch){claimPerson(ch.getAttribute('data-claimhere'));ch.textContent='Vinculando…';ch.disabled=true;return;}
    var rm=e.target.closest('[data-rmatt]');
    if(rm){removeAttachment(k,ensureId(),rm.getAttribute('data-rmatt'));redraw();return;}
    var rl=e.target.closest('[data-rmlink]');
    if(rl){removeLink(k,ensureId(),rl.getAttribute('data-rmlink'));redraw();return;}
    if(e.target.closest('#addlink')){
      var lbl=$('[data-linklabel]',panel).value.trim(),url=$('[data-linkurl]',panel).value.trim(),lm=$('[data-linkmsg]',panel);
      if(!/^https?:\/\//i.test(url)){lm.textContent='Pegá un link que empiece con http:// o https://';lm.className='msg err';return;}
      addLink(k,ensureId(),lbl,url);lm.textContent='';lm.className='msg';redraw();
    }
  });
  var pbSel=el('paidBy');if(pbSel)pbSel.dataset.prevValue=pbSel.value;
  panel.addEventListener('input',function(e){
    var nm=String(e.target.name||'');
    if(nm.indexOf('sh_')===0){
      lastEdited=Array.prototype.indexOf.call(box.querySelectorAll('[name^=sh_]'),e.target);
      spread(lastEdited);
    }else if(nm==='amount'&&el('split').value==='amounts')spread(lastEdited);
    if(nm==='amount'||nm==='cur'||nm.indexOf('sh_')===0){updSum();$('#formmsg',panel).textContent='';}
  });

  panel.addEventListener('change',function(e){
    var tf=e.target.closest('[data-ticket]');
    if(tf&&tf.files&&tf.files[0]){
      var file=tf.files[0],tm=$('#tkmsg',panel),say=function(t,err){tm.textContent=t;tm.className='hint'+(err?' warn':'');};
      tf.value='';
      readTicket(file,say).then(function(r){
        var got=[];
        if(r.amount!=null){el('amount').value=r.amount;el('amount').dispatchEvent(new Event('input',{bubbles:true}));got.push('total '+money(r.amount,el('cur').value||base()));}
        if(r.date&&el('date')){el('date').value=r.date;got.push('fecha '+fShort(r.date));}
        if(r.merchant&&el('desc')&&!el('desc').value.trim()){el('desc').value=r.merchant;got.push('«'+r.merchant+'»');}
        say(got.length?'Encontré '+got.join(', ')+'. Revisalo antes de guardar.':'No pude leer los datos: completalos a mano. La foto igual queda adjunta.',!got.length);
        /* La foto queda adjunta al gasto (achicada). */
        var f2=new File([r.blob],'ticket-'+(r.date||today())+'.jpg',{type:'image/jpeg'}),msg=$('[data-attmsg]',panel);
        uploadFiles(k,ensureId(),[f2],function(){redraw();},function(t,err){if(msg){msg.textContent=t;msg.className='msg'+(err?' err':'');}});
      }).catch(function(err){say((err&&err.message)||'No se pudo leer el ticket.',true);});
      return;
    }
    var fi=e.target.closest('[data-file]');
    if(fi&&fi.files&&fi.files.length){
      var id2=ensureId(),msg=$('[data-attmsg]',panel),files=fi.files;
      uploadFiles(k,id2,files,function(){redraw();},function(t,err){if(msg){msg.textContent=t;msg.className='msg'+(err?' err':'');}});
      fi.value='';
      return;
    }
    if(e.target.name==='split'){drawSplit();$('#formmsg',panel).textContent='';return;}
    if(e.target.name==='methodId'){syncPay();return;}
    if(e.target.name==='paidBy'){
      var sel=e.target;
      if(sel.value==='__new__'){
        var nm=(window.prompt('¿Cómo se llama la persona?')||'').trim();
        if(!nm){sel.value=sel.dataset.prevValue||'';return;}
        var pid=addPerson(nm);
        sel.innerHTML=buildPaidByOptions().map(function(o){return '<option value="'+esc(o[0])+'"'+(o[0]===pid?' selected':'')+'>'+esc(o[1])+'</option>';}).join('');
        drawSplit();
      }
      sel.dataset.prevValue=sel.value;
      syncPay();
    }
  });

  if(!ex){var first=$('input:not([type=hidden]),select',f);if(first&&window.matchMedia('(min-width:700px)').matches)first.focus();}
}

/* Alta de persona: antes se congelan los "todos por igual" viejos (sin splitWith) con quienes estaban,
   y después se pregunta en cuáles entra la nueva. */
var pendingJoin=[];
function freezeEqual(){
  var ids=allPeople().map(function(p){return p.id;}).join(',');
  ['transports','lodging','expenses'].forEach(function(k){live(k).forEach(function(x){
    if((x.split||'equal')==='equal'&&!x.splitWith&&(parseFloat(x.amount)||0)>0)upsert(k,x.id,{split:'equal',splitWith:ids});
  });});
}
function addPerson(name){
  freezeEqual();
  var pid=upsert('people',null,{name:name,c:Date.now()});
  pendingJoin.push(pid);
  return pid;
}
function askJoin(){
  if(!pendingJoin.length||!$('#sheet').hidden)return;
  var pid=pendingJoin.shift(),nm=nameOf(pid);
  var list=nm?costs().filter(function(c){return c.split==='equal'&&splitIds(c).indexOf(pid)<0;}):[];
  if(!list.length){askJoin();return;}
  var panel=openSheet('¿'+nm+' entra en gastos anteriores?','<p class="hint">Estos gastos ya estaban cargados y se dividían entre todos los que había. Tildá los que también le tocan a '+esc(nm)+'. Los que no tildes quedan como estaban.</p>'
    +'<div class="row" style="margin-bottom:10px"><button type="button" class="ghost" id="jall" style="padding:6px 12px;font-size:13px">Tildar todos</button></div>'
    +'<div class="stack">'+list.map(function(c){return '<label class="pkchk"><input type="checkbox" data-join="'+c.src+'|'+c.id+'"><span>'+esc(c.title)+' · '+money(c.amount,c.cur)+(c.date?' · '+esc(fShort(c.date)):'')+'</span></label>';}).join('')+'</div>'
    +'<div class="acts" style="margin-top:14px"><button type="button" class="ghost" data-close>Ninguno</button><button type="button" class="primary" id="jok">Listo</button></div>');
  $('#jall',panel).addEventListener('click',function(){Array.prototype.forEach.call(panel.querySelectorAll('[data-join]'),function(c){c.checked=true;});});
  $('#jok',panel).addEventListener('click',function(){
    Array.prototype.forEach.call(panel.querySelectorAll('[data-join]:checked'),function(c){
      var kk=c.getAttribute('data-join').split('|'),it=S[kk[0]].find(function(x){return x.id===kk[1];});
      if(it&&splitIds(it).indexOf(pid)<0)upsert(kk[0],kk[1],{splitWith:splitIds(it).concat([pid]).join(',')});
    });
    closeSheet();
  });
}
/* Organizador: la cuenta que creó el viaje (trip.owner). En viajes anteriores a este dato, quien esté
   vinculado a la primera persona de la lista (y queda anotado como organizador). */
function isOrganizer(){
  if(!cloudMode()||AUTH!=='in'||!ME)return false;
  if(S.trip.owner)return S.trip.owner===ME.uid;
  var first=allPeople()[0];
  return !!(first&&CLAIMS[first.id]&&CLAIMS[first.id].uid===ME.uid);
}
function maybeAdoptOwner(){
  if(S.trip.owner||!S.trip.setup||!isOrganizer())return;
  S.trip.owner=ME.uid;S.trip.u=nextU(S.trip.u);save();pushTrip({owner:ME.uid});
}
/* Cambio "de sistema" sobre un ítem (no es una edición de la persona): ra marca que no genera aviso. */
function sysUpdate(k,id,data){
  var i=S[k].findIndex(function(x){return x.id===id;});if(i<0)return;
  var u=nextU(S[k][i].u);S[k][i]=Object.assign({},S[k][i],data,{u:u,ra:u});save();pushItem(k,S[k][i]);
}
/* Desvincular: la persona se vuelve a crear con otro id y se le pasan gastos, repartos y pagos (el balance
   no cambia). El vínculo viejo queda apuntando a una persona borrada, así que la cuenta que la había
   tomado tiene que volver a elegir; y la mochila vieja queda con el id viejo, sellada: nadie que tome la
   persona nueva puede leerla. */
function unlinkPerson(oldId){
  var old=allPeople().find(function(p){return p.id===oldId;});if(!old)return '';
  freezeEqual();   /* los "todos por igual" viejos pasan a nombrar a cada uno, así se puede reemplazar el id */
  var nid=upsert('people',null,{name:old.name,c:old.c<1e15?old.c:Date.now()});
  var rep=function(id){return id===oldId?nid:id;};
  ['transports','lodging','expenses'].forEach(function(k){S[k].slice().forEach(function(x){
    var ch={};
    if(x.paidBy===oldId)ch.paidBy=nid;
    if(x.split===oldId)ch.split=nid;
    if(splitIds(x).indexOf(oldId)>=0)ch.splitWith=splitIds(x).map(rep).join(',');
    if(Array.isArray(x.shares)&&x.shares.some(function(s){return s.p===oldId;}))ch.shares=x.shares.map(function(s){return Object.assign({},s,{p:rep(s.p)});});
    if(Object.keys(ch).length)sysUpdate(k,x.id,ch);
  });});
  S.payments.slice().forEach(function(x){var ch={};if(x.from===oldId)ch.from=nid;if(x.to===oldId)ch.to=nid;if(Object.keys(ch).length)sysUpdate('payments',x.id,ch);});
  savePerson(oldId,{});remove('people',oldId);
  return nid;
}
function peopleUsed(id){if(live('payments').some(function(x){return x.from===id||x.to===id;}))return true;return costs().some(function(c){return c.paidBy===id||c.split===id||((c.split==='some'||c.split==='equal')&&(splitIds(c).indexOf(id)>=0||(c.split==='equal'&&!c.splitWith)))||(c.split==='amounts'&&c.shares.some(function(x){return x.p===id&&(parseFloat(x.a)||0)>0;}));});}
/* Los p1/p2 de viajes viejos pueden no estar todavía en `people`: se crean con su mismo id. */
function savePerson(id,data){
  if(S.people.some(function(x){return x.id===id}))return upsert('people',id,data);
  var lp=legacyPeople().find(function(x){return x.id===id});
  return upsert('people',null,Object.assign({id:id,name:lp?lp.name:'',c:lp?lp.c:Date.now()},data));
}
function pplBlock(){
  var ppl=allPeople(),org=isOrganizer();
  return '<div class="sideSec" id="pplWrap"><h3>Personas del viaje</h3><p class="hint">Pueden ser una o varias. Para cambiar un nombre, tocalo y escribí.'
   +(org?' Como organizás el viaje, podés desvincular a una persona si la eligió la cuenta equivocada.':'')+'</p><div class="attlist">'
   +(ppl.length?ppl.map(function(p){
      var cl=cloudMode()?CLAIMS[p.id]:null;
      return '<div class="pplrow">'+dot(p.id)+'<input type="text" data-pname="'+esc(p.id)+'" value="'+esc(p.name)+'" aria-label="Nombre" autocomplete="off">'
       +(cl?'<small title="Vinculada a una cuenta de Google">🔗 '+esc(cl.name||'cuenta')+'</small>':'')
       +(cl&&org&&cl.uid!==ME.uid?'<button type="button" class="ghost" data-unlink="'+esc(p.id)+'" style="padding:3px 9px;font-size:12px;flex:none">Desvincular</button>':'')
       +'<button type="button" class="x" data-pdel="'+esc(p.id)+'" aria-label="Quitar a '+esc(p.name)+'">✕</button></div>';
    }).join(''):'<p class="nada">'+(cloudMode()&&ME?'Al guardar, quedás vos'+(ME.name?' ('+esc(ME.name)+')':'')+' como primera persona. Después podés sumar a los demás.':'Todavía no hay nadie.')+'</p>')
   +'</div><form class="pplform"><input type="text" data-pnew placeholder="Nombre" autocomplete="off" required><button type="submit" class="ghost">+ Agregar persona</button></form><p class="msg" data-pplmsg></p></div>';
}
function bindPeople(panel){
  function redraw(msg,err){var w=$('#pplWrap',panel);if(w)w.outerHTML=pplBlock();var m=$('[data-pplmsg]',panel);if(m&&msg){m.textContent=msg;m.className='msg'+(err?' err':'');}renderHead();}
  panel.addEventListener('change',function(e){
    var inp=e.target.closest('[data-pname]');if(!inp)return;
    var nm=inp.value.trim(),id=inp.getAttribute('data-pname');
    if(!nm){inp.value=nameOf(id);return;}
    if(nm!==nameOf(id)){savePerson(id,{name:nm});renderHead();}
  });
  panel.addEventListener('click',function(e){
    var ub=e.target.closest('[data-unlink]');
    if(ub){
      var uid0=ub.getAttribute('data-unlink'),unm=nameOf(uid0),who=(CLAIMS[uid0]||{}).name||'otra cuenta';
      if(!isOrganizer())return;
      if(!ub.classList.contains('armed')){ub.classList.add('armed');ub.textContent='¿Seguro?';redraw('Si desvinculás a '+unm+', la cuenta «'+who+'» deja de ser '+unm+' y la persona queda libre para que la elija su cuenta. Sus gastos y pagos no cambian. Lo que había en su mochila queda guardado aparte y no lo ve nadie más. Tocá de nuevo para confirmar.');var again=$('[data-unlink="'+uid0+'"]',panel);if(again){again.classList.add('armed');again.textContent='¿Seguro?';}return;}
      unlinkPerson(uid0);
      redraw('Listo: '+unm+' quedó libre para que la elija su cuenta.');
      return;
    }
    var b=e.target.closest('[data-pdel]');if(!b)return;
    var id=b.getAttribute('data-pdel'),nm=nameOf(id);
    if(peopleUsed(id)){redraw('No se puede quitar a '+nm+': participa de gastos (pagó alguno o le toca una parte). Sacalo de esos gastos primero.',true);return;}
    if(!b.classList.contains('armed')){b.classList.add('armed');b.textContent='¿Quitar?';return;}
    savePerson(id,{});remove('people',id);
    if(cloudMode()&&myClaim===id)releaseClaim();
    if(!cloudMode()&&getWhoAmI()===id)setWhoAmI('');
    redraw();
  });
  panel.addEventListener('submit',function(e){
    var f=e.target.closest('.pplform');if(!f)return;
    e.preventDefault();
    var nm=$('[data-pnew]',f).value.trim();if(!nm)return;
    addPerson(nm);
    redraw();var n=$('[data-pnew]',panel);if(n)n.focus();
  });
}
/* Categorías propias del viaje (S.trip.cats = [{name,icon}]), además de las fijas de CATS. Se editan en
   Ajustes y se guardan con "Guardar". */
function catsBlockHtml(list){
  return '<div class="sideSec" id="catsWrap"><h3>Categorías de gastos propias</h3><p class="hint" style="margin:0 0 8px">Además de las de siempre, podés sumar las que use este viaje (por ejemplo "Nafta del auto" o "Regalos").</p>'
   +'<div class="row" style="gap:6px;margin-bottom:8px">'+(list.length?list.map(function(c,i){return '<span class="chip">'+esc(c.icon||'🏷️')+' '+esc(c.name)+'<button type="button" class="x" data-catdel="'+i+'" aria-label="Quitar '+esc(c.name)+'" style="border:0;background:none;color:var(--muted);padding:0 0 0 4px">✕</button></span>';}).join(''):'<span class="nada" style="padding:0">Ninguna todavía.</span>')+'</div>'
   +'<div class="pplform" style="margin-top:0"><input type="text" id="catIcon" maxlength="4" placeholder="🏷️" aria-label="Emoji" style="flex:none;width:56px;text-align:center"><input type="text" id="catName" maxlength="30" placeholder="Nombre de la categoría" autocomplete="off"><button type="button" class="ghost" id="catAdd">+ Agregar</button></div><p class="msg err" id="catMsg" style="margin:4px 0 0"></p></div>';
}
function bindCats(panel,list){
  function redraw(){var w=$('#catsWrap',panel);if(w)w.outerHTML=catsBlockHtml(list);}
  panel.addEventListener('click',function(e){
    var d=e.target.closest('[data-catdel]');if(d){list.splice(+d.getAttribute('data-catdel'),1);redraw();return;}
    if(!e.target.closest('#catAdd'))return;
    var nm=$('#catName',panel).value.trim().slice(0,30),ic=$('#catIcon',panel).value.replace(/[<>&"'`]/g,'').trim().slice(0,4)||'🏷️',msg=$('#catMsg',panel);
    if(!nm){msg.textContent='Poné un nombre.';return;}
    if(catAll()[nm]||list.some(function(c){return c.name.toLowerCase()===nm.toLowerCase();})){msg.textContent='Esa categoría ya existe.';return;}
    list.push({name:nm,icon:ic});redraw();
  });
}
function openSettings(){
  var t=S.trip,first=!t.setup,cats=tripCats().filter(function(c){return c&&c.name;}).map(function(c){return {name:String(c.name).slice(0,30),icon:String(c.icon||'🏷️').slice(0,4)};});
  sheetForm({title:t.setup?'Ajustes del viaje':'Armemos el viaje',noFocus:false,values:{name:t.name,start:t.start,end:t.end,base:t.base,daily:t.daily||'',budget:t.budget||'',info:t.info||''},
    fields:[
      {k:'name',l:'Nombre del viaje',t:'text',ph:'Ej: Bariloche 2026'},
      {k:'_city',t:'html',html:cityFieldHtml(t.city)},
      {k:'start',l:'Desde',t:'date',half:true},
      {k:'end',l:'Hasta',t:'date',half:true},
      {k:'base',l:'Moneda para los totales',t:'text',list:'curs',half:true,ph:'ARS'},
      {k:'daily',l:'Presupuesto diario (opcional)',t:'number',half:true,ph:'0'},
      {k:'budget',l:'Presupuesto total del viaje (opcional)',t:'number',half:true,ph:'0'},
      {k:'info',l:'Info útil (seguro de viaje, contacto de emergencia, dirección del alojamiento…)',t:'textarea',ph:'Lo que quieran tener a mano aunque no haya señal'}
    ],
    intro:shareBlockHtml(),
    extra:'<hr>'+pplBlock()+'<hr>'+catsBlockHtml(cats),
    onReady:function(panel){bindShareBlock(panel);bindPeople(panel);bindCityField(panel);bindCats(panel,cats);},
    validate:function(d){
      if(d.start&&d.end&&d.end<d.start)return 'La fecha "Hasta" es anterior a "Desde". Revisá las fechas del viaje.';
      var q=$('#cityQ');if(!d.cityJson&&q&&q.value.trim()&&!q.closest('[hidden]'))return 'Elegí la ciudad principal de la lista (o dejala vacía).';
      return '';
    },
    onSave:function(d){
      var nb=curCode(d.base,'ARS'),newBase=nb!==base();
      if(newBase)S.trip.rates={};
      var patch={name:d.name||'Nuestro viaje',start:d.start||'',end:d.end||'',base:nb,daily:parseFloat(d.daily)||0,budget:parseFloat(d.budget)||0,info:d.info||'',setup:true};
      if(first&&cloudMode()&&ME&&!S.trip.owner)patch.owner=ME.uid;   /* quien arma el viaje lo organiza */
      var city=null;try{city=cleanCity(JSON.parse(d.cityJson||'null'));}catch(e){}
      patch.city=city;
      patch.cats=cats;
      Object.assign(S.trip,patch,{u:nextU(S.trip.u)});
      save();pushTrip(newBase||first?null:patch);   /* moneda nueva o viaje nuevo: el viaje entero */
      /* Quien arma un viaje nuevo en la nube queda como su primera persona, ya vinculada a su cuenta. */
      if(first&&cloudMode()&&ME&&!myClaim&&!allPeople().length)claimPerson(upsert('people',null,{name:ME.name||'Yo',c:Date.now()}));
    }});
}
