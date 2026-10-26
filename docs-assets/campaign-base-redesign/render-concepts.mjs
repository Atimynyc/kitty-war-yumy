import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = new URL('./base-concepts.svg', import.meta.url);
const target = new URL('./base-concepts.png', import.meta.url);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 970 }, deviceScaleFactor: 1 });
  await page.setContent('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>html,body{margin:0}svg{display:block}</style>' + readFileSync(source, 'utf8') + '</html>');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(target) });
  console.log(fileURLToPath(target));
} finally {
  await browser.close();
}
