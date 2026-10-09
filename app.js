import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'https://unpkg.com/three@0.160.0/examples/jsm/exporters/STLExporter.js';

const viewport=document.querySelector('#viewport');
const scene=new THREE.Scene(); scene.background=new THREE.Color('#0b1420');
const camera=new THREE.PerspectiveCamera(45,1,.1,2000); camera.position.set(90,80,110);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.outputColorSpace=THREE.SRGBColorSpace; viewport.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.08;
scene.add(new THREE.HemisphereLight(0xdcecff,0x263344,2));
const light=new THREE.DirectionalLight(0xffffff,2.4);light.position.set(70,100,80);scene.add(light);
const grid=new THREE.GridHelper(300,30,0x31516c,0x1b3045);scene.add(grid);
const axes=new THREE.AxesHelper(35);scene.add(axes);
const modelGroup=new THREE.Group();scene.add(modelGroup);const sketchGroup=new THREE.Group();scene.add(sketchGroup);
let selected=null, activeTool='select', drawing=false, startPoint=null, preview=null, undoStack=[], installPrompt=null;
const mat=new THREE.MeshStandardMaterial({color:0x269be8,metalness:.25,roughness:.35});
const fa=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
function status(s){document.querySelector('#status').textContent=s}
function updateCount(){document.querySelector('#objectCount').textContent=fa(modelGroup.children.length)+' قطعه'}
function remember(){undoStack.push(modelGroup.children.map(o=>({type:o.userData.kind||'box',p:o.position.toArray(),r:o.rotation.toArray(),s:o.scale.toArray(),dims:o.userData.dims||null})));if(undoStack.length>30)undoStack.shift()}
function addMesh(mesh,kind,dims){mesh.material=mat.clone();mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.kind=kind;mesh.userData.dims=dims||{};modelGroup.add(mesh);select(mesh);updateCount();saveLocal();status('قطعه ساخته شد')}
function select(o){if(selected)selected.material.emissive?.setHex(0);selected=o;if(o?.material?.emissive)o.material.emissive.setHex(0x12344c);if(o?.userData?.dims){for(const [id,key] of [['width','w'],['depth','d'],['height','h']])if(o.userData.dims[key]!=null)document.getElementById(id).value=o.userData.dims[key]} }
function box(w=40,d=30,h=20){remember();const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d));m.position.y=h/2;addMesh(m,'box',{w,d,h})}
function cylinder(r=15,h=25){remember();const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,48));m.position.y=h/2;addMesh(m,'cylinder',{w:r*2,d:r*2,h})}
function sphere(r=15){remember();const m=new THREE.Mesh(new THREE.SphereGeometry(r,32,20));addMesh(m,'sphere',{w:r*2,d:r*2,h:r*2})}
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(viewport);resize();
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}animate();
function setView(v){if(v==='top')camera.position.set(0,180,.01);else if(v==='front')camera.position.set(0,0,180);else if(v==='right')camera.position.set(180,0,0);else camera.position.set(90,80,110);controls.target.set(0,0,0);camera.lookAt(0,0,0);controls.update()}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab,.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById(b.dataset.tab).classList.add('active')});
document.querySelector('#boxTool').onclick=()=>box(+width.value||40,+depth.value||30,+height.value||20);
document.querySelector('#cylTool').onclick=()=>cylinder(Math.max(1,(+width.value||30)/2),+height.value||25);
document.querySelector('#sphereTool').onclick=()=>sphere(Math.max(1,(+width.value||30)/2));
document.querySelector('#holeTool').onclick=()=>{status('برای نسخه بعد: برش واقعی با Boolean در حال توسعه است');alert('ابزار سوراخ‌کاری Boolean هنوز در این نسخه پیاده‌سازی نشده است. فعلاً از استوانه برای نمایش قطعه استفاده کن.')};
document.querySelector('#applyDims').onclick=()=>{if(!selected||selected.userData.kind!=='box'){alert('ابتدا یک مکعب را انتخاب کن.');return}remember();const w=Math.max(1,+width.value||40),d=Math.max(1,+depth.value||30),h=Math.max(1,+height.value||20);selected.geometry.dispose();selected.geometry=new THREE.BoxGeometry(w,h,d);selected.position.y=h/2;selected.userData.dims={w,d,h};saveLocal();status('ابعاد به‌روزرسانی شد')};
function worldPoint(e){const rect=renderer.domElement.getBoundingClientRect();const x=((e.clientX-rect.left)/rect.width)*2-1,y=-((e.clientY-rect.top)/rect.height)*2+1;const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x,y),camera);const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);const p=new THREE.Vector3();return ray.ray.intersectPlane(plane,p)?p:null}
renderer.domElement.addEventListener('pointerdown',e=>{if(activeTool==='select')return;drawing=true;startPoint=worldPoint(e);if(!startPoint)return;controls.enabled=false;renderer.domElement.setPointerCapture?.(e.pointerId)});
renderer.domElement.addEventListener('pointerup',e=>{if(!drawing)return;drawing=false;controls.enabled=true;const end=worldPoint(e);if(!startPoint||!end)return;const dx=end.x-startPoint.x,dz=end.z-startPoint.z;const color=0x53c7ff;
if(activeTool==='rect'||activeTool==='circle'||activeTool==='line'){let obj;if(activeTool==='rect'){const w=Math.max(1,Math.abs(dx)),d=Math.max(1,Math.abs(dz));const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(startPoint.x,0,startPoint.z),new THREE.Vector3(end.x,0,startPoint.z),new THREE.Vector3(end.x,0,end.z),new THREE.Vector3(startPoint.x,0,end.z),new THREE.Vector3(startPoint.x,0,startPoint.z)]);obj=new THREE.Line(geo,new THREE.LineBasicMaterial({color}));obj.userData={sketchKind:'rect',cx:(startPoint.x+end.x)/2,cz:(startPoint.z+end.z)/2,w,d};}
else if(activeTool==='circle'){const r=Math.max(1,Math.hypot(dx,dz));const pts=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;pts.push(new THREE.Vector3(startPoint.x+Math.cos(a)*r,0,startPoint.z+Math.sin(a)*r))}obj=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color}));obj.userData={sketchKind:'circle',cx:startPoint.x,cz:startPoint.z,r};}
else{obj=new THREE.Line(new THREE.BufferGeometry().setFromPoints([startPoint,end]),new THREE.LineBasicMaterial({color}));obj.userData={sketchKind:'line'};}sketchGroup.add(obj);status('اسکچ اضافه شد');}
startPoint=null;});
renderer.domElement.addEventListener('click',e=>{if(activeTool!=='select'||drawing)return;const rect=renderer.domElement.getBoundingClientRect();const mouse=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(mouse,camera);const hits=ray.intersectObjects(modelGroup.children,false);if(hits.length){select(hits[0].object);status('قطعه انتخاب شد')}});
function setTool(t){activeTool=t;document.querySelectorAll('.tool').forEach(b=>b.classList.remove('chosen'));const map={line:'lineTool',rect:'rectTool',circle:'circleTool',select:'selectTool'};if(map[t])document.getElementById(map[t]).classList.add('chosen');status(t==='select'?'انتخاب و چرخش':('ابزار '+({line:'خط',rect:'مستطیل',circle:'دایره'}[t]||t)))}
document.querySelector('#lineTool').onclick=()=>setTool('line');document.querySelector('#rectTool').onclick=()=>setTool('rect');document.querySelector('#circleTool').onclick=()=>setTool('circle');document.querySelector('#selectTool').onclick=()=>setTool('select');
document.querySelector('#extrudeSketch').onclick=()=>{const s=sketchGroup.children.at(-1);if(!s||!['rect','circle'].includes(s.userData.sketchKind)){alert('ابتدا یک مستطیل یا دایره بکش.');return}remember();const h=Math.max(1,+document.querySelector('#extrudeDepth').value||10);let m;if(s.userData.sketchKind==='rect'){const u=s.userData;m=new THREE.Mesh(new THREE.BoxGeometry(u.w,h,u.d));m.position.set(u.cx,h/2,u.cz);addMesh(m,'box',{w:u.w,d:u.d,h})}else{const u=s.userData;m=new THREE.Mesh(new THREE.CylinderGeometry(u.r,u.r,h,48));m.position.set(u.cx,h/2,u.cz);addMesh(m,'cylinder',{w:u.r*2,d:u.r*2,h})}setTool('select')};
document.querySelector('#clearSketch').onclick=()=>{while(sketchGroup.children.length){const o=sketchGroup.children.pop();o.geometry?.dispose();if(o.material)o.material.dispose()}status('اسکچ پاک شد')};
function projectData(){return {app:'SolidCAD Mobile',version:1,objects:modelGroup.children.map(o=>({kind:o.userData.kind,position:o.position.toArray(),rotation:o.rotation.toArray(),dims:o.userData.dims||{}}))}}
function saveLocal(){try{localStorage.setItem('solidcad-project',JSON.stringify(projectData()));document.querySelector('#saveState').textContent='ذخیره خودکار انجام شد'}catch(e){}}
document.querySelector('#saveBtn').onclick=()=>{saveLocal();status('پروژه ذخیره شد');document.querySelector('#saveState').textContent='ذخیره شد: '+new Date().toLocaleTimeString('fa-IR')};
function restore(data){while(modelGroup.children.length){const o=modelGroup.children.pop();o.geometry?.dispose()}selected=null;for(const d of data.objects||[]){let m;if(d.kind==='box')m=new THREE.Mesh(new THREE.BoxGeometry(d.dims.w||40,d.dims.h||20,d.dims.d||30));else if(d.kind==='cylinder')m=new THREE.Mesh(new THREE.CylinderGeometry((d.dims.w||30)/2,(d.dims.w||30)/2,d.dims.h||20,48));else if(d.kind==='sphere')m=new THREE.Mesh(new THREE.SphereGeometry((d.dims.w||30)/2,32,20));else continue;m.material=mat.clone();m.userData.kind=d.kind;m.userData.dims=d.dims||{};m.position.fromArray(d.position||[0,0,0]);m.rotation.fromArray(d.rotation||[0,0,0,1]);modelGroup.add(m)}updateCount();saveLocal()}
document.querySelector('#newBtn').onclick=()=>{if(confirm('پروژه جدید ساخته شود؟ ابتدا خروجی بگیر تا پروژه فعلی از دست نرود.')){while(modelGroup.children.length)modelGroup.remove(modelGroup.children[0]);while(sketchGroup.children.length)sketchGroup.remove(sketchGroup.children[0]);selected=null;updateCount();saveLocal();status('پروژه جدید آماده است')}};
document.querySelector('#undoBtn').onclick=()=>{const prev=undoStack.pop();if(!prev){alert('عملیاتی برای واگرد وجود ندارد.');return}restore({objects:prev.map(o=>({kind:o.type,position:o.p,rotation:o.r,dims:o.dims||{w:40,d:30,h:20}}))});status('واگرد انجام شد')};
function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
document.querySelector('#jsonBtn').onclick=()=>download('solidcad-project.json',JSON.stringify(projectData(),null,2),'application/json');
document.querySelector('#openFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{restore(JSON.parse(await f.text()));status('پروژه باز شد')}catch(err){alert('فایل پروژه معتبر نیست.')}e.target.value=''};
document.querySelector('#exportBtn').onclick=()=>{if(!modelGroup.children.length){alert('ابتدا یک قطعه بساز.');return}const exporter=new STLExporter();download('solidcad-model.stl',exporter.parse(modelGroup,{binary:false}),'model/stl');status('خروجی STL آماده شد')};
const saved=localStorage.getItem('solidcad-project');if(saved){try{restore(JSON.parse(saved));status('پروژه قبلی بارگذاری شد')}catch(e){}}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;document.querySelector('#installBtn').hidden=false});
document.querySelector('#installBtn').onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null}else alert('از منوی Chrome گزینه Add to Home screen / افزودن به صفحه اصلی را بزن.')};
if('serviceWorker'in navigator && location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
