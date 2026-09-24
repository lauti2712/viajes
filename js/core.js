/* Utilidades, tema, código del viaje y estado local */
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
/* Solo links http(s): evita que un dato cargado por otro meta un javascript: en un href. */
var safeUrl=function(u){u=String(u||'').trim();return /^https?:\/\//i.test(u)?u:''};
var uid=function(){return Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4)};
var LS='viaje-de-a-dos:v1';
var THEME_KEY='viaje-de-a-dos:theme';
function getTheme(){try{return localStorage.getItem(THEME_KEY)||'';}catch(e){return '';}}
function themeLabel(){var t=getTheme();return t==='light'?'☀️ Claro':(t==='dark'?'🌙 Oscuro':'🌓 Automático');}
function setTheme(t){
  try{if(t)localStorage.setItem(THEME_KEY,t);else localStorage.removeItem(THEME_KEY);}catch(e){}
  if(t)document.documentElement.setAttribute('data-theme',t);else document.documentElement.removeAttribute('data-theme');
  var b=$('#themeBtn');if(b)b.textContent=themeLabel();
}
function cycleTheme(){var t=getTheme();setTheme(t===''?'light':(t==='light'?'dark':''));}

var CODE_KEY='viaje-de-a-dos:code',MODE_KEY='viaje-de-a-dos:mode';
var CODE='',LOCAL_ONLY=false,FB=null,syncState='';
try{CODE=localStorage.getItem(CODE_KEY)||'';LOCAL_ONLY=localStorage.getItem(MODE_KEY)==='local';}catch(e){}
var ITEM_KEYS=['transports','lodging','expenses','plans','packing','people','payments'];
/* En la nube la mochila vive en su propia colección (trips/{code}/packing), privada por reglas. */
var CLOUD_KEYS=ITEM_KEYS.filter(function(k){return k!=='packing'});
var cloudMode=function(){return !!(FIREBASE_CONFIG.apiKey&&CODE&&!LOCAL_ONLY)};

var TYPES={vuelo:['✈️','Vuelo'],bus:['🚌','Micro / bus'],tren:['🚆','Tren'],barco:['⛴️','Barco'],auto:['🚗','Auto alquilado'],traslado:['🚕','Traslado'],otro:['🧭','Otro']};
var CATS={'Comida':'🍽️','Transporte local':'🚇','Actividades':'🎟️','Compras':'🛍️','Salud':'💊','Otros':'📌'};
var ITYPES={paseo:['🚶','Paseo'],comida:['🍽️','Comida'],excursion:['🗺️','Excursión'],tramite:['📄','Trámite'],descanso:['🛌','Descanso'],otro:['📌','Otro']};

/* ---------- Estado ---------- */
function blank(){return {v:1,trip:{name:'Nuestro viaje',start:'',end:'',base:'ARS',rates:{},ratesUpdatedAt:0,dollarType:'blue',daily:0,budget:0,info:'',setup:false,u:0},transports:[],lodging:[],expenses:[],plans:[],packing:[],people:[],payments:[]};}
var arr=function(a){return Array.isArray(a)?a.filter(function(x){return x&&x.id}):[]};
function fix(o){var b=blank();o=o||{};var t=Object.assign(b.trip,o.trip||{});t.rates=Object.assign({},(o.trip&&o.trip.rates)||{});return {v:1,trip:t,transports:arr(o.transports),lodging:arr(o.lodging),expenses:arr(o.expenses),plans:arr(o.plans),packing:arr(o.packing),people:arr(o.people),payments:arr(o.payments)};}
var S=blank();
try{var raw=localStorage.getItem(LS);if(raw)S=fix(JSON.parse(raw));}catch(e){}
function save(){try{localStorage.setItem(LS,JSON.stringify(S));}catch(e){}}
try{
  var qp=(new URLSearchParams(location.search).get('t')||'').toLowerCase();
  if(qp&&FIREBASE_CONFIG.apiKey&&/^[a-z0-9]{12,40}$/.test(qp)){
    /* Link de otro viaje: arranca limpio (antes, un viaje "solo local" se subía mezclado con el compartido). */
    if(CODE!==qp){S=blank();save();}
    CODE=qp;LOCAL_ONLY=false;
    localStorage.setItem(CODE_KEY,CODE);localStorage.removeItem(MODE_KEY);
    history.replaceState(null,'',location.pathname);
  }
  if(new URLSearchParams(location.search).has('v'))history.replaceState(null,'',location.pathname);
}catch(e){}
var live=function(k){return S[k].filter(function(x){return !x.del})};
function upsert(k,id,data){var now=Date.now(),i=id?S[k].findIndex(function(x){return x.id===id}):-1,it;if(i>=0){it=S[k][i]=Object.assign({},S[k][i],data,{u:now});}else{it=Object.assign({id:uid(),u:now},data);S[k].push(it);}save();pushItem(k,it);return it.id;}
function remove(k,id){var x=S[k].find(function(y){return y.id===id});if(x){x.del=true;x.u=Date.now();save();pushItem(k,x);}}
