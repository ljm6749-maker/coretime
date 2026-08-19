#!/usr/bin/env python3
"""
단일 파일 빌드 스크립트.

assets/ 의 CSS·JS 를 index.html 안으로 인라인해 dist/index.html 을 만듭니다.
사내 위키·공유 드라이브처럼 파일 하나만 올릴 수 있는 곳에 배포할 때 사용합니다.

  python3 build.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
html = (ROOT / 'index.html').read_text(encoding='utf-8')

# <link rel="stylesheet" href="assets/..."> → <style>
def inline_css(match):
    href = match.group(1)
    css = (ROOT / href).read_text(encoding='utf-8')
    return '<style>\n' + css + '\n</style>'

html = re.sub(r'<link rel="stylesheet" href="(assets/[^"]+)">', inline_css, html)

# <script src="assets/..."></script> → <script>
def inline_js(match):
    src = match.group(1)
    js = (ROOT / src).read_text(encoding='utf-8')
    return '<script>\n' + js + '\n</script>'

html = re.sub(r'<script src="(assets/[^"]+)"></script>', inline_js, html)

out = ROOT / 'dist'
out.mkdir(exist_ok=True)
(out / 'index.html').write_text(html, encoding='utf-8')
print('dist/index.html 생성 완료 —', len(html.encode('utf-8')) // 1024, 'KB')

# 문서 골격을 감싸 주는 호스트(사내 위키 임베드 등)를 위한 조각 파일
fragment = html
fragment = re.sub(r'<!doctype html>\s*', '', fragment, flags=re.I)
fragment = re.sub(r'</?(?:html|head|body)(?:\s[^>]*)?>', '', fragment, flags=re.I)
fragment = re.sub(r'<meta[^>]*>', '', fragment, flags=re.I)
fragment = fragment.strip() + '\n'
(out / 'embed.html').write_text(fragment, encoding='utf-8')
print('dist/embed.html 생성 완료 —', len(fragment.encode('utf-8')) // 1024, 'KB')
