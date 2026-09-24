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
function wxSummary(){
  var r=wxRange();if(!r)return '';
  var ds=Object.keys(WX.days);
  var head='<div class="wxbox"><b>'+flagOf(r.c.cc)+' '+esc(r.c.name)+'</b>';
  if(WX.state==='loading')return head+' <span class="hint" style="margin:0">Buscando el clima…</span></div>';
  if(!ds.length)return head+'</div>';
  var mx=Math.round(ds.reduce(function(t,d){return t+WX.days[d].max;},0)/ds.length),mn=Math.round(ds.reduce(function(t,d){return t+WX.days[d].min;},0)/ds.length);
  var txt=WX.kind==='fc'?'Pronóstico: máximas de '+mx+'° y mínimas de '+mn+'° en promedio.':WX.kind==='typ'?'Clima típico para esas fechas: máximas de ~'+mx+'° y mínimas de ~'+mn+'°. Cuando falten 16 días aparece el pronóstico.':'Hizo máximas de '+mx+'° y mínimas de '+mn+'° en promedio.';
  return head+' <span class="hint" style="margin:0">'+txt+'</span></div>';
}
