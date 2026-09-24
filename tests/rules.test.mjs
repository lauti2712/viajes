// Tests de las reglas de Firestore y Storage contra el emulador.
// Correr con: npm run test:rules   (necesita Java: JAVA_HOME apuntando a un JDK)
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';

const ADMIN = 'lautarom87@gmail.com';
const T = 'viajeprueba00000001';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'viajeiguazu-7104e',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'trips', T), { name: 'Prueba', setup: true, u: 1 });
    await setDoc(doc(db, 'trips', T, 'items', 'g1'), { k: 'expenses', id: 'g1', amount: 100, u: 1 });
    await setDoc(doc(db, 'trips', T, 'claims', 'pa'), { uid: 'ana', name: 'Ana' });
    await setDoc(doc(db, 'trips', T, 'claims', 'pb'), { uid: 'beto', name: 'Beto' });
    await setDoc(doc(db, 'trips', T, 'packing', 'k1'), { id: 'k1', owner: 'pa', text: 'Secreto de Ana', u: 1 });
    await setDoc(doc(db, 'users', 'ana', 'methods', 'm1'), { id: 'm1', name: 'Visa', type: 'credito' });
    await setDoc(doc(db, 'meta', 'app'), { reloadToken: 'x' });
  });
});

const as = (uid, email) => env.authenticatedContext(uid, email ? { email, email_verified: true } : {}).firestore();
const anon = () => env.unauthenticatedContext().firestore();

test('sin sesión no se lee ni se escribe nada', async () => {
  await assertFails(getDoc(doc(anon(), 'trips', T)));
  await assertFails(getDocs(collection(anon(), 'trips', T, 'items')));
  await assertFails(setDoc(doc(anon(), 'trips', 'otro000000000001'), { name: 'x' }));
  await assertFails(getDoc(doc(anon(), 'meta', 'app')));
});

test('solo el admin lista todos los viajes', async () => {
  await assertFails(getDocs(collection(as('ana', 'ana@x.com'), 'trips')));
  await assertSucceeds(getDocs(collection(as('admin', ADMIN), 'trips')));
});

test('con sesión y código se usa el viaje, pero no se borra nada', async () => {
  const db = as('ana', 'ana@x.com');
  await assertSucceeds(getDoc(doc(db, 'trips', T)));
  await assertSucceeds(setDoc(doc(db, 'trips', T, 'items', 'g2'), { k: 'expenses', id: 'g2', u: 2 }));
  await assertFails(deleteDoc(doc(db, 'trips', T, 'items', 'g1')));
});

test('la mochila solo la ve su dueño', async () => {
  const ana = as('ana'), beto = as('beto');
  await assertSucceeds(getDocs(query(collection(ana, 'trips', T, 'packing'), where('owner', '==', 'pa'))));
  await assertFails(getDocs(query(collection(beto, 'trips', T, 'packing'), where('owner', '==', 'pa'))));
  await assertFails(getDoc(doc(beto, 'trips', T, 'packing', 'k1')));
  await assertFails(updateDoc(doc(beto, 'trips', T, 'packing', 'k1'), { text: 'x' }));
});

test('sugerencias: se crean para otro solo desde la propia persona', async () => {
  const beto = as('beto');
  await assertSucceeds(setDoc(doc(beto, 'trips', T, 'packing', 's1'), { id: 's1', owner: 'pa', text: 'Gorro', suggested: '1', from: 'pb' }));
  await assertFails(setDoc(doc(beto, 'trips', T, 'packing', 's2'), { id: 's2', owner: 'pa', text: 'x', suggested: '1', from: 'pa' }));
  await assertFails(setDoc(doc(beto, 'trips', T, 'packing', 's3'), { id: 's3', owner: 'pa', text: 'x' }));
});

test('nadie toma ni suelta el vínculo de otro', async () => {
  const beto = as('beto');
  await assertFails(setDoc(doc(beto, 'trips', T, 'claims', 'pa'), { uid: 'beto' }));
  await assertFails(deleteDoc(doc(beto, 'trips', T, 'claims', 'pa')));
  await assertSucceeds(updateDoc(doc(beto, 'trips', T, 'claims', 'pb'), { cobro: [{ n: 'MP', a: 'beto.mp' }] }));
  await assertSucceeds(setDoc(doc(as('carla'), 'trips', T, 'claims', 'pc'), { uid: 'carla', name: 'Carla' }));
});

test('las formas de pago solo las ve su dueño', async () => {
  await assertSucceeds(getDocs(collection(as('ana'), 'users', 'ana', 'methods')));
  await assertFails(getDocs(collection(as('beto'), 'users', 'ana', 'methods')));
  await assertFails(setDoc(doc(as('beto'), 'users', 'ana', 'methods', 'm2'), { name: 'x' }));
});

test('forzar actualización: solo el admin', async () => {
  await assertSucceeds(getDoc(doc(as('ana'), 'meta', 'app')));
  await assertFails(setDoc(doc(as('ana', 'ana@x.com'), 'meta', 'app'), { reloadToken: 'y' }));
  await assertSucceeds(setDoc(doc(as('admin', ADMIN), 'meta', 'app'), { reloadToken: 'y' }));
});

test('storage: con sesión, solo imágenes/PDF', async () => {
  const st = env.authenticatedContext('ana').storage();
  const img = ref(st, `trips/${T}/expenses/g1/foto.png`);
  await assertSucceeds(uploadBytes(img, new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
  await assertFails(uploadBytes(ref(st, `trips/${T}/expenses/g1/x.html`), new Uint8Array([1]), { contentType: 'text/html' }));
  await assertFails(uploadBytes(ref(env.unauthenticatedContext().storage(), `trips/${T}/a.png`), new Uint8Array([1]), { contentType: 'image/png' }));
  await assertSucceeds(deleteObject(img));
});
