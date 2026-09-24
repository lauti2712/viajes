/* Copia de seguridad, unir datos y compartir el viaje */
'use strict';
/* ---------- Descargas (solo dentro de Claude) ---------- */
var DL=null;
try{if(window.claude&&typeof window.claude.use==='function'){window.claude.use('downloads').then(function(x){DL=x}).catch(function(){});}}catch(e){}

function mergeIn(inc){
  inc=fix(inc);
  ITEM_KEYS.forEach(function(k){
    var map=new Map(S[k].map(function(x){return [x.id,x]}));
    inc[k].forEach(function(x){var c=map.get(x.id);if(!c||(x.u||0)>(c.u||0))map.set(x.id,x);});
    S[k]=Array.from(map.values());
  });
  if(!S.trip.setup||(inc.trip.u||0)>(S.trip.u||0)){var r=Object.assign({},inc.trip.rates,S.trip.rates);S.trip=Object.assign({},inc.trip);S.trip.rates=Object.assign({},r,inc.trip.rates);}
  else{S.trip.rates=Object.assign({},inc.trip.rates,S.trip.rates);}
  save();pushAll();
}
/* ---------- Compartir / copia ---------- */
function downloadFile(name,text,type){var a=document.createElement('a'),u=URL.createObjectURL(new Blob([text],{type:type||'application/json'}));a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},1000);}
function openSync(){
  var json=JSON.stringify(S),cloud='';
  if(!FIREBASE_CONFIG.apiKey)cloud='<p class="hint">La nube no está activada: falta pegar la configuración de Firebase en el archivo. Mientras tanto, los datos se guardan solo en este dispositivo.</p>';
  else if(CODE)cloud='<p class="hint">El viaje se sincroniza en tiempo real. Pasale este link a quien viaje con vos. Quien lo tenga puede ver y editar el viaje.</p><label class="fld"><span>Link del viaje</span><input class="box" id="lnk" readonly></label><div class="row"><button type="button" class="primary" id="cplnk">Copiar link</button></div>';
  else cloud='<p class="hint">Ahora los datos están solo en este dispositivo.</p><div class="row"><button type="button" class="primary" id="goconnect">Conectar a la nube</button></div>';
  var panel=openSheet('Compartir datos',cloud+'<hr><h3 style="margin-bottom:8px">Copia de seguridad</h3><p class="hint">Podés guardar o pasar una copia de los datos a mano. Al sumar una copia se agrega lo nuevo y, si algo está en los dos lados, queda lo último que se editó.</p>'
   +'<div class="stack"><label class="fld"><span>Tus datos</span><textarea class="box" id="out" rows="3" readonly></textarea></label>'
   +'<div class="row"><button type="button" class="primary" id="cp">Copiar datos</button><button type="button" class="ghost" id="dl">Descargar archivo</button></div>'
   +'<label class="fld"><span>Recibir datos</span><textarea class="box" id="inp" rows="3" placeholder="Pegá acá los datos"></textarea></label>'
   +'<div class="row"><button type="button" class="primary" id="mg">Sumar a mi viaje</button><button type="button" class="ghost" id="pick">Elegir archivo</button><input type="file" id="fi" accept=".json,application/json,text/plain" hidden></div>'
   +'<p class="msg" id="msg" role="status"></p><hr><div class="row"><button type="button" class="danger" id="wipe"></button></div></div>');
  var out=$('#out',panel),msg=$('#msg',panel);
  out.value=json;
  var say=function(t,err){msg.textContent=t;msg.className='msg'+(err?' err':'')};
  var copy=function(text,src,okMsg){
    var ok=function(){say(okMsg)},fail=function(){say('No se pudo copiar. Seleccioná el texto y copialo a mano.',true)};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(ok).catch(function(){src.select();try{document.execCommand('copy');ok();}catch(e){fail();}});}
    else{src.select();try{document.execCommand('copy');ok();}catch(e){fail();}}
  };
  var lnk=$('#lnk',panel);
  if(lnk){lnk.value=location.origin+location.pathname+'?t='+CODE;$('#cplnk',panel).addEventListener('click',function(){copy(lnk.value,lnk,'Link copiado. Mandáselo a quien viaje con vos.')});}
  var gc=$('#goconnect',panel);if(gc)gc.addEventListener('click',function(){try{localStorage.removeItem(MODE_KEY);}catch(e){}openConnect();});
  $('#cp',panel).addEventListener('click',function(){copy(json,out,'Copiado.')});
  $('#dl',panel).addEventListener('click',function(){
    if(DL){DL.save({filename:'viaje.json',data:json}).then(function(){say('Archivo guardado.')}).catch(function(e){if(!e||e.code!=='declined')say('No se pudo guardar el archivo.',true)});}
    else downloadFile('viaje.json',json);
  });
  function doMerge(text){
    try{var o=JSON.parse(text);if(!o||typeof o!=='object'||!o.trip)throw new Error('x');mergeIn(o);say('Listo, se sumaron los datos.');out.value=JSON.stringify(S);json=out.value;renderHead();}
    catch(e){say('Eso no parece un dato de viaje válido. Revisá que esté copiado completo.',true);}
  }
  $('#mg',panel).addEventListener('click',function(){var v=$('#inp',panel).value.trim();if(!v){say('Pegá primero los datos.',true);return;}doMerge(v);});
  $('#pick',panel).addEventListener('click',function(){$('#fi',panel).click()});
  $('#fi',panel).addEventListener('change',function(e){var f=e.target.files&&e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){doMerge(String(r.result||''))};r.readAsText(f);});
  var wipe=$('#wipe',panel);
  wipe.textContent=CODE?'Salir de este viaje':'Borrar todo el viaje';
  wipe.addEventListener('click',function(){
    if(!wipe.classList.contains('armed')){wipe.classList.add('armed');wipe.textContent=CODE?'¿Seguro? Los datos siguen en la nube. Tocá de nuevo':'¿Seguro? Se borra todo. Tocá de nuevo';return;}
    if(CODE){try{localStorage.removeItem(LS);}catch(e){}setCode('');location.href=location.pathname;}
    else{S=blank();save();closeSheet();openSettings();}
  });
}
