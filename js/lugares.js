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
   +'<div class="citySearch"'+(c?' hidden':'')+'><input type="text" id="cityQ" placeholder="Ej: Puerto Iguazú" autocomplete="off" aria-label="Buscar ciudad"><div class="cityList" id="cityList" role="listbox"></div><small class="m0 hint" id="cityMsg">Escribí y elegí de la lista: así queda en el mapa y trae el clima.</small></div>'
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

/* ---------- Dirección del alojamiento ----------
   Se busca en Photon (OpenStreetMap, gratis y sin clave), cerca de la ciudad del viaje. Lo elegido guarda
   también las coordenadas (addrLat/addrLng); si no aparece, se puede dejar escrita a mano igual. */
function addrLabel(p){
  var st=[p.street,p.housenumber].filter(Boolean).join(' '),place=p.city||p.town||p.village||p.locality||p.district||'';
  var first=p.name&&p.name!==p.street&&p.name!==place?p.name:'';
  return [first,st,place,p.state&&p.state!==place?p.state:'',p.country].filter(Boolean).join(', ');
}
async function searchAddress(q){
  var c=cleanCity(S.trip.city),bias=c?'&lat='+c.lat+'&lon='+c.lng:'&lat=-34&lon=-60';
  var j=await fetch('https://photon.komoot.io/api/?limit=8'+bias+'&q='+encodeURIComponent(q)).then(function(r){return r.json();});
  return (j.features||[]).map(function(f){var p=f.properties||{},g=(f.geometry||{}).coordinates||[];return {label:addrLabel(p),lat:+g[1],lng:+g[0]};})
    .filter(function(a){return a.label&&isFinite(a.lat)&&isFinite(a.lng);})
    .map(function(a){if(c)a._d=Math.pow(a.lat-c.lat,2)+Math.pow((a.lng-c.lng)*Math.cos(c.lat*Math.PI/180),2);return a;})
    /* con ciudad del viaje, primero lo más cerca (sin descartar lo lejano: un viaje puede pasar por varias ciudades) */
    .sort(function(x,y){return c?x._d-y._d:0;}).slice(0,6);
}
function mapsUrl(x,key){
  if(!x)return '';var txt=x[key||'address'];
  var la=parseFloat(x.addrLat),ln=parseFloat(x.addrLng);
  if(isFinite(la)&&isFinite(ln)&&Math.abs(la)<=90&&Math.abs(ln)<=180)return 'https://www.google.com/maps/search/?api=1&query='+la.toFixed(6)+','+ln.toFixed(6);
  return txt?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(txt):'';
}
function addrFieldHtml(v,key,label,ph){
  key=key||'address';
  var ok=isFinite(parseFloat(v.addrLat))&&v[key];
  return '<div class="fld" id="addrFld"><span>'+esc(label||'Dirección')+'</span><input type="text" name="'+key+'" value="'+esc(v[key]||'')+'" placeholder="'+esc(ph||'Calle y número, o nombre del lugar')+'" autocomplete="off">'
   +'<div class="cityList" id="addrList" role="listbox"></div>'
   +'<small class="m0 hint" id="addrMsg">'+(ok?'📍 Ubicación encontrada en el mapa.':'Escribí y elegí de la lista para que quede ubicada en el mapa.')+'</small>'
   +'<input type="hidden" name="addrLat" value="'+esc(v.addrLat||'')+'"><input type="hidden" name="addrLng" value="'+esc(v.addrLng||'')+'"></div>';
}
function bindAddrField(panel,key){
  var q=panel.querySelector('[name='+(key||'address')+']'),list=$('#addrList',panel),msg=$('#addrMsg',panel),la=panel.querySelector('[name=addrLat]'),ln=panel.querySelector('[name=addrLng]'),tmr=null,res=[],seq=0;
  if(!q)return;
  q.addEventListener('input',function(){
    la.value='';ln.value='';clearTimeout(tmr);
    var v=q.value.trim();
    if(v.length<4){list.innerHTML='';msg.textContent='Escribí y elegí de la lista para que quede ubicada en el mapa.';return;}
    tmr=setTimeout(function(){
      var my=++seq;msg.textContent='Buscando…';
      searchAddress(v).then(function(r){if(my!==seq)return;res=r;
        list.innerHTML=r.length?r.map(function(a,i){return '<button type="button" class="cityOpt" data-ai="'+i+'">📍 '+esc(a.label)+'</button>';}).join(''):'';
        msg.textContent=r.length?'Elegí de la lista (o dejala así, sin ubicar en el mapa).':'No la encontré. Podés dejarla escrita igual: se busca por el texto al abrir el mapa.';
      }).catch(function(){if(my===seq)msg.textContent='No se pudo buscar (¿sin señal?). Podés dejarla escrita igual.';});
    },400);
  });
  list.addEventListener('click',function(e){
    var b=e.target.closest('[data-ai]');if(!b)return;
    var a=res[+b.getAttribute('data-ai')];q.value=a.label;la.value=a.lat.toFixed(6);ln.value=a.lng.toFixed(6);list.innerHTML='';msg.textContent='📍 Ubicación encontrada en el mapa.';
  });
}
/* Link de la reserva: se muestra con el nombre de la plataforma. */
var BOOK_SITES=[['airbnb','Airbnb'],['booking.com','Booking'],['despegar','Despegar'],['expedia','Expedia'],['hotels.com','Hotels.com'],['vrbo','Vrbo'],['agoda','Agoda'],['hostelworld','Hostelworld'],['trivago','Trivago'],['tripadvisor','Tripadvisor'],['almundo','Almundo'],['turismocity','Turismocity'],['decolar','Decolar']];
function bookSite(u){
  u=safeUrl(u);if(!u)return '';
  var h='';try{h=new URL(u).hostname.replace(/^www\./,'');}catch(e){return '';}
  var s=BOOK_SITES.find(function(x){return h.indexOf(x[0])>=0;});
  return s?s[1]:h;
}
