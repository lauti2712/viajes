/* Calendario de mis viajes (en el perfil): un mes a la vez, cada viaje con su color.
   Tocar un día y después otro arma un viaje nuevo con esas fechas (un solo día: tocarlo dos veces). */
'use strict';
var CAL={y:0,m:0,a:'',b:''},NEWDATES_KEY='viaje-de-a-dos:newdates';
var MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function calTrips(){return MYTRIPS.filter(function(t){return pd(t.start);}).map(function(t,i){return {code:t.code,name:t.name||'Viaje sin nombre',start:t.start,end:pd(t.end)&&t.end>=t.start?t.end:t.start,c:'--p'+((i%8)+1)};});}
function calInit(){
  if(CAL.y)return;
  var d=new Date(),t=today(),next=calTrips().filter(function(x){return x.end>=t;}).sort(function(a,b){return a.start.localeCompare(b.start);})[0];
  if(next&&next.start>t)d=pd(next.start);   /* arranca en el mes del próximo viaje */
  CAL.y=d.getFullYear();CAL.m=d.getMonth();
}
function calHtml(){
  calInit();
  var trips=calTrips(),first=new Date(CAL.y,CAL.m,1),off=(first.getDay()+6)%7,days=new Date(CAL.y,CAL.m+1,0).getDate(),t=today();
  var lo=CAL.a&&CAL.b?(CAL.a<CAL.b?CAL.a:CAL.b):CAL.a,hi=CAL.a&&CAL.b?(CAL.a<CAL.b?CAL.b:CAL.a):CAL.a;
  var cells='';
  for(var i=0;i<off;i++)cells+='<span class="cd out"></span>';
  for(var n=1;n<=days;n++){
    var d=iso(new Date(CAL.y,CAL.m,n)),on=trips.filter(function(x){return x.start<=d&&d<=x.end;});
    var cls='cd'+(d===t?' today':'')+(lo&&d>=lo&&d<=hi?' sel':'')+(d===lo||d===hi?' edge':'');
    cells+='<button type="button" class="'+cls+'" data-day="'+d+'" aria-label="'+esc(fLong(d))+(on.length?': '+esc(on.map(function(x){return x.name;}).join(', ')):'')+'"><span>'+n+'</span>'
      +(on.length?'<i class="bars">'+on.slice(0,3).map(function(x){return '<b style="background:var('+x.c+')"'+(x.start===d?' class="s"':'')+(x.end===d?' data-e':'')+'></b>';}).join('')+'</i>':'')+'</button>';
  }
  var mStart=iso(first),mEnd=iso(new Date(CAL.y,CAL.m,days)),inMonth=trips.filter(function(x){return x.start<=mEnd&&x.end>=mStart;}).sort(function(a,b){return a.start.localeCompare(b.start);});
  var pick=CAL.a?'<div class="calnew"><span>'+(CAL.b?'Viaje nuevo del <b>'+esc(fShort(lo))+'</b> al <b>'+esc(fShort(hi))+'</b>':'Desde el <b>'+esc(fShort(CAL.a))+'</b>. Tocá el día de vuelta (o el mismo, si es de un día).')+'</span>'
    +(CAL.b?'<button type="button" class="primary sm" data-calnew>Crear viaje</button>':'')+'<button type="button" class="ghost sm" data-calx>Cancelar</button></div>':'';
  return '<section class="psec" id="calWrap"><div class="bar"><h3>Calendario</h3><div class="row g6"><button type="button" class="ghost sm" data-cal="-1" aria-label="Mes anterior">‹</button><button type="button" class="ghost sm" data-cal="0">'+esc(MESES[CAL.m])+' '+CAL.y+'</button><button type="button" class="ghost sm" data-cal="1" aria-label="Mes siguiente">›</button></div></div>'
    +'<div class="cal"><span class="dw">L</span><span class="dw">M</span><span class="dw">M</span><span class="dw">J</span><span class="dw">V</span><span class="dw">S</span><span class="dw">D</span>'+cells+'</div>'
    +pick
    +(inMonth.length?'<div class="calist">'+inMonth.map(function(x){return '<button type="button" class="ghost" data-act="gotrip" data-code="'+esc(x.code)+'"><i class="dot" style="background:var('+x.c+')"></i>'+esc(x.name)+' <small>'+esc(fShort(x.start)+(x.end!==x.start?' al '+fShort(x.end):''))+'</small>'+(x.code===CODE?' <small>· estás acá</small>':'')+'</button>';}).join('')+'</div>'
      :'<p class="nada">'+(CAL.a?'':'Sin viajes este mes. Tocá dos días para armar uno.')+'</p>')
    +'</section>';
}
function bindCal(panel){
  function redraw(){var w=$('#calWrap',panel);if(w)w.outerHTML=calHtml();}
  panel.addEventListener('click',function(e){
    if(!e.target.closest('#calWrap'))return;
    var nv=e.target.closest('[data-cal]');
    if(nv){var s=+nv.getAttribute('data-cal');if(s){var d=new Date(CAL.y,CAL.m+s,1);CAL.y=d.getFullYear();CAL.m=d.getMonth();}else{var n0=new Date();CAL.y=n0.getFullYear();CAL.m=n0.getMonth();}redraw();return;}
    var dy=e.target.closest('[data-day]');
    if(dy){var d0=dy.getAttribute('data-day');if(!CAL.a||CAL.b){CAL.a=d0;CAL.b='';}else CAL.b=d0;redraw();return;}
    if(e.target.closest('[data-calx]')){CAL.a=CAL.b='';redraw();return;}
    if(e.target.closest('[data-calnew]')){
      var lo=CAL.a<CAL.b?CAL.a:CAL.b,hi=CAL.a<CAL.b?CAL.b:CAL.a;
      try{sessionStorage.setItem(NEWDATES_KEY,JSON.stringify({start:lo,end:hi}));}catch(x){}
      connectTo(genCode());
    }
  });
  return redraw;
}
/* Fechas elegidas en el calendario para el viaje que se está armando (se usan una vez, en Ajustes). */
function newDates(){try{var v=JSON.parse(sessionStorage.getItem(NEWDATES_KEY)||'null');return v&&pd(v.start)&&pd(v.end)?v:null;}catch(e){return null;}}
function clearNewDates(){try{sessionStorage.removeItem(NEWDATES_KEY);}catch(e){}}
