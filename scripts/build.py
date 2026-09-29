"""Bundle index.html + css + js into one self-contained file: dist/war-room.html.
Run: python3 scripts/build.py   (no dependencies)
The GitHub Pages site doesn't need this; it serves index.html directly. The bundle is for sharing one file or previewing in claude.ai."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'css/app.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="css/app.css">', '<style>\n' + css + '</style>')
def inline(m):
    src = (root / m.group(1)).read_text(encoding='utf-8')
    return '<script>\n/* ' + m.group(1) + ' */\n' + src + '\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
out = root / 'dist' / 'war-room.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print('wrote', out, round(out.stat().st_size / 1024), 'KB')
