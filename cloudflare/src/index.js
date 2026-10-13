// Cloudflare Durable Objects: authoritative room membership and WebSocket relay.
// Deploy separately; GitHub Pages cannot run this code.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {'Access-Control-Allow-Origin':'https://shihian.github.io','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
    if(request.method==='OPTIONS') return new Response(null,{headers});
    if(url.pathname==='/health') return Response.json({ok:true,service:'sudoku-rooms-v1'},{headers});
    if(url.pathname==='/rooms'&&request.method==='POST') {
      const id=crypto.randomUUID().replace(/-/g,'').slice(0,16);
      const hostKey=crypto.randomUUID();
      const stub=env.ROOMS.get(env.ROOMS.idFromName(id));
      await stub.fetch('https://room.internal/init',{method:'POST',body:JSON.stringify({hostKey})});
      return Response.json({roomId:id,hostKey},{headers});
    }
    const match=url.pathname.match(/^\/rooms\/([a-f0-9]{16})\/ws$/);
    if(match&&request.headers.get('Upgrade')==='websocket') {
      return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
    }
    return new Response('Not found',{status:404,headers});
  }
};
export class SudokuRoom {
  constructor(state,env){this.state=state;this.env=env;this.clients=new Map();this.host=null;this.game=null;this.status='waiting';this.players=new Map();this.winner=null;this.hostKey=null;}
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/init'&&request.method==='POST'){
      if(await this.state.storage.get('hostKey'))return new Response('Already initialized',{status:409});
      const {hostKey}=await request.json();await this.state.storage.put('hostKey',hostKey);return new Response('OK');
    }
    if(request.headers.get('Upgrade')!=='websocket')return new Response('WebSocket required',{status:426});
    const hostKey=await this.state.storage.get('hostKey');
    const isHost=url.searchParams.get('hostKey')===hostKey&&!!hostKey;
    if(this.clients.size>=8)return new Response('Room full',{status:409});
    if(isHost&&this.host)return new Response('Host already connected',{status:409});
    const [client,server]=Object.values(new WebSocketPair());server.accept();
    const id=crypto.randomUUID().slice(0,8);
    const player={id,name:'玩家 '+id.slice(-4).toUpperCase(),ready:false,filled:0,finished:false,time:null};
    this.clients.set(id,server);this.players.set(id,player);
    if(isHost)this.host=id;
    server.addEventListener('message',event=>this.message(id,event.data));
    server.addEventListener('close',()=>this.disconnect(id));
    server.addEventListener('error',()=>this.disconnect(id));
    this.send(id,{type:'welcome',id,isHost});
    this.send(id,{type:'snapshot',status:this.status,players:[...this.players.values()],startAt:this.game?.startAt||null,game:this.status==='playing'?this.publicGame():null,winner:this.winner});
    this.broadcast();
    return new Response(null,{status:101,webSocket:client});
  }
  publicGame(){if(!this.game)return null;const {answer,...rest}=this.game;return rest}
  send(id,data){try{this.clients.get(id)?.send(JSON.stringify(data))}catch{}}
  broadcast(){const data={type:'snapshot',status:this.status,players:[...this.players.values()],startAt:this.game?.startAt||null,winner:this.winner};for(const id of this.clients.keys())this.send(id,data)}
  message(id,raw){
    if(typeof raw!=='string'||raw.length>12000)return;
    let d;try{d=JSON.parse(raw)}catch{return}
    const p=this.players.get(id);if(!p||!d||typeof d.type!=='string')return;
    if(d.type==='ready'&&this.status==='waiting'){p.ready=true;this.broadcast()}
    if(d.type==='start'&&id===this.host&&this.status==='waiting'&&this.players.size>=2&&[...this.players.values()].every(p=>p.ready)){
      if(!Array.isArray(d.game?.answer)||d.game.answer.length!==81||!Array.isArray(d.game?.puzzle)||d.game.puzzle.length!==81)return;
      this.game={...d.game,startAt:Date.now()+5000};this.status='playing';this.winner=null;
      for(const player of this.players.values()){player.filled=0;player.finished=false;player.time=null}
      for(const playerId of this.clients.keys())this.send(playerId,{type:'game',game:this.publicGame()});
      this.broadcast();
    }
    if(d.type==='progress'&&this.status==='playing'){p.filled=Math.min(81,Math.max(0,Number(d.filled)||0));this.broadcast()}
    if(d.type==='finish'&&this.status==='playing'&&Date.now()>=this.game.startAt&&!this.winner&&Array.isArray(d.board)&&d.board.length===81&&d.board.every((n,i)=>n===this.game.answer[i])){
      p.finished=true;p.filled=81;p.time=Math.floor((Date.now()-this.game.startAt)/1000);this.winner={id,name:p.name,time:p.time};this.status='finished';this.broadcast();
    }
    if(d.type==='reset'&&id===this.host&&this.status==='finished'){this.game=null;this.winner=null;this.status='waiting';for(const x of this.players.values()){x.ready=false;x.filled=0;x.finished=false;x.time=null}this.broadcast()}
  }
  disconnect(id){this.clients.delete(id);this.players.delete(id);if(this.host===id){for(const clientId of this.clients.keys())this.send(clientId,{type:'closed',message:'房主已離線，房間關閉'});for(const socket of this.clients.values())try{socket.close(1000,'Host left')}catch{}this.clients.clear();this.players.clear();this.host=null;this.game=null;this.status='waiting'}else this.broadcast()}
}
