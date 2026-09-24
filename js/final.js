/* Resumen final del viaje: para imprimir/guardar como PDF, Excel (CSV) y texto para WhatsApp. */
'use strict';
function finalData(){
  var ppl=allPeople(),cs=costs(),b=settleUp(),parts={},paid={},sent={},recv={};
  ppl.forEach(function(p){parts[p.id]=0;paid[p.id]=0;sent[p.id]=0;recv[p.id]=0;});
  live('payments').forEach(function(x){var v=toBase(parseFloat(x.amount)||0,x.cur);if(v==null)return;if(x.from in sent)sent[x.from]+=v;if(x.to in recv)recv[x.to]+=v;});
  cs.forEach(function(c){
    var v=toBase(c.amount,c.cur);if(v==null)return;
    var sm=shareMap(c,v);Object.keys(sm).forEach(function(id){if(id in parts)parts[id]+=sm[id];});
    if(c.status==='pagado'&&c.paidBy in paid)paid[c.paidBy]+=v;
  });
  var total=sumBase(cs);
  return {ppl:ppl,sent:sent,recv:recv,cs:cs.slice().sort(function(x,y){return (x.date||'').localeCompare(y.date||'');}),parts:parts,paid:paid,net:b.net,total:total,
    transfers:settlements().list,payments:live('payments').slice().sort(function(x,y){return (x.date||'').localeCompare(y.date||'');})};
}
function tripDates(){return S.trip.start?fShort(S.trip.start)+(S.trip.end?' al '+fShort(S.trip.end):''):'';}
function xferLabel(d,id){var o=[];if(d.sent[id]>0.5)o.push('ya devolvió '+money(d.sent[id]));if(d.recv[id]>0.5)o.push('ya recibió '+money(d.recv[id]));return o.join(', ');}
function netLabel(v){return v>0.5?'le deben '+money(v):v<-0.5?'debe '+money(-v):'a mano';}

function finalText(){
  var d=finalData(),L=[];
  L.push('*'+(S.trip.name||'Nuestro viaje')+'*'+(tripDates()?' ('+tripDates()+')':''));
  L.push('Total del viaje: '+money(d.total.t));
  if(d.ppl.length>1){
    L.push('','*Cada uno*');
    d.ppl.forEach(function(p){var x=xferLabel(d,p.id);L.push('• '+p.name+': pagó '+money(d.paid[p.id])+', le toca '+money(d.parts[p.id])+(x?', '+x:'')+' → '+netLabel(d.net[p.id]||0));});
    L.push('','*Para quedar a mano*');
    if(!d.transfers.length)L.push('Están a mano 🎉');
    d.transfers.forEach(function(x){var c=cobroOf(x.toId);L.push('• '+x.from+' → '+x.to+': '+money(x.amt)+(c.length?' (alias '+c.map(function(y){return y.a;}).join(' / ')+')':''));});
  }
  if(d.total.miss.size)L.push('','Ojo: falta el tipo de cambio de '+Array.from(d.total.miss).join(', ')+'.');
  return L.join('\n');
}
/* CSV para Excel en español: separador ; y coma decimal, con BOM para que respete los acentos. */
function finalCsv(){
  var d=finalData(),num=function(n){return n==null?'':(Math.round(n*100)/100).toString().replace('.',',');};
  var q=function(v){v=String(v==null?'':v);return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
  var rows=[['Fecha','Tipo','Qué','Categoría','Pagó','Estado','Forma de pago','Monto','Moneda','Monto en '+base(),'Reparto'].concat(d.ppl.map(function(p){return 'Le toca a '+p.name;}))];
  var tipos={expenses:'Gasto',transports:'Transporte',lodging:'Alojamiento'};
  d.cs.forEach(function(c){
    var v=toBase(c.amount,c.cur),sm=v==null?{}:shareMap(c,v);
    rows.push([c.date,tipos[c.src],c.title,c.cat,nameOf(c.paidBy),c.status==='pagado'?'Pagado':'Por pagar',c.method,num(c.amount),c.cur,num(v),splitLabel(c)||'Todos por igual'].concat(d.ppl.map(function(p){return num(sm[p.id]||0);})));
  });
  rows.push([]);rows.push(['Persona','Pagó','Le toca','Devolvió','Recibió','Saldo']);
  d.ppl.forEach(function(p){rows.push([p.name,num(d.paid[p.id]),num(d.parts[p.id]),num(d.sent[p.id]),num(d.recv[p.id]),num(d.net[p.id]||0)]);});
  if(d.payments.length){rows.push([]);rows.push(['Pagos entre ustedes','De','A','Monto','Moneda']);d.payments.forEach(function(x){rows.push([x.date,nameOf(x.from),nameOf(x.to),num(parseFloat(x.amount)||0),x.cur]);});}
  if(d.transfers.length){rows.push([]);rows.push(['Para quedar a mano','De','A','Monto en '+base()]);d.transfers.forEach(function(x){rows.push(['',x.from,x.to,num(x.amt)]);});}
  return '﻿'+rows.map(function(r){return r.map(q).join(';');}).join('\r\n');
}
function finalHtml(){
  var d=finalData(),h='<h1>'+esc(S.trip.name||'Nuestro viaje')+'</h1><p class="rsub">'+esc(tripDates())+(tripDates()?' · ':'')+d.ppl.map(function(p){return esc(p.name);}).join(', ')+' · generado el '+esc(new Date().toLocaleDateString('es-AR'))+'</p>';
  h+='<h2>Total del viaje: '+money(d.total.t)+'</h2>';
  if(d.ppl.length>1){
    var anyX=d.payments.length>0;
    h+='<table><thead><tr><th>Persona</th><th>Pagó</th><th>Le toca</th>'+(anyX?'<th>Pagos entre ustedes</th>':'')+'<th>Saldo</th></tr></thead><tbody>'+d.ppl.map(function(p){var n=d.net[p.id]||0;return '<tr><td>'+esc(p.name)+'</td><td>'+money(d.paid[p.id])+'</td><td>'+money(d.parts[p.id])+'</td>'+(anyX?'<td>'+esc(xferLabel(d,p.id)||'—')+'</td>':'')+'<td>'+esc(netLabel(n))+'</td></tr>';}).join('')+'</tbody></table>';
    h+='<h2>Para quedar a mano</h2>'+(d.transfers.length?'<ul>'+d.transfers.map(function(x){var c=cobroOf(x.toId);return '<li><b>'+esc(x.from)+'</b> le transfiere <b>'+money(x.amt)+'</b> a <b>'+esc(x.to)+'</b>'+(c.length?' (alias '+esc(c.map(function(y){return y.a;}).join(' / '))+')':'')+'</li>';}).join('')+'</ul>':'<p>Están a mano.</p>');
  }
  if(d.payments.length)h+='<h2>Pagos entre ustedes</h2><ul>'+d.payments.map(function(x){return '<li>'+esc(fShort(x.date)||'')+' · '+esc(nameOf(x.from))+' le pagó '+money(parseFloat(x.amount)||0,x.cur)+' a '+esc(nameOf(x.to))+'</li>';}).join('')+'</ul>';
  h+='<h2>Todos los gastos</h2><table><thead><tr><th>Fecha</th><th>Qué</th><th>Pagó</th><th>Reparto</th><th class="r">Monto</th></tr></thead><tbody>'+d.cs.map(function(c){return '<tr><td>'+esc(fShort(c.date)||'—')+'</td><td>'+esc(c.title)+'<br><small>'+esc(c.cat)+(c.status!=='pagado'?' · por pagar':'')+'</small></td><td>'+esc(nameOf(c.paidBy)||'—')+'</td><td>'+esc(splitLabel(c)||'Todos')+'</td><td class="r">'+money(c.amount,c.cur)+'</td></tr>';}).join('')+'</tbody></table>';
  if(d.total.miss.size)h+='<p>Ojo: falta el tipo de cambio de '+esc(Array.from(d.total.miss).join(', '))+'.</p>';
  return h;
}
function openFinal(){
  var panel=openSheet('Resumen final','<p class="hint">Todo el viaje en un lugar: cuánto puso y cuánto le toca a cada uno, las transferencias para quedar a mano, los pagos entre ustedes y la lista de gastos.</p>'
   +'<div class="stack"><button type="button" class="primary" id="fprint">📄 Ver / guardar como PDF</button><button type="button" class="ghost" id="fcsv">📊 Descargar Excel (CSV)</button><button type="button" class="ghost" id="ftext">💬 Copiar resumen para WhatsApp</button>'
   +(navigator.share?'<button type="button" class="ghost" id="fshare">📤 Compartir…</button>':'')+'</div><p class="msg" id="fmsg" role="status"></p>'
   +'<label class="fld" style="margin-top:10px"><span>Vista previa del texto</span><textarea class="box" id="ftxt" rows="8" readonly></textarea></label>');
  var txt=finalText();$('#ftxt',panel).value=txt;
  var msg=$('#fmsg',panel),say=function(t){msg.textContent=t;};
  $('#fprint',panel).addEventListener('click',function(){
    var pa=$('#printArea');pa.innerHTML=finalHtml();
    say('En la ventana de impresión elegí "Guardar como PDF".');
    setTimeout(function(){window.print();},50);
  });
  $('#fcsv',panel).addEventListener('click',function(){
    var name=(S.trip.name||'viaje').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g,'').trim().replace(/\s+/g,'-')+'.csv';
    downloadFile(name,finalCsv(),'text/csv;charset=utf-8');say('Listo: se descargó '+name+'.');
  });
  $('#ftext',panel).addEventListener('click',function(){
    var ta=$('#ftxt',panel),ok=function(){say('Copiado. Pegalo en el grupo.');};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(ok).catch(function(){ta.select();try{document.execCommand('copy');ok();}catch(e){say('Seleccioná el texto y copialo a mano.');}});
    else{ta.select();try{document.execCommand('copy');ok();}catch(e){say('Seleccioná el texto y copialo a mano.');}}
  });
  var sh=$('#fshare',panel);if(sh)sh.addEventListener('click',function(){navigator.share({title:S.trip.name||'Viaje',text:txt}).catch(function(){});});
}
