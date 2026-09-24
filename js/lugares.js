/* Ciudad principal del viaje: se elige de una lista (buscadores gratuitos, sin clave) y se guarda validada con país y coordenadas en trip.city = {name, admin, country, cc, lat, lng}. */
'use strict';
function flagOf(cc){cc=String(cc||'').toUpperCase();return /^[A-Z]{2}$/.test(cc)?String.fromCodePoint(0x1F1E6+cc.charCodeAt(0)-65,0x1F1E6+cc.charCodeAt(1)-65):'';}
function cityLabel(c,short){if(!c||!c.name)return '';return c.name+(short?'':(c.admin&&c.admin!==c.name?', '+c.admin:'')+(c.country?', '+c.country:''));}
function validCity(c){return !!(c&&typeof c==='object'&&c.name&&isFinite(+c.lat)&&isFinite(+c.lng)&&Math.abs(+c.lat)<=90&&Math.abs(+c.lng)<=180);}
function cleanCity(c){return validCity(c)?{name:String(c.name).slice(0,80),admin:String(c.admin||'').slice(0,80),country:String(c.country||'').slice(0,60),cc:/^[A-Za-z]{2}$/.test(c.cc||'')?String(c.cc).toUpperCase():'',lat:+(+c.lat).toFixed(4),lng:+(+c.lng).toFixed(4)}:null;}
/* Se combinan dos buscadores gratuitos: Open-Meteo acierta con ciudades grandes (trae población) y Photon
   (OpenStreetMap) encuentra por cualquier palabra del nombre ("iguaz" -> Puerto Iguazú). Primero van las
   ciudades de más de 20.000 habitantes, después lo de Photon (con prioridad a Sudamérica) y el resto. */
async function searchCities(q){
  var enc=encodeURIComponent(q);
  var om=fetch('https://geocoding-api.open-meteo.com/v1/search?count=8&language=es&format=json&name='+enc).then(function(r){return r.json();}).then(function(j){
    return (j.results||[]).map(function(x){var c=cleanCity({name:x.name,admin:x.admin1,country:x.country,cc:x.country_code,lat:x.latitude,lng:x.longitude});if(c)c._pop=+x.population||0;return c;}).filter(Boolean);
  }).catch(function(){return [];});
  var ph=fetch('https://photon.komoot.io/api/?limit=6&layer=city&lat=-30&lon=-60&q='+enc).then(function(r){return r.json();}).then(function(j){
    return (j.features||[]).map(function(f){var p=f.properties||{},g=(f.geometry||{}).coordinates||[];return cleanCity({name:p.name,admin:p.state,country:p.country,cc:p.countrycode,lat:g[1],lng:g[0]});}).filter(Boolean);
  }).catch(function(){return [];});
  var res=await Promise.all([om,ph]),omr=res[0],phr=res[1];
  var SA=['AR','BR','UY','CL','PY','BO','PE','CO','EC','VE'];
  phr.sort(function(a,b){return (SA.indexOf(b.cc)>=0)-(SA.indexOf(a.cc)>=0);});   /* primero Sudamérica */
  var big=omr.filter(function(c){return c._pop>=20000;}).sort(function(a,b){return b._pop-a._pop;});
  var rest=omr.filter(function(c){return c._pop>0&&c._pop<20000;}).sort(function(a,b){return b._pop-a._pop;});
  var out=[];
  big.concat(phr,rest).forEach(function(c){
    /* repetidos: misma ciudad a menos de ~15 km */
    if(out.some(function(o){return Math.abs(o.lat-c.lat)<0.15&&Math.abs(o.lng-c.lng)<0.15;}))return;
    delete c._pop;out.push(c);
  });
  return out.slice(0,6);
}
/* Campo de Ajustes: buscador con lista; lo elegido va en un input oculto (cityJson). */
function cityFieldHtml(c){
  c=cleanCity(c);
  return '<div class="fld" id="cityFld"><span>Ciudad principal del viaje</span>'
   +'<div class="cityPick"'+(c?'':' hidden')+'><b>'+(c?flagOf(c.cc)+' '+esc(cityLabel(c)):'')+'</b><button type="button" class="ghost sm" id="cityChange">Cambiar</button></div>'
   +'<div class="citySearch"'+(c?' hidden':'')+'><input type="text" id="cityQ" placeholder="Ej: Puerto Iguazú" autocomplete="off" aria-label="Buscar ciudad"><div class="cityList" id="cityList" role="listbox"></div><small class="hint" id="cityMsg" style="margin:0">Escribí y elegí de la lista: así queda en el mapa y trae el clima.</small></div>'
   +'<input type="hidden" name="cityJson" value="'+esc(c?JSON.stringify(c):'')+'"></div>';
}
function bindCityField(panel){
  var q=$('#cityQ',panel),list=$('#cityList',panel),hid=panel.querySelector('[name=cityJson]'),msg=$('#cityMsg',panel),tmr=null,results=[],seq=0;
  if(!q)return;
  function pick(c){hid.value=JSON.stringify(c);$('.cityPick b',panel).textContent=flagOf(c.cc)+' '+cityLabel(c);$('.cityPick',panel).hidden=false;$('.citySearch',panel).hidden=true;list.innerHTML='';}
  $('#cityChange',panel).addEventListener('click',function(){hid.value='';$('.cityPick',panel).hidden=true;$('.citySearch',panel).hidden=false;q.value='';q.focus();});
  q.addEventListener('input',function(){
    clearTimeout(tmr);var v=q.value.trim();
    if(v.length<2){list.innerHTML='';return;}
    tmr=setTimeout(function(){
      var my=++seq;msg.textContent='Buscando…';
      searchCities(v).then(function(r){if(my!==seq)return;results=r;
        list.innerHTML=r.length?r.map(function(c,i){return '<button type="button" class="cityOpt" data-ci="'+i+'">'+flagOf(c.cc)+' <b>'+esc(c.name)+'</b> <small>'+esc([c.admin,c.country].filter(Boolean).join(', '))+'</small></button>';}).join(''):'<p class="nada">No encontré esa ciudad. Probá escribiéndola de otra forma.</p>';
        msg.textContent='Elegí de la lista.';
      }).catch(function(){if(my===seq)msg.textContent='No se pudo buscar (¿sin señal?). Probá de nuevo.';});
    },300);
  });
  list.addEventListener('click',function(e){var b=e.target.closest('[data-ci]');if(b)pick(results[+b.getAttribute('data-ci')]);});
}
