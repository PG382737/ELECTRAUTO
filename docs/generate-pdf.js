const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch();

  // French PDF
  const page1 = await browser.newPage();
  const frPath = 'file:///' + path.resolve('docs/guide-gestion-fr.html').replace(/\\/g, '/');
  await page1.goto(frPath, { waitUntil: 'networkidle0' });
  await page1.pdf({
    path: 'docs/guide-gestion-fr.pdf',
    format: 'Letter',
    printBackground: true,
    margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
  });
  console.log('FR PDF done');

  // English PDF
  const page2 = await browser.newPage();
  const enPath = 'file:///' + path.resolve('docs/guide-gestion-en.html').replace(/\\/g, '/');
  await page2.goto(enPath, { waitUntil: 'networkidle0' });
  await page2.pdf({
    path: 'docs/guide-gestion-en.pdf',
    format: 'Letter',
    printBackground: true,
    margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
  });
  console.log('EN PDF done');

  await browser.close();
  console.log('All done!');
})();
