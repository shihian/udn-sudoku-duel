const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const url='https://shihian.github.io/udn-sudoku-duel/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const hostContext=await browser.newContext(),guestContext=await browser.newContext();
 const host=await hostContext.newPage(),guest=await guestContext.newPage();
 const errors=[];
 for(const [name,page] of [['host',host],['guest',guest]]){
  page.on('pageerror',e=>errors.push(name+': '+e.message));
 }
 try{
  const skewContext=await browser.newContext();
  await skewContext.addInitScript(()=>{const realNow=Date.now.bind(Date);Date.now=()=>realNow()+48*60*60*1000});
  const skewPage=await skewContext.newPage();
  try{await skewPage.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await skewPage.locator('#duelTab').click();await skewPage.locator('#host').click();await skewPage.locator('#roomPanel').waitFor({state:'visible',timeout:30000});console.log('PASS: create room with client clock 48h ahead')}finally{await skewContext.close()}
  await host.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await host.locator('#duelTab').click();
  await host.locator('#boardSize').selectOption('3');
  await host.locator('#host').click();
  await host.locator('#roomPanel').waitFor({state:'visible',timeout:30000});
  const invite=await host.locator('#inviteUrl').inputValue();
  assert(invite.includes('?room='),'Firebase room invite created');
  await guest.goto(invite,{waitUntil:'domcontentloaded',timeout:45000});
  await guest.locator('#roomPanel').waitFor({state:'visible',timeout:30000});
  await host.locator('#roster .person').nth(1).waitFor({timeout:30000});
  assert.equal(await host.locator('#roster .person').count(),2);
  await host.locator('#ready').click();
  await guest.locator('#ready').click();
  await host.locator('#start').waitFor({state:'visible'});
  await host.waitForFunction(()=>!document.querySelector('#start').disabled,{timeout:30000});
  await host.locator('#start').click();
  await host.locator('#board .cell').first().waitFor({timeout:30000});
  await guest.locator('#board .cell').first().waitFor({timeout:30000});
  await guest.waitForTimeout(5500);
  for(let i=0;i<9;i++){
   const cell=guest.locator('#board .cell').nth(i);
   const preview=cell.locator('.answer-preview');
   if(await preview.count()){
    const n=Number(await preview.textContent());
    await cell.click();
    await guest.locator('#pad button').nth(n-1).click();
   }
  }
  await guest.locator('#modal').waitFor({state:'visible',timeout:30000});
  await host.locator('#modal').waitFor({state:'visible',timeout:30000});
  assert.match(await guest.locator('#modalTitle').textContent(),/你贏了/);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS live Firebase: two independent anonymous accounts, create, join, ready, countdown, synchronized puzzle, submit and winner');
 }catch(e){
  console.error('LIVE TEST FAILED:',e.message);
  console.error('HOST:',await host.locator('#message').textContent().catch(()=>'<unavailable>'));
  console.error('GUEST:',await guest.locator('#message').textContent().catch(()=>'<unavailable>'));
  throw e;
 }finally{
  await hostContext.close();await guestContext.close();await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
