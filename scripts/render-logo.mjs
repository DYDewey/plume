// Génère resources/icon.png (512×512) à partir de resources/logo.svg, sans dépendance :
// Electron dessine le SVG dans un canvas, puis on enregistre le PNG (transparence gardée).
// Usage : npx electron scripts/render-logo.mjs [sortie.png] [taille]
import { app, BrowserWindow } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? join(root, 'resources', 'icon.png');
const size = Number(process.argv[3] ?? 512);
const svg = readFileSync(join(root, 'resources', 'logo.svg'), 'utf8');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<canvas></canvas>');
  const dataUrl = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.querySelector('canvas');
      c.width = c.height = ${size};
      c.getContext('2d').drawImage(img, 0, 0, ${size}, ${size});
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;base64,' + ${JSON.stringify(Buffer.from(svg).toString('base64'))};
  })`);
  writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`icône écrite : ${out} (${size}×${size})`);
  app.quit();
});
