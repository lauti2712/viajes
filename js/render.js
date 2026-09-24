/* Armado de la pantalla: encabezado, pestañas, pantalla de login y aviso "quién sos" */
'use strict';
var VIEWS={resumen:vResumen,transportes:vTransportes,alojamiento:vAlojamiento,gastos:vGastos,itinerario:vItinerario,mochila:vMochila,pagos:vPagos};

/* Íconos del encabezado (trazo, toman el color del texto). */
var ICON={
  bell:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  gear:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  sun:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  moon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  auto:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/></svg>',
  user:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
};
function initialOf(n){n=String(n||'').trim();return n?esc(n.charAt(0).toUpperCase()):'';}
/* El estado de sincronización solo se muestra si hay algo que avisar. */
var SYNC_SHOW=['offline','err','denied','local'];
function renderHead(){
  var logged=!!(ME&&AUTH==='in'),home=homeMode(),t=getTheme();
  var tb=$('#themeBtn');tb.innerHTML=ICON[t==='light'?'sun':t==='dark'?'moon':'auto'];tb.setAttribute('aria-label','Tema: '+themeLabel().replace(/^\S+\s/,''));tb.title=tb.getAttribute('aria-label');
  var sb=$('#setBtn');sb.innerHTML=ICON.gear;sb.hidden=home||gated();
  var bb=$('#bellBtn'),n=cloudMode()&&logged?avisosCount():0;bb.hidden=!(cloudMode()&&logged);bb.innerHTML=ICON.bell+(n?'<b class="badge">'+n+'</b>':'');bb.setAttribute('aria-label',n?n+' avisos nuevos':'Avisos');
  var pb=$('#profileBtn');pb.hidden=!((cloudMode()||home)&&logged);pb.innerHTML=logged&&ME.name?'<span class="avatar">'+initialOf(ME.name)+'</span>':ICON.user;
  $('#who2').innerHTML=SYNC_SHOW.indexOf(syncState==='connecting'&&navigator.onLine===false?'offline':syncState)>=0?syncChip():'';
  if(home){$('#title').textContent='Mis viajes';$('#when').innerHTML='';document.title='Mis viajes';return;}
  $('#title').textContent=S.trip.name||'Nuestro viaje';
  var s=pd(S.trip.start),e=pd(S.trip.end),w='';
  if(!s){w='<span>Sin fechas todavía</span>';}
  else{
    var d=dayDiff(pd(today()),s),st='';
    if(d>0)st=d===1?'Falta 1 día':'Faltan '+d+' días';
    else if(e&&dayDiff(pd(today()),e)>=0)st='Día '+(1-d)+' de '+(dayDiff(s,e)+1);
    else if(e)st='Viaje terminado';
    else st='Ya empezó';
    w='<span>'+esc(fShort(S.trip.start))+(e?' al '+esc(fShort(S.trip.end)):'')+'</span><span class="sep" aria-hidden="true">·</span><b>'+st+'</b>';
  }
  var cy=cleanCity(S.trip.city);if(cy)w='<span>📍 '+esc(cy.name)+'</span><span class="sep" aria-hidden="true">·</span>'+w;
  $('#when').innerHTML=w;
  document.title=(S.trip.name||'Nuestro viaje');
}
/* Perfil: la cuenta, sus viajes, sus formas de pago, instalar la app y salir. */
function openProfile(){
  if(!ME)return;
  var h='<div class="prof"><span class="avatar lg">'+initialOf(ME.name)+'</span><div><b>'+esc(ME.name||'Tu cuenta')+'</b><small>'+esc(ME.email||'')+'</small></div></div>';
  if(!homeMode())h+='<section class="psec"><div class="bar"><h3>Mis viajes</h3><button type="button" class="ghost sm" data-act="newtrip">+ Nuevo</button></div><div id="tripsl">'+tripsListHtml()+'</div></section>';
  h+=mapSectionHtml();
  h+='<section class="psec"><div class="bar"><h3>Formas de pago</h3><button type="button" class="ghost sm" data-act="addmethod">+ Agregar</button></div>'
   +(METHODS.length?METHODS.map(function(m){var ty=mtype(m);return '<div class="exp" role="button" tabindex="0" data-act="editmethod" data-id="'+esc(m.id)+'" style="grid-template-columns:34px 1fr"><span class="ec" aria-hidden="true">'+ty[0]+'</span><div class="et"><b>'+esc(methodLabel(m))+'</b><small><span>'+esc(ty[1])+'</span>'+(m.alias&&m.share?'<span>Alias visible: '+esc(m.alias)+'</span>':'')+'</small></div></div>';}).join('')
     :'<p class="nada">Todavía no cargaste ninguna. Sirven para elegir con qué pagaste cada gasto y para que te paguen a tu alias.</p>')
   +(cloudMode()?'<div class="row" style="margin-top:10px"><button type="button" class="ghost" data-act="gopagos">💳 Ver mis pagos y resúmenes de tarjeta</button></div>':'')+'</section>';
  h+='<section class="psec"><h3 style="margin-bottom:8px">Preferencias</h3><label class="pkchk"><input type="checkbox" data-pref="showWeather"'+(PREFS.showWeather!==false?' checked':'')+'><span>Mostrar el clima en el itinerario</span></label></section>';
  if(typeof isStandalone==='function'&&!isStandalone()&&(installEvt||isIOS()))h+='<section class="psec"><button type="button" class="ghost" data-act="install">📲 Instalar la app en este dispositivo</button></section>';
  h+='<section class="psec"><button type="button" class="danger" data-act="logout">Salir de la cuenta</button></section>';
  var panel=openSheet('Mi perfil',h);
  drawTripMap(panel);
  formRefresh=function(){var w=$('#tripsl',panel);if(w)w.innerHTML=tripsListHtml();};
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
  if(tab==='pagos'&&!canPay)tab='itinerario';   /* Mis pagos se abre desde el perfil */
  $('#main').innerHTML=whoBanner()+VIEWS[tab]();
  Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(b){if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
}
