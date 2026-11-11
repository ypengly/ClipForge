// Voice enhancement from one settings object, two paths:
//  1) Live preview via Web Audio (approximation: filters + compressor, no spectral denoise)
//  2) Export via FFmpeg (afftdn spectral denoise, EQ, loudnorm) -> ffmpegFilters()
export const defaults=()=>({noise:0,clarity:0,bg:0,vol:100,norm:false,fade:0});
let ctx,c;
export function attachPreview(video){
 if(ctx)return;ctx=new AudioContext();const src=ctx.createMediaElementSource(video);
 const hp=ctx.createBiquadFilter();hp.type='highpass';
 const pk=ctx.createBiquadFilter();pk.type='peaking';pk.frequency.value=3000;
 const lp=ctx.createBiquadFilter();lp.type='lowpass';
 const comp=ctx.createDynamicsCompressor(),g=ctx.createGain();
 c={hp,pk,lp,comp,g};src.connect(hp);hp.connect(pk);pk.connect(lp);lp.connect(comp);comp.connect(g);g.connect(ctx.destination);
}
export function applyPreview(v,on=true){
 if(!c)return;ctx.resume();if(!on)v=defaults();
 c.hp.frequency.value=60+v.noise*1.4;c.pk.gain.value=v.clarity*0.1;c.lp.frequency.value=20000-v.bg*120;
 c.comp.threshold.value=v.norm?-30:0;c.comp.ratio.value=v.norm?6:1;c.g.gain.value=v.vol/100;
}
/** FFmpeg audio filters used at export. */
export function ffmpegFilters(v){
 const f=[];
 if(v.noise>0)f.push(`highpass=f=${60+Math.round(v.noise*1.4)}`,`afftdn=nr=${Math.round(6+v.noise*0.24)}:nf=-40`);
 if(v.clarity>0)f.push(`equalizer=f=3000:t=q:w=1:g=${(v.clarity*0.1).toFixed(1)}`);
 if(v.bg>0)f.push(`lowpass=f=${20000-v.bg*120}`);
 if(v.norm)f.push('loudnorm=I=-16:TP=-1.5:LRA=11');
 return f;
}
