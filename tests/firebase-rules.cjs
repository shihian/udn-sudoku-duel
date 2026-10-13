const fs=require('node:fs'),assert=require('node:assert/strict');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-sudoku-universe',database:{host:'127.0.0.1',port:9000,rules:fs.readFileSync('firebase.rules.json','utf8')}});
 const id='a'.repeat(36),room='rooms/'+id,now=Date.now();
 const member=(name)=>({name,ready:false,filled:0,finished:false,time:0});
 const host=env.authenticatedContext('host-uid').database();
 const guest=env.authenticatedContext('guest-uid').database();
 const stranger=env.authenticatedContext('stranger-uid').database();
 const anonymous=env.unauthenticatedContext().database();
 try{
  await assertFails(anonymous.ref(room).get());
  await assertFails(guest.ref('rooms').get());
  await assertSucceeds(host.ref(room).set({hostUid:'host-uid',createdAt:now,updatedAt:now,status:'waiting',boardSize:'3',variant:'classic',difficulty:'easy',startAt:0,winnerUid:'',members:{'host-uid':member('房主')}}));
  await assertSucceeds(guest.ref(room).get());
  await assertFails(stranger.ref(room+'/status').set('playing'));
  await assertFails(guest.ref(room+'/hostUid').set('guest-uid'));
  await assertSucceeds(guest.ref(room+'/members/guest-uid').set(member('好友')));
  await assertFails(guest.ref(room+'/members/host-uid/ready').set(true));
  await assertSucceeds(guest.ref(room+'/members/guest-uid/ready').set(true));
  await assertSucceeds(guest.ref(room+'/members/guest-uid/filled').set(3));
  await assertFails(guest.ref(room+'/members/guest-uid/finished').set(true));
  await assertFails(guest.ref(room+'/members/guest-uid/time').set(10));
  await assertSucceeds(host.ref(room+'/status').set('countdown'));
  console.log('PASS: Firebase RTDB rules compile, room creation, join, read and privilege boundaries');
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e);process.exitCode=1});
