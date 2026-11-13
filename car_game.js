(()=>{
'use strict';
const THREE=ToyBattleLibraries.THREE;
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const lerp=(a,b,t)=>a+(b-a)*t;
const rad=Math.PI/180;
const specs={sport:{name:'闪电跑车',desc:'高速 · 灵活',color:0xff565e,hp:100,speed:24,accel:26,turn:2.7,icon:'🏎️'},buggy:{name:'越野战车',desc:'稳重 · 跳跃强化',color:0x33d6a4,hp:125,speed:19,accel:22,turn:2.2,icon:'🚙'},armor:{name:'钢甲战车',desc:'碰撞 · 高耐久',color:0x71a4ff,hp:170,speed:16,accel:18,turn:1.85,icon:'🚘'}};
let selected='sport', mode='challenge',active=false,paused=true,ended=false;
const state={x:0,z:8,h:0,vx:0,vz:0,vy:0,y:0,roll:0,spin:0,hp:100,score:0,stars:0,kills:0,energy:35,boostUntil:0,jumpTime:-9,steering:0,modeTime:0,combo:0,hitFlash:0};
let enemies=[],coins=[],obstacles=[],ramps=[],effects=[],goal=10, lastTime=performance.now(),elapsed=0,camTop=false, hold=null, guideUntil=0, inputKey={};
let playerVisual=null,playerWheelMeshes=[];
const scene=new THREE.Scene();scene.background=new THREE.Color(0xb9e5ff);scene.fog=new THREE.Fog(0xb9e5ff,46,130);
const camera=new THREE.PerspectiveCamera(53,1,.1,220);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('canvasHost').appendChild(renderer.domElement);renderer.domElement.id='carCanvas';
const amb=new THREE.HemisphereLight(0xe5f5ff,0x61734b,2.2);scene.add(amb);
const sun=new THREE.DirectionalLight(0xfff4d7,2.65);sun.position.set(-17,26,-19);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-43;sun.shadow.camera.right=43;sun.shadow.camera.top=43;sun.shadow.camera.bottom=-43;sun.shadow.camera.near=2;sun.shadow.camera.far=90;sun.shadow.bias=-0.0008;scene.add(sun);
const mat=(color,metal=.08,rough=.65)=>new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough});
const asphalt=mat(0x39495a,0,.94),white=mat(0xe6ebee),yellow=mat(0xffd261),grass=mat(0x71b67f),stone=mat(0x879d9b),edge=mat(0xff747a),wood=mat(0xa66b3d);
const box=(parent,w,h,d,m,x=0,y=0,z=0,shadow=false)=>{const v=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);v.position.set(x,y,z);v.castShadow=shadow;v.receiveShadow=true;parent.add(v);return v};
const cyl=(parent,rt,rb,h,m,x,y,z,segments=12)=>{const v=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),m);v.position.set(x,y,z);v.castShadow=true;parent.add(v);return v};
const sphere=(parent,r,m,x,y,z,segments=12)=>{const v=new THREE.Mesh(new THREE.SphereGeometry(r,segments,9),m);v.position.set(x,y,z);v.castShadow=true;parent.add(v);return v};
const ground=new THREE.Mesh(new THREE.PlaneGeometry(320,320),grass);ground.rotation.x=-Math.PI/2;ground.position.y=-.05;ground.receiveShadow=true;scene.add(ground);
box(scene,51,.15,51,stone,0,.02,0);box(scene,48,.14,48,asphalt,0,.1,0);
for(let k=-20;k<=20;k+=5){box(scene,.19,.018,2,white,0,.19,k);box(scene,2,.018,.19,white,k,.19,0)}
for(let k=-23;k<=23;k+=2){box(scene,1,.12,.38,k%4?white:edge,k,.24,-24.1);box(scene,1,.12,.38,k%4?white:edge,k,.24,24.1);box(scene,.38,.12,1,k%4?white:edge,-24.1,.24,k);box(scene,.38,.12,1,k%4?white:edge,24.1,.24,k)}
const treeGreen=[mat(0x318c64),mat(0x50a872),mat(0x4b9965)],buildingColors=[mat(0xb6cadc),mat(0xe9c48f),mat(0xaec0a9),mat(0xaab5cd)];
function placeDecor(){for(let i=0;i<28;i++){const a=i*2.4;const x=(i%2===0?1:-1)*(28+(i%4)*3),z=(i%3===0?1:-1)*(27+(i%5)*2); if(i%3!==0){const h=3+(i*7%8);box(scene,2.5,h,3.1,buildingColors[i%buildingColors.length],x,h/2,z,true);box(scene,2.8,.23,3.4,stone,x,h+.1,z)}else {cyl(scene,.28,.36,2,wood,x,1,z);sphere(scene,1.65,treeGreen[i%3],x,2.55,z);sphere(scene,1.15,treeGreen[(i+1)%3],x+.75,3.05,z)}}}
placeDecor();
// Raised translucent boundaries keep the arena easy to read.
for(const [x,z,w,d] of [[-24.65,0,.18,49.8],[24.65,0,.18,49.8],[0,-24.65,49.8,.18],[0,24.65,49.8,.18]])box(scene,w,.8,d,mat(0x6895b9),x,.53,z);
const ringGeo=new THREE.TorusGeometry(.58,.12,8,22),coinMat=new THREE.MeshStandardMaterial({color:0xffca50,emissive:0xb87511,emissiveIntensity:.55,metalness:.67,roughness:.19});
const particleGeo=new THREE.SphereGeometry(.095,6,4);
function particle(x,y,z,color,count=10){for(let i=0;i<count;i++){const g=new THREE.Mesh(particleGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:1}));g.position.set(x,y,z);scene.add(g);const d=Math.PI*2*i/count;effects.push({mesh:g,vx:Math.cos(d)*(3+Math.random()*3),vy:2+Math.random()*4,vz:Math.sin(d)*(3+Math.random()*3),life:.52+Math.random()*.32,max:.84});}}
function makeCar(spec,scale=1,enemy=false){const root=new THREE.Group(),pivot=new THREE.Group();root.add(pivot);root.scale.setScalar(scale);const paint=mat(spec.color,.38,.28),paintTop=mat(spec.color,.33,.38),shadowPaint=mat(0x192638,.25,.35),glass=mat(0x7cc2df,.36,.13),rubber=mat(0x161b24,.05,.94),wheelHub=mat(0xdce9eb,.67,.3),lamp=mat(0xfff1c0,.05,.17);
 const chassis=box(pivot,1.75,.54,3.1,paint,0,.76,0,true); chassis.geometry.translate(0,0,0);
 box(pivot,1.39,.52,1.54,paintTop,0,1.27,.19,true);
 const wind=box(pivot,1.16,.08,.72,glass,0,1.56,-.25,true);wind.rotation.x=-.27;
 box(pivot,1.18,.07,.54,glass,0,1.56,.68,true);
 box(pivot,1.68,.15,.25,shadowPaint,0,.59,-1.49);box(pivot,1.68,.15,.25,shadowPaint,0,.59,1.49);
 const wheels=[];for(const xx of [-1.0,1.0])for(const zz of [-1.03,1.03]){const wh=new THREE.Group();wh.position.set(xx,.51,zz);pivot.add(wh);const tire=cyl(wh,.44,.44,.32,rubber,0,0,0,12);tire.rotation.z=Math.PI/2;const hub=cyl(wh,.22,.22,.34,wheelHub,0,0,0,12);hub.rotation.z=Math.PI/2;wheels.push(wh)}
 for(const xx of [-.63,.63]){box(pivot,.35,.12,.11,lamp,xx,.93,-1.59);box(pivot,.34,.12,.1,mat(0xff596c),xx,.91,1.6)}
 if(spec===specs.armor){box(pivot,2.15,.3,.32,stone,0,.68,-1.52);box(pivot,2,.16,.3,stone,0,.66,1.55);for(const zz of [-.72,.8])box(pivot,2.2,.12,.12,stone,0,1.05,zz)}
 if(spec===specs.buggy){for(const xx of [-.64,.64])box(pivot,.08,.44,1.55,shadowPaint,xx,1.7,.1);box(pivot,1.3,.09,.1,shadowPaint,0,1.94,.1)}
 const under=new THREE.Mesh(new THREE.RingGeometry(.9,1.58,28),new THREE.MeshBasicMaterial({color:enemy?0xff635d:0x4bd2ff,transparent:true,opacity:.16,depthWrite:false}));under.rotation.x=-Math.PI/2;under.position.y=.14;root.add(under);
 scene.add(root);return {root,pivot,wheels,glow:under};}
function resize(){const w=window.innerWidth,h=window.innerHeight;camera.aspect=w/h;camera.fov=w<h?61:53;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
window.addEventListener('resize',resize);resize();
const car=makeCar(specs.sport);playerVisual=car;car.root.position.set(state.x,0,state.z);
function clearEntities(arr){for(const v of arr){if(v.group)scene.remove(v.group);if(v.mesh)scene.remove(v.mesh);if(v.car)scene.remove(v.car.root)}arr.length=0}
function rnd(a,b){return a+Math.random()*(b-a)}
function spawnCoins(){clearEntities(coins);for(let i=0;i<19;i++){const x=rnd(-20,20),z=rnd(-20,20);if(Math.hypot(x,z-8)<4){i--;continue}const mesh=new THREE.Mesh(ringGeo,coinMat);mesh.position.set(x,1.25,z);scene.add(mesh);coins.push({x,z,mesh,phase:rnd(0,6),kind:i%5===0?'energy':'star',got:false})}}
function spawnBarriers(){clearEntities(obstacles);for(let i=0;i<12;i++){const x=rnd(-19,19),z=rnd(-19,19);if(Math.hypot(x,z-8)<5){i--;continue}const group=new THREE.Group();group.position.set(x,0,z);if(i%3===0){box(group,1.8,1.1,1.8,wood,0,.7,0,true);box(group,1.85,.07,1.85,mat(0xdfc391),0,1.28,0)}else {cyl(group,.55,.64,1.24,mat(0xff8b50),0,.7,0,13);cyl(group,.56,.56,.15,white,0,1.1,0,13);cyl(group,.6,.6,.13,white,0,.33,0,13)}scene.add(group);obstacles.push({x,z,group,hitAt:-2,r:1.3})}}
function makeRamp(x,z,angle){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=angle;const mesh=box(g,4,.17,6,mat(0x5ac6e2,.12,.48),0,1.05,0,true);mesh.rotation.x=-.29;box(g,4,.12,.18,white,0,.10,-2.96);box(g,4,.12,.18,yellow,0,1.85,3);scene.add(g);ramps.push({x,z,angle,mesh:g})}
makeRamp(-13,-11,.1);makeRamp(13,13,Math.PI+.15);
function randomEnemyPos(){let x,z;do{x=rnd(-20,20);z=rnd(-20,20)}while(Math.hypot(x-state.x,z-state.z)<12);return {x,z}}
function spawnBots(){clearEntities(enemies);for(let i=0;i<5;i++){const p=randomEnemyPos();const sp=[specs.sport,specs.buggy,specs.armor][i%3],tone={...sp,color:[0xeaa35b,0xf67aa5,0xb2a5ff,0x77d9ce,0xfa6666][i]};const visual=makeCar(tone,.92,true);enemies.push({x:p.x,z:p.z,h:rnd(-Math.PI,Math.PI),vx:0,vz:0,hp:sp.hp*.75,maxHp:sp.hp*.75,car:visual,spec:sp,stun:0,hitAt:-5,alive:true,aggression:.5+i*.19})}}
const formatTime=n=>Math.max(0,Math.ceil(n))+'s';
function showToast(s){const node=$('toast');node.textContent=s;node.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>node.classList.remove('show'),1800)}
function selectVehicle(id){selected=id;const sp=specs[id];$('vehicleDesc').textContent=sp.icon+' '+sp.name+' · '+sp.desc+' · 生命 '+sp.hp+' · 最高速 '+sp.speed;document.querySelectorAll('[data-car]').forEach(e=>e.classList.toggle('active',e.dataset.car===id));if(!active&&car.root){scene.remove(car.root);Object.assign(car,makeCar(sp));car.root.position.set(state.x,0,state.z);}}
function selectMode(id){mode=id;document.querySelectorAll('[data-mode]').forEach(e=>e.classList.toggle('active',e.dataset.mode===id));$('modeTip').textContent=id==='challenge'?'90秒内收集10个能量星，跳跃穿越障碍':id==='battle'?'对撞5辆AI汽车，存活到最后就是冠军':'无限时间，随意试验手推、甩尾和跳冲';}
for(const b of document.querySelectorAll('[data-car]'))b.addEventListener('click',()=>selectVehicle(b.dataset.car));
for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>selectMode(b.dataset.mode));
selectVehicle('sport');selectMode('challenge');
function reset(){const sp=specs[selected];Object.assign(state,{x:0,z:8,h:0,vx:0,vz:0,vy:0,y:0,roll:0,spin:0,hp:sp.hp,score:0,stars:0,kills:0,energy:40,boostUntil:0,jumpTime:-9,modeTime:0,combo:0,hitFlash:0});lastTime=performance.now();elapsed=0;active=true;paused=false;ended=false;hold=null;$('startScreen').classList.add('hidden');$('endScreen').classList.add('hidden');$('helpScreen').classList.add('hidden');$('pauseButton').textContent='⏸ 暂停';if(car.root)scene.remove(car.root);Object.assign(car,makeCar(sp));spawnCoins();spawnBarriers();if(mode==='battle')spawnBots();else clearEntities(enemies);guideUntil=performance.now()+12000;showToast('按住车尾向前推 · 快速前滑跳冲！');updateHUD();}
function endGame(won){if(ended)return;ended=true;paused=true;hold=null;$('endTitle').textContent=won?'🏆 挑战成功！':'💥 挑战结束';$('endDesc').textContent=(mode==='challenge'?'收集星星 '+state.stars+'/10':mode==='battle'?'淘汰对手 '+state.kills+'/5':'自由驾驶')+' · 得分 '+state.score;$('endScreen').classList.remove('hidden');}
function forward(h=state.h){return {x:Math.sin(h),z:-Math.cos(h)}}
function right(h=state.h){return {x:Math.cos(h),z:Math.sin(h)}}
const tmp=new THREE.Vector3();
function proj(x,y,z){tmp.set(x,y,z).project(camera);return {x:(tmp.x+1)*innerWidth*.5,y:(1-tmp.y)*innerHeight*.5}}
function touchFrame(){const c=proj(state.x,state.y+.8,state.z),f=forward(),r=right();const a=proj(state.x+f.x*1.55,state.y+.8,state.z+f.z*1.55),b=proj(state.x+r.x*.97,state.y+.8,state.z+r.z*.97);const ff={x:a.x-c.x,y:a.y-c.y},rr={x:b.x-c.x,y:b.y-c.y};const fl=Math.hypot(ff.x,ff.y)||1,rl=Math.hypot(rr.x,rr.y)||1;return {c,f:{x:ff.x/fl,y:ff.y/fl},r:{x:rr.x/rl,y:rr.y/rl},fl,rl};}
function zoneFor(x,y){const t=touchFrame(),dx=x-t.c.x,dy=y-t.c.y,fy=dx*t.f.x+dy*t.f.y,rx=dx*t.r.x+dy*t.r.y;const radius=Math.max(78,Math.min(innerWidth,innerHeight)*.15);if(Math.hypot(dx,dy)>radius+55)return null;const fN=fy/Math.max(t.fl,23),rN=rx/Math.max(t.rl,23);if(fN<-.32 && Math.abs(fN)>Math.abs(rN)*.7)return 'rear';if(rN<-.35 && Math.abs(rN)>Math.abs(fN)*.65)return 'left';if(rN>.35 && Math.abs(rN)>Math.abs(fN)*.65)return 'right';return 'body'}
function jumpDash(){if(state.y>.1||elapsed-state.jumpTime<2.7){if(elapsed-state.jumpTime<2.7)showToast('跳跃冷却中');return false}const f=forward();state.vy=selected==='buggy'?11.5:9.5;state.vx+=f.x*12;state.vz+=f.z*12;state.jumpTime=elapsed;state.boostUntil=elapsed+1.4;particle(state.x,1,state.z,0x60f6ff,17);showToast('🚀 跳跃冲刺！');return true}
function boost(){if(state.energy<25){showToast('⚡ 能量不足，收集蓝色光环');return}state.energy-=25;const f=forward();state.vx+=f.x*14;state.vz+=f.z*14;state.boostUntil=elapsed+1.9;particle(state.x,.5,state.z,0xffe86d,15);showToast('⚡ 氮气爆发！')}
function onPointerDown(e){if(paused||ended)return;if(e.target!==renderer.domElement)return;const zone=zoneFor(e.clientX,e.clientY);if(!zone)return;e.preventDefault();renderer.domElement.setPointerCapture(e.pointerId);const t=touchFrame();hold={id:e.pointerId,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,startTime:performance.now(),zone,startH:state.h,originDir:t.f,swiped:false};$('touchState').textContent=zone==='rear'?'推车尾 → 前进':zone==='left'?'推左侧 → 左移':zone==='right'?'推右侧 → 右移':'按住车身 → 旋转';}
function onPointerMove(e){if(!hold||e.pointerId!==hold.id)return;e.preventDefault();const dx=e.clientX-hold.startX,dy=e.clientY-hold.startY,forwardDistance=dx*hold.originDir.x+dy*hold.originDir.y,lateral=Math.abs(dx*hold.originDir.y-dy*hold.originDir.x),elapsedMs=performance.now()-hold.startTime;
 if(!hold.swiped && forwardDistance>Math.max(48,Math.min(innerWidth,innerHeight)*.09) && lateral<Math.abs(forwardDistance)*.95 && elapsedMs<650){hold.swiped=true;jumpDash();}
 if(!hold.swiped && hold.zone==='body' && elapsedMs>60){ // Follow finger turn: movement around car alters heading smoothly.
  const f=touchFrame(),relX=e.clientX-f.c.x,relY=e.clientY-f.c.y;
  const a=Math.atan2(relY,relX),a0=Math.atan2(hold.startY-f.c.y,hold.startX-f.c.x);
  let delta=a-a0;while(delta>Math.PI)delta-=Math.PI*2;while(delta<-Math.PI)delta+=Math.PI*2;
  const sideShift=(e.clientX-hold.lastX);
  state.h+=clamp(delta*.06+sideShift*.012,-.15,.15);state.steering=clamp(sideShift*.1,-1,1);
 }
 hold.lastX=e.clientX;hold.lastY=e.clientY;
}
function onPointerUp(e){if(!hold||e.pointerId!==hold.id)return;const old=hold;hold=null;$('touchState').textContent='直接触摸汽车操作';if(old.zone==='rear'&&!old.swiped && performance.now()-old.startTime<200){const f=forward();state.vx+=f.x*2.6;state.vz+=f.z*2.6}}
renderer.domElement.addEventListener('pointerdown',onPointerDown);renderer.domElement.addEventListener('pointermove',onPointerMove);renderer.domElement.addEventListener('pointerup',onPointerUp);renderer.domElement.addEventListener('pointercancel',onPointerUp);renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
const mobileButtons={rear:0,left:0,right:0,brake:0,turnLeft:0,turnRight:0};
for(const el of document.querySelectorAll('[data-action]')){const key=el.dataset.action;el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);if(key==='jump')jumpDash();else if(key==='boost')boost();else mobileButtons[key]=1});const release=()=>{mobileButtons[key]=0};el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);}
$('assistBtn').onclick=()=>{$('assistControls').classList.toggle('on');$('assistBtn').classList.toggle('active')};
$('viewButton').onclick=()=>{camTop=!camTop;showToast(camTop?'上帝俯视镜头':'跟随镜头')};
$('pauseButton').onclick=()=>{if(!active)return;paused=!paused;$('pauseButton').textContent=paused?'▶ 继续':'⏸ 暂停';if(paused)showToast('已暂停')};
$('restartButton').onclick=()=>{reset()};
$('helpButton').onclick=()=>{$('helpScreen').classList.remove('hidden');paused=true};
$('helpClose').onclick=()=>{$('helpScreen').classList.add('hidden');paused=false};
$('startButton').onclick=reset;$('playAgain').onclick=reset;
$('chooseAgain').onclick=()=>{$('endScreen').classList.add('hidden');$('startScreen').classList.remove('hidden');paused=true;active=false};
$('backToMenu').onclick=()=>{location.href='classic_game.html'};
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();inputKey[k]=true;if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(k===' '&&!e.repeat&&!paused)jumpDash();if(k==='shift'&&!e.repeat&&!paused)boost();if(k==='p')$('pauseButton').click();});window.addEventListener('keyup',e=>{inputKey[e.key.toLowerCase()]=false});
function paintGuide(){if(!active||paused)return;const t=touchFrame(),guide=$('gestureHints');if(performance.now()>guideUntil){guide.style.opacity='0';return}guide.style.opacity='1';const labels=[['rear','推尾·前进',-1.15,0],['left','←推左',0,-1.35],['right','推右→',0,1.35],['body','旋转',0,0]];for(const [id,label,ff,rr]of labels){const node=$('hint-'+id);const offX=(t.f.x*t.fl*ff+t.r.x*t.rl*rr),offY=(t.f.y*t.fl*ff+t.r.y*t.rl*rr);node.style.left=(t.c.x+offX)+'px';node.style.top=(t.c.y+offY)+'px';node.textContent=label}}
function updateHUD(){const sp=specs[selected];$('healthFill').style.width=(clamp(state.hp/sp.hp*100,0,100))+'%';$('healthText').textContent=Math.ceil(Math.max(0,state.hp))+'/'+sp.hp;$('energyFill').style.width=(clamp(state.energy,0,100))+'%';$('energyText').textContent=Math.floor(state.energy)+'%';$('speed').textContent=Math.round(Math.hypot(state.vx,state.vz)*8)+' km/h';$('score').textContent=state.score;$('time').textContent=mode==='challenge'?formatTime(90-state.modeTime):formatTime(state.modeTime);$('objective').textContent=mode==='challenge'?`⭐ ${state.stars}/10`:mode==='battle'?`🚘 ${enemies.filter(e=>e.alive).length} 辆敌车`:'🌍 自由驾驶';$('jumpReady').style.opacity=elapsed-state.jumpTime>2.7?'1':'.5';$('boostReady').style.opacity=state.energy>=25?'1':'.5';}
function collideWorld(){const r=22.55;const oldX=state.x,oldZ=state.z;state.x=clamp(state.x,-r,r);state.z=clamp(state.z,-r,r);if(oldX!==state.x){state.vx*=-.28;state.hp-=.03}if(oldZ!==state.z){state.vz*=-.28;state.hp-=.03}}
let starsAngle=0;
function update(dt){elapsed+=dt;state.modeTime+=dt;if(state.hitFlash>0)state.hitFlash=Math.max(0,state.hitFlash-dt);
 // Hand-based controls are independent of a traditional joystick.
 let pushForward=mobileButtons.rear||inputKey.w||inputKey.arrowup?1:0;
 let pushBack=mobileButtons.brake||inputKey.s||inputKey.arrowdown?1:0;
 let pushLeft=mobileButtons.left||inputKey.q?1:0;
 let pushRight=mobileButtons.right||inputKey.e?1:0;
 let turn= (mobileButtons.turnRight||inputKey.d||inputKey.arrowright?1:0)-(mobileButtons.turnLeft||inputKey.a||inputKey.arrowleft?1:0);
 if(hold&&!hold.swiped){if(hold.zone==='rear')pushForward=1;else if(hold.zone==='left')pushLeft=1;else if(hold.zone==='right')pushRight=1;}
 const sp=specs[selected],f=forward(),r=right();const speed=Math.hypot(state.vx,state.vz),power=elapsed<state.boostUntil?1.75:1;
 state.h+=turn*sp.turn*dt*(.45+.55*clamp(speed/8,0,1));
 state.vx+=(f.x*(pushForward-pushBack*.75)*sp.accel + r.x*(pushRight-pushLeft)*sp.accel*.80)*dt*power;
 state.vz+=(f.z*(pushForward-pushBack*.75)*sp.accel + r.z*(pushRight-pushLeft)*sp.accel*.80)*dt*power;
 const drag=(pushForward||pushBack||pushLeft||pushRight)?2.05:2.65;
 const friction=Math.exp(-drag*dt);state.vx*=friction;state.vz*=friction;
 const cap=sp.speed*(elapsed<state.boostUntil?1.55:1);if(speed>cap*1.25){state.vx*=.985;state.vz*=.985;}
 state.x+=state.vx*dt;state.z+=state.vz*dt;collideWorld();
 if(state.y>0||state.vy>0){state.vy-=23*dt;state.y+=state.vy*dt;if(state.y<=0){state.y=0;state.vy=0;particle(state.x,.22,state.z,0xb1e9ff,12)}}
 const localRight=(state.vx*r.x+state.vz*r.z);state.roll=lerp(state.roll,clamp(-localRight*.035,-.17,.17),Math.min(1,dt*6));state.steering*=Math.exp(-dt*7);
 // Jump ramps trigger only when crossing the rising slope at meaningful velocity.
 for(const ramp of ramps){const dx=state.x-ramp.x,dz=state.z-ramp.z;const co=Math.cos(ramp.angle),si=Math.sin(ramp.angle),lx=dx*co-dz*si,lz=dx*si+dz*co;if(Math.abs(lx)<2.35&&lz>-3&&lz<3&&state.y<.03&&speed>4 && elapsed-state.jumpTime>1.7){state.vy=7.2;state.jumpTime=elapsed;state.boostUntil=Math.max(state.boostUntil,elapsed+.55);showToast('🛫 飞跃跳台！')}}
 for(const obj of obstacles){const dx=state.x-obj.x,dz=state.z-obj.z,dist=Math.hypot(dx,dz);if(dist<2.15&&state.y<.9){const nx=dx/(dist||1),nz=dz/(dist||1);state.x=obj.x+nx*2.15;state.z=obj.z+nz*2.15;const hit=Math.max(0,Math.abs(state.vx*nx+state.vz*nz));state.vx+=nx*(2+hit*.6);state.vz+=nz*(2+hit*.6);if(elapsed-obj.hitAt>1.0){obj.hitAt=elapsed;state.hp-=Math.min(15,4+hit*.75);state.hitFlash=.35;particle(obj.x,.9,obj.z,0xffac5b,9);showToast('💥 撞到路障！')}}}
 for(const c of coins){if(!c.mesh.visible)continue;c.mesh.rotation.y+=dt*1.8;c.mesh.position.y=1.25+Math.sin(elapsed*3+c.phase)*.22;const d=Math.hypot(c.x-state.x,c.z-state.z);if(d<1.6){c.mesh.visible=false;if(c.kind==='energy'){state.energy=clamp(state.energy+35,0,100);state.hp=clamp(state.hp+5,0,sp.hp);state.score+=60;showToast('⚡ 能量+35 · 生命+5')}else {state.stars++;state.score+=100;showToast('⭐ 星星 '+state.stars+'/'+goal)}particle(c.x,1.15,c.z,c.kind==='energy'?0x4fe7ff:0xffd25e,12)}}
 if(mode==='battle')updateBots(dt);if(mode==='free'&&coins.every(c=>!c.mesh.visible))spawnCoins();
 for(let i=effects.length-1;i>=0;i--){const o=effects[i];o.life-=dt;o.mesh.position.x+=o.vx*dt;o.mesh.position.y+=o.vy*dt;o.mesh.position.z+=o.vz*dt;o.vy-=12*dt;o.mesh.material.opacity=clamp(o.life/o.max,0,1);if(o.life<=0){scene.remove(o.mesh);o.mesh.material.dispose();effects.splice(i,1)}}
 if(state.hp<=0)endGame(false);else if(mode==='challenge'){if(state.stars>=goal)endGame(true);else if(state.modeTime>=90)endGame(false)} else if(mode==='battle'&&enemies.every(e=>!e.alive))endGame(true);
 const posY=state.y+Math.sin(elapsed*17)*Math.min(speed*.003,.045);
 car.root.position.set(state.x,posY,state.z);car.root.rotation.y=state.h;car.pivot.rotation.z=state.roll;for(const w of car.wheels)w.rotation.x+=speed*dt*.45;
 car.glow.material.opacity=elapsed<state.boostUntil?.32:.16;
 if(speed>9 && elapsed<state.boostUntil && Math.random()<.5){const b=forward(),r=right();particle(state.x-b.x*1.4+r.x*rnd(-.5,.5),.4,state.z-b.z*1.4+r.z*rnd(-.5,.5),0x78eaff,2)}
 }
function updateBots(dt){for(const e of enemies){if(!e.alive)continue;const dx=state.x-e.x,dz=state.z-e.z,dist=Math.hypot(dx,dz)||1;const toward=Math.atan2(dx,-dz);let diff=toward-e.h;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;e.h+=clamp(diff,-dt*1.15,dt*1.15);let s=e.stun>0?.3:1;e.stun=Math.max(0,e.stun-dt);const f=forward(e.h);e.vx=(e.vx+f.x*13*dt*s)*Math.exp(-1.9*dt);e.vz=(e.vz+f.z*13*dt*s)*Math.exp(-1.9*dt);e.x=clamp(e.x+e.vx*dt,-21.8,21.8);e.z=clamp(e.z+e.vz*dt,-21.8,21.8);e.car.root.position.set(e.x,0,e.z);e.car.root.rotation.y=e.h;for(const w of e.car.wheels)w.rotation.x+=Math.hypot(e.vx,e.vz)*dt*.4;
 if(dist<2.2&&state.y<1.1&&elapsed-e.hitAt>.85){e.hitAt=elapsed;const relative=Math.hypot(state.vx-e.vx,state.vz-e.vz);const damage=7+relative*1.3*(selected==='armor'?1.5:1);e.hp-=damage;state.hp-=Math.max(2,(10+relative*.6)*(selected==='armor'?.55:1));e.stun=.55;state.hitFlash=.3;const nx=dx/dist,nz=dz/dist;state.vx+=nx*7;state.vz+=nz*7;e.vx-=nx*6;e.vz-=nz*6;particle((state.x+e.x)/2,.9,(state.z+e.z)/2,0xffc161,18);showToast('💥 碰撞命中 '+Math.round(damage)+'!');if(e.hp<=0){e.alive=false;state.kills++;state.score+=250;scene.remove(e.car.root);particle(e.x,1,e.z,0xff7769,24);showToast('🏁 淘汰一辆敌车！')}}}}
function cameraUpdate(dt){const target= new THREE.Vector3(state.x,0,state.z-1.2);const dest=camTop?new THREE.Vector3(state.x,36,state.z+2):new THREE.Vector3(state.x,13,state.z+14);const a=1-Math.exp(-dt*5.2);camera.position.lerp(dest,a);camera.lookAt(target);}
function drawMap(){const canvas=$('miniMap'),cx=canvas.getContext('2d'),s=canvas.width;cx.clearRect(0,0,s,s);cx.fillStyle='rgba(15,35,57,.9)';cx.fillRect(0,0,s,s);cx.strokeStyle='#7891a8';cx.lineWidth=2;cx.strokeRect(7,7,s-14,s-14);const p=(x,z)=>({x:8+(x+24)/48*(s-16),y:8+(z+24)/48*(s-16)});
 for(const c of coins){if(!c.mesh.visible)continue;const q=p(c.x,c.z);cx.fillStyle=c.kind==='energy'?'#69eaff':'#f7d676';cx.beginPath();cx.arc(q.x,q.y,2.2,0,Math.PI*2);cx.fill()}
 for(const e of enemies){if(!e.alive)continue;const q=p(e.x,e.z);cx.fillStyle='#f77f84';cx.beginPath();cx.arc(q.x,q.y,3.6,0,Math.PI*2);cx.fill()}
 const q=p(state.x,state.z);cx.save();cx.translate(q.x,q.y);cx.rotate(state.h);cx.fillStyle='#6ee6ff';cx.beginPath();cx.moveTo(0,-6);cx.lineTo(4,4);cx.lineTo(-4,4);cx.closePath();cx.fill();cx.restore();}
let hudCounter=0;function loop(t){let dt=clamp((t-lastTime)/1000,0,.040);lastTime=t;if(active&&!paused&&!ended){update(dt);cameraUpdate(dt);if((hudCounter++%7)===0){updateHUD();drawMap()}paintGuide()}else{cameraUpdate(dt);if(!active){car.root.rotation.y+=dt*.20}}
 renderer.render(scene,camera);requestAnimationFrame(loop)}
camera.position.set(0,13,22);camera.lookAt(0,0,6.8);requestAnimationFrame(loop);
window.addEventListener('blur',()=>{if(active&&!ended){paused=true;$('pauseButton').textContent='▶ 继续';hold=null}});
window.__carGameTest={start:reset,state,enemies,coins,selectMode,selectVehicle,jumpDash,boost,touchFrame,zoneFor,get ended(){return ended},get paused(){return paused},setPaused(v){paused=v}};
})();
