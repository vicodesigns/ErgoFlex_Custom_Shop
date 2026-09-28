from pathlib import Path

folder = Path(__file__).resolve().parent
html = (folder / 'editor-shell.html').read_text()
module = (folder / 'tech-week-divi-code-module.html').read_text()
css = (folder / 'editor.css').read_text() + (folder / 'editor-click.css').read_text()
js = (folder / 'editor.js').read_text()

assert '<!-- MODULE_HERE -->' in html
assert '<link rel="stylesheet" href="editor.css">' in html
assert '<script src="editor.js"></script>' in html
assert '</script>' not in js

html = html.replace('<!-- MODULE_HERE -->', module)
html = html.replace('<link rel="stylesheet" href="editor.css">', f'<style>{css}</style>')
html = html.replace('<script src="editor.js"></script>', f'<script>{js}</script>')
(folder / 'ergoflex-editor.html').write_text(html)
print(f'Built {folder / "ergoflex-editor.html"} ({len(html):,} characters)')
(folder / 'ergoflex-demos.html').write_text(
    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    '<title>ErgoFlex | Meet ErgoFlex. An intelligent workstation, in motion</title>'
    '<meta name="description" content="Bring a staffed ErgoFlex desk demonstration to your LA Tech Week event. Guests try the controls and meet the inventor. Transport, setup, and demonstrations handled.">'
    '</head><body style="margin:0">' + module + '</body></html>'
)
