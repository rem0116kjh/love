#!/usr/bin/env python3
"""Package the artwork as one offline HTML file, using only Python's standard library."""
import base64
from pathlib import Path

root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'styles.css').read_text(encoding='utf-8')
for name in ('cormorant-latin.woff2', 'cormorant-italic-latin.woff2'):
    encoded = base64.b64encode((root / 'assets' / name).read_bytes()).decode('ascii')
    css = css.replace(f'./assets/{name}', f'data:font/woff2;base64,{encoded}')
html = html.replace('<link rel="stylesheet" href="./styles.css">', f'<style>\n{css}\n</style>')
for script in ('scene.js', 'app.js'):
    html = html.replace(f'  <script src="./{script}" defer></script>\n', '')
    source = (root / script).read_text(encoding='utf-8')
    html = html.replace('</body>', f'<script>\n{source}\n</script>\n</body>')
favicon = base64.b64encode((root / 'assets/favicon.svg').read_bytes()).decode('ascii')
html = html.replace('./assets/favicon.svg', f'data:image/svg+xml;base64,{favicon}')
license_text = (root / 'assets/FONT-LICENSE.txt').read_text(encoding='utf-8')
html = html.replace('</body>', f'<script type="text/plain" id="font-license">\n{license_text}\n</script>\n</body>')
out = root / 'dist' / 'noel-for-sieun.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(f'{out} ({out.stat().st_size:,} bytes)')
