"""Build the public index.html from the Claude Bet Ledger page.

usage: python3 tools/build_public.py <bet-ledger.html from the Claude artifact>
The page stays identical; shim.js stands in for the Claude runtime (see shim.js).
"""
import json, re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1]).read_text()
head = ('<script src="firebase-config.js"></script><script src="shim.js"></script>'
        '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E%F0%9F%8F%88%3C/text%3E%3C/svg%3E">'
        '<style>#refreshBar,#importBtn{display:none!important}'
        '.pubauth{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}'
        '.pubauth .btns{display:flex;gap:8px;align-items:center;flex-wrap:wrap}'
        '.gbtn{display:inline-flex;gap:8px;align-items:center;font-weight:600}</style>')
assert src.count('</head>') >= 1
out = src.replace('</head>', head + '</head>', 1)
out = out.replace('Private to you. Saved to your account.', 'Your bet log is saved in this browser.')
lines = (root / 'lines.json').read_text()
out, n = re.subn(r'(<script[^>]*id="boardSnap"[^>]*>)(.*?)(</script>)', lambda m: m.group(1) + lines.replace('</', '<\\/') + m.group(3), out, count=1, flags=re.S)
assert n == 1
(root / 'index.html').write_text(out)
print('wrote', root / 'index.html', len(out))
