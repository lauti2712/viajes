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
    await setDoc(doc(db, 'trips', T), { name: 'Prueba', setup: true, u: 1, owner: 'ana' });
    for (const u of ['ana', 'beto']) await setDoc(doc(db, 'trips', T, 'members', u), { uid: u, name: u });
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

test('solo los miembros ven el viaje; entrar con el link te suma', async () => {
  const carla = as('carla');
  await assertFails(getDoc(doc(carla, 'trips', T)));
  await assertFails(getDocs(collection(carla, 'trips', T, 'items')));
  await assertFails(setDoc(doc(carla, 'trips', T, 'items', 'x1'), { k: 'expenses', id: 'x1' }));
  await assertFails(setDoc(doc(carla, 'trips', T, 'members', 'beto'), { uid: 'beto' }));   // no se anota a otro
  await assertSucceeds(setDoc(doc(carla, 'trips', T, 'members', 'carla'), { uid: 'carla', name: 'Carla' }));
  await assertSucceeds(getDoc(doc(carla, 'trips', T)));
  await assertSucceeds(getDocs(collection(carla, 'trips', T, 'items')));
});

test('viaje nuevo: el que lo crea queda de organizador', async () => {
  const dani = as('dani'), N = 'viajenuevo0000001';
  await assertFails(setDoc(doc(dani, 'trips', N), { name: 'x', owner: 'dani' }));   // primero se anota
  await assertSucceeds(setDoc(doc(dani, 'trips', N, 'members', 'dani'), { uid: 'dani' }));
  await assertFails(setDoc(doc(dani, 'trips', N), { name: 'x', owner: 'otro' }));
  await assertSucceeds(setDoc(doc(dani, 'trips', N), { name: 'x', owner: 'dani' }));
});

test('el organizador saca a alguien y no puede volver a entrar', async () => {
  const ana = as('ana'), beto = as('beto');
  await assertFails(setDoc(doc(beto, 'trips', T, 'banned', 'ana'), { uid: 'ana' }));        // solo el organizador
  await assertFails(deleteDoc(doc(beto, 'trips', T, 'members', 'ana')));
  await assertSucceeds(setDoc(doc(ana, 'trips', T, 'banned', 'beto'), { uid: 'beto' }));
  await assertSucceeds(deleteDoc(doc(ana, 'trips', T, 'members', 'beto')));
  await assertSucceeds(deleteDoc(doc(ana, 'trips', T, 'claims', 'pb')));
  await assertFails(getDoc(doc(beto, 'trips', T)));
  await assertFails(setDoc(doc(beto, 'trips', T, 'members', 'beto'), { uid: 'beto' }));
  await assertSucceeds(deleteDoc(doc(ana, 'trips', T, 'banned', 'beto')));                // volver a permitir
  await assertSucceeds(setDoc(doc(beto, 'trips', T, 'members', 'beto'), { uid: 'beto' }));
});

test('viaje cerrado: nadie nuevo entra con el link; solo el organizador lo cierra', async () => {
  await assertFails(updateDoc(doc(as('beto'), 'trips', T), { locked: true }));
  await assertFails(updateDoc(doc(as('beto'), 'trips', T), { owner: 'beto' }));
  await assertSucceeds(updateDoc(doc(as('beto'), 'trips', T), { name: 'Otro nombre' }));
  await assertSucceeds(updateDoc(doc(as('ana'), 'trips', T), { locked: true }));
  await assertFails(setDoc(doc(as('carla'), 'trips', T, 'members', 'carla'), { uid: 'carla' }));
});

test('historial: los miembros agregan, nadie edita ni borra', async () => {
  const beto = as('beto');
  await assertSucceeds(setDoc(doc(beto, 'trips', T, 'log', 'l1'), { uid: 'beto', k: 'expenses', id: 'g1' }));
  await assertFails(setDoc(doc(beto, 'trips', T, 'log', 'l2'), { uid: 'ana' }));
  await assertFails(updateDoc(doc(beto, 'trips', T, 'log', 'l1'), { k: 'x' }));
  await assertFails(deleteDoc(doc(beto, 'trips', T, 'log', 'l1')));
  await assertFails(getDocs(collection(as('carla'), 'trips', T, 'log')));
});

test('gastos propios: solo los ve su dueño', async () => {
  const ana = as('ana'), beto = as('beto');
  await assertSucceeds(setDoc(doc(ana, 'trips', T, 'private', 'p1'), { k: 'expenses', id: 'p1', ouid: 'ana', desc: 'Regalo', amount: 10 }));
  await assertFails(setDoc(doc(beto, 'trips', T, 'private', 'p2'), { k: 'expenses', id: 'p2', ouid: 'ana' }));   // no a nombre de otro
  await assertSucceeds(getDocs(query(collection(ana, 'trips', T, 'private'), where('ouid', '==', 'ana'))));
  await assertFails(getDocs(query(collection(beto, 'trips', T, 'private'), where('ouid', '==', 'ana'))));
  await assertFails(getDoc(doc(beto, 'trips', T, 'private', 'p1')));
  await assertFails(updateDoc(doc(beto, 'trips', T, 'private', 'p1'), { amount: 1 }));
  await assertFails(deleteDoc(doc(beto, 'trips', T, 'private', 'p1')));
  await assertSucceeds(deleteDoc(doc(ana, 'trips', T, 'private', 'p1')));
});

test('amigos: el libro lo ven solo sus miembros; vincular con el link de un solo uso', async () => {
  const ana = as('ana', 'ana@x.com'), nico = as('nico'), beto = as('beto');
  await assertSucceeds(setDoc(doc(ana, 'ledgers', 'l1'), { a: 'ana', aName: 'Ana', b: '', bName: 'Nico', bAcct: '', members: ['ana'], inv: '' }));
  await assertFails(setDoc(doc(beto, 'ledgers', 'l2'), { a: 'ana', b: '', members: ['ana'] }));   // a nombre de otro
  await assertSucceeds(setDoc(doc(ana, 'ledgers', 'l1', 'entries', 'e1'), { k: 'direct', total: 100, pa: 50, pb: 50, payer: 'a', by: 'ana' }));
  await assertFails(getDoc(doc(nico, 'ledgers', 'l1')));
  await assertFails(getDocs(collection(nico, 'ledgers', 'l1', 'entries')));
  // sin invitación activa no se puede vincular
  await assertFails(updateDoc(doc(nico, 'ledgers', 'l1'), { b: 'nico', members: ['ana', 'nico'], claim: '', inv: '' }));
  await assertSucceeds(updateDoc(doc(ana, 'ledgers', 'l1'), { inv: 'tok123' }));
  await assertFails(updateDoc(doc(nico, 'ledgers', 'l1'), { b: 'nico', members: ['ana', 'nico'], claim: 'mal', inv: '' }));
  await assertFails(updateDoc(doc(ana, 'ledgers', 'l1'), { b: 'beto', members: ['ana', 'beto'] }));   // el dueño no mete a otro
  await assertSucceeds(updateDoc(doc(nico, 'ledgers', 'l1'), { b: 'nico', bAcct: 'Nicolás', members: ['ana', 'nico'], claim: 'tok123', inv: '' }));
  await assertSucceeds(getDocs(collection(nico, 'ledgers', 'l1', 'entries')));   // ve lo anterior
  await assertSucceeds(setDoc(doc(nico, 'ledgers', 'l1', 'entries', 'e2'), { k: 'direct', total: 30, pa: 15, pb: 15, payer: 'b', by: 'nico' }));
  await assertFails(updateDoc(doc(beto, 'ledgers', 'l1'), { b: 'beto', members: ['ana', 'beto'], claim: 'tok123', inv: '' }));   // ya se usó
  await assertFails(getDocs(collection(beto, 'ledgers', 'l1', 'entries')));
  await assertSucceeds(getDocs(query(collection(nico, 'ledgers'), where('members', 'array-contains', 'nico'))));
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
  await assertFails(setDoc(doc(as('carla'), 'trips', T, 'claims', 'pc'), { uid: 'carla', name: 'Carla' }));   // todavía no entró
  await setDoc(doc(as('carla'), 'trips', T, 'members', 'carla'), { uid: 'carla' });
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
