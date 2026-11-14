#!/usr/bin/env python3
"""Serve the standalone NOËL artwork on localhost, with no dependencies."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=4173)
args = parser.parse_args()
handler = partial(SimpleHTTPRequestHandler, directory=str(Path(__file__).resolve().parent))
try:
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
except OSError as error:
    parser.exit(1, f'Cannot start on port {args.port}: {error}\nTry: python3 serve.py --port 4174\n')
print(f'NOËL is ready at http://127.0.0.1:{args.port}', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
