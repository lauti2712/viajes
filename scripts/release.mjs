// Prepara una publicación: chequea el código, corre los tests de cuentas y sube la versión (?v=).
// Uso: npm run release   (después: commit + push; si cambiaron las reglas, primero npm run deploy:rules)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const fail = (m) => { console.error('✗ ' + m); process.exit(1); };
const html = readFileSync('index.html', 'utf8');

// 1. Sintaxis de cada archivo JS.
for (const f of readdirSync('js').filter((f) => f.endsWith('.js'))) {
  try { execFileSync(process.execPath, ['--check', 'js/' + f], { stdio: 'pipe' }); } catch (e) { fail(`js/${f}: ${String(e.stderr).split('\n').slice(0, 5).join('\n')}`); }
}
execFileSync(process.execPath, ['--check', 'sw.js'], { stdio: 'pipe' });

// 2. Los scripts de index.html existen y son los mismos (y en el mismo orden) que guarda sw.js.
const inHtml = [...html.matchAll(/<script src="js\/([\w-]+)\.js\?v=/g)].map((m) => m[1]);
const swList = JSON.parse(readFileSync('sw.js', 'utf8').match(/const JS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
const onDisk = readdirSync('js').filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
if (inHtml.join() !== swList.join()) fail(`sw.js (JS) no coincide con index.html:\n  index: ${inHtml.join(', ')}\n  sw.js: ${swList.join(', ')}`);
const missing = inHtml.filter((f) => !onDisk.includes(f)), unused = onDisk.filter((f) => !inHtml.includes(f));
if (missing.length) fail('index.html pide archivos que no existen: ' + missing.join(', '));
if (unused.length) console.warn('! Archivos en js/ que index.html no carga: ' + unused.join(', '));

// 3. Tests de cuentas.
try { execFileSync(process.execPath, ['--test', 'tests/cuentas.test.mjs'], { stdio: 'pipe' }); } catch (e) { fail('Fallan los tests de cuentas:\n' + String(e.stdout).split('\n').filter((l) => /not ok|Error|actual|expected/.test(l)).join('\n')); }

// 4. Nueva versión: fecha de hoy + letra (a, b, c… si se publica varias veces el mismo día).
const d = new Date(), day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const vers = [...html.matchAll(/\?v=(\d{8})([a-z])/g)];
if (!vers.length) fail('No encontré ?v= en index.html');
const [, oldDay, oldL] = vers[0];
const next = oldDay === day ? (oldL === 'z' ? fail('Ya van 26 versiones hoy') : String.fromCharCode(oldL.charCodeAt(0) + 1)) : 'a';
const v = day + next;
writeFileSync('index.html', html.replace(/\?v=\d{8}[a-z]/g, '?v=' + v));
console.log(`✓ Código OK, tests OK, ${inHtml.length} scripts en orden. Versión ${oldDay + oldL} → ${v}`);
