// Real export via FFmpeg.wasm: one filter_complex trims, speeds, crops, rotates, color-adjusts
// and audio-processes each clip, then concatenates them.
import {ffmpegFilters} from './voice-enhance.js';
let ff=null,cancelled=false;
export async function loadFF(){
 if(ff)return ff;
 if(!window.FFmpegWASM)throw new Error('FFmpeg not found. Run setup.sh and start the app with serve.py.');
 ff=new FFmpegWASM.FFmpeg();
 await ff.load({coreURL:'vendor/ffmpeg-core.js',wasmURL:'vendor/ffmpeg-core.wasm'});return ff;
}
export const cancel=()=>{cancelled=true;if(ff){ff.terminate();ff=null}};
const atempo=s=>{const a=[];while(s>2){a.push('atempo=2');s/=2}while(s<0.5){a.push('atempo=0.5');s/=0.5}a.push('atempo='+s);return a};
const rot={90:'transpose=1',180:'transpose=1,transpose=1',270:'transpose=2'};
function clipFilters(c,i,W,H,fps,voice){
 const sp=c.speed;
 const v=[`trim=start=${c.start}:end=${c.end}`,'setpts=PTS-STARTPTS',`setpts=PTS/${sp}`];
 if(rot[c.rot])v.push(rot[c.rot]);if(c.flipH)v.push('hflip');if(c.flipV)v.push('vflip');
 if(c.crop){const[a,b]=c.crop.split('/').map(Number);v.push(`crop='min(iw,ih*${a/b})':'min(ih,iw/${a/b})'`)}
 v.push(`eq=brightness=${c.bri/100}:contrast=${c.con/100}:saturation=${c.sat/100}`,
  `scale=${W}:${H}:force_original_aspect_ratio=decrease`,`pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`,'setsar=1',`fps=${fps}`);
 const a=[`atrim=start=${c.start}:end=${c.end}`,'asetpts=PTS-STARTPTS',...atempo(sp),`volume=${c.vol/100}`,...ffmpegFilters(voice)];
 if(voice.vol!==100)a.push(`volume=${voice.vol/100}`);
 if(voice.fade>0&&i===0)a.push(`afade=t=in:d=${voice.fade}`);
 return `[${i}:v]${v.join(',')}[v${i}];[${i}:a]${a.join(',')}[a${i}]`;
}
/** clips: [{file,...}]; o: {res,fmt,fps,q} */
export async function exportVideo(clips,voice,o,onProg){
 cancelled=false;const f=await loadFF();
 f.on('progress',e=>onProg(Math.min(1,Math.max(0,e.progress))));
 const H=+o.res;let W=16/9;if(clips[0].crop){const[a,b]=clips[0].crop.split('/').map(Number);W=a/b}
 W=Math.round(H*W/2)*2;
 const args=[],parts=[];
 for(let i=0;i<clips.length;i++){
  await f.writeFile('in'+i,new Uint8Array(await clips[i].file.arrayBuffer()));args.push('-i','in'+i);
  parts.push(clipFilters(clips[i],i,W,H,o.fps,voice));}
 parts.push(clips.map((_,i)=>`[v${i}][a${i}]`).join('')+`concat=n=${clips.length}:v=1:a=1[v][a]`);
 const out='out.'+o.fmt;
 const codec=o.fmt==='mp4'?['-c:v','libx264','-crf',o.q,'-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k']
  :['-c:v','libvpx','-crf',o.q,'-b:v','2M','-c:a','libopus'];
 const r=await f.exec([...args,'-filter_complex',parts.join(';'),'-map','[v]','-map','[a]',...codec,out]);
 if(cancelled)throw new Error('Export cancelled');
 if(r!==0)throw new Error('FFmpeg failed. Every clip needs an audio track; see the browser console.');
 return new Blob([await f.readFile(out)],{type:o.fmt==='mp4'?'video/mp4':'video/webm'});
}
export async function extractAudio(file,start,end){
 const f=await loadFF();await f.writeFile('src',new Uint8Array(await file.arrayBuffer()));
 const r=await f.exec(['-i','src','-ss',String(start),'-to',String(end),'-vn','-c:a','libmp3lame','-b:a','192k','a.mp3']);
 if(r!==0)throw new Error('This file has no audio track to extract.');
 return new Blob([await f.readFile('a.mp3')],{type:'audio/mpeg'});
}
