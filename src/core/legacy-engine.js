/* Shape Spin — deterministic game rules, independent of Canvas/DOM. */
(function (root) {
  'use strict';
  const CAPACITY = 5;
  const TYPES = {
    Y: { shape:'circle',   color:'#f4c64b', light:'#ffe88c', dark:'#ba7c23', name:'黄色圆形', en:'Yellow circle' },
    P: { shape:'triangle', color:'#ec91b2', light:'#ffd2e1', dark:'#b5507a', name:'粉色三角形', en:'Pink triangle' },
    C: { shape:'square',   color:'#62cad3', light:'#b8eff0', dark:'#277e93', name:'青色方形', en:'Cyan square' },
    R: { shape:'star',     color:'#f57661', light:'#ffbba1', dark:'#b23f39', name:'珊瑚色星星', en:'Coral star' },
    O: { shape:'circle',   color:'#ec7258', light:'#ffb394', dark:'#b44333', name:'红色圆形', en:'Red circle' },
    B: { shape:'circle',   color:'#479ddc', light:'#a2d6f7', dark:'#23679e', name:'蓝色圆形', en:'Blue circle' },
    G: { shape:'square',   color:'#9cc956', light:'#deedac', dark:'#587e35', name:'绿色方形', en:'Green square' },
    H: { shape:'hexagon',  color:'#f3aa50', light:'#ffe0a4', dark:'#b96d2e', name:'橙色六边形', en:'Orange hexagon' },
    D: { shape:'diamond',  color:'#9b97dc', light:'#d7cffb', dark:'#625b9d', name:'淡紫色菱形', en:'Lilac diamond' }
  };
  const copy = o => JSON.parse(JSON.stringify(o));
  function rng(seed) { return function () { let t=seed+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
  function shuffle(a, random) { for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; }
  function selectable(state) {
    const cells = state.cells, byPos = new Map(cells.map(c => [c.r+','+c.c,c]));
    const open = new Set(), queue = [];
    // Only top-row cells are exits. Missing cells are walls, never shortcuts.
    for (const c of cells) if(c.r===0 && c.taken){open.add(c.id);queue.push(c);}
    for(let i=0;i<queue.length;i++){
      const c=queue[i];
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const n=byPos.get((c.r+dr)+','+(c.c+dc));
        if(n && n.taken && !open.has(n.id)){open.add(n.id);queue.push(n);}
      }
    }
    return cells.filter(c=>!c.taken && (c.r===0 || [[-1,0],[1,0],[0,-1],[0,1]].some(([dr,dc])=>{
      const n=byPos.get((c.r+dr)+','+(c.c+dc));return n && open.has(n.id);
    }))).map(c=>c.id);
  }
  function rawCells(mask, keys, id) {
    let i=0;const cells=[];
    mask.forEach((row,r)=>[...row].forEach((v,c)=>{if(v==='1')cells.push({id:`${id}-${i}`,r,c,key:keys[i++],taken:false});}));
    return cells;
  }
  function generateLevel(id,title,mask,palette,spins,seed,windowSize) {
    const random=rng(seed),n=mask.join('').replaceAll('0','').length;
    const keys=shuffle(Array.from({length:n},(_,i)=>palette[i%palette.length]),random);
    const cells=rawCells(mask,keys,id), sandbox={cells:copy(cells)},plan=[];
    while(sandbox.cells.some(c=>!c.taken)){
      const options=selectable(sandbox);
      if(!options.length)throw Error('Disconnected level mask');
      const next=options[Math.floor(random()*options.length)];
      sandbox.cells.find(c=>c.id===next).taken=true;plan.push(next);
    }
    const goalOrder=[];
    for(let i=0;i<plan.length;i+=windowSize) goalOrder.push(...shuffle(plan.slice(i,i+windowSize),random));
    const goals=[];
    for(let i=0;i<goalOrder.length;i+=3) goals.push(goalOrder.slice(i,i+3).map(id=>cells.find(c=>c.id===id).key));
    return {id,title,mask,cells,goals,spins,plan};
  }
  function authored(id,title,mask,keys,goals,spins,plan) {
    const cells=rawCells(mask,keys,id);
    return {id,title,mask,cells,goals,spins,plan:(plan||cells.map((_,i)=>i)).map(i=>`${id}-${i}`)};
  }
  const LEVELS = [
    authored(1,'初见形状',['111','111','111','111'],['Y','P','P','C','Y','Y','R','P','C','R','R','C'],[['P','Y','P'],['R','Y','Y'],['C','C','C'],['P','R','R']],0,[0,1,2,3,4,5,6,8,11,7,9,10]),
    generateLevel(2,'腾出一点空间',['111','111','111','111','111'],['Y','P','C','R'],2,2126,5),
    authored(3,'转动的时机',['01110','11111','01110','11111'],['O','B','B','H','O','B','O','H','G','D','D','G','G','H','B','D'],[['D','H','G'],['O','B','B'],['B','H','H'],['D','G','G'],['O','O','D'],['B']],3,[0,1,2,4,3,8,9,5,6,7,13,10,12,11,14,15]),
    generateLevel(4,'弯路也能通',['01110','11111','11011','11111','01110'],['B','O','G','H','D'],2,4103,6),
    generateLevel(5,'彩色回廊',['01110','01110','11111','01110','11111'],['P','C','Y','R','H'],2,5901,6),
    generateLevel(6,'同形不同色',['11111','11111','11111','11111','11111'],['B','O','C','G','D'],3,6488,6),
    generateLevel(7,'五格之间',['01110','11111','10101','11111','11111'],['Y','P','C','O','G','H','D'],2,7375,6),
    generateLevel(8,'小小挑战',['11111','11111','11011','11111','11111'],['Y','P','C','R','O','B','G','H'],2,8831,6)
  ];
  class Engine {
    constructor(levelIndex=0,saved=null) {
      if(!Number.isInteger(levelIndex)||levelIndex<0||levelIndex>=LEVELS.length) throw Error('Invalid level');
      this.level=LEVELS[levelIndex];this.levelIndex=levelIndex;this.history=[];
      this.state=saved?copy(saved):{
        cells:copy(this.level.cells),
        goals:this.level.goals.map((keys,i)=>({id:i,keys:[keys[0]||null,keys[1]||null,keys[2]||null],filled:[null,null,null],completed:false})),
        active:0,buffer:[],spins:this.level.spins,moves:0,spinUsed:0,phase:'playing'
      };
      this.assert();
    }
    snapshot(){return copy(this.state);}
    getSelectable(){return selectable(this.state);}
    availableSlot(key) {const g=this.state.goals[this.state.active];return g.keys.findIndex((k,i)=>k===key&&!g.filled[i]);}
    _emit(events,type,extra={}){events.push({type,...extra,state:this.snapshot()});}
    _remember(){this.history.push(this.snapshot());if(this.history.length>50)this.history.shift();}
    _next(){const s=this.state;for(let d=1;d<s.goals.length;d++){let i=(s.active+d)%s.goals.length;if(!s.goals[i].completed)return {index:i,distance:d};}return null;}
    pick(id){
      const s=this.state,c=s.cells.find(c=>c.id===id);
      if(s.phase!=='playing')return {ok:false,reason:'ended'};
      if(!c||c.taken)return {ok:false,reason:'gone'};
      if(!this.getSelectable().includes(id))return {ok:false,reason:'blocked'};
      const slot=this.availableSlot(c.key);
      if(slot<0&&s.buffer.length>=CAPACITY)return {ok:false,reason:'full'};
      this._remember();s.moves++;c.taken=true;const events=[];
      if(slot>=0){
        s.goals[s.active].filled[slot]=id;
        this._emit(events,'fit',{items:[{id,key:c.key,from:'board',slot,row:s.active}]});
      }else{
        s.buffer.push({id,key:c.key});
        this._emit(events,'store',{id,key:c.key,bufferIndex:s.buffer.length-1});
      }
      this._settle(events);this._finish(events);return {ok:true,events};
    }
    spin(){
      const s=this.state;
      if(s.phase!=='playing')return {ok:false,reason:'ended'};
      if(s.spins<=0)return {ok:false,reason:'no-spins'};
      const next=this._next();if(!next)return {ok:false,reason:'last-row'};
      this._remember();s.spins--;s.moves++;s.spinUsed++;
      const from=s.active;s.active=next.index;const events=[];
      this._emit(events,'rotate',{from,to:s.active,distance:next.distance,reason:'spin'});
      this._settle(events);this._finish(events);return {ok:true,events};
    }
    _settle(events){
      const s=this.state;
      for(let guard=0;guard<s.goals.length+2;guard++){
        const items=[];
        for(const p of s.buffer.slice()){
          const slot=this.availableSlot(p.key);
          if(slot>=0){s.goals[s.active].filled[slot]=p.id;s.buffer=s.buffer.filter(b=>b.id!==p.id);items.push({...p,from:'buffer',slot,row:s.active});}
        }
        if(items.length)this._emit(events,'fit',{items});
        const goal=s.goals[s.active];
        if(!goal.keys.every((k,i)=>!k||goal.filled[i]))break;
        if(!goal.completed){goal.completed=true;this._emit(events,'complete',{row:s.active});}
        if(s.cells.every(c=>c.taken)&&s.buffer.length===0){s.phase='won';this._emit(events,'win');break;}
        const next=this._next();
        if(!next)throw Error('Unbalanced level');
        const from=s.active;s.active=next.index;
        this._emit(events,'rotate',{from,to:s.active,distance:next.distance,reason:'auto'});
      }
    }
    _finish(events){
      const s=this.state;
      if(s.phase==='playing'&&s.buffer.length>=CAPACITY&&s.spins===0){
        const ids=this.getSelectable();
        const direct=s.cells.some(c=>ids.includes(c.id)&&this.availableSlot(c.key)>=0);
        if(!direct){s.phase='lost';this._emit(events,'lose');}
      }
      this.assert();
    }
    undo(){
      if(!this.history.length)return false;
      this.state=this.history.pop();this.assert();return true;
    }
    assert(){
      const s=this.state,all=new Map(this.level.cells.map(c=>[c.id,c]));
      if(!s||!Array.isArray(s.cells)||!Array.isArray(s.buffer)||!Array.isArray(s.goals))throw Error('Invalid state');
      if(s.cells.length!==all.size||s.buffer.length>CAPACITY||s.spins<0||s.spins>this.level.spins)throw Error('Invalid state bounds');
      if(!Number.isInteger(s.active)||s.active<0||s.active>=s.goals.length||s.goals.length!==this.level.goals.length)throw Error('Invalid targets');
      if(!['playing','won','lost'].includes(s.phase))throw Error('Invalid game phase');
      const ids=s.cells.map(c=>c.id);if(new Set(ids).size!==ids.length)throw Error('Duplicate source');
      for(const c of s.cells){const ref=all.get(c.id);if(!ref||ref.key!==c.key||ref.r!==c.r||ref.c!==c.c)throw Error('Invalid source');}
      const placed=[];const demand={};const supply={};
      this.level.cells.forEach(c=>supply[c.key]=(supply[c.key]||0)+1);
      for(let r=0;r<s.goals.length;r++){
        const g=s.goals[r],original=this.level.goals[r];
        if(g.keys.length!==3||g.filled.length!==3)throw Error('Invalid goal width');
        for(let i=0;i<3;i++){
          const k=g.keys[i];if(k!==(original[i]||null))throw Error('Changed goal');
          if(k)demand[k]=(demand[k]||0)+1;
          if(g.filled[i]){const p=all.get(g.filled[i]);if(!p||p.key!==k)throw Error('Invalid match');placed.push(p.id);}
        }
        if(g.completed&&!g.keys.every((k,i)=>!k||g.filled[i]))throw Error('Incomplete completed row');
      }
      if(JSON.stringify(Object.entries(demand).sort())!==JSON.stringify(Object.entries(supply).sort()))throw Error('Demand and supply do not balance');
      const used=[...s.buffer.map(p=>{if(!all.has(p.id)||all.get(p.id).key!==p.key)throw Error('Invalid buffer');return p.id;}),...placed];
      if(new Set(used).size!==used.length)throw Error('Duplicated piece');
      const taken=s.cells.filter(c=>c.taken).map(c=>c.id);
      if(taken.length!==used.length||taken.some(id=>!used.includes(id)))throw Error('Piece conservation broken');
      if(s.phase==='won'&&(taken.length!==s.cells.length||s.buffer.length))throw Error('Invalid victory');
      return true;
    }
  }
  const api={CAPACITY,TYPES,LEVELS,Engine,selectable,copy};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.ShapeSpinCore=api;
})(typeof window!=='undefined'?window:globalThis);
