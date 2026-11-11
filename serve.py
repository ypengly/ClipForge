# Local server with the COOP/COEP headers FFmpeg.wasm needs (SharedArrayBuffer). Run: python serve.py
import http.server, socketserver
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy","same-origin")
        self.send_header("Cross-Origin-Embedder-Policy","require-corp")
        self.send_header("Cache-Control","no-store")
        super().end_headers()
H.extensions_map['.wasm']='application/wasm'
socketserver.TCPServer.allow_reuse_address=True
with socketserver.TCPServer(("",8080),H) as s:
    print("ClipForge: http://localhost:8080"); s.serve_forever()
