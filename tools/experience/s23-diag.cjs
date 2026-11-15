const puppeteer=require('puppeteer-core');
(async()=>{const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new',args:['--use-angle=d3d11','--enable-unsafe-swiftshader']});
const p=await b.newPage();p.on('console',m=>{if(/error|warn/i.test(m.type()))console.log('CONSOLE',m.type(),m.text().slice(0,300))});p.on('pageerror',e=>console.log('PAGEERR',String(e).slice(0,300)));
p.on('requestfailed',r=>console.log('FAILED',r.url().slice(0,200)));p.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url().slice(0,200))});
await p.goto('http://127.0.0.1:3923/?view=product&presentation=1&tour=1',{waitUntil:'load',timeout:60000}).catch(e=>console.log('GOTO',e.message));
await new Promise(r=>setTimeout(r,25000));console.log('READY',await p.evaluate(()=>!!window.ErgoPresentation));await b.close();})();
