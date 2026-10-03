/* Clima de cada día del viaje en su ciudad principal (Open-Meteo, gratis y sin clave).
   Hasta 16 días adelante: pronóstico. Más lejos: clima típico de esas fechas (promedio de los últimos
   3 años). Viajes ya pasados: lo que hubo. Se guarda en el dispositivo para no pedirlo en cada pantalla. */
'use strict';
var WX={key:'',days:{},kind:'',state:''};
var WMO=function(c){c=+c;return c===0?['☀️','Despejado']:c<=2?['🌤️','Algo nublado']:c===3?['☁️','Nublado']:c<=48?['🌫️','Niebla']:c<=57?['🌦️','Llovizna']:c<=67?['🌧️','Lluvia']:c<=77?['🌨️','Nieve']:c<=82?['🌧️','Chaparrones']:c<=86?['🌨️','Nieve']:['⛈️','Tormenta'];};
function wxRange(){
  var c=cleanCity(S.trip.city),s=pd(S.trip.start),e=pd(S.trip.end)||s;
  if(!c||!s||!e||dayDiff(s,e)<0||dayDiff(s,e)>60)return null;
  return {c:c,start:S.trip.start,end:S.trip.end||S.trip.start};
}
function loadWeather(){
  var r=wxRange();if(!r){WX={key:'',days:{},kind:'',state:''};return;}
  var key=[r.c.lat,r.c.lng,r.start,r.end].join('|');
  if(WX.key===key&&WX.state)return;
  WX={key:key,days:{},kind:'',state:'loading'};
  try{var cached=JSON.parse(localStorage.getItem('viaje-de-a-dos:wx')||'{}')[key];if(cached&&Date.now()-cached.t<(cached.kind==='fc'?3*3600e3:7*864e5)){WX={key:key,days:cached.days,kind:cached.kind,state:'ok'};return;}}catch(e){}
  var t=pd(today()),ds=dayDiff(t,pd(r.start)),de=dayDiff(t,pd(r.end)),q='latitude='+r.c.lat+'&longitude='+r.c.lng+'&timezone=auto&daily=weather_code,temperature_2m_max,temperature_2m_min';
  var job;
  if(de<=15&&ds>=-80)job=fetch('https://api.open-meteo.com/v1/forecast?'+q+',precipitation_probability_max&start_date='+r.start+'&end_date='+r.end).then(function(x){return x.json();}).then(function(j){return {kind:'fc',days:toDays(j,'precipitation_probability_max')};});
  else if(de<-5)job=fetch('https://archive-api.open-meteo.com/v1/archive?'+q+',precipitation_sum&start_date='+r.start+'&end_date='+r.end).then(function(x){return x.json();}).then(function(j){return {kind:'past',days:toDays(j,'precipitation_sum')};});
  else{
    /* Clima típico: mismas fechas de los 3 años anteriores, promediadas. */
    var y0=pd(r.start).getFullYear(),reqs=[1,2,3].map(function(k){
      var sh=function(d){return (+d.slice(0,4)-k)+d.slice(4);};
      return fetch('https://archive-api.open-meteo.com/v1/archive?'+q+',precipitation_sum&start_date='+sh(r.start)+'&end_date='+sh(r.end)).then(function(x){return x.json();}).then(function(j){return toDays(j,'precipitation_sum',k);}).catch(function(){return {};});
    });
    job=Promise.all(reqs).then(function(all){
      var days={};
      Object.keys(all[0]||{}).forEach(function(d){
        var v=all.map(function(a){return a[d];}).filter(Boolean);if(!v.length)return;
        var avg=function(f){return v.reduce(function(t,x){return t+x[f];},0)/v.length;};
        var rainy=v.filter(function(x){return x.pp>=1;}).length;
        var clear=v.filter(function(x){return x.code<=2;}).length;
        /* Ícono típico: lluvia si llovió la mayoría de los años; si no, sol o nubes según lo más común. */
        days[d]={max:avg('max'),min:avg('min'),pp:Math.round(rainy/v.length*100),code:rainy/v.length>=0.5?61:(clear>=v.length/2?1:3)};
      });
      return {kind:'typ',days:days};
    });
  }
  job.then(function(res){
    if(WX.key!==key)return;
    WX={key:key,days:res.days,kind:res.kind,state:'ok'};
    try{var all=JSON.parse(localStorage.getItem('viaje-de-a-dos:wx')||'{}');all[key]={t:Date.now(),days:res.days,kind:res.kind};var ks=Object.keys(all);if(ks.length>20)delete all[ks[0]];localStorage.setItem('viaje-de-a-dos:wx',JSON.stringify(all));}catch(e){}
    render();
  }).catch(function(){if(WX.key===key)WX.state='err';});
}
/* Pasa la respuesta diaria a {fecha: {max,min,code,pp}}; `yearsBack` corre las fechas al año del viaje. */
function toDays(j,ppField,yearsBack){
  var d=j&&j.daily,out={};if(!d||!d.time)return out;
  d.time.forEach(function(t,i){
    var k=yearsBack?(+t.slice(0,4)+yearsBack)+t.slice(4):t;
    if(d.temperature_2m_max[i]==null)return;
    out[k]={max:+d.temperature_2m_max[i],min:+d.temperature_2m_min[i],code:+d.weather_code[i],pp:+(d[ppField]&&d[ppField][i])||0};
  });
  return out;
}
function wxChip(date){
  var w=WX.days[date];if(!w)return '';
  var typ=WX.kind==='typ',ic=WMO(w.code);
  var rain=WX.kind==='fc'?(w.pp>=30?' · 💧'+Math.round(w.pp)+'%':''):WX.kind==='typ'?(w.pp>=50?' · 💧 suele llover':''):(w.pp>=1?' · 💧 llovió':'');
  return '<span class="wx" title="'+esc(ic[1])+(typ?' (clima típico)':'')+'">'+ic[0]+' '+(typ?'~':'')+Math.round(w.max)+'°/'+Math.round(w.min)+'°'+rain+'</span>';
}
/* Texto del clima de todo el viaje (promedio de los días). */
function wxTripText(){
  var ds=Object.keys(WX.days);if(!ds.length)return WX.state==='loading'?'Buscando el clima del viaje…':'';
  var mx=Math.round(ds.reduce(function(t,d){return t+WX.days[d].max;},0)/ds.length),mn=Math.round(ds.reduce(function(t,d){return t+WX.days[d].min;},0)/ds.length);
  return WX.kind==='fc'?'Pronóstico: máximas de '+mx+'° y mínimas de '+mn+'° en promedio.':WX.kind==='typ'?'Clima típico para esas fechas: máximas de ~'+mx+'° y mínimas de ~'+mn+'°. Cuando falten 16 días aparece el pronóstico.':'Hizo máximas de '+mx+'° y mínimas de '+mn+'° en promedio.';
}

/* ---------- Clima de ahora (ciudad del viaje) ----------
   Open-Meteo: ahora + próximas horas + 7 días. Se guarda 30 min en el dispositivo. */
var WXN={key:'',state:'',d:null};
function loadNow(force){
  var c=cleanCity(S.trip.city);if(!c){WXN={key:'',state:'',d:null};return;}
  var key=c.lat+','+c.lng;
  if(!force&&WXN.key===key&&WXN.state)return;
  try{var ca=JSON.parse(localStorage.getItem('viaje-de-a-dos:wxnow')||'{}');if(!force&&ca.key===key&&Date.now()-ca.t<30*60e3){WXN={key:key,state:'ok',d:ca.d};return;}}catch(e){}
  WXN={key:key,state:'loading',d:WXN.key===key?WXN.d:null};
  fetch('https://api.open-meteo.com/v1/forecast?latitude='+c.lat+'&longitude='+c.lng+'&timezone=auto&forecast_days=7'
    +'&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day'
    +'&hourly=temperature_2m,weather_code,precipitation_probability'
    +'&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset')
  .then(function(r){return r.json();}).then(function(j){
    if(WXN.key!==key||!j||!j.current)throw 0;
    var now=j.current.time,H=j.hourly||{},D=j.daily||{},hours=[],days=[];
    (H.time||[]).forEach(function(t,i){if(t.slice(0,13)>=now.slice(0,13)&&hours.length<24)hours.push({t:t,temp:H.temperature_2m[i],code:H.weather_code[i],pp:H.precipitation_probability?H.precipitation_probability[i]:0});});
    (D.time||[]).forEach(function(t,i){days.push({d:t,max:D.temperature_2m_max[i],min:D.temperature_2m_min[i],code:D.weather_code[i],pp:D.precipitation_probability_max?D.precipitation_probability_max[i]:0,sr:(D.sunrise||[])[i]||'',ss:(D.sunset||[])[i]||''});});
    /* de noche (entre la puesta y la salida del sol) los despejados van con luna */
    hours.forEach(function(x){var dy=days.find(function(y){return y.d===x.t.slice(0,10);});x.day=dy&&dy.sr?(x.t>=dy.sr&&x.t<dy.ss?1:0):1;});
    var d={cur:{t:now,temp:j.current.temperature_2m,feels:j.current.apparent_temperature,hum:j.current.relative_humidity_2m,wind:j.current.wind_speed_10m,code:j.current.weather_code,day:j.current.is_day},hours:hours,days:days};
    WXN={key:key,state:'ok',d:d};
    try{localStorage.setItem('viaje-de-a-dos:wxnow',JSON.stringify({key:key,t:Date.now(),d:d}));}catch(e){}
    render();if(formRefresh)formRefresh();
  }).catch(function(){if(WXN.key===key){WXN.state='err';if(formRefresh)formRefresh();}});
}
var wxIcon=function(code,day){var ic=WMO(code);return day===0&&+code<=2?['🌙',ic[1]]:ic;};
/* Chip del renglón del itinerario: el clima de ahora; tocarlo abre el detalle. */
function wxNowChip(){
  var c=cleanCity(S.trip.city);if(!c)return '';
  loadNow();
  var cur=WXN.d&&WXN.d.cur,ic=cur?wxIcon(cur.code,cur.day):null;
  return '<button type="button" class="wxnow" data-act="wxopen" aria-label="Clima en '+esc(c.name)+(cur?': '+Math.round(cur.temp)+' grados, '+esc(ic[1]):'')+'">'+(cur?'<span>'+ic[0]+'</span><b>'+Math.round(cur.temp)+'°</b>':'<span>🌡️</span><b>…</b>')+'</button>';
}
function wxDetailHtml(){
  var c=cleanCity(S.trip.city);if(!c)return '<p class="nada">Elegí la ciudad principal del viaje en Ajustes para ver el clima.</p>';
  var d=WXN.d,h='<p class="hint">'+flagOf(c.cc)+' '+esc(cityLabel(c))+'</p>';
  if(!d)return h+'<p class="nada">'+(WXN.state==='err'?'No se pudo traer el clima (¿sin señal?).':'Buscando el clima…')+'</p>';
  var cu=d.cur,ic=wxIcon(cu.code,cu.day),t0=d.days[0];
  h+='<div class="wxcur"><span class="big">'+ic[0]+'</span><div><b>'+Math.round(cu.temp)+'°</b><span>'+esc(ic[1])+'</span></div><ul>'
    +'<li>Sensación <b>'+Math.round(cu.feels)+'°</b></li><li>Humedad <b>'+Math.round(cu.hum)+'%</b></li><li>Viento <b>'+Math.round(cu.wind)+' km/h</b></li>'
    +(t0&&t0.sr?'<li>🌅 '+esc(hh(tm(t0.sr)))+' · 🌇 '+esc(hh(tm(t0.ss)))+'</li>':'')+'</ul></div>';
  h+='<h3 class="mb6">Próximas horas</h3><div class="wxhours">'+d.hours.map(function(x,i){var hi=wxIcon(x.code,x.day);return '<div><small>'+(i?esc(hh(tm(x.t))):'Ahora')+'</small><span>'+hi[0]+'</span><b>'+Math.round(x.temp)+'°</b>'+(x.pp>=20?'<small class="pp">💧'+Math.round(x.pp)+'%</small>':'<small class="pp"></small>')+'</div>';}).join('')+'</div>';
  h+='<h3 class="mb6 mt14">Próximos días</h3><div class="wxdays">'+d.days.map(function(x,i){var di=WMO(x.code),dd=pd(x.d);return '<div><span class="dn">'+(i===0?'Hoy':i===1?'Mañana':esc(cap(dd.toLocaleDateString('es-AR',{weekday:'short',day:'numeric'}).replace('.',''))))+'</span><span>'+di[0]+'</span><span class="pp">'+(x.pp>=20?'💧'+Math.round(x.pp)+'%':'')+'</span><b>'+Math.round(x.max)+'°</b><small>'+Math.round(x.min)+'°</small></div>';}).join('')+'</div>';
  var tt=wxRange()?wxTripText():'';
  if(tt)h+='<h3 class="mb6 mt14">Durante el viaje</h3><p class="hint">'+esc(tt)+'</p>';
  h+='<label class="pkchk mt10"><input type="checkbox" data-pref="showWeather"'+(PREFS.showWeather!==false?' checked':'')+'><span>Mostrar el clima de cada día en el itinerario</span></label>';
  return h;
}
function openWeather(){
  var c=cleanCity(S.trip.city);
  var panel=openSheet('Clima'+(c?' en '+c.name:''),'<div id="wxd">'+wxDetailHtml()+'</div>');
  formRefresh=function(){var w=$('#wxd',panel);if(w)w.innerHTML=wxDetailHtml();};
  if(c&&(!WXN.d||WXN.state!=='loading'))loadNow(WXN.state==='ok'&&WXN.d&&Date.now()-Date.parse(WXN.d.cur.t)>30*60e3);
}
