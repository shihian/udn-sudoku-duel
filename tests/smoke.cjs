const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');const html=fs.readFileSync('index.html','utf8'),js=fs.readFileSync('app.js','utf8');const ids=[...js.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);const missing=[...new Set(ids)].filter(id=>!html.includes('id="'+id+'"'));assert.deepEqual(missing,[],'JS references missing HTML elements');new vm.Script(js.replace(/^import .*?;\\s*/gm,''),{filename:'app.js'});assert(!/\bhistory\s*=\s*\[/.test(js),'history API shadowed');assert(/window\.history\.replaceState/.test(js),'browser history must be explicit');assert(html.includes('id="lobby"'),'lobby missing');console.log('PASS: all '+new Set(ids).size+' referenced DOM ids exist, JS syntax and history usage valid');
// Firebase migration: no legacy PeerJS transport in the deployed entry point.
assert(js.includes("FB.createRoom("),'Firebase room creation must be wired');
assert(js.includes("FB.joinRoom("),'Firebase room join must be wired');
assert(js.includes("FB.watchRoom("),'Firebase room subscription must be wired');
assert(html.includes('type="module"'),'ES module must be loaded');
assert(!html.includes('peerjs.min.js'),'PeerJS must be removed from deployed page');
assert(js.includes("$('hintBtn').disabled=false"),'multiplayer hint must be enabled');
const rules=JSON.parse(fs.readFileSync('firebase.rules.json','utf8'));
assert.equal(rules.rules.rooms['.read'],false);
assert.equal(rules.rules.rooms['.write'],false);
console.log('PASS: Firebase transport wiring, restricted root rules and multiplayer hints');
