/* Shape Spin — offline Canvas renderer and browser UI. No external assets. */
(() => {
  'use strict';
  const {Engine, LEVELS, TYPES, CAPACITY, selectable, copy} = window.ShapeSpinCore;
  const $ = id => document.getElementById(id);
  const canvas=$('scene'), ctx=canvas.getContext('2d'), game=$('game');
  if(!ctx){$('status').textContent='浏览器暂不支持 Canvas，请使用新版浏览器。';return;}
  const W=430,H=900,CY=293,RADIUS=146,STEP=.60,COLUMNS=[123,215,307],BUFFER_X=[44,103,162,221,280],BUFFER_Y=523;
  const FONT='ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
  const SAVE_KEY='shape-spin-demo-v1';
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timeScale=reduced?.32:1, epoch=0, busy=false, hovered=null, hintId=null, hintUntil=0;
  let flashes=[],flights=[],hiddenFills=new Set(),particles=[],tweens=[],bufferTween=null,shaking=null,celebration=null;
  let reelPosition=0,engine,display,levelIndex=0,boardGeo,reachable=new Set(),buttons=new Map();
  let toastUntil=0,modalKind='',lastFocus=null,frameTime=performance.now(),lastInput='pointer';
  let completed=[],soundEnabled=true,audio=null;
  let persisted=null;
  try{persisted=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');}catch(_){/* Private mode/corrupt storage: start safely. */}
  if(persisted&&persisted.version===1){
    completed=Array.isArray(persisted.completed)?[...new Set(persisted.completed.filter(n=>Number.isInteger(n)&&n>=0&&n<LEVELS.length))]:[];
    soundEnabled=persisted.sound!==false;
    levelIndex=Number.isInteger(persisted.level)&&persisted.level>=0&&persisted.level<LEVELS.length?persisted.level:0;
  }
  function persist(){
    try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:1,completed,sound:soundEnabled,level:levelIndex,state:engine.snapshot(),history:engine.history.slice(-12)}));}catch(_){/* Game remains playable without storage. */}
  }
  const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
  const lerp=(a,b,p)=>a+(b-a)*p;
  const ease=p=>1-Math.pow(1-p,3);
  const mod=(a,b)=>((a%b)+b)%b;
  function mix(a,b,p){
    const aa=parseInt(a.replace('#',''),16),bb=parseInt(b.replace('#',''),16);
    const r=Math.round(lerp(aa>>16,bb>>16,p)),g=Math.round(lerp((aa>>8)&255,(bb>>8)&255,p)),bl=Math.round(lerp(aa&255,bb&255,p));
    return `rgb(${r},${g},${bl})`;
  }
  function hexMix(a,b,p){const aa=parseInt(a.slice(1),16),bb=parseInt(b.slice(1),16);return '#'+[16,8,0].map(s=>Math.round(lerp((aa>>s)&255,(bb>>s)&255,p)).toString(16).padStart(2,'0')).join('');}
  function rr(x,y,w,h,r){
    r=Math.max(0,Math.min(r,w/2,h/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }
  function roundPoly(points,rounding){
    ctx.beginPath();
    for(let i=0;i<points.length;i++){
      const p=points[i],prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
      const da=Math.hypot(prev[0]-p[0],prev[1]-p[1]),db=Math.hypot(next[0]-p[0],next[1]-p[1]);
      const r=Math.min(rounding,da*.38,db*.38);
      const a=[p[0]+(prev[0]-p[0])*r/da,p[1]+(prev[1]-p[1])*r/da];
      const b=[p[0]+(next[0]-p[0])*r/db,p[1]+(next[1]-p[1])*r/db];
      if(i===0)ctx.moveTo(...a);else ctx.lineTo(...a);
      ctx.quadraticCurveTo(p[0],p[1],b[0],b[1]);
    }
    ctx.closePath();
  }
  function shapePath(shape,x,y,r){
    if(shape==='circle'){ctx.beginPath();ctx.arc(x,y,r*.88,0,Math.PI*2);ctx.closePath();return;}
    if(shape==='square'){rr(x-r*.84,y-r*.84,r*1.68,r*1.68,r*.23);return;}
    let pts=[];
    if(shape==='triangle')pts=[[0,-1.04],[1,.82],[-1,.82]];
    else if(shape==='diamond')pts=[[0,-1.05],[1.02,0],[0,1.05],[-1.02,0]];
    else if(shape==='hexagon')pts=Array.from({length:6},(_,i)=>{const a=-Math.PI/2+i*Math.PI/3;return [Math.cos(a),Math.sin(a)];});
    else if(shape==='star')pts=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,rad=i%2?.48:1.05;return [Math.cos(a)*rad,Math.sin(a)*rad];});
    roundPoly(pts.map(([px,py])=>[x+px*r,y+py*r]),r*(shape==='star'?.13:.19));
  }
  function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  function softEllipse(x,y,rx,ry,color){ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,color);g.addColorStop(1,'#00000000');ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.restore();}
  function text(value,x,y,size,color,weight=600,align='center'){
    ctx.font=`${weight} ${size}px ${FONT}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(value,x,y);
  }
  function token(x,y,size,key,{alpha=1,angle=0,scale=1,outlined=false,shadow=true}={}){
    const t=TYPES[key];if(!t)return;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);ctx.globalAlpha*=alpha;
    const r=size/2;
    if(shadow){softEllipse(0,r*.73+7,r*.9,7,'#1a473637');}
    shapePath(t.shape,0,5,r);ctx.fillStyle=t.dark;ctx.fill();
    if(outlined){ctx.strokeStyle=hexMix(t.dark,'183c30',.45);ctx.lineWidth=2;ctx.stroke();}
    const g=ctx.createLinearGradient(-r,-r,r*.4,r);g.addColorStop(0,t.light);g.addColorStop(.4,hexMix(t.color,t.light,.22));g.addColorStop(1,t.color);
    shapePath(t.shape,0,0,r);ctx.fillStyle=g;ctx.fill();
    ctx.lineWidth=outlined?1.7:1;ctx.strokeStyle=outlined?hexMix(t.dark,'315343',.18):hexMix(t.dark,t.color,.6);ctx.stroke();
    ctx.save();shapePath(t.shape,0,0,r);ctx.clip();
    shapePath(t.shape,0,1,r*.91);ctx.strokeStyle='#ffffff5f';ctx.lineWidth=1.1;ctx.stroke();
    ctx.restore();ctx.restore();
  }
  function hole(x,y,key,scaleY,filled){
    const t=TYPES[key];if(!t)return;
    ctx.save();ctx.translate(x,y);ctx.scale(1,Math.max(.04,scaleY));
    const r=18.5;
    if(filled){
      shapePath(t.shape,0,0,r);ctx.fillStyle='#ffffff07';ctx.fill();ctx.strokeStyle='#ffffff12';ctx.lineWidth=.8;ctx.stroke();
    }else{
      shapePath(t.shape,0,1.3,r+1);ctx.fillStyle=hexMix(t.color,'ffffff',.3);ctx.fill();
      shapePath(t.shape,0,0,r);
      const g=ctx.createLinearGradient(0,-r,0,r);g.addColorStop(0,hexMix(t.dark,'041712',.7));g.addColorStop(.47,hexMix(t.dark,'051912',.55));g.addColorStop(1,hexMix(t.dark,'081e15',.19));
      ctx.fillStyle=g;ctx.fill();ctx.strokeStyle=hexMix(t.dark,'071b13',.35);ctx.lineWidth=1.2;ctx.stroke();
      ctx.save();shapePath(t.shape,0,0,r);ctx.clip();shapePath(t.shape,0,5,r*.96);const floor=ctx.createLinearGradient(0,-r,0,r);floor.addColorStop(0,hexMix(t.dark,'041712',.46));floor.addColorStop(1,hexMix(t.dark,'081e15',.19));ctx.fillStyle=floor;ctx.fill();ctx.restore();
    }
    ctx.restore();
  }
  function background(){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#f0f5eb');g.addColorStop(.44,'#e9f2e7');g.addColorStop(1,'#dceedd');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=.12;for(let y=157;y<464;y+=27)for(let x=17;x<W;x+=27)ellipse(x,y,.65,.65,'#759781');ctx.restore();
    const glow=ctx.createRadialGradient(213,299,20,213,299,205);glow.addColorStop(0,'#ffffff75');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(0,130,W,340);
    ctx.beginPath();ctx.moveTo(0,624);ctx.quadraticCurveTo(0,602,26,602);ctx.lineTo(63,602);ctx.quadraticCurveTo(78,602,89,611);ctx.lineTo(341,611);ctx.quadraticCurveTo(352,602,367,602);ctx.lineTo(406,602);ctx.quadraticCurveTo(430,602,430,624);ctx.lineTo(430,900);ctx.lineTo(0,900);ctx.closePath();ctx.fillStyle='#cce3ce45';ctx.fill();
  }
  function drawReels(now){
    softEllipse(215,447,139,20,'#476e4d27');
    const axle=ctx.createLinearGradient(0,CY-13,0,CY+15);axle.addColorStop(0,'#d5e4d8');axle.addColorStop(.28,'#f3f7ef');axle.addColorStop(.55,'#b4cbb9');axle.addColorStop(1,'#8da997');
    rr(-8,CY-11,446,24,10);ctx.fillStyle=axle;ctx.fill();
    rr(52,191,326,205,17);ctx.fillStyle='#b8cbbb';ctx.fill();
    const backing=ctx.createLinearGradient(0,188,0,405);backing.addColorStop(0,'#fcfcf2');backing.addColorStop(.55,'#dae6d7');backing.addColorStop(1,'#a1baa8');rr(54,183,322,210,17);ctx.fillStyle=backing;ctx.fill();
    [54,357].forEach(x=>{rr(x,CY-57,19,115,9);const cg=ctx.createLinearGradient(x,0,x+19,0);cg.addColorStop(0,'#8caa98');cg.addColorStop(.55,'#e6efdf');cg.addColorStop(1,'#98b6a0');ctx.fillStyle=cg;ctx.fill();});
    const base=Math.floor(reelPosition),tiles=[];
    for(let o=base-3;o<=base+3;o++){
      const angle=(reelPosition-o)*STEP;
      if(Math.abs(angle)>1.59)continue;
      tiles.push({ord:o,angle,normal:Math.max(.02,Math.cos(angle))});
    }
    tiles.sort((a,b)=>a.normal-b.normal);
    for(const tile of tiles){
      const {angle,normal,ord}=tile;
      const row=display.goals[mod(ord,display.goals.length)];
      const half=STEP*.464;
      const top=CY+RADIUS*Math.sin(angle-half),bottom=CY+RADIUS*Math.sin(angle+half);
      if(bottom-top<.4)continue;
      for(let col=0;col<3;col++){
        const k=row.keys[col];const t=TYPES[k]||{light:'#eef2d4',color:'#d8dfb7',dark:'#a8b390'};
        const x=COLUMNS[col]-44,h=bottom-top;
        ctx.save();ctx.globalAlpha=clamp(normal*5);
        rr(x,top+3,88,h,Math.min(8,h/3));ctx.fillStyle=hexMix(t.dark,'719879',.24);ctx.fill();
        const fg=ctx.createLinearGradient(x,top,x+80,bottom);
        fg.addColorStop(0,hexMix(t.light,'99b591',.12*(1-normal)));
        fg.addColorStop(.24,hexMix(t.color,t.light,.35));
        fg.addColorStop(1,hexMix(t.color,'496b49',.14*(1-normal)));
        rr(x+.5,top,87,h-1,Math.min(8,h/3));ctx.fillStyle=fg;ctx.fill();ctx.strokeStyle=hexMix(t.dark,t.color,.65);ctx.lineWidth=.85;ctx.stroke();
        rr(x+3,top+2,82,Math.max(2,h-5),Math.min(6,h/3));ctx.strokeStyle='#ffffff65';ctx.lineWidth=1;ctx.stroke();
        const fillId=row.filled[col],isFilled=!!fillId&&!hiddenFills.has(fillId);
        if(k&&normal>.10)hole(COLUMNS[col],CY+RADIUS*Math.sin(angle),k,normal,isFilled);
        else if(!k&&normal>.5)ellipse(COLUMNS[col],CY+RADIUS*Math.sin(angle),2,2*normal,'#9daa7e35');
        ctx.restore();
      }
    }
    const pulse=flashes.length?clamp(1-(now-flashes[0].start)/600):0;
    ctx.save();ctx.shadowColor='#56735a20';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
    rr(74,CY-44,282,88,13);ctx.strokeStyle='#ffffff';ctx.lineWidth=7;ctx.stroke();ctx.restore();
    rr(70,CY-48,290,96,16);ctx.strokeStyle=pulse?`rgba(111,169,107,${pulse*.8})`:'#adc5ae65';ctx.lineWidth=1.3;ctx.stroke();
    roundPoly([[59,CY-18],[79,CY],[59,CY+18]],4);ctx.fillStyle='#d6e8d5';ctx.fill();ctx.strokeStyle='#8bab94';ctx.lineWidth=1.7;ctx.stroke();
    roundPoly([[371,CY-18],[351,CY],[371,CY+18]],4);ctx.fillStyle='#d6e8d5';ctx.fill();ctx.strokeStyle='#8bab94';ctx.lineWidth=1.7;ctx.stroke();
    rr(189,CY-54,52,17,8);ctx.fillStyle='#fdfef3';ctx.fill();text('MATCH',215,CY-45,8.3,'#698771',850);
    if(celebration){
      const p=clamp((now-celebration.start)/celebration.duration);
      if(p>=1)celebration=null;else{
        ctx.save();ctx.globalAlpha=Math.sin(Math.PI*p);ctx.translate(215,CY-2-p*5);const s=1+.06*Math.sin(p*Math.PI);ctx.scale(s,s);ctx.font=`900 29px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#3e755b';ctx.lineWidth=6;ctx.lineJoin='round';ctx.strokeText(celebration.text,0,0);ctx.fillStyle='#ffffff';ctx.fillText(celebration.text,0,0);ctx.restore();
      }
    }
  }
  function drawBuffer(now){
    for(let i=0;i<CAPACITY;i++){
      const x=BUFFER_X[i],danger=display.buffer.length>=4;
      ctx.save();ctx.shadowColor='#5a805731';ctx.shadowBlur=6;ctx.shadowOffsetY=5;rr(x-24,BUFFER_Y-22,48,48,11);ctx.fillStyle='#99b79d';ctx.fill();ctx.restore();
      const g=ctx.createLinearGradient(0,BUFFER_Y-25,0,BUFFER_Y+22);g.addColorStop(0,'#eff4e5');g.addColorStop(1,'#d1dfc6');rr(x-24,BUFFER_Y-25,48,46,11);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#f9fbef';ctx.lineWidth=1.2;ctx.stroke();
      rr(x-20,BUFFER_Y-21,40,38,8);ctx.strokeStyle=danger&&i>=display.buffer.length?'#c89e7070':'#a6bda638';ctx.lineWidth=1;ctx.stroke();
      if(!display.buffer[i])text(String(i+1),x,BUFFER_Y-1,11,danger?'#b8a383':'#afc0a6',650);
    }
    for(let i=0;i<display.buffer.length;i++){
      const p=display.buffer[i];if(hiddenFills.has(p.id))continue;
      let x=BUFFER_X[i];
      if(bufferTween){const j=bufferTween.before.findIndex(q=>q.id===p.id);if(j>=0)x=lerp(BUFFER_X[j],x,ease(bufferTween.progress));}
      token(x,BUFFER_Y-5,35,p.key,{outlined:false});
    }
  }
  function geometry(){
    const def=LEVELS[levelIndex],rows=def.mask.length,cols=def.mask[0].length;
    const cell=Math.min(60,240/rows,330/cols);
    return {rows,cols,cell,left:(W-cols*cell)/2,top:624+(240-rows*cell)/2};
  }
  function cellCenter(p){return {x:boardGeo.left+(p.c+.5)*boardGeo.cell,y:boardGeo.top+(p.r+.5)*boardGeo.cell-1};}
  function drawBoard(now){
    const {cell,left,top}=boardGeo;
    for(const p of display.cells){
      const x=left+p.c*cell,y=top+p.r*cell;
      rr(x-3,y+1,cell+6,cell+7,10);ctx.fillStyle='#a4c3aa';ctx.fill();
    }
    for(const p of display.cells){
      const x=left+p.c*cell,y=top+p.r*cell;
      const f=ctx.createLinearGradient(x,y,x+cell*.2,y+cell);
      f.addColorStop(0,p.taken?'#d9e8d5':'#f5f8ef');f.addColorStop(1,p.taken?'#d2e2cd':'#dce8d6');
      rr(x+1,y+1,cell-2,cell-2,8);ctx.fillStyle=f;ctx.fill();ctx.strokeStyle=p.taken?'#b8cfb4':'#fdfef5';ctx.lineWidth=1;ctx.stroke();
      if(p.taken){ellipse(x+cell/2,y+cell/2,1.8,1.8,'#a1bca439');continue;}
      const pos=cellCenter(p),active=reachable.has(p.id),hover=hovered===p.id,hint=hintId===p.id&&now<hintUntil;
      let ox=0;if(shaking&&shaking.id===p.id){const dt=now-shaking.start;if(dt>260)shaking=null;else ox=Math.sin(dt*.09)*3.5*(1-dt/260);}
      if((hover&&active)||hint){
        rr(x+3,y+3,cell-6,cell-6,8);ctx.strokeStyle=hint?`rgba(97,150,108,${.5+Math.sin(now*.006)*.2})`:'#8bab79a0';ctx.lineWidth=2;ctx.stroke();
      }
      const lift=active?-3:0;
      token(pos.x+ox,pos.y+lift,cell*.68,p.key,{outlined:active,alpha:active?1:.83,scale:hover&&active?1.04:1});
      if(active){ellipse(pos.x+cell*.29,pos.y-cell*.30,1.5,1.5,'#fffefa');}
    }
    for(const p of display.cells.filter(c=>c.r===0)){
      const x=left+(p.c+.5)*cell,y=top-7;
      ctx.beginPath();ctx.moveTo(x-3,y+1);ctx.lineTo(x,y-2);ctx.lineTo(x+3,y+1);ctx.strokeStyle='#8cab90';ctx.lineWidth=1.4;ctx.stroke();
    }
  }
  function drawFlights(){
    for(const f of flights){
      const p=clamp(f.progress),e=ease(p);
      const x=lerp(f.x1,f.x2,e)+(f.x2-f.x1>0?1:-1)*Math.sin(p*Math.PI)*13;
      const y=lerp(f.y1,f.y2,e)-Math.sin(p*Math.PI)*45;
      token(x,y,lerp(f.size,35,e),f.key,{scale:1+Math.sin(p*Math.PI)*.1,angle:Math.sin(p*Math.PI)*(f.x2-f.x1)*.0006,outlined:false,shadow:false});
    }
  }
  function burst(x,y,colors,count=10,big=false){
    if(reduced)return;
    for(let i=0;i<count;i++){
      const a=Math.random()*Math.PI*2,s=(big?90:40)+Math.random()*(big?190:70);
      particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-(big?100:20),life:0,max:(big?1.8:.55)+Math.random()*.4,size:(big?3:1.8)+Math.random()*2,color:colors[i%colors.length],angle:Math.random()*6,spin:Math.random()*7-3.5,big});
    }
  }
  function drawParticles(dt){
    for(const p of particles){
      p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.big?155:80)*dt;p.angle+=p.spin*dt;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.globalAlpha=clamp(1-p.life/p.max);
      ctx.fillStyle=p.color;
      if(p.big){rr(-p.size,-p.size*.5,p.size*2,p.size,1);ctx.fill();}
      else{ctx.beginPath();ctx.moveTo(0,-p.size*1.8);ctx.quadraticCurveTo(p.size*.25,-p.size*.25,p.size*1.2,0);ctx.quadraticCurveTo(p.size*.25,p.size*.25,0,p.size*1.8);ctx.quadraticCurveTo(-p.size*.25,p.size*.25,-p.size*1.2,0);ctx.quadraticCurveTo(-p.size*.25,-p.size*.25,0,-p.size*1.8);ctx.fill();}
      ctx.restore();
    }
    particles=particles.filter(p=>p.life<p.max);
  }
  function animate(ms,update){
    if(timeScale===0){update(1);return Promise.resolve(true);}
    const duration=Math.max(1,ms*timeScale),start=performance.now();
    return new Promise(resolve=>tweens.push({start,duration,update,resolve}));
  }
  function cancelAnimations(){for(const t of tweens)t.resolve(false);tweens=[];flights=[];particles=[];flashes=[];hiddenFills.clear();bufferTween=null;celebration=null;}
  function render(now){
    const dt=Math.min(.04,(now-frameTime)/1000);frameTime=now;
    const finished=[];
    tweens=tweens.filter(t=>{const p=clamp((now-t.start)/t.duration);t.update(p);if(p>=1){finished.push(t);return false;}return true;});
    for(const t of finished)t.resolve(true);
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    ctx.clearRect(0,0,W,H);background();drawReels(now);drawBuffer(now);drawBoard(now);drawFlights();drawParticles(dt);
    flashes=flashes.filter(f=>now-f.start<600);
    if(toastUntil&&now>toastUntil){toastUntil=0;defaultStatus();}
    requestAnimationFrame(render);
  }
  function resize(){const rect=game.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2.5);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}
  new ResizeObserver(resize).observe(game);
  window.addEventListener('resize',resize);
  function unlockAudio(){
    if(!soundEnabled)return;
    try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch(_){audio=null;}
  }
  function tone(freq,duration=.09,delay=0,type='sine',volume=.028){
    if(!soundEnabled||!audio)return;
    try{const osc=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+delay;osc.type=type;osc.frequency.setValueAtTime(freq,start);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.009);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(gain);gain.connect(audio.destination);osc.start(start);osc.stop(start+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};}catch(_){}
  }
  function sound(name){
    if(name==='fit'){tone(659,.13);tone(988,.17,.05);}
    else if(name==='store')tone(370,.12,0,'triangle',.022);
    else if(name==='complete')[784,988,1175].forEach((f,i)=>tone(f,.15,i*.055));
    else if(name==='spin')[330,392,494,587,659].forEach((f,i)=>tone(f,.07,i*.05,'triangle',.015));
    else if(name==='win')[523,659,784,1047].forEach((f,i)=>tone(f,.3,i*.10));
    else if(name==='error')tone(165,.08,0,'triangle',.018);
    else if(name==='undo'){tone(587,.07);tone(392,.11,.055);}
  }
  function refreshStageButtons(){
    $('desktop-stages').innerHTML='';
    LEVELS.forEach((l,i)=>{const b=document.createElement('button');b.className='stage-dot'+(i===levelIndex?' current':'')+(completed.includes(i)?' done':'');b.textContent=String(i+1).padStart(2,'0');b.title=l.title+(completed.includes(i)?' · 已通关':'');b.setAttribute('aria-label',`第 ${i+1} 关 ${l.title}`);b.addEventListener('click',()=>requestLevel(i));$('desktop-stages').appendChild(b);});
    $('desktop-progress').textContent=`${completed.length} / ${LEVELS.length}`;
  }
  function rebuildPieceButtons(){
    const layer=$('piece-buttons');layer.innerHTML='';buttons=new Map();
    for(const p of display.cells){
      const b=document.createElement('button');const x=boardGeo.left+p.c*boardGeo.cell,y=boardGeo.top+p.r*boardGeo.cell;
      b.className='piece-hit';b.dataset.id=p.id;b.style.left=`${x/W*100}%`;b.style.top=`${y/H*100}%`;b.style.width=`${boardGeo.cell/W*100}%`;b.style.height=`${boardGeo.cell/H*100}%`;
      b.addEventListener('click',()=>submitPick(p.id));
      b.addEventListener('pointerenter',()=>{hovered=p.id;});b.addEventListener('pointerleave',()=>{if(hovered===p.id)hovered=null;});
      b.addEventListener('focus',()=>{hovered=p.id;});b.addEventListener('blur',()=>{if(hovered===p.id)hovered=null;});
      layer.appendChild(b);buttons.set(p.id,b);
    }
  }
  function syncUI(){
    reachable=new Set(selectable(display));
    const fit=display.goals.reduce((n,g)=>n+g.filled.filter(Boolean).length,0),total=display.cells.length;
    $('level-number').textContent=String(levelIndex+1).padStart(2,'0');$('level-title').textContent=LEVELS[levelIndex].title;
    $('fit-count').textContent=`${fit} / ${total}`;$('fit-progress').style.width=`${fit/total*100}%`;
    $('coin-count').textContent=completed.length*10;
    $('buffer-count').innerHTML=`${display.buffer.length} <i>/ 5</i>`;
    document.querySelector('.buffer-header').classList.toggle('warning',display.buffer.length>=4);
    $('spin-count').textContent=`${display.spins} 次`;
    const remainingRows=display.goals.filter(g=>!g.completed).length;
    $('spin-button').disabled=busy||display.spins===0||display.phase!=='playing'||remainingRows<=1;
    $('spin-button').classList.toggle('attention',!busy&&display.spins>0&&display.buffer.length>=3&&remainingRows>1);
    $('spin-button').setAttribute('aria-label',`转到下一组未完成目标，剩余 ${display.spins} 次`);
    $('undo-button').disabled=busy||!engine.history.length;
    $('remaining-count').textContent=`${display.cells.filter(c=>!c.taken).length} 个待取出`;
    for(const p of display.cells){
      const b=buttons.get(p.id);if(!b)continue;
      b.hidden=p.taken;b.tabIndex=!p.taken&&reachable.has(p.id)&&!busy?0:-1;
      b.setAttribute('aria-disabled',String(!reachable.has(p.id)||busy));
      b.setAttribute('aria-label',`${TYPES[p.key].name}，第 ${p.r+1} 行第 ${p.c+1} 列，${reachable.has(p.id)?'可取出':'出口被挡住'}`);
    }
    $('sound-button').classList.toggle('muted',!soundEnabled);$('sound-button').setAttribute('aria-pressed',String(soundEnabled));$('sound-button').setAttribute('aria-label',soundEnabled?'关闭音效':'开启音效');
    if(!toastUntil)defaultStatus();
  }
  function defaultStatus(){
    const s=display;let message='点击亮起的图形，让它找到自己的位置';
    if(s.phase==='won')message='所有形状都找到了自己的位置！';
    else if(s.phase==='lost')message='空间用完了，换一个顺序再试一次';
    else if(busy)message='正在归位…';
    else if(s.buffer.length>=4)message=s.spins>0?'暂存快满了，试试 SPIN 切换目标':'暂存快满了，优先取出能直接归位的图形';
    else if(levelIndex===2&&s.buffer.length>=2)message='暂时用不上？SPIN 可以转到下一组目标';
    else if(s.moves===0&&levelIndex===0)message='先试试上面的圆形和三角形';
    else if(s.buffer.length>0)message='暂存的图形，会在目标出现时自动归位';
    $('status').textContent=message;$('status').classList.toggle('warn',s.buffer.length>=4&&s.phase==='playing');
  }
  function toast(message,warn=false){$('status').textContent=message;$('status').classList.toggle('warn',warn);toastUntil=performance.now()+2500;}
  function errorFeedback(reason,id){
    const messages={blocked:'这块图形还没有通往上方出口的空路',full:'暂存位满了：先匹配白框，或使用 SPIN',gone:'这块图形已经取出',ended:'这一关已结束','no-spins':'本关 SPIN 已用完，可以撤销再试试','last-row':'只剩最后一组目标，无需再转动'};
    toast(messages[reason]||'稍等一下，再试试',true);sound('error');if(id)shaking={id,start:performance.now()};
  }
  async function playEvents(events){
    const myEpoch=epoch;busy=true;syncUI();
    for(const ev of events){
      if(myEpoch!==epoch)return;
      const before=display;display=copy(ev.state);syncUI();
      if(ev.type==='fit'||ev.type==='store'){
        const items=ev.type==='store'?[{id:ev.id,key:ev.key,from:'board',store:true,index:ev.bufferIndex}]:ev.items;
        hiddenFills=new Set(items.map(p=>p.id));
        bufferTween={before:before.buffer,progress:0};
        flights=items.map(p=>{
          let start;
          if(p.from==='board')start=cellCenter(before.cells.find(c=>c.id===p.id));
          else start={x:BUFFER_X[Math.max(0,before.buffer.findIndex(c=>c.id===p.id))],y:BUFFER_Y-5};
          return {...p,x1:start.x,y1:start.y-3,x2:p.store?BUFFER_X[p.index]:COLUMNS[p.slot],y2:p.store?BUFFER_Y-5:CY,size:p.from==='board'?boardGeo.cell*.68:35,progress:0};
        });
        sound(ev.type==='fit'?'fit':'store');
        await animate(ev.type==='fit'?340+Math.max(0,items.length-1)*45:280,p=>{bufferTween&&(bufferTween.progress=p);flights.forEach((f,i)=>{f.progress=clamp(p*(1+(items.length-1)*.1)-i*.1);});});
        if(myEpoch!==epoch)return;
        for(const f of flights)if(!f.store)burst(f.x2,f.y2,['#ffffff','#fff4c4',TYPES[f.key].light],9);
        hiddenFills.clear();flights=[];bufferTween=null;
      }else if(ev.type==='complete'){
        flashes.push({start:performance.now()});celebration={start:performance.now(),duration:Math.max(250,480*timeScale),text:['Lovely!','Perfect fit!','Nice!','So satisfying!'][ev.row%4]};sound('complete');
        await animate(240,()=>{});
      }else if(ev.type==='rotate'){
        const from=reelPosition,distance=ev.distance+(ev.reason==='spin'?display.goals.length:0),end=from+distance;
        if(ev.reason==='spin')sound('spin');
        await animate(ev.reason==='spin'?900:420,p=>{reelPosition=lerp(from,end,p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2);});
        if(myEpoch!==epoch)return;reelPosition=ev.to;
      }else if(ev.type==='win'){
        burst(110,265,['#f4d372','#86c8b3','#eeacbb','#85b5d6'],40,true);burst(320,245,['#f4d372','#86c8b3','#eeacbb','#85b5d6'],40,true);sound('win');
        await animate(320,()=>{});if(myEpoch!==epoch)return;onWin();
      }else if(ev.type==='lose'){
        await animate(200,()=>{});if(myEpoch!==epoch)return;showLose();
      }
    }
    if(myEpoch!==epoch)return;
    busy=false;display=engine.snapshot();syncUI();persist();
    if(lastInput==='keyboard'&&$('modal').hidden){const next=display.cells.find(c=>!c.taken&&reachable.has(c.id));if(next)buttons.get(next.id)?.focus({preventScroll:true});}
  }
  function submitPick(id){
    if(!$('modal').hidden||busy)return false;
    unlockAudio();const result=engine.pick(id);
    if(!result.ok){errorFeedback(result.reason,id);return false;}
    hintId=null;toastUntil=0;playEvents(result.events);return true;
  }
  function submitSpin(){
    if(!$('modal').hidden||busy)return false;
    unlockAudio();const result=engine.spin();
    if(!result.ok){errorFeedback(result.reason);return false;}
    toastUntil=0;playEvents(result.events);return true;
  }
  function undo(){
    if(busy)return false;
    unlockAudio();if(!engine.undo()){toast('还没有可以撤销的操作');return false;}
    closeModal();epoch++;cancelAnimations();display=engine.snapshot();reelPosition=display.active;
    sound('undo');syncUI();persist();toast('已撤销上一步，SPIN 次数也一并恢复');return true;
  }
  function initLevel(index,saved=null){
    epoch++;cancelAnimations();busy=false;toastUntil=0;hovered=null;hintId=null;levelIndex=index;
    try{engine=new Engine(index,saved);}catch(e){console.warn('Saved state ignored:',e.message);engine=new Engine(index);}
    display=engine.snapshot();reelPosition=display.active;boardGeo=geometry();closeModal();rebuildPieceButtons();syncUI();refreshStageButtons();
    if(!saved){const p=display.cells.find(c=>c.r===0);hintId=p?.id;hintUntil=performance.now()+6000;}
    persist();
  }
  function requestLevel(index){
    if(index===levelIndex&&display.phase==='playing'){closeModal();return;}
    if(engine.state.phase==='playing'&&engine.state.moves>0){
      showModal('confirm',`<div class="modal-eyebrow">A FRESH START</div><h2 id="modal-title">换一关试试？</h2><p class="modal-description">当前这一关将重新开始。已通关的记录和金币会保留。</p><div class="modal-actions"><button class="primary-button" data-action="confirm-level" data-level="${index}">进入第 ${index+1} 关</button><button class="secondary-button" data-action="close">继续当前关卡</button></div>`);
    }else initLevel(index);
  }
  function requestRestart(){
    showModal('confirm',`<div class="modal-eyebrow">TRY A NEW ORDER</div><h2 id="modal-title">重新开始这一关？</h2><p class="modal-description">图形、暂存位和 SPIN 次数都会恢复。关卡布局保持不变，试试另一种取出顺序。</p><div class="modal-actions"><button class="primary-button" data-action="restart">重新开始</button><button class="secondary-button" data-action="close">继续游戏</button></div>`);
  }
  function showModal(kind,html){
    if($('modal').hidden)lastFocus=document.activeElement;
    modalKind=kind;$('modal-card').className='modal-card'+(['win','lose'].includes(kind)?' result-card':'');$('modal-card').innerHTML=html;
    $('modal').hidden=false;document.querySelector('.interface').inert=true;
    $('modal-card').focus({preventScroll:true});
  }
  function closeModal(){
    const wasOpen=!$('modal').hidden;$('modal').hidden=true;document.querySelector('.interface').inert=false;modalKind='';
    if(wasOpen&&lastFocus?.isConnected&&lastFocus!==document.body&&!lastFocus.hidden)try{lastFocus.focus({preventScroll:true});}catch(_){}
  }
  function showHelp(){
    showModal('help',`<button class="modal-close" data-action="close" aria-label="关闭规则">×</button><div class="modal-eyebrow">A LITTLE GUIDE</div><h2 id="modal-title">让形状，恰好归位。</h2><p class="modal-description">不用拖动，也不用凑三个相同的。<br>挑对顺序，剩下的交给转轮。</p>
      <div class="modal-rule"><span class="rule-index">01</span><div><strong>先找到通往上方的出口</strong>图形只能沿棋盘里的空格，上下左右移动到顶端出口。亮起并带描边的图形可以点击，其他图形需要先解除阻挡。</div></div>
      <div class="modal-rule"><span class="rule-index">02</span><div><strong>颜色、形状都要一样</strong>只匹配白框内的目标。可匹配时自动嵌入；暂时不匹配的放入 5 格暂存区。整排填满后，转轮自动推进，不消耗 SPIN。</div></div>
      <div class="modal-rule"><span class="rule-index">03</span><div><strong>SPIN，换一组目标</strong>每次消耗 1 次，按固定循环顺序切到下一组未完成目标，保留已经填好的位置。暂存中的匹配图形会自动归位。</div></div>
      <div class="modal-rule"><span class="rule-index">04</span><div><strong>留出空间，全部归位就通关</strong>满 5 格后，仍可点击能直接归位的图形或使用 SPIN。满格且两种出路都没有时失败。撤销免费，也能撤销 SPIN。</div></div>
      <div class="rule-note">截图复现 Demo：采用「整排推进 / 固定循环 SPIN / 空路取出」的明确规则，不代表原作尚未确认的细节。8 关全部可试；首次通关每关 +10 演示金币，不涉及充值或提现。</div>
      <button class="primary-button" data-action="close">开始归位</button>`);
  }
  function showLevels(){
    showModal('levels',`<button class="modal-close" data-action="close" aria-label="关闭关卡列表">×</button><div class="modal-eyebrow">EIGHT LITTLE PUZZLES</div><h2 id="modal-title">今天，玩哪一关？</h2><p class="modal-description">全部关卡开放试玩。每关布局固定，可以反复尝试不同的顺序。</p><div class="level-grid">${LEVELS.map((l,i)=>`<button class="level-card ${i===levelIndex?'active':''}" data-action="level" data-level="${i}"><span class="num">${String(i+1).padStart(2,'0')}</span><span class="name">${l.title}</span><span class="small">${l.cells.length} 个图形 · ${l.spins} 次 SPIN</span>${completed.includes(i)?'<span class="done">✓</span>':''}</button>`).join('')}</div><button class="secondary-button" data-action="close">回到游戏</button>`);
  }
  function onWin(restored=false){
    const first=!completed.includes(levelIndex);if(first)completed.push(levelIndex);
    refreshStageButtons();syncUI();persist();
    const reward=first?10:0,next=levelIndex+1;
    showModal('win',`<div class="modal-eyebrow">LEVEL ${String(levelIndex+1).padStart(2,'0')} COMPLETE</div><div class="result-stars" aria-hidden="true"><span>★</span><span>★</span><span>★</span></div><h2 id="modal-title">刚刚好！</h2><p class="modal-description">每一个形状，都找到了自己的位置。</p><div class="reward-display"><div class="reward-coin">S</div><div class="reward-value">${reward?'+10':'✓'}</div></div><div class="reward-label">${reward?'首次通关奖励 · 演示金币':'本关奖励已领取 · 继续享受解谜'}</div><div class="stats-row"><div class="stat"><strong>${engine.state.cells.length}</strong>图形归位</div><div class="stat"><strong>${engine.state.moves}</strong>操作次数</div><div class="stat"><strong>${engine.state.spinUsed}</strong>使用 SPIN</div></div><div class="modal-actions"><button class="primary-button" data-action="next">${next<LEVELS.length?'下一关 →':'再玩一轮 →'}</button><button class="secondary-button" data-action="levels">${completed.length===LEVELS.length?'8 关全部完成 · 查看关卡':'选择关卡'}</button></div>`);
  }
  function showLose(){
    showModal('lose',`<div class="modal-eyebrow">A LITTLE ROOM TO RETHINK</div><div class="lose-illustration" aria-hidden="true">▣ ▣ ▣ ▣ ▣</div><h2 id="modal-title">空间用完了</h2><p class="modal-description">暂存区已满，没有可直接归位的图形，<br>也没有剩余的 SPIN。<br>回退一步，试试另一条路。</p><div class="modal-actions"><button class="primary-button" data-action="undo">撤销一步，继续</button><button class="secondary-button" data-action="restart">重新挑战</button><button class="plain-button" data-action="levels">换一关试试</button></div>`);
  }
  $('modal-card').addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b)return;unlockAudio();
    const a=b.dataset.action;
    if(a==='close')closeModal();else if(a==='restart')initLevel(levelIndex);else if(a==='next')initLevel((levelIndex+1)%LEVELS.length);
    else if(a==='level')requestLevel(Number(b.dataset.level));else if(a==='confirm-level')initLevel(Number(b.dataset.level));
    else if(a==='levels')showLevels();else if(a==='undo'){busy=false;undo();}
  });
  $('modal').addEventListener('click',e=>{if(e.target===$('modal')&&!['win','lose'].includes(modalKind))closeModal();});
  $('help-button').addEventListener('click',showHelp);$('level-button').addEventListener('click',showLevels);
  $('spin-button').addEventListener('click',submitSpin);$('undo-button').addEventListener('click',undo);$('restart-button').addEventListener('click',requestRestart);
  $('sound-button').addEventListener('click',()=>{soundEnabled=!soundEnabled;if(soundEnabled){unlockAudio();tone(659,.1);}syncUI();persist();});
  document.addEventListener('pointerdown',()=>{lastInput='pointer';},{passive:true});
  document.addEventListener('keydown',e=>{
    lastInput='keyboard';
    if(!$('modal').hidden){
      if(e.key==='Escape'&&!['win','lose'].includes(modalKind)){e.preventDefault();closeModal();}
      if(e.key==='Tab'){
        const focusables=[...$('modal-card').querySelectorAll('button:not(:disabled),[tabindex="0"]')];
        if(!focusables.length)return;
        if(e.shiftKey&&(document.activeElement===focusables[0]||document.activeElement===$('modal-card'))){e.preventDefault();focusables.at(-1).focus();}
        else if(!e.shiftKey&&(document.activeElement===focusables.at(-1)||document.activeElement===$('modal-card'))){e.preventDefault();focusables[0].focus();}
      }return;
    }
    if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
    if(e.key.toLowerCase()==='s'){e.preventDefault();submitSpin();}
    else if(e.key.toLowerCase()==='z'){e.preventDefault();undo();}
    else if(e.key.toLowerCase()==='h'){e.preventDefault();showHelp();}
    else if(e.key.toLowerCase()==='r'){e.preventDefault();requestRestart();}
  });
  window.addEventListener('pagehide',persist);
  // Developer/test surface. All values are local demo state; there is no paid currency.
  window.ShapeSpinDemo={
    version:'1.0.0',getState:()=>engine.snapshot(),getLevel:()=>levelIndex+1,isBusy:()=>busy,
    selectLevel:n=>{if(Number.isInteger(n)&&n>=1&&n<=LEVELS.length)initLevel(n-1);},
    pick:submitPick,spin:submitSpin,undo,
    setAnimationSpeed:n=>{if(Number.isFinite(n))timeScale=clamp(n,0,3);},
    getSelectable:()=>engine.getSelectable(),getPlan:()=>LEVELS[levelIndex].plan.slice(),
    clearSavedData:()=>{completed=[];try{localStorage.removeItem(SAVE_KEY);}catch(_){}initLevel(0);}
  };
  const saved=persisted?.version===1?persisted.state:null;
  initLevel(levelIndex,saved);
  if(saved&&Array.isArray(persisted.history)){
    try{engine.history=persisted.history.slice(-12).map(s=>{new Engine(levelIndex,s);return copy(s);});syncUI();}catch(_){engine.history=[];}
  }
  if(display.phase==='won')onWin(true);else if(display.phase==='lost')showLose();
  resize();requestAnimationFrame(render);
})();
