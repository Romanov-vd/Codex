import{chromium}from'playwright';
import http from'node:http';
import{readFile}from'node:fs/promises';
import assert from'node:assert/strict';
import {Script} from 'node:vm';
import{dayAfter}from'../server/catalog.mjs';
const html=await readFile('standalone/liniya-clinic.html');
// Regression: HTML Preview rewrites literal script tags even inside JS strings.
// Mirror that transform and compile every resulting inline script before launching.
const transformed=html.toString().replace(/<script(\s*src=["'][^"']*["'])?(\s*type=["'](text|application)\/javascript["'])?/gi,'<script type="text/htmlpreview"$1');
const payloads=[...transformed.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
assert.equal(payloads.length,2);
for(const [,source] of payloads)new Script(source);
const previewLoader=process.env.CLINIC_HTMLPREVIEW_LOADER?await readFile(process.env.CLINIC_HTMLPREVIEW_LOADER):null;
const previewIndex=process.env.CLINIC_HTMLPREVIEW_INDEX?await readFile(process.env.CLINIC_HTMLPREVIEW_INDEX):null;
const sourceURL='https://raw.githubusercontent.com/Romanov-vd/Codex/main/deliverables/liniya-clinic.html';
const server=http.createServer((req,res)=>{
 const isLoader=previewLoader&&req.url.startsWith('/htmlpreview.js');
 res.setHeader('Content-Type',isLoader?'application/javascript':'text/html; charset=utf-8');
 res.end(isLoader?previewLoader:(previewIndex||html));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const errors=[],apiRequests=[],remoteRequests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))apiRequests.push(r.url());if(/^https?:/.test(r.url())&&!r.url().startsWith(origin)&&r.url()!==sourceURL)remoteRequests.push(r.url());});
 if(previewLoader)await page.route(sourceURL,route=>route.fulfill({body:html,contentType:'text/plain',headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.goto(origin+(previewLoader?'/?'+sourceURL:''));await page.getByRole('heading',{name:'Ваше здоровье. Наше внимание.'}).waitFor();
 assert.match(await page.locator('.topline').innerText(),/Локальное демо/);
 await context.setOffline(true);
 await page.getByRole('button',{name:'Записаться на приём',exact:true}).click();let booking=page.getByRole('dialog',{name:'Найдём удобное время'});await booking.getByRole('button',{name:'Выбрать дату'}).click();
 let day=dayAfter(1);if(new Date(day+'T12:00:00+03:00').getUTCDay()===0)day=dayAfter(2);
 await booking.getByLabel('Дата приёма',{exact:true}).fill(day);await booking.locator('.slot-grid button:not(:disabled)').first().click();await booking.getByRole('button',{name:'Продолжить'}).click();await booking.getByRole('button',{name:'Войти для записи'}).click();
 await page.getByRole('dialog',{name:'Рады видеть вас снова'}).getByRole('button',{name:'Регистрация',exact:true}).click();const registration=page.getByRole('dialog',{name:'Давайте познакомимся'});
 await registration.getByLabel('Как к вам обращаться').fill('Автономный Пациент');await registration.getByLabel('Email',{exact:true}).fill('offline@example.test');await registration.getByLabel('Пароль',{exact:true}).fill('Offline-Test-2026');await registration.getByRole('checkbox').check();await registration.getByRole('button',{name:'Создать кабинет'}).click();await registration.waitFor({state:'hidden'});
 await booking.getByRole('checkbox').check();await booking.getByRole('button',{name:'Подтвердить запись',exact:true}).click();await page.getByRole('dialog',{name:'Вы записаны. До встречи!'}).getByRole('link',{name:'Мои записи'}).click();await page.locator('.appointment-card').waitFor();assert.equal(new URL(page.url()).hash,'#/cabinet');
 const before=await page.locator('.appointment-facts').innerText();await page.getByRole('button',{name:'Перенести',exact:true}).click();const change=page.getByRole('dialog',{name:'Перенесём приём'});await change.getByLabel('Дата приёма',{exact:true}).fill(day);await change.locator('.slot-grid button:not(:disabled)').last().click();await change.getByRole('button',{name:'Продолжить'}).click();await change.getByRole('checkbox').check();await change.getByRole('button',{name:'Подтвердить перенос'}).click();await page.getByRole('dialog',{name:'Вы записаны. До встречи!'}).getByRole('link',{name:'Мои записи'}).click();await page.locator('.appointment-card').waitFor();assert.notEqual(await page.locator('.appointment-facts').innerText(),before);
 await context.setOffline(false);await page.reload();await page.locator('.appointment-card').waitFor();assert.equal(await page.locator('.appointment-card').count(),1);await context.setOffline(true);
 await page.getByRole('button',{name:'Отменить запись',exact:true}).click();await page.getByRole('dialog',{name:'Отменить запись?'}).getByRole('button',{name:'Да, отменить'}).click();await page.getByRole('heading',{name:'Пока нет запланированных приёмов'}).waitFor();await page.getByRole('button',{name:'История',exact:true}).click();assert.match(await page.locator('.appointment-card').innerText(),/Отменён/);
 await page.locator('.header').getByRole('link',{name:'Контакты',exact:true}).click();await page.getByLabel('Ваше имя').fill('Автономная заявка');await page.getByLabel('Телефон',{exact:true}).fill('+7 999 000 11 22');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Отправить заявку'}).click();await page.getByRole('heading',{name:'Заявка сохранена'}).waitFor();
 await page.getByRole('button',{name:'Выйти из кабинета',exact:true}).click();await page.locator('.header').getByRole('button',{name:'Личный кабинет'}).click();const auth=page.getByRole('dialog',{name:'Рады видеть вас снова'});await auth.getByLabel('Email',{exact:true}).fill('admin@local.test');await auth.getByLabel('Пароль',{exact:true}).fill('ClinicDemo2026!');await auth.getByRole('button',{name:'Войти в кабинет'}).click();await auth.waitFor({state:'hidden'});
 await page.locator('.header').getByRole('link',{name:'Демо-администратор'}).click();await page.getByRole('link',{name:'Панель клиники'}).click();await page.getByRole('button',{name:'Заявки (1)'}).click();assert.match(await page.locator('.admin-grid').innerText(),/Автономная заявка/);
 await page.getByRole('button',{name:'Как попробовать'}).click();await page.getByRole('dialog',{name:'О ваших данных'}).waitFor();assert.match(await page.getByRole('dialog').innerText(),/не синхронизируются/);await page.getByRole('dialog').getByRole('button',{name:'Закрыть окно'}).click();
 await page.locator('.brand').first().click();assert.equal(new URL(page.url()).hash,'#/');
 for(const width of[320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow at '+width);}
 assert.deepEqual(apiRequests,[]);assert.deepEqual(remoteRequests,[]);assert.deepEqual(errors,[]);
 console.log('PASS: '+(previewLoader?'original HTML Preview loader; ':'standalone HTML; ')+ ' no API/network requests; registration, booking, reschedule, cancellation, callback and admin work offline; IndexedDB persists after reload; hash routes and responsive layouts verified.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
