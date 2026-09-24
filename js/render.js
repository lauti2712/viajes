/* Armado de la pantalla: encabezado, pestañas, pantalla de login y aviso "quién sos" */
'use strict';
var VIEWS={resumen:vResumen,transportes:vTransportes,alojamiento:vAlojamiento,gastos:vGastos,itinerario:vItinerario,mochila:vMochila,pagos:vPagos};

function renderHead(){
  if(homeMode()){$('#title').textContent='Mis viajes';$('#when').innerHTML='';$('#who2').innerHTML=syncChip();document.title='Mis viajes';var l0=$('#logoutBtn');if(l0){l0.hidden=!(ME&&AUTH==='in');if(ME)l0.textContent='Salir'+(ME.name?' ('+ME.name.split(' ')[0]+')':'');}var mt0=$('#tripsBtn');if(mt0)mt0.hidden=true;return;}
  $('#title').textContent=S.trip.name||'Nuestro viaje';
  var tb=$('#themeBtn');if(tb)tb.textContent=themeLabel();
  if(typeof syncInstallBtn==='function')syncInstallBtn();
  var mt=$('#tripsBtn');if(mt)mt.hidden=!(cloudMode()&&AUTH==='in');
  var bb=$('#bellBtn');if(bb){var n=cloudMode()&&AUTH==='in'?avisosCount():0;bb.hidden=!(cloudMode()&&AUTH==='in');bb.innerHTML='🔔'+(n?' <b class="badge">'+n+'</b>':'');bb.setAttribute('aria-label',n?n+' avisos nuevos':'Avisos');}
  var lo=$('#logoutBtn');if(lo){lo.hidden=!(ME&&AUTH==='in');if(ME)lo.textContent='Salir'+(ME.name?' ('+ME.name.split(' ')[0]+')':'');}
  $('#who2').innerHTML=(gated()?[]:allPeople()).map(function(p){return '<span class="chip">'+dot(p.id)+esc(p.name)+'</span>';}).join('')+syncChip();
  var s=pd(S.trip.start),e=pd(S.trip.end),w='';
  if(!s){w='<span>Sin fechas todavía</span>';}
  else{
    var d=dayDiff(pd(today()),s),st='';
    if(d>0)st=d===1?'Falta 1 día':'Faltan '+d+' días';
    else if(e&&dayDiff(pd(today()),e)>=0)st='Día '+(1-d)+' de '+(dayDiff(s,e)+1);
    else if(e)st='Viaje terminado';
    else st='Ya empezó';
    w='<span class="cal" aria-hidden="true">📅</span><span>'+esc(fShort(S.trip.start))+(e?' al '+esc(fShort(S.trip.end)):'')+'</span><b>'+st+'</b>';
  }
  $('#when').innerHTML=w;
  document.title=(S.trip.name||'Nuestro viaje');
}
/* Con nube hay que iniciar sesión con Google antes de ver el viaje. Si Firebase ni siquiera cargó
   (sin señal), AUTH queda 'offline' y se muestra lo guardado en el dispositivo. */
var loginMsg='';
/* Logueado pero sin elegir quién es en el viaje: sin eso no aparecen sus formas de pago ni su mochila. */
var whoLater=false;
function whoBanner(){
  if(!cloudMode()||AUTH!=='in'||!claimsLoaded||whoLater||tab==='mochila'||myPersonId())return '';
  var free=allPeople().filter(function(p){return !CLAIMS[p.id]||CLAIMS[p.id].uid===ME.uid;});
  return '<div class="infobox" style="border-left-color:var(--sun)"><h3>¿Quién sos en este viaje?</h3><p style="margin-bottom:10px">Elegilo una vez y queda vinculado a tu cuenta de Google: así los demás pueden elegir tus formas de pago al cargar un gasto, ven tu alias y tenés tu mochila.</p>'
   +'<div class="whopick" style="margin:0">'+free.map(function(p){return '<button type="button" class="primary" data-act="whoami" data-who="'+esc(p.id)+'">Soy '+esc(p.name)+'</button>';}).join('')
   +'<button type="button" class="ghost" data-tab="mochila">No estoy en la lista</button><button type="button" class="ghost" data-act="wholater">Ahora no</button></div>'+(claimMsg?'<p class="msg err">'+esc(claimMsg)+'</p>':'')+'</div>';
}
function gated(){return (cloudMode()||homeMode())&&(AUTH==='pending'||AUTH==='out');}
function vGate(){
  if(AUTH!=='out')return '<p class="sub" style="text-align:center;margin-top:30px">Cargando…</p>';
  return '<div class="gate"><h2>Entrá con Google</h2><p>'+(homeMode()?'Iniciá sesión con tu cuenta de Google para ver tus viajes o armar uno nuevo.':'Para ver y editar este viaje, iniciá sesión con tu cuenta de Google.')+'</p>'
   +'<button type="button" class="primary" data-act="login">Continuar con Google</button>'
   +(loginMsg?'<p class="msg err">'+esc(loginMsg)+'</p>':'')
   +'<p class="hint">Si abriste el link desde Instagram o Facebook y no te deja entrar, abrilo en Chrome o Safari.</p>'
   +(homeMode()?'<p class="hint"><button type="button" class="ghost" data-act="golocal" style="padding:5px 12px;font-size:13px">Usar sin cuenta, solo en este dispositivo</button></p>':'')+'</div>';
}
function render(){
  var g=gated();
  document.body.classList.toggle('gated',g);
  document.body.classList.toggle('home',homeMode());
  renderHead();
  if(g){$('#main').innerHTML=vGate();return;}
  if(homeMode()){$('#main').innerHTML=vHome();return;}
  var canPay=cloudMode()&&AUTH==='in';
  $('#tabPagos').hidden=!canPay;
  if(tab==='pagos'&&!canPay)tab='itinerario';
  $('#main').innerHTML=whoBanner()+VIEWS[tab]();
  Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(b){if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
}
