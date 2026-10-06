/* Compartir el viaje (link) y descargas */
'use strict';
function downloadFile(name,text,type){var a=document.createElement('a'),u=URL.createObjectURL(new Blob([text],{type:type||'application/json'}));a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},1000);}
function tripLink(){return location.origin+location.pathname+'?t='+CODE;}
/* Bloque de arriba de Ajustes: el link del viaje para pasárselo a los demás. */
function shareBlockHtml(){
  if(cloudMode())return '<div class="shareBox"><h3 class="mb4">Compartir el viaje</h3><p class="mb8 hint">Pasale este link a quien viaje con vos: entra con su cuenta de Google y ve todo en tiempo real.</p>'
    +'<div class="row"><input class="box" id="lnk" readonly value="'+esc(tripLink())+'" aria-label="Link del viaje"><button type="button" class="primary" data-copy="'+esc(tripLink())+'">Copiar</button>'
    +(navigator.share?'<button type="button" class="ghost" id="shareLnk">Compartir</button>':'')+'</div></div><hr>';
  return '';
}
function bindShareBlock(panel){
  var sh=$('#shareLnk',panel);if(sh)sh.addEventListener('click',function(){navigator.share({title:S.trip.name||'Nuestro viaje',text:'Sumate al viaje "'+(S.trip.name||'Nuestro viaje')+'":',url:tripLink()}).catch(function(){});});
}
