# ClipForge
Lightweight browser video editor (HTML/CSS/vanilla JS, FFmpeg.wasm, Web Audio, IndexedDB).

## Run
1. `sh setup.sh` (needs Node/npm; copies FFmpeg.wasm into `vendor/`).
2. `python serve.py`, then open http://localhost:8080 in Chrome or Edge.
Live Server will not work for export: FFmpeg.wasm needs COOP/COEP headers, which `serve.py` sends.

## Test each feature
- Import: click Import or drop files; click a library item to add it to the timeline.
- Trim: set Start/End. Split: move playhead, press S. Delete: Delete key. Reorder: drag clips.
- Speed, volume, crop, rotate, flip, brightness/contrast/saturation: change the Clip panel, preview updates, export applies them.
- Extract audio: select clip, "Extract audio (MP3)".
- Voice enhance: set sliders, Preview result, then export and listen to the output.
- Save/Open: Save project (also autosaves), Projects to reopen/delete.
- Export: pick settings, Start export, then Download.

## Known limitations (not implemented yet)
- Text overlays/subtitles, transitions, audio tracks/background music, waveforms and clip-edge dragging are not built.
- Timeline is one video track; clips must contain an audio track to export.
- Preview denoise is a filter approximation; export uses real FFmpeg `afftdn`. Background reduction is a low-pass, not source separation.
- Preview crop is approximate; export uses the first clip's crop ratio for the whole output.
- 4K and 60 fps are slow in WASM; 1080p on long clips may exceed browser memory.
- Safari/Firefox: preview works, export is best in Chromium browsers.
