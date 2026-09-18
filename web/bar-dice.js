/* Rounded white die adapted from the approved white-dice-motion study.
 * Only animation is random here: the game engine supplies the authoritative face. */
(function(root){
 const three=()=>import('/three-0160.module.min.js');
 async function create(stage){
  const T=await three();let disposed=false,raf=0,finish=null;
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(2);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.setClearColor(0xeee8dc,0);stage.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,.1,100);camera.position.set(5.2,9,6.5);camera.lookAt(0,.2,0);
  scene.add(new T.HemisphereLight(0xfff8ed,0xc8b99e,1.45));const key=new T.DirectionalLight(0xfff4df,2.5);key.position.set(-3,7,5);scene.add(key);const fill=new T.DirectionalLight(0xfffaf3,.4);fill.position.set(5,1,-4);scene.add(fill);const glint=new T.DirectionalLight(0xffffff,2);glint.position.set(2,5,7);scene.add(glint);
  const positions={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
  function material(value){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#fcfcfd';ctx.fillRect(0,0,256,256);
   for(const[u,v]of positions[value]){const x=128+u*50.5,y=128+v*50.5,r=value===1?28:21.5,red=value===1||value===4;const ink=ctx.createRadialGradient(x-3,y+3,1,x,y,r);ink.addColorStop(0,red?'#ac252a':'#36373a');ink.addColorStop(.77,red?'#941d24':'#242528');ink.addColorStop(.95,red?'#74171e':'#18191b');ink.addColorStop(1,red?'#bc4c50':'#68696c');ctx.fillStyle=ink;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
   const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;return new T.MeshPhysicalMaterial({map,roughness:.34,metalness:0,clearcoat:.45,clearcoatRoughness:.3});}
  const geometry=new T.BoxGeometry(2,2,2,32,32,32),pos=geometry.attributes.position,norm=geometry.attributes.normal,p=new T.Vector3(),n=new T.Vector3();
  function surface(x,y,z){const qx=Math.abs(x)-.9,qy=Math.abs(y)-.9,qz=Math.abs(z)-.9,box=Math.hypot(Math.max(qx,0),Math.max(qy,0),Math.max(qz,0))+Math.min(Math.max(qx,qy,qz),0)-.1,sphere=Math.hypot(x,y,z)-1.43,h=Math.max(.065-Math.abs(box-sphere),0)/.065;return Math.max(box,sphere)+h*h*.065*.25;}
  for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i);let low=0,high=1;for(let k=0;k<20;k++){const t=(low+high)/2;if(surface(p.x*t,p.y*t,p.z*t)>0)high=t;else low=t;}p.multiplyScalar((low+high)/2);const e=.0005;n.set(surface(p.x+e,p.y,p.z)-surface(p.x-e,p.y,p.z),surface(p.x,p.y+e,p.z)-surface(p.x,p.y-e,p.z),surface(p.x,p.y,p.z+e)-surface(p.x,p.y,p.z-e)).normalize();pos.setXYZ(i,p.x,p.y,p.z);norm.setXYZ(i,n.x,n.y,n.z);}geometry.computeBoundingSphere();
  const die=new T.Mesh(geometry,[3,4,1,6,2,5].map(material));scene.add(die);
  const normals={1:new T.Vector3(0,1,0),6:new T.Vector3(0,-1,0),3:new T.Vector3(1,0,0),4:new T.Vector3(-1,0,0),2:new T.Vector3(0,0,1),5:new T.Vector3(0,0,-1)};
  const orientation=(value,yaw=.17)=>new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw).multiply(new T.Quaternion().setFromUnitVectors(normals[value],new T.Vector3(0,1,0)));
  function draw(){if(!disposed)renderer.render(scene,camera);}
  function size(){if(disposed)return;const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw();}
  const observer=new ResizeObserver(size);observer.observe(stage);
  function set(value){die.quaternion.copy(orientation(value));die.position.y=0;stage.dataset.face=String(value);stage.setAttribute('aria-label','骰子朝上 '+value+' 点');draw();}set(1);size();
  function roll(value){return new Promise(resolve=>{finish=resolve;const start=die.quaternion.clone(),target=orientation(value,Math.random()*Math.PI*2),axis=new T.Vector3(Math.random()-.5,.15,Math.random()-.5).normalize(),spin=new T.Quaternion(),began=performance.now(),duration=root.matchMedia('(prefers-reduced-motion: reduce)').matches?0:900;
   function frame(now){if(disposed){resolve();return;}const t=duration?Math.min(1,(now-began)/duration):1;
    if(t<.72){const u=t/.72;die.quaternion.slerpQuaternions(start,target,u);spin.setFromAxisAngle(axis,Math.PI*4*u);die.quaternion.premultiply(spin);die.position.y=4*1.25*u*(1-u);}
    else if(t<.9){const u=(t-.72)/.18;die.quaternion.setFromAxisAngle(axis,.1*Math.sin(Math.PI*u)*(1-u)).multiply(target);die.position.y=4*.16*u*(1-u);}
    else{const u=(t-.9)/.1;die.quaternion.setFromAxisAngle(axis,.028*Math.sin(2*Math.PI*u)*(1-u)).multiply(target);die.position.y=0;}
    stage.style.setProperty('--dice-air',String(Math.max(0,die.position.y)));draw();if(t<1)raf=requestAnimationFrame(frame);else{die.quaternion.copy(target);die.position.y=0;stage.style.setProperty('--dice-air','0');stage.dataset.face=String(value);stage.setAttribute('aria-label','骰子朝上 '+value+' 点');draw();finish=null;resolve();}}raf=requestAnimationFrame(frame);
  });}
  function dispose(){disposed=true;cancelAnimationFrame(raf);finish?.();observer.disconnect();geometry.dispose();for(const m of die.material){m.map.dispose();m.dispose();}renderer.dispose();renderer.domElement.remove();}
  return {set,roll,dispose};
 }
 root.MamoDice={create};
})(window);
