const puppeteer = require('/home/ergo/ErgoFlex_Custom_Shop/node_modules/puppeteer-core');
const http = require('http');
let browser, page;
(async () => {
  browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome', headless:'new',
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--autoplay-policy=no-user-gesture-required','--mute-audio']});
  page = await browser.newPage();
  if (process.env.VCLOCK) await page.evaluateOnNewDocument(require('fs').readFileSync(process.env.VCLOCK,'utf8'));
  page.on('console', m => { if (/error/i.test(m.type())) console.log('[console]', m.text().slice(0,200)); });
  http.createServer(async (req, res) => {
    let body=''; req.on('data', c => body += c); req.on('end', async () => {
      try {
        const q = body ? JSON.parse(body) : {}; let out = 'ok';
        const u = req.url;
        if (u==='/vp') { await page.setViewport({width:q.w,height:q.h,deviceScaleFactor:q.dpr||2}); }
        else if (u==='/goto') { await page.goto(q.url,{waitUntil:'networkidle2',timeout:60000}); }
        else if (u==='/eval') { out = JSON.stringify(await page.evaluate(q.js)); }
        else if (u==='/click') { await page.mouse.move(q.x,q.y); await new Promise(r=>setTimeout(r,150)); await page.mouse.click(q.x,q.y,{delay:q.delay||80}); }
        else if (u==='/move') { await page.mouse.move(q.x,q.y); }
        else if (u==='/type') { await page.keyboard.type(q.text,{delay:40}); }
        else if (u==='/key') { await page.keyboard.press(q.key); }
        else if (u==='/wheel') { await page.mouse.move(q.x,q.y); await page.mouse.wheel({deltaY:q.dy}); }
        else if (u==='/shot') { await page.screenshot({path:q.path}); }
        else if (u==='/run') { const fn = eval(q.code); out = JSON.stringify(await fn(page)); }
        else if (u==='/quit') { res.end('bye'); await browser.close(); process.exit(0); }
        res.end(out);
      } catch (e) { res.statusCode=500; res.end(String(e.stack||e)); }
    });
  }).listen(4799, '127.0.0.1', () => console.log('ctl ready'));
})();
