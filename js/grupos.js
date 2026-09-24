/* Grupos dentro del viaje: quiénes se quedan en cada alojamiento (lodging.guests) y quiénes van en cada
   auto (vehicles.riders). Sirven para repartir gastos rápido ("los del Depto A") y el costo de cada
   alojamiento entre los que se quedan ahí. Los autos se cargan una vez en el perfil (users/{uid}/vehicles)
   y se suman a cada viaje. */
'use strict';
var MYVEH=[];   /* vehículos de mi cuenta */
function idsOf(s){return String(s||'').split(',').filter(Boolean);}
function livingIds(list){var ok=allPeople().map(function(p){return p.id;});return idsOf(list).filter(function(id){return ok.indexOf(id)>=0;});}
function namesOf(list){return livingIds(list).map(nameOf).join(', ');}
/* Accesos rápidos para el reparto: cada alojamiento con gente y cada auto con pasajeros. */
function splitGroups(){
  var me=myPersonId(),g=[];
  live('lodging').forEach(function(l){var ids=livingIds(l.guests);if(ids.length)g.push({key:'l'+l.id,ic:'🏠',name:l.name||'Alojamiento',ids:ids,mine:ids.indexOf(me)>=0});});
  live('vehicles').forEach(function(v){var ids=livingIds(v.riders);if(ids.length)g.push({key:'v'+v.id,ic:'🚗',name:vehName(v),ids:ids,mine:ids.indexOf(me)>=0});});
  return g.sort(function(a,b){return (b.mine-a.mine);});
}
function groupChipsHtml(){
  var g=splitGroups();if(!g.length)return '';
  return '<div class="grps"><span class="hint" style="margin:0">Rápido:</span>'+g.map(function(x){return '<button type="button" class="ghost sm" data-grp="'+esc(x.key)+'" title="'+esc(x.ids.map(nameOf).join(', '))+'">'+x.ic+' '+esc(x.name)+' · '+x.ids.length+(x.mine?' (vos)':'')+'</button>';}).join('')+'</div>';
}
function groupIds(key){var x=splitGroups().find(function(g){return g.key===key;});return x?x.ids:[];}

/* ---------- Alojamiento: "me quedo acá" ---------- */
function toggleGuest(lid){
  var me=myPersonId(),l=S.lodging.find(function(x){return x.id===lid;});if(!me||!l)return;
  var ids=idsOf(l.guests),i=ids.indexOf(me);
  if(i>=0)ids.splice(i,1);else ids.push(me);
  upsert('lodging',lid,{guests:ids.join(',')});render();
}
function guestsLine(l){
  var ids=livingIds(l.guests),me=myPersonId(),inIt=ids.indexOf(me)>=0;
  return '<div class="guests"><span>👥 '+(ids.length?esc(ids.map(nameOf).join(', ')):'Todavía nadie marcó que se queda acá')+'</span>'
   +(me?'<button type="button" class="ghost sm" data-act="lodgejoin" data-id="'+l.id+'">'+(inIt?'Ya no me quedo':'Me quedo acá')+'</button>':'')+'</div>';
}
/* Checkboxes de personas (huéspedes del alojamiento o pasajeros de un auto) dentro de un formulario. */
function peopleChecksHtml(prefix,sel,title){
  var ids=idsOf(sel);
  return '<div class="fld" id="'+prefix+'Box"><span>'+esc(title)+'</span><div class="row">'+allPeople().map(function(p){return '<label class="pksug"><input type="checkbox" name="'+prefix+'_'+esc(p.id)+'"'+(ids.indexOf(p.id)>=0?' checked':'')+'>'+esc(p.name)+'</label>';}).join('')+'</div></div>';
}
function takeChecks(d,prefix){var o=[];Object.keys(d).forEach(function(k){if(k.indexOf(prefix+'_')===0){o.push(k.slice(prefix.length+1));delete d[k];}});return o.join(',');}

/* ---------- Autos ---------- */
function vehName(v){return v.name||(v.detail?v.detail:'Auto')+(v.owner&&nameOf(v.owner)?' de '+nameOf(v.owner):'');}
function vehiclesHtml(){
  var L=live('vehicles'),me=myPersonId();
  var h='<section class="vehs"><div class="bar" style="margin-bottom:8px"><h3>🚗 Autos del viaje</h3><button type="button" class="ghost sm" data-act="vehadd">+ Sumar un auto</button></div>';
  if(!L.length)return h+'<p class="nada" style="padding:0 0 6px">Si van en auto, sumalo acá y cada uno marca en cuál va. Después, al cargar la nafta o los peajes, lo repartís entre los de ese auto con un toque.</p></section>';
  return h+L.map(function(v){
    var ids=livingIds(v.riders),seats=parseInt(v.seats,10)||0,inIt=ids.indexOf(me)>=0,full=seats&&ids.length>=seats;
    return '<div class="stay veh" role="button" tabindex="0" data-act="vehedit" data-id="'+v.id+'"><div class="nm">'+esc(vehName(v))+'</div>'
     +'<div class="sub" style="margin:2px 0 0">'+esc([v.detail,v.plate?'Patente '+v.plate:'',v.owner&&nameOf(v.owner)?'De '+nameOf(v.owner):''].filter(Boolean).join(' · '))+'</div>'
     +'<div class="guests"><span>👥 '+(ids.length?esc(ids.map(nameOf).join(', ')):'Nadie todavía')+(seats?' <b>· '+ids.length+'/'+seats+' lugares</b>':'')+'</span>'
     +(me?'<button type="button" class="ghost sm" data-act="ride" data-id="'+v.id+'"'+(!inIt&&full?' disabled':'')+'>'+(inIt?'Me bajo':full?'Lleno':'Me subo')+'</button>':'')+'</div></div>';
  }).join('')+'</section>';
}
function toggleRide(vid){
  var me=myPersonId(),v=S.vehicles.find(function(x){return x.id===vid;});if(!me||!v)return;
  var ids=idsOf(v.riders),i=ids.indexOf(me),seats=parseInt(v.seats,10)||0;
  if(i>=0)ids.splice(i,1);else{if(seats&&livingIds(v.riders).length>=seats)return;ids.push(me);}
  upsert('vehicles',vid,{riders:ids.join(',')});render();
}
/* Sumar un auto al viaje: uno de "Mis vehículos" o cargado a mano. */
function openVehAdd(){
  var inTrip=live('vehicles').map(function(v){return v.vid;}).filter(Boolean);
  var h=MYVEH.length?'<p class="hint">Tus vehículos (los cargás en tu perfil):</p><div class="stack">'+MYVEH.map(function(v){var ya=inTrip.indexOf(v.id)>=0;return '<button type="button" class="ghost" data-act="vehfrom" data-vid="'+esc(v.id)+'"'+(ya?' disabled':'')+' style="text-align:left">🚗 <b>'+esc(v.name||v.detail||'Auto')+'</b> '+esc([v.detail&&v.name?v.detail:'',v.plate,v.seats?v.seats+' asientos':''].filter(Boolean).join(' · '))+(ya?' — ya está en el viaje':'')+'</button>';}).join('')+'</div><hr>'
   :'<p class="hint">Todavía no cargaste vehículos en tu perfil. Podés cargarlos ahí (👤 → Mis vehículos) para usarlos en todos tus viajes, o cargar uno a mano para este viaje.</p>';
  openSheet('Sumar un auto',h+'<button type="button" class="ghost" data-act="vehedit" data-id="">Cargar uno a mano</button>');
}
function addVehFromProfile(vid){
  var v=MYVEH.find(function(x){return x.id===vid;});if(!v)return;
  var me=myPersonId();
  upsert('vehicles',null,{vid:v.id,name:v.name||'',detail:v.detail||'',plate:v.plate||'',seats:String(v.seats||''),owner:me,riders:me});
  closeSheet();
}
function openVehicle(id){
  var ex=id?S.vehicles.find(function(x){return x.id===id;}):null,v=ex||{seats:'5',owner:myPersonId(),riders:myPersonId()};
  sheetForm({title:ex?'Auto del viaje':'Nuevo auto',values:v,
    fields:[
      {k:'name',l:'Nombre (opcional)',t:'text',ph:'Ej: El Etios, Auto de Agus'},
      {k:'detail',l:'Marca y modelo',t:'text',half:true,ph:'Toyota Etios'},
      {k:'plate',l:'Patente',t:'text',half:true,ph:'AB123CD'},
      {k:'seats',l:'Asientos',t:'number',half:true,ph:'5'},
      {k:'owner',l:'De quién es',t:'select',half:true,opts:[['','Nadie en particular']].concat(allPeople().map(function(p){return [p.id,p.name];}))},
      {k:'_riders',t:'html',html:peopleChecksHtml('r',v.riders,'Quiénes van en este auto')}
    ],
    validate:function(d){var n=Object.keys(d).filter(function(k){return k.indexOf('r_')===0;}).length,s=parseInt(d.seats,10)||0;return s&&n>s?'Marcaste '+n+' personas y el auto tiene '+s+' asientos.':'';},
    onSave:function(d){d.riders=takeChecks(d,'r');d.plate=(d.plate||'').toUpperCase().slice(0,12);d.seats=String(parseInt(d.seats,10)||'');upsert('vehicles',ex?ex.id:null,d);},
    onDelete:ex?function(){remove('vehicles',ex.id);}:null
  });
}
/* Mis vehículos (perfil) */
function openMyVehicle(id){
  var ex=id?MYVEH.find(function(x){return x.id===id;}):null;
  sheetForm({title:ex?'Editar vehículo':'Nuevo vehículo',values:ex||{seats:'5'},
    fields:[
      {k:'name',l:'Apodo (opcional)',t:'text',ph:'Ej: El Etios'},
      {k:'detail',l:'Marca y modelo',t:'text',req:true,ph:'Toyota Etios'},
      {k:'plate',l:'Patente',t:'text',half:true,ph:'AB123CD'},
      {k:'seats',l:'Asientos',t:'number',half:true,ph:'5'}
    ],
    onSave:function(d){saveMyVehicle(Object.assign({},ex||{},{id:ex?ex.id:uid(),name:d.name||'',detail:d.detail||'',plate:(d.plate||'').toUpperCase().slice(0,12),seats:parseInt(d.seats,10)||0,u:Date.now()}));},
    onDelete:ex?function(){saveMyVehicle(Object.assign({},ex,{del:true,u:Date.now()}));}:null
  });
}
function saveMyVehicle(v){
  if(!FB||AUTH!=='in')return;
  var i=MYVEH.findIndex(function(x){return x.id===v.id;});
  if(v.del){if(i>=0)MYVEH.splice(i,1);}else if(i>=0)MYVEH[i]=v;else MYVEH.push(v);
  try{FB.fs.setDoc(FB.fs.doc(FB.db,'users',ME.uid,'vehicles',v.id),clean(v)).catch(fbErr);}catch(e){}
}
function listenMyVehicles(){
  FB.fs.onSnapshot(FB.fs.collection(FB.db,'users',ME.uid,'vehicles'),function(snap){
    MYVEH=snap.docs.map(function(x){return x.data()||{};}).filter(function(v){return v.id&&!v.del&&ID_RE.test(v.id);});
    if(formRefresh)formRefresh();
  },function(){});
}
function myVehiclesHtml(){
  return '<section class="psec"><div class="bar"><h3>Mis vehículos</h3><button type="button" class="ghost sm" data-act="myvehadd">+ Agregar</button></div>'
   +(MYVEH.length?MYVEH.map(function(v){return '<div class="exp" role="button" tabindex="0" data-act="myvehedit" data-id="'+esc(v.id)+'" style="grid-template-columns:34px 1fr"><span class="ec" aria-hidden="true">🚗</span><div class="et"><b>'+esc(v.name||v.detail||'Auto')+'</b><small>'+(v.name&&v.detail?'<span>'+esc(v.detail)+'</span>':'')+(v.plate?'<span>'+esc(v.plate)+'</span>':'')+(v.seats?'<span>'+esc(String(v.seats))+' asientos</span>':'')+'</small></div></div>';}).join('')
     :'<p class="nada">Cargá tu auto una vez y lo sumás a cada viaje: cada uno marca en cuál va y la nafta se reparte entre los de ese auto.</p>')+'</section>';
}
