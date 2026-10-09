/* Eventos globales y arranque */
'use strict';
/* ---------- Eventos ---------- */
var lastTab={k:'',t:0};
document.addEventListener('click',function(e){
  var cp=e.target.closest&&e.target.closest('[data-copy]');
  if(cp){var txt=cp.getAttribute('data-copy'),done=function(){cp.textContent='¡Copiado!';setTimeout(function(){cp.textContent='Copiar';},1500);};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done).catch(function(){});
    e.stopPropagation();return;}
  var pd=e.target.closest&&e.target.closest('[data-pkdel]');
  if(pd){remove('packing',pd.getAttribute('data-pkdel'));render();return;}
  var fg=e.target.closest&&e.target.closest('[data-forget]');
  if(fg){e.stopPropagation();if(!fg.classList.contains('armed')){fg.classList.add('armed');fg.textContent='¿Quitar?';return;}forgetTrip(fg.getAttribute('data-forget'));if(NOACCESS){setCode('');location.href=location.pathname;return;}render();if(formRefresh)formRefresh();return;}
  var t=e.target.closest('[data-tab],[data-act],[data-close]');if(!t)return;
  if(t.hasAttribute('data-close')){closeSheet();return;}
  if(t.dataset.tab){
    /* doble toque en la pestaña Gastos: anotar un gasto nuevo */
    var now0=Date.now(),dbl=t.dataset.tab==='gastos'&&lastTab.k==='gastos'&&now0-lastTab.t<400;
    lastTab={k:t.dataset.tab,t:dbl?0:now0};
    tab=t.dataset.tab;render();window.scrollTo(0,0);
    if(dbl)openItem('expenses');
    return;
  }
  var a=t.dataset.act;
  if(a==='add')openItem(t.dataset.k,null,t.dataset.date?{date:t.dataset.date}:null);
  else if(a==='edit')openItem(t.dataset.k,t.dataset.id);
  else if(a==='settings')openSettings();
  else if(a==='theme')cycleTheme();
  else if(a==='fetchrates')fetchRates((t.dataset.codes||'USD,BRL').split(','));
  else if(a==='fetchusd')fetchBlueUsd(t.dataset.type);
  else if(a==='settle')openPayment(null,{from:t.dataset.from,to:t.dataset.to,amount:Math.round(parseFloat(t.dataset.amt)*100)/100,method:'Transferencia'});
  else if(a==='editpay')openPayment(t.dataset.id);
  else if(a==='mytrips')openTrips();
  else if(a==='profile')openProfile();
  else if(a==='lodgejoin')toggleGuest(t.dataset.id);
  else if(a==='ride')toggleRide(t.dataset.id,t.dataset.k);
  else if(a==='vehadd')openVehAdd();
  else if(a==='vehfrom')addVehFromProfile(t.dataset.vid);
  else if(a==='vehedit')openVehicle(t.dataset.id);
  else if(a==='myvehadd')openMyVehicle(null);
  else if(a==='myvehedit')openMyVehicle(t.dataset.id);
  else if(a==='itinpast'){itinPast=!itinPast;render();}
  else if(a==='wxopen')openWeather();
  else if(a==='h12'){setPref('h12',!!t.dataset.v);closeSheet();openProfile();}
  else if(a==='friends')openFriends();
  else if(a==='rates')openRates();
  else if(a==='trash')openTrash();
  else if(a==='history')openHistory();
  else if(a==='final')openFinal();
  else if(a==='avisos')openAvisos();
  else if(a==='gopagos'){tab='pagos';closeSheet();}
  else if(a==='gomochila'){tab='mochila';closeSheet();}
  else if(a==='notifon'){if('Notification' in window)Notification.requestPermission().then(function(){closeSheet();openAvisos();});}
  else if(a==='pscope'){pagosScope=t.dataset.scope;if(pagosScope==='all'&&(t.dataset.reload||!otherState))loadOtherCharges();else render();}
  else if(a==='newtrip')connectTo(genCode());
  else if(a==='gotrip'){if(t.dataset.code===CODE)closeSheet();else connectTo(t.dataset.code);}
  else if(a==='gohome'){setCode('');location.href=location.pathname;}
  else if(a==='wholater'){whoLater=true;render();}
  else if(a==='gwho'){gastosWho=t.dataset.who||'';render();}
  else if(a==='whoami'){claimPerson(t.dataset.who);render();}
  else if(a==='addme'){addMe();render();}
  else if(a==='whoswitch'){claimMsg='';releaseClaim();render();}
  else if(a==='login')login();
  else if(a==='addmethod')openMethod(null);
  else if(a==='editmethod')openMethod(t.dataset.id);
  else if(a==='logout')logout();
  else if(a==='install')installApp();
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&!$('#sheet').hidden){closeSheet();return;}
  if((e.key==='Enter'||e.key===' ')&&e.target.getAttribute&&e.target.getAttribute('role')==='button'&&e.target.dataset.act){e.preventDefault();e.target.click();}
});
document.addEventListener('change',function(e){
  var r=e.target.closest&&e.target.closest('[data-rate]');
  if(r){var rc=curCode(r.dataset.rate,''),rv=parseFloat(r.value)||0;if(!rc)return;S.trip.rates[rc]=rv;S.trip.u=nextU(S.trip.u);save();var rp={};rp[rc]=rv;pushTrip({rates:rp});render();return;}
  /* "Otra moneda…": se escribe el código (USD, CLP, UYU…) y queda elegida. */
  if(e.target.tagName==='SELECT'&&e.target.value==='__other'&&(e.target.name==='cur'||e.target.name==='base')){
    var sel=e.target,cc=curCode(window.prompt('Código de la moneda (3 letras, por ejemplo CLP, UYU, MXN):')||'','');
    if(!cc){sel.value=sel.dataset.prev||base();return;}
    if(!Array.prototype.some.call(sel.options,function(o){return o.value===cc;})){var op=document.createElement('option');op.value=op.textContent=cc;sel.insertBefore(op,sel.querySelector('option[value=__other]'));}
    sel.value=cc;sel.dataset.prev=cc;sel.dispatchEvent(new Event('input',{bubbles:true}));return;
  }
  if(e.target.tagName==='SELECT'&&(e.target.name==='cur'||e.target.name==='base'))e.target.dataset.prev=e.target.value;
  var pf=e.target.closest&&e.target.closest('[data-pref]');
  if(pf){setPref(pf.getAttribute('data-pref'),pf.checked);return;}
  var pc=e.target.closest&&e.target.closest('[data-pkcheck]');
  if(pc){upsert('packing',pc.getAttribute('data-pkcheck'),{checked:pc.checked?'1':''});render();}
});
document.addEventListener('submit',function(e){
  if(e.target.id==='joinform'){
    e.preventDefault();
    var c=parseCode($('#joinc').value);
    if(!c){$('#joinmsg').textContent='Ese link o código no es válido. Pegalo completo, tal cual te lo pasaron.';return;}
    connectTo(c);return;
  }
  var pform=e.target.closest&&e.target.closest('.addperson');
  if(pform){
    e.preventDefault();
    var nm=pform.querySelector('[data-persontext]').value.trim();
    if(!nm)return;
    var pid=addPerson(nm);
    claimPerson(pid);
    render();askJoin();
    return;
  }
  var sform=e.target.closest&&e.target.closest('.pksuggest');
  if(sform){
    e.preventDefault();
    var toEl=sform.querySelector('[data-sugto]'),owner2=toEl?toEl.value:'',txt2=sform.querySelector('[data-pktext]').value.trim();
    if(!txt2||!owner2)return;
    sendSuggestion(owner2,txt2);
    packSuggestMsg='Listo, se lo sugerimos.';
    render();
    return;
  }
  var form=e.target.closest&&e.target.closest('.pkadd');
  if(form){
    e.preventDefault();
    var owner=form.dataset.owner,txt=form.querySelector('[data-pktext]').value.trim();
    if(!txt)return;
    upsert('packing',null,{owner:owner,text:txt,checked:'',suggested:'',from:''});
    render();
  }
});

render();
startCloud();   /* con viaje abierto, o la pantalla de inicio con Mis viajes */
