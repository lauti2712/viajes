/* Foto del ticket: se lee con Tesseract.js en el propio dispositivo (la imagen no se manda a ningún
   servicio) y se completan total, fecha y comercio. La primera vez descarga el lector (~10 MB). */
'use strict';
var TESS_URL='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',tessP=null;
var TESS_SRI='sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F';   /* si el CDN lo cambia, no se ejecuta */
function loadTesseract(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  if(!tessP)tessP=new Promise(function(ok,fail){var s=document.createElement('script');s.src=TESS_URL;s.integrity=TESS_SRI;s.crossOrigin='anonymous';s.onload=function(){ok(window.Tesseract);};s.onerror=function(){tessP=null;fail(new Error('No se pudo descargar el lector de tickets.'));};document.head.appendChild(s);});
  return tessP;
}
/* Achica (máx. 1600 px) y pasa a grises: mejora la lectura y la foto adjunta pesa poco. */
function prepImage(file){
  return new Promise(function(ok,fail){
    var url=URL.createObjectURL(file),img=new Image();
    img.onload=function(){
      var k=Math.min(1,1600/Math.max(img.width,img.height)),c=document.createElement('canvas');
      c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
      var g=c.getContext('2d');g.drawImage(img,0,0,c.width,c.height);
      var photo=document.createElement('canvas');photo.width=c.width;photo.height=c.height;photo.getContext('2d').drawImage(c,0,0);
      var d=g.getImageData(0,0,c.width,c.height),p=d.data;
      for(var i=0;i<p.length;i+=4){var y=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2];p[i]=p[i+1]=p[i+2]=y;}
      g.putImageData(d,0,0);URL.revokeObjectURL(url);
      photo.toBlob(function(b){ok({canvas:c,blob:b});},'image/jpeg',0.8);
    };
    img.onerror=function(){URL.revokeObjectURL(url);fail(new Error('No se pudo abrir la imagen.'));};
    img.src=url;
  });
}
/* "12.345,67" · "12345.67" · "$ 1.234" · "12,345.67" -> número. */
function parseAmount(s){
  s=String(s).replace(/[^\d.,]/g,'');if(!s)return null;
  var m=/^(.*?)[.,](\d{1,2})$/.exec(s),ent,dec='';
  if(m&&!/[.,]\d{3}$/.test(s)){ent=m[1];dec=m[2];}else ent=s;
  ent=ent.replace(/[.,]/g,'');
  var n=parseFloat(ent+(dec?'.'+dec:''));return isFinite(n)?n:null;
}
var AMT_RE=/\$?\s*(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;
function amountsIn(line){var o=[],m;AMT_RE.lastIndex=0;while((m=AMT_RE.exec(line))){var n=parseAmount(m[1]);if(n!=null)o.push(n);}return o;}
function parseTicket(text){
  var lines=String(text||'').split(/\n/).map(function(l){return l.trim();}).filter(Boolean),res={};
  /* Total: la línea con TOTAL (no subtotal); si no hay, el monto más grande con decimales. */
  var tl=lines.filter(function(l){return /\bTOTAL\b|\bIMPORTE\b|\bA PAGAR\b/i.test(l)&&!/SUB\s*-?\s*TOTAL/i.test(l);});
  for(var i=tl.length-1;i>=0&&res.amount==null;i--){var a=amountsIn(tl[i]).filter(function(n){return n>0;});if(a.length)res.amount=a[a.length-1];}
  if(res.amount==null){var all=[];lines.forEach(function(l){if(/CUIT|CAE|TEL|N[°º]|NRO|P\.?V/i.test(l))return;all=all.concat(amountsIn(l).filter(function(n){return n>0&&n<1e8&&n%1!==0;}));});if(all.length)res.amount=Math.max.apply(null,all);}
  /* Fecha: dd/mm/aa(aa). */
  var dm=/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(lines.join(' '));
  if(dm){var d=+dm[1],mo=+dm[2],y=+dm[3];if(y<100)y+=2000;if(d>=1&&d<=31&&mo>=1&&mo<=12&&y>2000&&y<2100)res.date=y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
  /* Comercio: la primera línea con texto que no sea un dato fiscal. */
  var skip=/CUIT|IVA|FACTURA|TICKET|FECHA|HORA|CAJA|DOMICILIO|INGRESOS|INICIO|RESP|CONSUMIDOR|ORIGINAL|TEL|DIRECC|N[°º]/i;
  for(var j=0;j<Math.min(lines.length,8);j++){var l=lines[j];if(skip.test(l))continue;if((l.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/g)||[]).length>=3&&!/^\d/.test(l)){res.merchant=l.replace(/\s{2,}/g,' ').slice(0,60);break;}}
  return res;
}
async function readTicket(file,onMsg){
  onMsg('Preparando la foto…');
  var prep=await prepImage(file);
  onMsg('Descargando el lector de tickets (solo la primera vez)…');
  var T=await loadTesseract();
  onMsg('Leyendo el ticket…');
  var r=await T.recognize(prep.canvas,'spa',{logger:function(m){if(m.status==='recognizing text')onMsg('Leyendo el ticket… '+Math.round((m.progress||0)*100)+'%');}});
  var out=parseTicket(r&&r.data&&r.data.text);
  out.blob=prep.blob;out.text=r&&r.data&&r.data.text;
  return out;
}
