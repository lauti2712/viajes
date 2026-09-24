/* Mapa de mis viajes (en el perfil): un pin por viaje en su ciudad principal. Leaflet + mapas de
   OpenStreetMap; se carga recién al abrir el perfil. */
'use strict';
var LEAF_JS='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',LEAF_CSS='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',leafP=null;
function loadLeaflet(){
  if(window.L)return Promise.resolve(window.L);
  if(!leafP)leafP=new Promise(function(ok,fail){
    var l=document.createElement('link');l.rel='stylesheet';l.href=LEAF_CSS;l.integrity='sha384-c6Rcwz4e4CITMbu/NBmnNS8yN2sC3cUElMEMfP3vqqKFp7GOYaaBBCqmaWBjmkjb';l.crossOrigin='anonymous';document.head.appendChild(l);
    var s=document.createElement('script');s.src=LEAF_JS;s.integrity='sha384-NElt3Op+9NBMCYaef5HxeJmU4Xeard/Lku8ek6hoPTvYkQPh3zLIrJP7KiRocsxO';s.crossOrigin='anonymous';
    s.onload=function(){ok(window.L);};s.onerror=function(){leafP=null;fail(new Error('No se pudo cargar el mapa.'));};document.head.appendChild(s);
  });
  return leafP;
}
function isDark(){var t=document.documentElement.getAttribute('data-theme');return t?t==='dark':!!(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);}
function tripsWithCity(){
  var list=MYTRIPS.map(function(t){return {code:t.code,name:t.name,start:t.start,end:t.end,city:cleanCity(t.city)};});
  if(CODE&&cleanCity(S.trip.city)){var cur=list.find(function(t){return t.code===CODE;});var mine={code:CODE,name:S.trip.name,start:S.trip.start,end:S.trip.end,city:cleanCity(S.trip.city)};if(cur)Object.assign(cur,mine);else list.push(mine);}
  return list.filter(function(t){return t.city;});
}
function mapSectionHtml(){return '<section class="psec"><h3 style="margin-bottom:8px">Mapa de mis viajes</h3><div id="tripmap" class="tripmap"><p class="nada" style="padding:12px">Cargando mapa…</p></div><small class="hint" id="mapmsg" style="margin:6px 0 0;display:block"></small></section>';}
function drawTripMap(panel){
  var box=$('#tripmap',panel),msg=$('#mapmsg',panel);if(!box)return;
  var trips=tripsWithCity();
  if(!trips.length){box.innerHTML='<p class="nada" style="padding:12px">Cuando elijas la ciudad principal de tus viajes (en ⚙️ Ajustes), aparecen acá.</p>';return;}
  loadLeaflet().then(function(L){
    box.innerHTML='';
    var map=L.map(box,{zoomControl:true,attributionControl:true,scrollWheelZoom:false});
    /* Mapas de OpenStreetMap (gratis, con atribución); en tema oscuro se oscurecen con un filtro. */
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);
    box.classList.toggle('dark',isDark());
    var pts=[];
    /* Viajes en la misma ciudad comparten un pin con la lista. */
    var byPlace={};trips.forEach(function(t){var k=t.city.lat+','+t.city.lng;(byPlace[k]=byPlace[k]||[]).push(t);});
    Object.keys(byPlace).forEach(function(k){
      var g=byPlace[k],c=g[0].city,here=g.some(function(t){return t.code===CODE;});
      var icon=L.divIcon({className:'',html:'<span class="mpin'+(here?' here':'')+'">'+(g.length>1?g.length:'')+'</span>',iconSize:[26,26],iconAnchor:[13,26],popupAnchor:[0,-24]});
      var html='<div class="mpop"><b>'+flagOf(c.cc)+' '+esc(c.name)+'</b>'+g.map(function(t){
        var f=t.start?fShort(t.start)+(t.end?' al '+fShort(t.end):''):'';
        return '<div class="mpt"><span>'+esc(t.name||'Viaje')+(f?'<small>'+esc(f)+'</small>':'')+'</span>'+(t.code===CODE?'<em>Estás acá</em>':'<button type="button" class="ghost sm" data-act="gotrip" data-code="'+esc(t.code)+'">Abrir</button>')+'</div>';
      }).join('')+'</div>';
      L.marker([c.lat,c.lng],{icon:icon,title:c.name}).addTo(map).bindPopup(html);
      pts.push([c.lat,c.lng]);
    });
    if(pts.length===1)map.setView(pts[0],6);else map.fitBounds(pts,{padding:[30,30],maxZoom:7});
    setTimeout(function(){map.invalidateSize();},200);
    var sin=MYTRIPS.filter(function(t){return !cleanCity(t.city)&&t.code!==CODE;}).length+(CODE&&!cleanCity(S.trip.city)?1:0);
    msg.textContent=sin?(sin===1?'1 viaje todavía no tiene ciudad elegida.':sin+' viajes todavía no tienen ciudad elegida.'):'';
  }).catch(function(e){box.innerHTML='<p class="nada" style="padding:12px">'+esc(e.message)+' ¿Sin señal?</p>';});
}
