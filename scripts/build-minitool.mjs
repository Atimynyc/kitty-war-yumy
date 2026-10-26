import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { compatibleCSS } from './minitool-css.mjs';

const root = process.cwd();
const out = path.join(root, 'dist-minitool');
const engine = path.join(root, 'node_modules/phaser/src');
const phaserPackage = JSON.parse(await fs.readFile('node_modules/phaser/package.json', 'utf8'));
if (phaserPackage.version !== '3.90.0') throw new Error('Review the offline engine integration before upgrading Phaser.');
const result = await build({
  entryPoints: ['src/minitool.ts'], bundle: true, format: 'iife', platform: 'browser',
  target: ['es2017', 'chrome61', 'ios18.4'], outfile: path.join(out, 'assets/game.js'),
  minify: true, sourcemap: false, legalComments: 'eof', metafile: true,
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'process.env.NODE_ENV': '"production"', global: 'window' },
  plugins: [{ name: 'offline-canvas-engine', setup(builder) {
    builder.onResolve({ filter: /^phaser$/ }, () => ({ path: path.join(engine, 'phaser.js') }));
    builder.onLoad({ filter: /phaser[\\/]src[\\/].*\.js$/ }, async ({ path: file }) => {
      let contents = await fs.readFile(file, 'utf8');
      const relative = path.relative(engine, file).replaceAll('\\', '/');
      if (relative === 'loader/XHRLoader.js') contents = 'module.exports = function(file) { file.loader.nextFile(file, false); return null; };';
      if (relative === 'device/Fullscreen.js') contents = 'module.exports = { available: false, active: false, keyboard: false, request: "", cancel: "" };';
      if (relative === 'device/Features.js') contents = 'module.exports = { canvas: !!window.CanvasRenderingContext2D, canvasBitBltShift: false, file: false, fileSystem: false, getUserMedia: false, littleEndian: new Uint8Array(new Uint32Array([1]).buffer)[0] === 1, localStorage: false, pointerLock: false, stableSort: false, support32bit: false, vibration: false, webGL: false, worker: false };';
      if (relative === 'loader/filetypes/index.js') contents = 'module.exports = { ImageFile: require("./ImageFile") };';
      if (relative === 'input/mouse/MouseManager.js') {
        for (const method of ['requestPointerLock', 'releasePointerLock']) {
          const pattern = new RegExp(`    ${method}: function \\([^]*?\\n    },`);
          if (!pattern.test(contents)) throw new Error(`Phaser integration changed: ${method}`);
          contents = contents.replace(pattern, '');
        }
      }
      if (relative === 'scale/ScaleManager.js') {
        for (const method of ['startFullscreen', 'stopFullscreen']) {
          const pattern = new RegExp(`    ${method}: function \\([^]*?\\n    },`);
          if (!pattern.test(contents)) throw new Error(`Phaser integration changed: ${method}`);
          contents = contents.replace(pattern, `    ${method}: function () { return false; },`);
        }
      }
      contents = contents.replace(/typeof (CANVAS_RENDERER|WEBGL_RENDERER|FEATURE_SOUND|PLUGIN_CAMERA3D|PLUGIN_FBINSTANT)/g, (_, flag) => flag === 'CANVAS_RENDERER' ? 'true' : 'false');
      // Game does not use either physics engine, tilemaps or third-party plugins.
      if (relative === 'phaser.js') contents = contents.replace(/^\s*(Physics|Tilemaps): require\([^\n]+\n/gm, '');
      return { contents, loader: 'js' };
    });
    builder.onLoad({ filter: /\.css$/ }, async ({ path: file }) => ({ contents: (path.basename(file) === 'style.css' ? '* { --layout-row-gap: 0px; --layout-column-gap: 0px; }\n' : '') + compatibleCSS(await fs.readFile(file, 'utf8')), loader: 'css' }));
  } }],
});
let html = await fs.readFile('index.html', 'utf8');
html = html.replace('href="/favicon.svg"', 'href="./favicon.svg"')
  .replace('<script type="module" src="/src/main.ts"></script>', '<script src="./assets/game.js"></script>')
  .replace('</head>', '  <link rel="stylesheet" href="./assets/game.css" />\n  </head>');
await fs.writeFile(path.join(out, 'index.html'), html);
await fs.copyFile('public/favicon.svg', path.join(out, 'favicon.svg'));
await fs.mkdir('.tmp/minitool', { recursive: true });
await fs.writeFile('.tmp/minitool/build-meta.json', JSON.stringify(result.metafile, null, 2));
console.log(`Mini-tool classic-script build: ${out}`);
