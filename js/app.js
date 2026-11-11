// App core: media library, timeline model, preview sync, undo/redo, autosave, UI wiring.
import {saveProject,listProjects,getBlob,deleteProject} from './storage.js';
import * as VE from './voice-enhance.js';
import {exportVideo,cancel,extractAudio} from './export.js';
const $=id=>document.getElementById(id);
const S={id:crypto.randomUUID(),media:{},clips:[],sel:null,voice:VE.defaults(),zoom:40,idx:0};
const urls={},undo=[],redo=[],vid=$('vid');
const fmt=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const say=m=>$('msg').textContent=m;
const snap=()=>JSON.stringify({clips:S.clips,voice:S.voice});
function push(){undo.push(snap());if(undo.length>100)undo.shift();redo.length=0;autosave()}
function restore(j){const o=JSON.parse(j);S.clips=o.clips;S.voice=o.voice;S.sel=null;draw();syncVoice()}
$('btnUndo').onclick=()=>{if(undo.length){redo.push(snap());restore(undo.pop())}};
$('btnRedo').onclick=()=>{if(redo.length){undo.push(snap());restore(redo.pop())}};

/* ---------- import ---------- */
async function addFiles(files){
 for(const f of files){
  if(!/^(video|audio)\//.test(f.type)){say(`Unsupported file: ${f.name}`);continue}
  const id=crypto.randomUUID();urls[id]=URL.createObjectURL(f);
  S.media[id]={id,name:f.name,file:f,...await probe(f,urls[id])};
 }
 drawLib();
}
function probe(f,url){return new Promise(res=>{
 const v=document.createElement(f.type.startsWith('video')?'video':'audio');v.preload='metadata';v.src=url;
 v.onloadedmetadata=async()=>{let thumb='';
  if(v.videoWidth){v.currentTime=Math.min(1,v.duration/2);await new Promise(r=>v.onseeked=r);
   const c=document.createElement('canvas');c.width=96;c.height=56;c.getContext('2d').drawImage(v,0,0,96,56);thumb=c.toDataURL('image/jpeg',.6)}
  res({duration:v.duration,video:!!v.videoWidth,thumb})};
 v.onerror=()=>{say(`Cannot read ${f.name}. This browser may not support the format.`);res({duration:0,video:false,thumb:''})}})}
function drawLib(){const l=$('lib');l.innerHTML='';
 Object.values(S.media).forEach(m=>{const d=document.createElement('div');d.className='item';
  d.innerHTML=`<img alt="" src="${m.thumb}"><span>${m.name}<br>${fmt(m.duration)}</span>`;
  d.title='Add to timeline';d.onclick=()=>addClip(m.id);l.appendChild(d)});
 if(!Object.keys(S.media).length)l.textContent='Drop video or audio files here'}
function addClip(mid){const m=S.media[mid];if(!m.video)return say('Audio-only files cannot go on the timeline yet.');
 push();S.clips.push({id:crypto.randomUUID(),mid,start:0,end:+m.duration.toFixed(2),speed:1,vol:100,crop:'',rot:'0',flipH:false,flipV:false,bri:0,con:100,sat:100});
 S.sel=S.clips.at(-1).id;draw();load(starts()[S.clips.length-1])}
$('btnImport').onclick=()=>$('file').click();$('file').onchange=e=>addFiles(e.target.files);
['dragover','drop'].forEach(ev=>document.body.addEventListener(ev,e=>{e.preventDefault();if(ev==='drop')addFiles(e.dataTransfer.files)}));

/* ---------- timeline ---------- */
const dur=c=>(c.end-c.start)/c.speed;
const total=()=>S.clips.reduce((a,c)=>a+dur(c),0);
const starts=()=>{let t=0;return S.clips.map(c=>{const s=t;t+=dur(c);return s})};
const sel=()=>S.clips.find(c=>c.id===S.sel);
function draw(){const tr=$('track');tr.innerHTML='';let x=0;const z=S.zoom;
 S.clips.forEach((c,i)=>{const d=document.createElement('div');d.className='clip'+(c.id===S.sel?' sel':'');
  d.style.left=x*z+'px';d.style.width=Math.max(30,dur(c)*z)+'px';d.draggable=true;
  d.textContent=`${S.media[c.mid]?.name||'clip'} · ${c.speed}x`;
  d.onclick=e=>{e.stopPropagation();S.sel=c.id;draw();load(starts()[i])};
  d.ondragstart=e=>e.dataTransfer.setData('i',i);d.ondragover=e=>e.preventDefault();
  d.ondrop=e=>{e.stopPropagation();e.preventDefault();const f=+e.dataTransfer.getData('i');if(f!==i){push();S.clips.splice(i,0,S.clips.splice(f,1)[0]);draw()}};
  tr.appendChild(d);x+=dur(c)});
 const ph=document.createElement('div');ph.id='ph';tr.appendChild(ph);
 const r=$('ruler');r.innerHTML='';for(let t=0;t<=Math.ceil(x)+5;t+=5){const s=document.createElement('span');s.textContent=fmt(t);s.style.cssText=`position:absolute;left:${t*z}px;font-size:10px;color:#8b93a1`;r.appendChild(s)}
 fields();tick()}
$('track').addEventListener('click',e=>{if(e.target.id==='track'&&S.clips.length)load(Math.min((e.offsetX)/S.zoom,total()))});
$('track').addEventListener('scroll',e=>$('ruler').scrollLeft=e.target.scrollLeft);
$('zIn').onclick=()=>{S.zoom=Math.min(200,S.zoom*1.3);draw()};$('zOut').onclick=()=>{S.zoom=Math.max(5,S.zoom/1.3);draw()};

/* ---------- preview: plays one source clip at a time and jumps at boundaries ---------- */
function load(t){
 if(!S.clips.length)return;const st=starts();let i=st.findLastIndex(s=>s<=t);if(i<0)i=0;
 const c=S.clips[i];S.idx=i;const want=urls[c.mid];
 const go=()=>{vid.currentTime=c.start+(t-st[i])*c.speed;vid.playbackRate=c.speed;vid.volume=Math.min(1,c.vol/100);applyCss(c);tick()};
 if(vid.dataset.m!==c.mid){vid.dataset.m=c.mid;vid.src=want;vid.onloadedmetadata=go}else go()}
function applyCss(c){vid.style.filter=`brightness(${1+c.bri/100}) contrast(${c.con/100}) saturate(${c.sat/100})`;
 vid.style.transform=`rotate(${c.rot}deg) scaleX(${c.flipH?-1:1}) scaleY(${c.flipV?-1:1})`;
 vid.style.objectFit=c.crop?'cover':'contain';vid.style.aspectRatio=c.crop||'';}
function tick(){const c=S.clips[S.idx];if(!c)return 0;
 const t=starts()[S.idx]+(vid.currentTime-c.start)/c.speed;
 $('time').textContent=`${fmt(Math.max(0,t))} / ${fmt(total())}`;
 const p=$('ph');if(p)p.style.left=Math.max(0,t)*S.zoom+'px';return t}
vid.ontimeupdate=()=>{const c=S.clips[S.idx];if(!c)return;tick();
 if(vid.currentTime>=c.end-0.05){if(S.idx<S.clips.length-1)load(starts()[S.idx+1]+0.001);else{vid.pause();$('btnPlay').textContent='Play'}}};
$('btnPlay').onclick=()=>{if(!S.clips.length)return;VE.attachPreview(vid);
 if(vid.paused){vid.play();$('btnPlay').textContent='Pause'}else{vid.pause();$('btnPlay').textContent='Play'}};
$('btnFs').onclick=()=>$('vwrap').requestFullscreen();

/* ---------- clip editing ---------- */
const map={cStart:['start',1],cEnd:['end',1],cSpeed:['speed',1],cVol:['vol',1],cCrop:['crop'],cRot:['rot'],cFlipH:['flipH','b'],cFlipV:['flipV','b'],cBri:['bri',1],cCon:['con',1],cSat:['sat',1]};
Object.entries(map).forEach(([id,[k,n]])=>$(id).onchange=$(id).oninput=()=>{const c=sel();if(!c)return;
 const e=$(id);let v=n==='b'?e.checked:n?+e.value:e.value;
 if(k==='start')v=Math.max(0,Math.min(v,c.end-.1));if(k==='end')v=Math.min(S.media[c.mid].duration,Math.max(v,c.start+.1));
 push();c[k]=v;draw();load(starts()[S.clips.indexOf(c)])});
function fields(){const c=sel();if(!c)return;for(const[id,[k,n]]of Object.entries(map)){const e=$(id);if(n==='b')e.checked=c[k];else e.value=c[k]}$('oVol').textContent=c.vol}
$('btnSplit').onclick=split;$('btnDel').onclick=del;
function split(){const c=sel();if(!c||S.clips[S.idx]!==c)return say('Select a clip and put the playhead inside it.');
 const t=+vid.currentTime.toFixed(2);if(t<=c.start+.1||t>=c.end-.1)return say('Move the playhead inside the clip to split.');
 push();const b={...c,id:crypto.randomUUID(),start:t};c.end=t;S.clips.splice(S.clips.indexOf(c)+1,0,b);draw()}
function del(){if(!sel())return;push();S.clips=S.clips.filter(c=>c.id!==S.sel);S.sel=null;S.idx=0;draw();if(S.clips.length)load(0)}
const dl=(b,n)=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5e3)};
$('btnExtract').onclick=async()=>{const c=sel();if(!c)return say('Select a clip first.');say('Extracting audio…');
 try{dl(await extractAudio(S.media[c.mid].file,c.start,c.end),'audio.mp3');say('Audio extracted.')}catch(e){say(e.message)}};

/* ---------- voice enhance ---------- */
const vmap={vNoise:'noise',vClar:'clarity',vBg:'bg',vVol:'vol',vNorm:'norm',vFade:'fade'};
Object.entries(vmap).forEach(([id,k])=>$(id).oninput=$(id).onchange=()=>{const e=$(id);S.voice[k]=e.type==='checkbox'?e.checked:+e.value;
 const o=e.parentElement.querySelector('output');if(o)o.textContent=e.value;autosave()});
function syncVoice(){for(const[id,k]of Object.entries(vmap)){const e=$(id);e.type==='checkbox'?e.checked=S.voice[k]:e.value=S.voice[k];const o=e.parentElement.querySelector('output');if(o)o.textContent=e.value}}
$('btnEnh').onclick=()=>{Object.assign(S.voice,{noise:60,clarity:40,bg:30,norm:true});syncVoice();say('Voice enhance applied to export. Press Preview to listen.')};
$('btnPrev').onclick=()=>{if(!S.clips.length)return say('Add a clip first.');VE.attachPreview(vid);VE.applyPreview(S.voice);if(vid.paused)$('btnPlay').click();say('Previewing enhanced voice.')};
$('btnReset').onclick=()=>{S.voice=VE.defaults();syncVoice();VE.applyPreview(S.voice,false);say('Audio reset.')};

/* ---------- export ---------- */
$('btnExport').onclick=()=>S.clips.length?$('dlgExp').showModal():say('Add a clip to the timeline first.');
$('eClose').onclick=()=>$('dlgExp').close();
$('eCancel').onclick=()=>{cancel();$('estat').textContent='Cancelled.';$('prog').hidden=true};
$('eGo').onclick=async()=>{const p=$('prog');p.hidden=false;p.value=0;$('eDl').hidden=true;$('estat').textContent='Loading FFmpeg…';
 const clips=S.clips.map(c=>({...c,file:S.media[c.mid].file}));
 const o={res:$('eRes').value,fmt:$('eFmt').value,fps:+$('eFps').value,q:$('eQ').value};
 try{const b=await exportVideo(clips,S.voice,o,v=>{p.value=v;$('estat').textContent=`Encoding ${Math.round(v*100)}%`});
  const a=$('eDl');a.href=URL.createObjectURL(b);a.download=`${$('pname').value}.${o.fmt}`;a.textContent=`Download (${(b.size/1e6).toFixed(1)} MB)`;a.hidden=false;$('estat').textContent='Done.'}
 catch(e){$('estat').textContent=e.message}};

/* ---------- projects: edit list + media blobs in IndexedDB; debounced autosave ---------- */
let tm;function autosave(){clearTimeout(tm);tm=setTimeout(save,1500)}
async function save(){if(!Object.keys(S.media).length)return;const blobs={};Object.values(S.media).forEach(m=>blobs[S.id+':'+m.id]=m.file);
 const media=Object.values(S.media).map(({file,...r})=>r);
 await saveProject({id:S.id,name:$('pname').value,updated:Date.now(),clips:S.clips,voice:S.voice,media},blobs);say('Project saved.')}
$('btnSave').onclick=save;
$('btnNew').onclick=()=>{if(confirm('Start a new project? Unsaved changes are lost.'))location.reload()};
$('btnOpen').onclick=async()=>{const l=$('plist');l.innerHTML='';(await listProjects()).forEach(p=>{
 const r=document.createElement('div');r.className='row';r.innerHTML=`<button>${p.name}</button><button>Delete</button>`;
 r.children[0].onclick=async()=>{S.id=p.id;S.clips=p.clips;S.voice=p.voice;S.media={};$('pname').value=p.name;
  for(const m of p.media){const f=await getBlob(p.id+':'+m.id);if(f){urls[m.id]=URL.createObjectURL(f);S.media[m.id]={...m,file:f}}}
  drawLib();draw();syncVoice();$('dlgProj').close();if(S.clips.length)load(0)};
 r.children[1].onclick=async()=>{await deleteProject(p.id);r.remove()};l.appendChild(r)});$('dlgProj').showModal()};
$('pClose').onclick=()=>$('dlgProj').close();

/* ---------- shortcuts ---------- */
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)&&e.target.type!=='range')return;
 const k=e.key.toLowerCase();
 if(e.ctrlKey&&k==='z'){e.preventDefault();$('btnUndo').click()}else if(e.ctrlKey&&k==='y'){e.preventDefault();$('btnRedo').click()}
 else if(e.ctrlKey&&k==='s'){e.preventDefault();save()}else if(e.ctrlKey&&(k==='='||k==='+')){e.preventDefault();$('zIn').click()}
 else if(e.ctrlKey&&k==='-'){e.preventDefault();$('zOut').click()}
 else if(k===' '){e.preventDefault();$('btnPlay').click()}else if(k==='s')split();else if(k==='delete')del();
 else if(k==='arrowleft')load(Math.max(0,tick()-1/30));else if(k==='arrowright')load(tick()+1/30)});
addEventListener('beforeunload',()=>Object.values(urls).forEach(URL.revokeObjectURL));
