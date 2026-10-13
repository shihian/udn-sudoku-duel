const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');const html=fs.readFileSync('index.html','utf8'),js=fs.readFileSync('app.js','utf8');const ids=[...js.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);const missing=[...new Set(ids)].filter(id=>!html.includes('id="'+id+'"'));assert.deepEqual(missing,[],'JS references missing HTML elements');new vm.Script(js,{filename:'app.js'});assert(!/\bhistory\s*=\s*\[/.test(js),'history API shadowed');assert(/window\.history\.replaceState/.test(js),'browser history must be explicit');assert(html.includes('id="lobby"'),'lobby missing');console.log('PASS: all '+new Set(ids).size+' referenced DOM ids exist, JS syntax and history usage valid');
// Regression: room must admit a third player even after the race starts.
assert(js.includes("room.status==='countdown'||room.status==='playing'"),'late join must receive active puzzle');
assert(!js.includes("room.status!=='waiting'||room.players.length>=8"),'old two-player/started-room join rejection remains');
assert(js.includes("room.challenge=p"),'host must retain puzzle for late joiners');
console.log('PASS: late-join implementation checks');

assert(js.includes("$('hintBtn').disabled=false"),'multiplayer hint must be enabled');
assert(!js.includes("mode!=='solo'||!allowed()"),'hint must not reject multiplayer');
console.log('PASS: multiplayer hint enabled');
