import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import postcss from 'postcss';
import { UNIT_ORDER, ENEMY_ORDER, FOOD_RATES } from '../src/game/content.ts';
import { unitParts, unitShadowSVG, unitStarsSVG } from '../src/game/unit-art.ts';
import { unitSVG, unitPortraitSVG } from '../src/art.ts';
import { portraitBaseSVG } from '../src/portrait-art.ts';
import { cannonMountSVG, cannonBarrelSVG, feederSVG, baseDamageSVG } from '../src/game/base-art.ts';
import { baseCatSVG, baseCatParts, BASE_CAT_MOOD_PARTS } from '../src/game/base-cat-art.ts';
import { PLAYER_CAT, ORANGE_CAT, CAT_OPTIONS, breedPreset } from '../src/game/cat-appearance.ts';
import { CHAPTER_WORLDS, chapterWorldSVG } from '../src/ui/chapter-world.ts';

const root = path.resolve('dist-minitool');
const expected = ['assets/game.css', 'assets/game.js', 'favicon.svg', 'index.html'];
const all = [];
async function walk(dir) { for (const entry of await fs.readdir(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) await walk(file); else all.push(path.relative(root, file).replaceAll('\\', '/')); } }
await walk(root);
assert.deepEqual(all.sort(), expected);
const files = await Promise.all(expected.map(async name => {
  const data = await fs.readFile(path.join(root, name));
  return { name, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') };
}));
const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
const js = await fs.readFile(path.join(root, 'assets/game.js'), 'utf8');
const css = await fs.readFile(path.join(root, 'assets/game.css'), 'utf8');
assert.match(html, /<!doctype html>/i);
assert.match(html, /lang="zh-CN"/);
assert.match(html, /charset="UTF-8"/);
for (const viewport of ['width=device-width', 'initial-scale=1.0', 'viewport-fit=cover']) assert.ok(html.includes(viewport));
assert.doesNotMatch(html, /<base\b|<iframe\b|<object\b|\bon\w+\s*=|javascript:|type="module"|http-equiv=/i);
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length, 1);
for (const [, attrs, body] of scripts) { assert.match(attrs, /src="\.\//); assert.equal(body.trim(), ''); }
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
for (const ref of references) { assert.ok(ref.startsWith('./')); assert.ok(expected.includes(ref.slice(2)), `Missing resource ${ref}`); }

const forbidden = [
  /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\b(?:WebSocket|EventSource|RTCPeerConnection|WebAssembly)\b/,
  /\bnew\s+(?:Worker|SharedWorker|Accelerometer|Gyroscope|Magnetometer|Function)\b/, /\beval\s*\(/,
  /navigator\.(?:geolocation|clipboard|bluetooth|usb|hid|serial|getBattery|connection|credentials|locks|vibrate)/,
  /(?:enumerateDevices|getDisplayMedia|requestFullscreen|webkitRequestFullscreen|requestPointerLock|exitPointerLock)\b/,
  /(?:DeviceMotionEvent|DeviceOrientationEvent|PaymentRequest)\b/, /\bwindow\.(?:open|prompt)\s*\(/,
  /\b(?:execCommand|importScripts)\s*\(/, /serviceWorker\.register/, /storage\.persist/,
  /location\.(?:assign|replace)\s*\(/, /createElement\(["'](?:script|iframe|object)["']\)/,
];
for (const pattern of forbidden) assert.doesNotMatch(js, pattern);
const ast = ts.createSourceFile('game.js', js, ts.ScriptTarget.ES2017, true, ts.ScriptKind.JS);
assert.equal(ast.parseDiagnostics.length, 0);
const unsupportedKinds = new Set([ts.SyntaxKind.ImportDeclaration, ts.SyntaxKind.ExportDeclaration, ts.SyntaxKind.ExportAssignment, ts.SyntaxKind.ImportKeyword, ts.SyntaxKind.BigIntLiteral, ts.SyntaxKind.PrivateIdentifier, ts.SyntaxKind.SpreadAssignment, ts.SyntaxKind.ClassStaticBlockDeclaration]);
let astNodes = 0, base64Count = 0, maxBase64Bytes = 0;
function inspect(node) {
  astNodes++;
  assert.ok(!unsupportedKinds.has(node.kind), `Unexpected syntax: ${ts.SyntaxKind[node.kind]}`);
  assert.ok(!node.questionDotToken, 'Untransformed optional chain');
  if (ts.isBinaryExpression(node)) assert.ok(![ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.QuestionQuestionEqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.BarBarEqualsToken].includes(node.operatorToken.kind));
  if (ts.isStringLiteral(node) && /base64,/.test(node.text)) {
    for (const item of node.text.matchAll(/data:[^,\s]*;base64,([a-zA-Z0-9+/=]+)/g)) { base64Count++; maxBase64Bytes = Math.max(maxBase64Bytes, Buffer.from(item[1], 'base64').length); }
  }
  ts.forEachChild(node, inspect);
}
inspect(ast);
assert.ok(maxBase64Bytes < 1024 * 1024);
const cssTree = postcss.parse(css);
cssTree.walkRules(rule => assert.doesNotMatch(rule.selector, /:has\(/));
cssTree.walkAtRules(rule => assert.ok(!['container', 'layer', 'property'].includes(rule.name)));
cssTree.walkDecls(decl => {
  assert.ok(!['inset', 'container-type', 'margin-inline', 'padding-block'].includes(decl.prop));
  assert.doesNotMatch(decl.value, /url\(\s*["']?(?:https?:|\/\/)/);
});
const artwork = [unitShadowSVG, unitStarsSVG];
for (const scene of Object.keys(CHAPTER_WORLDS)) artwork.push(chapterWorldSVG(scene), chapterWorldSVG(scene, true));
for (const side of ['player', 'enemy']) {
  for (const tier of [1, 2, 3]) artwork.push(portraitBaseSVG(side, tier), cannonMountSVG(side, tier), cannonBarrelSVG(side, tier));
  for (const economy of FOOD_RATES.keys()) artwork.push(feederSVG(side, economy));
  for (const damage of [0, 1, 2]) artwork.push(baseDamageSVG(damage));
  for (const mood of ['calm', 'hungry', 'happy', 'worried']) {
    artwork.push(baseCatSVG(side === 'enemy' ? ORANGE_CAT : PLAYER_CAT, mood, side === 'enemy'));
    for (const part of baseCatParts(side === 'enemy' ? ORANGE_CAT : PLAYER_CAT, mood, side === 'enemy')) if (mood === 'calm' || BASE_CAT_MOOD_PARTS.includes(part.name)) artwork.push(part.svg);
  }
  for (const kind of [...(side === 'player' ? UNIT_ORDER : ENEMY_ORDER), 'boss']) {
    artwork.push(unitSVG(kind, side), unitPortraitSVG(kind));
    for (const look of ['front', 'back', 'side']) artwork.push(...unitParts(kind, side, look).map(part => part.svg));
  }
}
for (const [breed] of CAT_OPTIONS.breed) {
  const cat=breedPreset(breed);
  for (const key of Object.keys(CAT_OPTIONS)) for (const [value] of CAT_OPTIONS[key]) {
    const variant={...cat,[key]:value};
    artwork.push(baseCatSVG(variant),...baseCatParts(variant).map(part=>part.svg));
  }
}
const largestSVGBytes = Math.max(...artwork.map(value => Buffer.byteLength(value)));
assert.ok(largestSVGBytes < 100 * 1024);
const report = {
  status: 'passed', scope: 'Static checks; not platform or real-device acceptance', files,
  checks: ['root index.html', 'allowlisted file types', 'all resource references resolve locally', 'external classic script', 'no inline handlers or custom CSP', 'banned API scan including engine code', 'JS AST syntax scan plus ES2017/Chrome61 build target', 'CSS fallback review', 'Base64 and generated SVG sizes'],
  javascriptASTNodes: astNodes, base64Count, largestBase64Bytes: maxBase64Bytes,
  generatedSVGVariants: artwork.length, largestSVGBytes,
  totalUncompressedBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  pending: ['Xiaohongshu creator-platform simulator', 'Android device QR scan', 'iOS device QR scan', 'actual Chrome61 CSS and runtime compatibility', 'real-device startup, FPS and memory'],
};
await fs.mkdir('release', { recursive: true });
await fs.writeFile('release/minitool-static-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
