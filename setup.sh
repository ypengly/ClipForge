#!/bin/sh
# Downloads FFmpeg.wasm and copies the browser files into vendor/
npm init -y >/dev/null 2>&1
npm i @ffmpeg/ffmpeg@0.12.10 @ffmpeg/core@0.12.6
cp node_modules/@ffmpeg/ffmpeg/dist/umd/* vendor/
cp node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.* vendor/
echo "Done. Now run: python serve.py"
