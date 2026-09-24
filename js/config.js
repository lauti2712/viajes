/* Configuración de Firebase (pública por diseño: la seguridad está en las reglas). La usan index.html y admin.html. */
var FIREBASE_CONFIG={
  apiKey:"AIzaSyARMDTJSRVhHLlGmK83zJn4fI2fM6R4meQ",
  authDomain:"viajeiguazu-7104e.firebaseapp.com",
  projectId:"viajeiguazu-7104e",
  storageBucket:"viajeiguazu-7104e.firebasestorage.app",
  messagingSenderId:"783661170294",
  appId:"1:783661170294:web:192ffe6f0ea7d3bcdfa957"
};
var FB_VER='10.14.1';
/* En localhost la app y el admin usan los emuladores de Firebase en vez de la base real. */
var DEV=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
