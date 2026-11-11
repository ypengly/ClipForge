// IndexedDB: project metadata + edit list in 'projects'; media blobs in 'media' (never localStorage).
const open=()=>new Promise((res,rej)=>{const r=indexedDB.open('clipforge',1);
 r.onupgradeneeded=()=>{r.result.createObjectStore('projects',{keyPath:'id'});r.result.createObjectStore('media')};
 r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const tx=async(s,m,f)=>{const d=await open();return new Promise((res,rej)=>{const t=d.transaction(s,m);const q=f(t.objectStore(s));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)})};
export const saveProject=(p,blobs)=>Promise.all([tx('projects','readwrite',s=>s.put(p)),...Object.entries(blobs).map(([k,v])=>tx('media','readwrite',s=>s.put(v,k)))]);
export const listProjects=()=>tx('projects','readonly',s=>s.getAll());
export const getBlob=k=>tx('media','readonly',s=>s.get(k));
export const deleteProject=id=>tx('projects','readwrite',s=>s.delete(id));
