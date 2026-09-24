/* Eventos globales y arranque */
'use strict';
/* ---------- Eventos ---------- */
document.addEventListener('click',function(e){
  var cp=e.target.closest&&e.target.closest('[data-copy]');
  if(cp){var txt=cp.getAttribute('data-copy'),done=function(){cp.textContent='¡Copiado!';setTimeout(function(){cp.textContent='Copiar';},1500);};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done).catch(function(){});
    e.stopPropagation();return;}
  var pd=e.target.closest&&e.target.closest('[data-pkdel]');
  if(pd){remove('packing',pd.getAttribute('data-pkdel'));render();return;}
  var fg=e.target.closest&&e.target.closest('[data-forget]');
  if(fg){e.stopPropagation();if(!fg.classList.contains('armed')){fg.classList.add('armed');fg.textContent='¿Quitar?';return;}forgetTrip(fg.getAttribute('data-forget'));render();if(formRefresh)formRefresh();return;}
  var t=e.target.closest('[data-tab],[data-act],[data-close]');if(!t)return;
  if(t.hasAttribute('data-close')){closeSheet();return;}
  if(t.dataset.tab){tab=t.dataset.tab;render();window.scrollTo(0,0);return;}
  var a=t.dataset.act;
  if(a==='add')openItem(t.dataset.k,null,t.dataset.date?{date:t.dataset.date}:null);
  else if(a==='edit')openItem(t.dataset.k,t.dataset.id);
  else if(a==='settings')openSettings();
  else if(a==='sync')openSync();
  else if(a==='theme')cycleTheme();
  else if(a==='fetchrates')fetchRates((t.dataset.codes||'USD,BRL').split(','));
  else if(a==='fetchusd')fetchBlueUsd(t.dataset.type);
  else if(a==='settle')openPayment(null,{from:t.dataset.from,to:t.dataset.to,amount:Math.round(parseFloat(t.dataset.amt)*100)/100,method:'Transferencia'});
  else if(a==='editpay')openPayment(t.dataset.id);
  else if(a==='mytrips')openTrips();
  else if(a==='newtrip')connectTo(genCode());
  else if(a==='gotrip'){if(t.dataset.code===CODE)closeSheet();else connectTo(t.dataset.code);}
  else if(a==='golocal'){try{localStorage.setItem(MODE_KEY,'local');}catch(e){}location.href=location.pathname;}
  else if(a==='wholater'){whoLater=true;render();}
  else if(a==='gwho'){gastosWho=t.dataset.who||'';render();}
  else if(a==='whoami'){if(cloudMode())claimPerson(t.dataset.who);else setWhoAmI(t.dataset.who);render();}
  else if(a==='whoswitch'){claimMsg='';if(cloudMode())releaseClaim();else setWhoAmI('');render();}
  else if(a==='login')login();
  else if(a==='addmethod')openMethod(null);
  else if(a==='editmethod')openMethod(t.dataset.id);
  else if(a==='logout')logout();
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&!$('#sheet').hidden){closeSheet();return;}
  if((e.key==='Enter'||e.key===' ')&&e.target.getAttribute&&e.target.getAttribute('role')==='button'&&e.target.dataset.act){e.preventDefault();e.target.click();}
});
document.addEventListener('change',function(e){
  var r=e.target.closest&&e.target.closest('[data-rate]');
  if(r){S.trip.rates[r.dataset.rate]=parseFloat(r.value)||0;S.trip.u=Date.now();save();pushTrip();render();return;}
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
    if(cloudMode())claimPerson(pid);else setWhoAmI(pid);
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

if(!cloudMode())migratePeople();
render();
if(!FIREBASE_CONFIG.apiKey){if(!S.trip.setup)openSettings();}
else if(LOCAL_ONLY){syncState='local';renderHead();if(!S.trip.setup)openSettings();}
else startCloud();   /* con viaje abierto, o la pantalla de inicio con Mis viajes */
