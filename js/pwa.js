/* PWA: service worker (abre sin señal), botón "Instalar app" y avisos del sistema. */
'use strict';
var ASSET_V=(function(){var s=document.querySelector('script[src*="js/core.js"]');var m=s&&/[?&]v=([^&]+)/.exec(s.src);return m?m[1]:'0';})();
var installEvt=null;
var isStandalone=function(){return (window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;};
var isIOS=function(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);};
function syncInstallBtn(){var b=$('#installBtn');if(b)b.hidden=isStandalone()||!(installEvt||isIOS());}
if('serviceWorker' in navigator){
  window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js?v='+encodeURIComponent(ASSET_V)).catch(function(){});});
}
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();installEvt=e;syncInstallBtn();});
window.addEventListener('appinstalled',function(){installEvt=null;syncInstallBtn();});
function installApp(){
  if(installEvt){installEvt.prompt();installEvt.userChoice.finally(function(){installEvt=null;syncInstallBtn();});return;}
  openSheet('Instalar la app','<p class="hint">En iPhone o iPad, desde <b>Safari</b>:</p><ol style="margin:0 0 12px;padding-left:20px;line-height:1.7">'
   +'<li>Tocá el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li><li>Elegí <b>Agregar a inicio</b>.</li><li>Tocá <b>Agregar</b>.</li></ol>'
   +'<p class="hint">Queda como una app más, abre sin la barra del navegador y funciona sin señal. La primera vez que la abras desde el ícono vas a tener que entrar con Google de nuevo.</p>');
}
/* Avisos del sistema: con service worker funcionan también en Android (new Notification no). */
function showSysNotification(title,body,tag){
  try{
    if(navigator.serviceWorker&&navigator.serviceWorker.controller){navigator.serviceWorker.ready.then(function(r){r.showNotification(title,{body:body,tag:tag,icon:'icons/icon-192.png',badge:'icons/icon-192.png'});});return;}
    new Notification(title,{body:body,tag:tag,icon:'icons/icon-192.png'});
  }catch(e){}
}
syncInstallBtn();
