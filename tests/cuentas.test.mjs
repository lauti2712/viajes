// Tests de las cuentas: repartos, monedas, pagos entre personas y transferencias mínimas.
// Carga core.js y plata.js tal cual los usa la app (scripts clásicos con globales) en un contexto aislado.
// Correr con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function app(people, extra) {
  const mem = {};
  const store = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
  const ctx = vm.createContext({
    console, Intl, Math, Date, JSON, Set, URLSearchParams,
    location: { hostname: 'test', search: '', pathname: '/' },
    history: { replaceState() {} },
    localStorage: store, sessionStorage: store,
  });
  for (const f of ['config', 'core', 'plata']) vm.runInContext(readFileSync(new URL(`../js/${f}.js`, import.meta.url), 'utf8'), ctx, { filename: f + '.js' });
  vm.runInContext(`
    var CLAIMS={};
    function pushItem(){} function myPersonId(){return '';} function render(){}
    function allPeople(){return live('people').map(function(p){return {id:p.id,name:p.name};});}
    function nameOf(id){var p=allPeople().find(function(x){return x.id===id;});return p?p.name:'';}
    function add(k,x){S[k].push(Object.assign({id:uid(),u:1},x));}
  `, ctx);
  for (const [id, name] of people) ctx.add('people', { id, name });
  if (extra) extra(ctx);
  return ctx;
}
const P3 = [['ana', 'Ana'], ['beto', 'Beto'], ['caro', 'Caro']];
const gasto = (x) => Object.assign({ desc: 'x', status: 'pagado', cur: 'ARS', split: 'equal' }, x);
const net = (c) => Object.fromEntries(Object.entries(c.settleUp().net).map(([k, v]) => [k, Math.round(v * 100) / 100]));
const deudas = (c) => Array.from(c.settlements().list, (x) => `${x.fromId}>${x.toId}:${x.amt}`).sort();
const sumaCero = (c) => assert.ok(Math.abs(Object.values(c.settleUp().net).reduce((t, v) => t + v, 0)) < 0.01, 'los saldos tienen que sumar cero');

test('todos por igual: el que pagó recupera lo de los demás', () => {
  const c = app(P3, (c) => c.add('expenses', gasto({ amount: 300, paidBy: 'ana' })));
  assert.deepEqual(net(c), { ana: 200, beto: -100, caro: -100 });
  assert.deepEqual(deudas(c), ['beto>ana:100', 'caro>ana:100']);
});

test('"todos" guarda quiénes eran: el que se suma después no paga lo viejo', () => {
  const c = app(P3, (c) => c.add('expenses', gasto({ amount: 200, paidBy: 'ana', splitWith: 'ana,beto' })));
  assert.deepEqual(net(c), { ana: 100, beto: -100, caro: 0 });
  assert.equal(c.splitLabel(c.S.expenses[0]), 'Entre Ana, Beto');
});

test('algunos: solo entre los elegidos', () => {
  const c = app(P3, (c) => c.add('expenses', gasto({ amount: 90, paidBy: 'caro', split: 'some', splitWith: 'beto,caro' })));
  assert.deepEqual(net(c), { ana: 0, beto: -45, caro: 45 });
});

test('por montos: proporcional a lo que puso cada uno', () => {
  const c = app(P3, (c) => c.add('expenses', gasto({ amount: 100, paidBy: 'ana', split: 'amounts', shares: [{ p: 'ana', a: 20 }, { p: 'beto', a: 50 }, { p: 'caro', a: 30 }] })));
  assert.deepEqual(net(c), { ana: 80, beto: -50, caro: -30 });
});

test('alojamiento: entre los que se quedan; si nadie marcó, entre todos', () => {
  const c = app(P3, (c) => {
    c.add('lodging', { name: 'Depto A', amount: 100, paidBy: 'ana', status: 'pagado', split: 'guests', guests: 'ana,beto' });
    c.add('lodging', { name: 'Depto B', amount: 30, paidBy: 'caro', status: 'pagado', split: 'guests', guests: '' });
  });
  assert.deepEqual(net(c), { ana: 40, beto: -60, caro: 20 });
});

test('pasajes: entre los que viajan con ese pasaje', () => {
  const c = app(P3, (c) => {
    c.add('transports', { from: 'Rosario', to: 'Iguazú', amount: 200000, paidBy: 'ana', status: 'pagado', split: 'riders', riders: 'ana,beto' });
    c.add('transports', { from: 'Rosario', to: 'Iguazú', amount: 100000, paidBy: 'caro', status: 'pagado', split: 'riders', riders: 'caro' });
  });
  assert.deepEqual(net(c), { ana: 100000, beto: -100000, caro: 0 });
});

test('un pasajero que ya no está en el viaje no se lleva parte', () => {
  const c = app(P3, (c) => c.add('transports', { amount: 90, paidBy: 'ana', status: 'pagado', split: 'riders', riders: 'ana,beto,fantasma' }));
  assert.deepEqual(net(c), { ana: 45, beto: -45, caro: 0 });
});

test('para mí: gasto propio, no genera deudas', () => {
  const c = app(P3, (c) => {
    c.add('expenses', gasto({ amount: 5000, paidBy: 'beto', split: 'self' }));
    c.add('expenses', gasto({ amount: 300, paidBy: 'ana' }));
  });
  assert.deepEqual(net(c), { ana: 200, beto: -100, caro: -100 });
  assert.equal(c.splitLabel(c.S.expenses[0]), 'Gasto propio de Beto');
});

test('gasto viejo "solo de X"', () => {
  const c = app(P3, (c) => c.add('expenses', gasto({ amount: 50, paidBy: 'ana', split: 'beto' })));
  assert.deepEqual(net(c), { ana: 50, beto: -50, caro: 0 });
});

test('pendientes, borrados y sin monto no cuentan', () => {
  const c = app(P3, (c) => {
    c.add('expenses', gasto({ amount: 300, paidBy: 'ana', status: 'pendiente' }));
    c.add('expenses', gasto({ amount: 300, paidBy: 'ana', del: true }));
    c.add('expenses', gasto({ amount: 0, paidBy: 'ana' }));
  });
  assert.deepEqual(net(c), { ana: 0, beto: 0, caro: 0 });
  assert.equal(c.settlements().list.length, 0);
});

test('otra moneda: usa el tipo de cambio; sin tipo de cambio avisa y no suma', () => {
  const c = app(P3, (c) => {
    c.S.trip.rates.USD = 1000;
    c.add('expenses', gasto({ amount: 30, cur: 'usd', paidBy: 'ana' }));
    c.add('expenses', gasto({ amount: 99, cur: 'BRL', paidBy: 'beto' }));
  });
  assert.deepEqual(net(c), { ana: 20000, beto: -10000, caro: -10000 });
  assert.deepEqual(Array.from(c.settleUp().miss), ['BRL']);
});

test('los pagos entre personas saldan la deuda', () => {
  const c = app(P3, (c) => {
    c.add('expenses', gasto({ amount: 300, paidBy: 'ana' }));
    c.add('payments', { from: 'beto', to: 'ana', amount: 100, cur: 'ARS' });
  });
  assert.deepEqual(net(c), { ana: 100, beto: 0, caro: -100 });
  assert.deepEqual(deudas(c), ['caro>ana:100']);
});

test('redondeo: 100 entre 3 no deja centavos sueltos', () => {
  const c = app(P3, (c) => c.add('expenses', gasto({ amount: 100, paidBy: 'ana' })));
  sumaCero(c);
  // Ana recupera 66,66 o 66,67: el centavo que no se puede dividir no queda colgado.
  const t = Math.round(c.settlements().list.reduce((t, x) => t + x.amt, 0) * 100);
  assert.ok(t === 6666 || t === 6667, String(t));
});

test('transferencias mínimas: grupos que se cancelan entre sí', () => {
  // Ana le pagó 10 a Beto y Caro 20 a Dani, sin relación entre sí: 2 transferencias, no 3.
  const c = app([['ana', 'Ana'], ['beto', 'Beto'], ['caro', 'Caro'], ['dani', 'Dani']], (c) => {
    c.add('expenses', gasto({ amount: 10, paidBy: 'ana', split: 'some', splitWith: 'beto' }));
    c.add('expenses', gasto({ amount: 20, paidBy: 'caro', split: 'some', splitWith: 'dani' }));
  });
  assert.deepEqual(deudas(c), ['beto>ana:10', 'dani>caro:20']);
});

test('8 personas: nunca más de 7 transferencias y todo cierra', () => {
  const P8 = 'abcdefgh'.split('').map((x) => [x, x.toUpperCase()]);
  const c = app(P8, (c) => {
    [[1000, 'a'], [2500, 'b'], [333, 'c'], [7000, 'd'], [120, 'e']].forEach(([amount, paidBy]) => c.add('expenses', gasto({ amount, paidBy })));
    c.add('lodging', { name: 'Casa', amount: 16000, paidBy: 'f', status: 'pagado', split: 'guests', guests: 'a,b,c,f' });
  });
  sumaCero(c);
  const l = c.settlements().list, n = net(c);
  assert.ok(l.length <= 7);
  // Después de hacer las transferencias, todos quedan en cero (se ignoran saldos de menos de 50 centavos).
  l.forEach((x) => { n[x.fromId] += x.amt; n[x.toId] -= x.amt; });
  Object.values(n).forEach((v) => assert.ok(Math.abs(v) < 0.5, 'queda saldo: ' + v));
});

test('una sola persona: no hay deudas', () => {
  const c = app([['ana', 'Ana']], (c) => c.add('expenses', gasto({ amount: 500, paidBy: 'ana' })));
  assert.deepEqual(net(c), { ana: 0 });
  assert.equal(c.settlements().list.length, 0);
});

test('monedas raras no se cuelan como HTML', () => {
  const c = app(P3);
  assert.equal(c.curCode('<img>', 'ARS'), 'ARS');
  assert.equal(c.curCode(' usd ', 'ARS'), 'USD');
});
