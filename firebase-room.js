import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,signInAnonymously,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {getDatabase,ref,get,set,update,onValue,runTransaction,onDisconnect,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js';
import {firebaseConfig} from './firebase-config.js';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
let login=null;
export async function identity(){
 if(!login)login=signInAnonymously(auth).then(x=>x.user.uid).catch(e=>{login=null;throw e});
 return login;
}
export function randomRoom(){return Array.from(crypto.getRandomValues(new Uint8Array(18)),x=>x.toString(16).padStart(2,'0')).join('')}
export async function createRoom(settings){
 const uid=await identity(),id=randomRoom(),now=Date.now();
 const room={hostUid:uid,createdAt:now,updatedAt:now,status:'waiting',boardSize:settings.boardSize,variant:settings.variant,difficulty:settings.difficulty,startAt:0,challenge:null,winnerUid:'',members:{[uid]:{name:'玩家 '+uid.slice(-4).toUpperCase(),ready:false,filled:0,finished:false,time:0}}};
 // Firebase rejects null child values by deleting them; omit challenge until game starts.
 delete room.challenge;
 await set(ref(db,'rooms/'+id),room);
 return {id,uid};
}
export async function joinRoom(id){
 const uid=await identity(),r=ref(db,'rooms/'+id),snap=await get(r);
 if(!snap.exists())throw Error('找不到房間，可能已過期或已關閉');
 const data=snap.val();
 if(!['waiting','countdown','playing','finished'].includes(data.status))throw Error('房間狀態無效');
 const memberRef=ref(db,'rooms/'+id+'/members/'+uid);
 if(!data.members?.[uid]){
  const result=await runTransaction(memberRef,current=>current||{name:'玩家 '+uid.slice(-4).toUpperCase(),ready:data.status!=='waiting',filled:0,finished:false,time:0},{applyLocally:false});
  if(!result.committed)throw Error('無法加入房間');
 }
 return {id,uid};
}
export function watchRoom(id,cb,error){return onValue(ref(db,'rooms/'+id),s=>cb(s.val()),error)}
export async function ready(id,uid){await update(ref(db,'rooms/'+id+'/members/'+uid),{ready:true})}
export async function progress(id,uid,filled){await update(ref(db,'rooms/'+id+'/members/'+uid),{filled})}
export async function submit(id,uid,board){await update(ref(db,'rooms/'+id+'/members/'+uid),{submission:board,filled:board.length})}
export async function startRoom(id,challenge,startAt){
 await update(ref(db,'rooms/'+id),{challenge,startAt,status:'countdown',winnerUid:'',updatedAt:Date.now()})
}
export async function playing(id){await update(ref(db,'rooms/'+id),{status:'playing',updatedAt:Date.now()})}
export async function finishRoom(id,uid,seconds){await update(ref(db,'rooms/'+id),{winnerUid:uid,status:'finished',updatedAt:Date.now(),['members/'+uid+'/finished']:true,['members/'+uid+'/time']:seconds})}
export async function resetRoom(id,members){
 const changes={status:'waiting',startAt:0,challenge:null,winnerUid:'',updatedAt:Date.now()};
 for(const uid of Object.keys(members)){changes['members/'+uid+'/ready']=false;changes['members/'+uid+'/filled']=0;changes['members/'+uid+'/finished']=false;changes['members/'+uid+'/time']=0}
 await update(ref(db,'rooms/'+id),changes);
}
