// AFTERGLOW RUSH — original procedural city, course and vehicles.
export function buildWorld(THREE, scene) {
  const preexistingSceneChildren=new Set(scene.children);
  const TAU = Math.PI * 2;
  const clamp = THREE.MathUtils.clamp;
  let seed = 4917;
  const rand = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
  const up = new THREE.Vector3(0, 1, 0);
  const curve = new THREE.CatmullRomCurve3([
    [80,7,400],[-120,7,400],[-355,12,245],[-438,15,-60],[-285,10,-340],
    [0,12,-425],[300,22,-275],[403,23,-20],[294,12,255]
  ].map(p=>new THREE.Vector3(...p)), true, 'catmullrom', .38);
  curve.arcLengthDivisions = 2200;
  const length = curve.getLength(), width = 26;
  const wrap = s => ((s % length) + length) % length;
  function sample(s, x=0) {
    const t = wrap(s) / length;
    const position=curve.getPointAt(t), tangent=curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    position.addScaledVector(right,x);
    return {position,tangent,right,heading:Math.atan2(-tangent.x,-tangent.z)};
  }
  const ramps = [
    {s:length*.185,x:-7.4,width:7.6,length:33,height:4.1},
    {s:length*.675,x:7.2,width:8.5,length:42,height:5.8},
    {s:length*.323,x:22,width:8,length:34,height:4.6}
  ];
  const shortcuts=[{start:length*.285,end:length*.387,x:21.5,width:16}];
  function branch(s) { const k=s/length; return k>.285 && k<.387 ? Math.sin(Math.PI*(k-.285)/.102)*16 : 0; }
  function surface(s,x=0) {
    const d=wrap(s); let y=sample(d,x).position.y;
    for(const r of ramps) if(d>=r.s && d<=r.s+r.length && Math.abs(x-r.x)<r.width*.5) y+=(d-r.s)/r.length*r.height;
    return y;
  }
  const mat = (color, roughness=.7, metalness=0, extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
  const roadMat=mat('#172b3b',.89), shoulderMat=mat('#566875',.86), concreteMat=mat('#364e63',.9);
  const asphalt=document.createElement('canvas');asphalt.width=512;asphalt.height=512;
  const ac=asphalt.getContext('2d');ac.fillStyle='#a0a7ad';ac.fillRect(0,0,512,512);
  let asphaltSeed=81;const noise=()=>((asphaltSeed=Math.imul(asphaltSeed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let i=0;i<25000;i++){const shade=110+Math.floor(noise()*85);ac.fillStyle=`rgba(${shade},${shade},${shade},.35)`;ac.fillRect(noise()*512,noise()*512,1+noise()*2,1+noise()*2);}
  ac.fillStyle='#6d747b22';ac.fillRect(116,0,78,512);ac.fillRect(366,0,68,512);ac.fillStyle='#30394422';ac.fillRect(0,310,512,2);
  const asphaltTexture=new THREE.CanvasTexture(asphalt);asphaltTexture.wrapS=asphaltTexture.wrapT=THREE.RepeatWrapping;asphaltTexture.colorSpace=THREE.SRGBColorSpace;asphaltTexture.anisotropy=8;roadMat.map=asphaltTexture;
  const lineMat=mat('#c1d6d6',.65,0,{emissive:'#50696a',emissiveIntensity:.25});
  const cyanMat=mat('#74eff2',.4,.25,{emissive:'#1fbabf',emissiveIntensity:1.6});
  const limeMat=mat('#e7ff66',.4,.15,{emissive:'#a3cc27',emissiveIntensity:.8});
  const pinkMat=mat('#f580a0',.4,.2,{emissive:'#d84378',emissiveIntensity:.7});
  const darkMat=mat('#162937',.55,.5), whiteMat=mat('#d2dfdf',.4,.2);
  const boxGeo=new THREE.BoxGeometry(1,1,1), dummy=new THREE.Object3D();
  const roadMeshes=[];
  function mergeByMaterial(meshes,parent) {
    const batches=new Map(),result=new Map();
    parent.updateWorldMatrix(true,false);
    const inverse=new THREE.Matrix4().copy(parent.matrixWorld).invert();
    for(const m of meshes){if(!batches.has(m.material))batches.set(m.material,[]);batches.get(m.material).push(m);}
    for(const [material,items] of batches){
      if(items.length===1){result.set(material,items[0]);continue;}
      const pos=[],nor=[],tex=[],ind=[];let offset=0,castShadow=false,receiveShadow=false;
      for(const m of items){
        m.updateWorldMatrix(true,false);const transform=new THREE.Matrix4().multiplyMatrices(inverse,m.matrixWorld),g=m.geometry.clone().applyMatrix4(transform);
        const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;
        for(let i=0;i<p.count;i++){pos.push(p.getX(i),p.getY(i),p.getZ(i));nor.push(n?n.getX(i):0,n?n.getY(i):1,n?n.getZ(i):0);tex.push(u?u.getX(i):0,u?u.getY(i):0);}
        if(g.index)for(const i of g.index.array)ind.push(i+offset);else for(let i=0;i<p.count;i++)ind.push(i+offset);
        offset+=p.count;castShadow ||= m.castShadow;receiveShadow ||= m.receiveShadow;m.removeFromParent();g.dispose();
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));g.setIndex(ind);g.computeBoundingSphere();
      const combined=mesh(g,material,parent);combined.castShadow=castShadow;combined.receiveShadow=receiveShadow;result.set(material,combined);
    }
    return result;
  }
  function mesh(geometry,material,parent=scene) { const m=new THREE.Mesh(geometry,material); parent.add(m); return m; }
  function box(parent,w,h,d,material,x=0,y=0,z=0) {const m=mesh(boxGeo,material,parent);m.scale.set(w,h,d);m.position.set(x,y,z);return m;}
  function instance(geometry,material,placements) {
    const m=new THREE.InstancedMesh(geometry,material,placements.length);
    placements.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx||0,p.ry||0,p.rz||0);dummy.scale.set(p.w||1,p.h||1,p.d||1);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});
    m.instanceMatrix.needsUpdate=true;scene.add(m);return m;
  }
  function at(s,x,y=0) {const p=sample(s,x);p.position.y+=y;return p;}
  function placement(s,x,y,w,h,d) {const p=at(s,x,y);return {x:p.position.x,y:p.position.y,z:p.position.z,ry:p.heading,w,h,d};}
  function ribbon(start,end,left,right,material,height=.025,step=5) {
    const positions=[],uv=[],indices=[],count=Math.ceil((end-start)/step);
    for(let i=0;i<=count;i++) {
      const s=start+(end-start)*i/count;
      const lo=typeof left==='function'?left(s):left, hi=typeof right==='function'?right(s):right;
      for(const x of [lo,hi]) {const p=sample(s,x).position;p.y+=typeof height==='function'?height(s,x):height;positions.push(p.x,p.y,p.z);uv.push(x/26,s/20);}
      if(i<count){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const m=mesh(g,material);m.receiveShadow=true;roadMeshes.push(m);return m;
  }

  // The main game owns sky, scene lighting and cinematic color grading.
  const ground=mesh(new THREE.PlaneGeometry(6000,6000),mat('#253f52',1));ground.rotation.x=-Math.PI/2;ground.position.y=-3;
  // A broad waterfront runs underneath the east viaduct.
  const water=mesh(new THREE.PlaneGeometry(290,1550),mat('#397483',.2,.65,{emissive:'#173e52',emissiveIntensity:.3}));water.rotation.x=-Math.PI/2;water.position.set(393,-1,100);
  const reflections=[];
  for(let i=0;i<70;i++) reflections.push({x:260+rand()*250,y:-.93,z:-620+rand()*1400,w:1+rand()*2,h:.03,d:12+rand()*28});
  instance(boxGeo,mat('#698e9f',.25,.35),reflections);

  // Seamless asphalt, inset lane paint, a widened express route and safety rails.
  ribbon(0,length,-14.4,s=>14.4+branch(s),shoulderMat,-.1);
  ribbon(0,length,-13,s=>13+branch(s),roadMat,0);
  ribbon(0,length,-12.45,-12.27,lineMat,.032);
  ribbon(0,length,s=>12.27+branch(s),s=>12.45+branch(s),lineMat,.032);
  for(const x of [-4.33,4.33]) for(let s=0;s<length;s+=16) ribbon(s,Math.min(s+7,length),x-.085,x+.085,lineMat,.04,7);
  for(let s=shortcuts[0].start+12;s<shortcuts[0].end-12;s+=15) ribbon(s,s+7,12.92,13.10,limeMat,.045,7);
  const rails=[],railLights=[],piers=[],lampPoles=[],lampArms=[],lampHeads=[];
  for(let s=0;s<length;s+=6) for(const side of [-1,1]) {
    const x=side<0?-14.15:14.15+branch(s);
    rails.push(placement(s,x,.57,.48,1.1,5.93));
    railLights.push(placement(s,x,.96,.53,.055,5.95));
  }
  instance(boxGeo,concreteMat,rails);instance(boxGeo,cyanMat,railLights);
  for(let s=12;s<length;s+=39) {
    const p=sample(s);const bridge=p.position.y>12;
    if(bridge) for(const side of [-1,1]) {const q=sample(s,side*9);piers.push({x:q.position.x,y:(q.position.y-3)/2-2,z:q.position.z,ry:q.heading,w:2.4,h:q.position.y+3,d:3});}
    if(s>length*.415&&s<length*.493)continue;
    for(const side of [-1,1]) {
      const x=side<0?-16:16+branch(s),p=sample(s,x);
      lampPoles.push(placement(s,x,5.2,.17,10.4,.17));
      lampArms.push(placement(s,x-side*1.8,10.3,3.6,.18,.16));
      lampHeads.push(placement(s,x-side*3.35,10.25,.9,.12,2));
    }
  }
  instance(boxGeo,concreteMat,piers);instance(boxGeo,darkMat,lampPoles);instance(boxGeo,darkMat,lampArms);instance(boxGeo,mat('#d1efff',.4,0,{emissive:'#d1efff',emissiveIntensity:2.8}),lampHeads);

  // Physical ramps: the top surface is also used by the driving simulation.
  for(const r of ramps) {
    ribbon(r.s,r.s+r.length,r.x-r.width/2,r.x+r.width/2,mat('#65798a',.7,.25),(s)=>((s-r.s)/r.length)*r.height+.05,2);
    for(const x of [r.x-r.width/2+.18,r.x+r.width/2-.18]) ribbon(r.s,r.s+r.length,x-.12,x+.12,limeMat,s=>(s-r.s)/r.length*r.height+.07,2);
    for(let j=0;j<4;j++){const ds=r.s+9+j*5;ribbon(ds,ds+1,r.x-r.width*.38,r.x+r.width*.38,limeMat,s=>(s-r.s)/r.length*r.height+.09,1);}
    const p=sample(r.s+r.length,r.x);const stop=box(scene,r.width,r.height,.4,concreteMat);stop.position.copy(p.position);stop.position.y+=r.height/2;stop.rotation.y=p.heading;
  }

  // A curved tunnel with evenly spaced luminous ribs.
  const tunnelStart=length*.415,tunnelEnd=length*.493;
  const tunnelPos=[],tunnelIndices=[],profile=[];
  profile.push([-15.3,0],[-15.3,6]);
  for(let j=0;j<=16;j++){const a=Math.PI-j/16*Math.PI;profile.push([Math.cos(a)*15.3,6+Math.sin(a)*8]);}
  profile.push([15.3,0]);
  const sections=Math.ceil((tunnelEnd-tunnelStart)/7),n=profile.length;
  for(let i=0;i<=sections;i++) {const p=sample(tunnelStart+(tunnelEnd-tunnelStart)*i/sections);for(const [x,y] of profile){const q=p.position.clone().addScaledVector(p.right,x);q.y+=y;tunnelPos.push(q.x,q.y,q.z);}if(i<sections)for(let j=0;j<n-1;j++){const a=i*n+j;tunnelIndices.push(a,a+1,a+n,a+1,a+n+1,a+n);}}
  const tunnelGeo=new THREE.BufferGeometry();tunnelGeo.setAttribute('position',new THREE.Float32BufferAttribute(tunnelPos,3));tunnelGeo.setIndex(tunnelIndices);tunnelGeo.computeVertexNormals();mesh(tunnelGeo,mat('#182c42',.75,.1,{side:THREE.DoubleSide}));
  const ribs=[];
  for(let s=tunnelStart;s<tunnelEnd;s+=15) for(const x of [-14.7,14.7]) {ribs.push(placement(s,x,4.1,.12,7.8,.22));ribs.push(placement(s,x*.67,12.1,8.1,.1,.22));}
  instance(boxGeo,cyanMat,ribs);
  const tunnelLamps=[];for(let s=tunnelStart+5;s<tunnelEnd;s+=12)tunnelLamps.push(placement(s,0,13.8,5,.08,1.8));instance(boxGeo,whiteMat,tunnelLamps);

  // Entirely original procedural towers; facade textures keep draw calls low.
  function facadeTexture(tone) {
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;const c=canvas.getContext('2d');
    c.fillStyle=tone;c.fillRect(0,0,128,256);
    for(let y=7;y<250;y+=15)for(let x=7;x<124;x+=15){c.fillStyle=rand()<.43?(['#8399ae','#bdcbb8','#71a2bb','#dbbb92'][Math.floor(rand()*4)]):'#263e53';c.fillRect(x,y,6,8);}
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;
  }
  const buildingMats=['#30465b','#3f526a','#354258','#445d73'].map(c=>{const t=facadeTexture(c);return mat('#aac4d6',.68,.18,{map:t,emissive:'#667c8c',emissiveMap:t,emissiveIntensity:.4});});
  const buildings=buildingMats.map(()=>[]),roofs=[],roofLights=[];
  const roadCenters=[];for(let s=0;s<length;s+=20)roadCenters.push(sample(s).position);
  function nearRoad(x,z,r=52) {for(const p of roadCenters)if((x-p.x)**2+(z-p.z)**2<r*r)return true;return false;}
  for(let i=0;i<420;i++) {
    const x=(rand()-.5)*1900,z=(rand()-.5)*1750;
    if((x>250&&x<535&&z<760&&z>-650)||nearRoad(x,z,57))continue;
    const w=17+rand()*32,d=17+rand()*28,h=22+Math.pow(rand(),1.6)*175;
    const row=Math.floor(rand()*4);buildings[row].push({x,y:h/2-3,z,w,h,d});
    roofs.push({x,y:h-2,z,w:w*1.03,h:1.2,d:d*1.03});
    if(h>80){roofLights.push({x,y:h-1.4,z:z-d*.5,w:w+.4,h:.22,d:.25});if(rand()<.5)roofs.push({x,y:h+4,z,w:1,h:12,d:1});}
  }
  buildings.forEach((b,i)=>instance(boxGeo,buildingMats[i],b));instance(boxGeo,darkMat,roofs);instance(boxGeo,cyanMat,roofLights);
  // Close street-level blocks and neon storefronts define the racing corridor.
  const lowBlocks=[],shopLights=[];
  for(let s=38;s<length;s+=61){if(s>length*.41&&s<length*.5)continue;for(const side of [-1,1]){const x=side*(29+rand()*6)+(side>0?branch(s):0),p=sample(s,x);if(p.position.x>252&&p.position.x<525)continue;const h=5+rand()*9;lowBlocks.push({x:p.position.x,y:h/2-2,z:p.position.z,ry:p.heading,w:13+rand()*6,h,d:22});shopLights.push({x:p.position.x-p.right.x*side*7,y:h-2,z:p.position.z-p.right.z*side*7,ry:p.heading,w:.25,h:.4,d:18});}}
  instance(boxGeo,mat('#3d5063',.84,.1),lowBlocks);instance(boxGeo,pinkMat,shopLights);

  function textTexture(title,subtitle='',accent='#dafa66',wide=false) {
    const c=document.createElement('canvas');c.width=wide?1024:512;c.height=256;const q=c.getContext('2d');
    q.fillStyle='#102130';q.fillRect(0,0,c.width,256);q.fillStyle=accent;q.fillRect(0,0,12,256);q.fillRect(32,30,46,8);
    q.fillStyle='#f0f5ef';q.font=`900 ${wide?76:57}px Arial`;q.textBaseline='middle';q.fillText(title,32,120,c.width-65);
    q.fillStyle=accent;q.font='bold 21px Arial';q.fillText(subtitle,34,205,c.width-65);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
  }
  function billboard(s,x,title,subtitle,accent='#dafa66') {
    const p=sample(s,x),g=new THREE.Group();g.position.copy(p.position);g.rotation.y=p.heading;scene.add(g);
    box(g,.45,9,.45,concreteMat,-4,4.5);box(g,.45,9,.45,concreteMat,4,4.5);
    box(g,15,5,.32,darkMat,0,10);
    const face=mesh(new THREE.PlaneGeometry(14.6,4.6),new THREE.MeshBasicMaterial({map:textTexture(title,subtitle,accent),side:THREE.DoubleSide}),g);face.position.set(0,10,0.19);
    box(g,15,.09,.4,accent==='#dafa66'?limeMat:cyanMat,0,12.5);
  }
  billboard(length*.022,-23,'AFTERGLOW','CHASE THE LAST LIGHT.');
  billboard(length*.134,24,'VELOCITY','STAY IN THE MOMENT.','#6eeaf4');
  billboard(length*.275,26,'SKYLINE','EXPRESS ROUTE  ↗');
  billboard(length*.398,-23,'NIGHTSHIFT','LIGHT UP THE CITY.','#6eeaf4');
  billboard(length*.645,-24,'ALTITUDE','TAKE FLIGHT.');
  billboard(length*.833,26,'AFTERGLOW','YOUR CITY. YOUR LINE.','#6eeaf4');
  billboard(length*.954,-23,'ONE LAST','PUSH TO THE FINISH.');

  // Start / finish gantry and broad checker line.
  const gate=new THREE.Group(),gp=sample(0);gate.position.copy(gp.position);gate.rotation.y=gp.heading;scene.add(gate);
  box(gate,.85,12,.85,darkMat,-15,6);box(gate,.85,12,.85,darkMat,15,6);box(gate,31,2.8,.8,darkMat,0,12);
  box(gate,.12,11,1,limeMat,-14.5,5.5);box(gate,.12,11,1,limeMat,14.5,5.5);box(gate,30,.12,1,limeMat,0,10.55);
  const gateFace=mesh(new THREE.PlaneGeometry(28,2.5),new THREE.MeshBasicMaterial({map:textTexture('AFTERGLOW  /  RUSH','01   ·   SOLSTICE CIRCUIT','#dafa66',true),side:THREE.DoubleSide}),gate);gateFace.position.set(0,12,.43);
  const grid=[];for(let row=0;row<4;row++)for(let lane=0;lane<26;lane++)if((row+lane)%2===0)grid.push(placement(row*.7-.9,-12.5+lane,.055,.99,.025,.69));instance(boxGeo,whiteMat,grid);
  for(let row=1;row<=4;row++)for(const x of [-8,0,8]){const s=length-row*10;ribbon(s,s+.15,x-1.65,x+1.65,lineMat,.045);ribbon(s,s+5,x-1.65,x-1.5,lineMat,.045);ribbon(s,s+5,x+1.5,x+1.65,lineMat,.045);}
  for(let i=1;i<=4;i++) {
    const s=length*.2*i,p=sample(s),g=new THREE.Group();g.position.copy(p.position);g.rotation.y=p.heading;scene.add(g);
    for(const x of [-14.7,14.7]){box(g,.48,9.5,.55,darkMat,x,4.75);box(g,.09,9.2,.6,cyanMat,x-Math.sign(x)*.26,4.7);}
    box(g,30,.42,.6,darkMat,0,9.5);box(g,30,.08,.62,cyanMat,0,9.2);
    const sign=mesh(new THREE.PlaneGeometry(10,2.1),new THREE.MeshBasicMaterial({map:textTexture('CHECKPOINT',`SECTOR 0${i}  /  KEEP PUSHING`,'#6eeaf4'),side:THREE.DoubleSide}),g);sign.position.set(0,9.6,.34);
  }

  // Bridge suspension cables create a striking silhouette on the waterfront.
  for(const f of [.615,.72]) {
    const s=length*f,g=new THREE.Group(),p=sample(s);g.position.copy(p.position);g.rotation.y=p.heading;scene.add(g);
    for(const x of [-18,18]){box(g,1.3,44,2.2,concreteMat,x,19);box(g,.15,41,2.4,cyanMat,x-1,19);}
    box(g,38,2,2.4,concreteMat,0,39);
    const cableMat=mat('#728b9f',.5,.65);
    for(const side of [-1,1])for(const dz of [-80,-60,-40,-20,20,40,60,80]) {
      const a=new THREE.Vector3(side*18,38,0),b=new THREE.Vector3(side*14,.9,dz),v=b.clone().sub(a);
      const cable=mesh(new THREE.CylinderGeometry(.065,.065,v.length(),5),cableMat,g);cable.position.copy(a).add(b).multiplyScalar(.5);cable.quaternion.setFromUnitVectors(up,v.normalize());
    }
  }

  // Roadside props that the game can scatter on contact.
  const breakables=[];
  const coneGeo=new THREE.ConeGeometry(.42,1.1,7),coneMat=mat('#f8a25f',.7),bottleMat=mat('#99eeff',.18,.5,{emissive:'#24cbea',emissiveIntensity:1.7});
  for(let i=0;i<52;i++) {
    const s=length*(.045+rand()*.93),x=(rand()<.5?-1:1)*(10.4+rand()*1.2);if(s>tunnelStart&&s<tunnelEnd)continue;
    const g=new THREE.Group(),p=sample(s,x);g.position.copy(p.position);g.rotation.y=p.heading;scene.add(g);
    const cone=mesh(coneGeo,coneMat,g);cone.position.y=.57;box(g,.82,.12,.82,darkMat,0,.06);box(g,.5,.12,.5,whiteMat,0,.55);breakables.push({s,x,mesh:g,active:true});
  }
  const pickups=[];
  for(let i=0;i<24;i++) {
    const s=length*(.055+i*.037),x=[-8,0,8][i%3],p=sample(s,x),g=new THREE.Group();g.position.copy(p.position);g.position.y+=1.3;scene.add(g);
    const bottle=mesh(new THREE.CylinderGeometry(.27,.31,1.05,8),bottleMat,g);bottle.rotation.z=-.23;
    const cap=box(g,.23,.18,.23,whiteMat,.11,.58);cap.rotation.z=-.23;
    const ring=mesh(new THREE.TorusGeometry(.69,.035,5,20),cyanMat,g);ring.rotation.x=Math.PI/2;ring.position.y=-.6;
    pickups.push({s,x,mesh:g,active:true,baseY:p.position.y+1.3});
  }

  const tireMat=mat('#10151d',.85),rimMat=mat('#758f9d',.26,.9),glassMat=mat('#153447',.12,.75),carbonMat=mat('#132431',.48,.65);
  const wheelGeo=new THREE.CylinderGeometry(.43,.43,.28,16);wheelGeo.rotateZ(Math.PI/2);
  const rimGeo=new THREE.CylinderGeometry(.29,.29,.285,10);rimGeo.rotateZ(Math.PI/2);
  const tailMat=mat('#ff355c',.25,.1,{emissive:'#ff244b',emissiveIntensity:3});
  const headMat=mat('#ddfaff',.2,.1,{emissive:'#b1eaff',emissiveIntensity:3});
  const flameMat=new THREE.MeshBasicMaterial({color:'#8beaff',transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false});
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=64;shadowCanvas.height=64;const shadowContext=shadowCanvas.getContext('2d');
  const shadowGradient=shadowContext.createRadialGradient(32,32,3,32,32,32);shadowGradient.addColorStop(0,'rgba(0,0,0,.65)');shadowGradient.addColorStop(1,'rgba(0,0,0,0)');shadowContext.fillStyle=shadowGradient;shadowContext.fillRect(0,0,64,64);
  const shadowMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const shadowGeometry=new THREE.PlaneGeometry(3.5,6.2);
  function hull(rings, material,parent) {
    const positions=[],indices=[];
    rings.forEach(([z,w,b,t])=>{positions.push(-w*.83,b,z,-w,t-.12,z,-w*.8,t,z,w*.8,t,z,w,t-.12,z,w*.83,b,z);});
    for(let r=0;r<rings.length-1;r++)for(let j=0;j<6;j++){const a=r*6+j,b=r*6+(j+1)%6;indices.push(a,b,a+6,b,b+6,a+6);}
    indices.push(0,2,1,0,3,2,0,4,3,0,5,4);const a=(rings.length-1)*6;indices.push(a,a+1,a+2,a,a+2,a+3,a,a+3,a+4,a,a+4,a+5);
    for(let i=0;i<indices.length;i+=3){const t=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=t;}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return mesh(g,material,parent);
  }
  function createCar(color='#4aa7ff') {
    const car=new THREE.Group(),paint=mat(color,.23,.74,{envMapIntensity:1.15});
    const body=hull([[-2.38,.77,.34,.6],[-1.94,.96,.26,.76],[-.72,1.02,.28,.84],[.75,1.05,.3,.87],[1.96,.98,.35,.76],[2.23,.82,.4,.67]],paint,car);body.castShadow=true;
    hull([[-.92,.74,.78,.83],[-.31,.67,.8,1.37],[.54,.66,.83,1.4],[1.28,.8,.8,.92]],glassMat,car);
    box(car,1.23,.065,.9,paint,0,1.4,.15);
    for(const x of [-.78,.78]){const sill=box(car,.10,.09,1.98,paint,x,1.04,.15);sill.rotation.z=x<0?-.18:.18;}
    box(car,1.92,.10,.34,carbonMat,0,.3,-2.13);
    box(car,1.83,.16,.23,carbonMat,0,.36,2.19);
    for(const x of [-.87,.87])box(car,.12,.18,2.8,carbonMat,x,.28,0);
    // Slim LEDs give each original car a clear front and rear silhouette.
    for(const x of [-.57,.57]){box(car,.54,.075,.08,headMat,x,.64,-2.205);box(car,.56,.065,.08,tailMat,x,.69,2.21);}
    box(car,.49,.15,.035,whiteMat,0,.53,2.265);
    box(car,1.25,.13,.06,carbonMat,0,.45,-2.37);
    for(const x of [-.48,.48]){box(car,.35,.025,.57,carbonMat,x,.785,-1.38);box(car,.08,.26,.12,carbonMat,x,1.02,1.82);}
    box(car,1.92,.08,.38,paint,0,1.16,1.94);
    const wheels=[];
    for(const x of [-.98,.98])for(const z of [-1.38,1.43]){
      const group=new THREE.Group();group.position.set(x,.44,z);car.add(group);
      mesh(wheelGeo,tireMat,group);mesh(rimGeo,rimMat,group);
      const hub=mesh(new THREE.CylinderGeometry(.105,.105,.303,8),carbonMat,group);hub.rotation.z=Math.PI/2;
      wheels.push(group);
    }
    const flames=[];
    for(const x of [-.59,.59]) {
      box(car,.22,.16,.27,rimMat,x,.4,2.21);
      const f=mesh(new THREE.ConeGeometry(.18,1.4,7),flameMat,car);f.rotation.x=Math.PI/2;f.position.set(x,.41,2.95);f.visible=false;flames.push(f);
    }
    // Soft contact shadow; inexpensive enough for every traffic vehicle.
    const shadow=mesh(shadowGeometry,shadowMaterial,car);shadow.rotation.x=-Math.PI/2;shadow.position.y=.03;
    const staticParts=car.children.filter(m=>m.isMesh && !flames.includes(m) && m!==shadow);
    const combined=mergeByMaterial(staticParts,car);
    car.userData={wheels,flames,body:combined.get(paint)||body,paint,shadow};return car;
  }
  // Merge the hundreds of individual paint strokes into a handful of draws.
  const roadBatches=new Map();
  for(const m of roadMeshes){if(!roadBatches.has(m.material))roadBatches.set(m.material,[]);roadBatches.get(m.material).push(m);}
  for(const [material,meshes] of roadBatches){
    if(meshes.length<2)continue;
    const pos=[],nor=[],tex=[],ind=[];let offset=0;
    for(const m of meshes){const g=m.geometry;pos.push(...g.attributes.position.array);nor.push(...g.attributes.normal.array);tex.push(...g.attributes.uv.array);for(const i of g.index.array)ind.push(i+offset);offset+=g.attributes.position.count;scene.remove(m);g.dispose();}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));g.setIndex(ind);mesh(g,material).receiveShadow=true;
  }
  const movableGroups=new Set([...pickups,...breakables].map(o=>o.mesh));
  const worldStatic=[];
  function collectStatic(node){if(movableGroups.has(node)||node.isInstancedMesh)return;if(node.isMesh)worldStatic.push(node);for(const child of node.children)collectStatic(child);}
  for(const child of [...scene.children])if(!preexistingSceneChildren.has(child))collectStatic(child);
  mergeByMaterial(worldStatic,scene);
  function update(time) {for(const p of pickups)if(p.active){p.mesh.rotation.y=time*1.8;p.mesh.position.y=p.baseY+Math.sin(time*2.5+p.s)*.15;}}
  return {length,width,sample,surface,ramps,shortcuts,pickups,breakables,update,createCar,curve,tunnel:{start:tunnelStart,end:tunnelEnd},tunnels:[{start:tunnelStart,end:tunnelEnd}],outerWidth:s=>13+branch(wrap(s))};
}
