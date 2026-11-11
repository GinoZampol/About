import pathlib
OUT = pathlib.Path(__file__).parent
S = 11
def mag(stroke, w=12, glass="rgba(255,255,255,.35)"):
    return f'''<svg class="mag" viewBox="0 0 300 300"><circle cx="115" cy="115" r="85" fill="{glass}" stroke="{stroke}" stroke-width="{w}"/>
<path d="M62 85 A60 60 0 0 1 100 52" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".9"/>
<line x1="178" y1="178" x2="268" y2="268" stroke="{stroke}" stroke-width="{w+12}" stroke-linecap="round"/></svg>'''

def chart(pre, eu, m, lb=("BAD","GOOD")):
    def bw(kind, v, extra="", mm=""):
        return f'<div class="bw {kind} {extra}"><div class="bar" style="height:{v*S}px"></div>{mm}<div class="lab">{lb[0] if kind=="bad" else lb[1]}</div></div>'
    return f'''<div class="chart"><div class="grid"><i></i><i></i><i></i><i></i></div><div class="bars">{bw("bad",22)}{bw("good",27)}{bw("bad",12,"gap",m)}{bw("good",65)}</div>
<div class="groups"><div class="grp pre"><div class="gt">{pre}</div><div class="gs">before</div></div><div class="grp eu"><div class="gt">{eu}</div><div class="gs">after</div></div></div></div>'''

BASE = '''*{box-sizing:border-box;margin:0;padding:0}body{width:1080px;height:1920px;overflow:hidden;font-family:Inter,'Liberation Sans',sans-serif}
.stage{position:relative;width:1080px;height:1920px;overflow:hidden}
.chart{position:absolute;left:0;right:0;top:740px}
.grid{position:absolute;left:60px;right:60px;top:0;height:780px}.grid i{position:absolute;left:0;right:0;height:0;border-top:2px solid #0002}
.grid i:nth-child(1){top:0}.grid i:nth-child(2){top:260px}.grid i:nth-child(3){top:520px}.grid i:nth-child(4){top:780px}
.bars{height:780px;display:flex;align-items:flex-end;justify-content:center;gap:22px;position:relative}.bw{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;width:200px}.bw.gap{margin-left:70px}
.bar{width:100%}.lab{position:absolute;bottom:-58px;font-weight:800;font-size:34px;letter-spacing:2px}
.mag{position:absolute;width:290px;height:290px;left:50%;top:50%;margin-left:-125px;transform:translateY(-175px) rotate(-8deg)}
.groups{display:flex;justify-content:center;margin-top:92px}.grp{width:422px;text-align:center;border-top:6px solid #888;padding-top:14px}.grp+.grp{margin-left:70px}
.gt{font-weight:800;font-size:36px;line-height:1.1;text-transform:uppercase}.gs{font-size:26px;margin-top:6px;opacity:.7}
.foot{position:absolute;bottom:60px;left:60px;right:60px;font-size:24px}
'''
def page(name, css, body):
    (OUT/f"{name}.html").write_text(f'<!doctype html><html><head><meta charset="utf-8"><style>{BASE}{css}</style></head><body><div class="stage">{body}</div></body></html>')

# N1  NYT-style ---------------------------------------------------------
page("n1-times-editorial", '''.stage{background:#fff;color:#121212}
.k{position:absolute;top:78px;left:60px;right:60px;font-weight:800;font-size:28px;letter-spacing:4px;color:#666;text-transform:uppercase;border-bottom:3px solid #121212;padding-bottom:16px}
h1{position:absolute;top:150px;left:60px;right:60px;font-family:'Liberation Serif','DejaVu Serif',serif;font-weight:700;font-size:150px;line-height:.96;letter-spacing:-3px}
h1 i{font-style:italic;color:#bf3a30}
h2{position:absolute;top:630px;left:60px;right:80px;font-family:'Liberation Serif',serif;font-size:50px;line-height:1.15;color:#444;font-weight:400}
.bad .bar{background:#bf3a30}.good .bar{background:#2f7d5b}.lab{color:#121212;font-family:'Liberation Sans',sans-serif}
.grp{border-top-color:#121212}.grp.eu{border-top-color:#121212}.gt{font-family:'Liberation Sans',sans-serif;font-size:32px}.gs{font-family:'Liberation Serif',serif;font-style:italic;font-size:30px}
.mag{filter:drop-shadow(0 6px 6px #0003)}.foot{color:#777;font-family:'Liberation Serif',serif;font-style:italic;font-size:26px;border-top:2px solid #ddd;padding-top:14px}''',
f'''<div class="k">Opinion &nbsp;|&nbsp; The Chart</div><h1>“All bad”? <i>Look at the ratio.</i></h1><h2>What the colonial record looks like when you weigh the harm against the good.</h2>
{chart("Pre-colonial<br>Nigerian regimes","European<br>colonialism",mag("#121212"))}<div class="foot">Illustrative, not exact figures. Bars show relative share of outcomes.</div>''')

# N2  WSJ-style ---------------------------------------------------------
page("n2-journal-stipple", '''.stage{background:#f6f3ea;color:#0f2742}
.k{position:absolute;top:80px;left:60px;font-weight:800;font-size:30px;letter-spacing:5px;color:#fff;background:#0a58b3;padding:10px 26px;text-transform:uppercase}
h1{position:absolute;top:170px;left:60px;right:60px;font-family:'Liberation Serif',serif;font-weight:700;font-size:146px;line-height:.98;letter-spacing:-3px;color:#0f2742}
h2{position:absolute;top:625px;left:60px;right:80px;font-family:'Liberation Serif',serif;font-style:italic;font-size:52px;line-height:1.15;color:#3b5875}
.grid i{border-top:3px dotted #0f274255}
.bar{background-image:radial-gradient(#fff6 2px,transparent 2.5px);background-size:12px 12px}
.bad .bar{background-color:#b3202a}.good .bar{background-color:#0f2742}.lab{color:#0f2742;font-family:'Liberation Serif',serif;font-size:36px}
.grp{border-top:4px solid #0f2742}.grp.eu{border-top-color:#b3202a}.gt{font-family:'Liberation Serif',serif;font-size:36px}
.mag{filter:drop-shadow(0 6px 0 #0003)}.foot{color:#3b5875;font-family:'Liberation Serif',serif;font-style:italic;font-size:26px}''',
f'''<div class="k">By the numbers</div><h1>Was colonialism really <em>all bad?</em></h1><h2>The ledger says the harm was the smaller share.</h2>
{chart("Pre-colonial<br>African regimes","European<br>colonialism",mag("#0f2742"))}<div class="foot">Illustrative, not exact figures.</div>''')

# N3  Economist-style ------------------------------------------------------
page("n3-weekly-chartbook", '''.stage{background:#fff;color:#121212}
.rule{position:absolute;top:0;left:60px;width:140px;height:26px;background:#e3120b}
h1{position:absolute;top:80px;left:60px;right:60px;font-weight:900;font-size:136px;line-height:.96;letter-spacing:-4px}
h1 span{color:#e3120b}
h2{position:absolute;top:530px;left:60px;right:80px;font-weight:500;font-size:46px;line-height:1.2;color:#444}
.panelbg{position:absolute;left:30px;right:30px;top:700px;height:1110px;background:#dde9ef;z-index:0}
.chart{z-index:1}.grid i{border-top:2px solid #fff}.grid i{border-top-width:4px}
.bad .bar{background:#e3120b}.good .bar{background:#006ba2}.lab{color:#121212}
.grp{border-top:4px solid #121212}.grp.eu{border-top-color:#121212}.gt{font-size:32px}
.mag{filter:drop-shadow(0 6px 4px #0003)}.foot{color:#666;font-size:24px;bottom:50px;left:60px}''',
f'''<div class="rule"></div><h1>The colonial ledger: <span>harm vs. good</span></h1><h2>The chart the “all bad” crowd leaves out</h2><div class="panelbg"></div>
{chart("Pre-colonial<br>Nigerian regimes","European<br>colonialism",mag("#121212"))}<div class="foot">Illustrative, not exact figures. Relative share of outcomes.</div>''')

# N4  Terminal-style ------------------------------------------------------
page("n4-terminal-black", '''.stage{background:#000;color:#ff9f1c;font-family:'JetBrains Mono',monospace}
.hdr{position:absolute;top:0;left:0;right:0;height:70px;background:#ff9f1c;color:#000;font-weight:800;font-size:30px;display:flex;align-items:center;padding:0 40px;letter-spacing:2px}
h1{position:absolute;top:120px;left:50px;right:50px;font-family:Inter,sans-serif;font-weight:900;font-size:140px;line-height:.92;letter-spacing:-4px;color:#fff;text-transform:uppercase}
h1 span{color:#ff9f1c}
h2{position:absolute;top:560px;left:50px;right:60px;font-size:34px;line-height:1.35;color:#ff9f1c}
.grid i{border-top:2px dashed #ff9f1c44}
.bad .bar{background:#ff3b30}.good .bar{background:#16e08f}.lab{color:#ff9f1c;font-family:'JetBrains Mono',monospace;font-size:32px}
.grp{border-top:4px solid #ff9f1c66}.grp.eu{border-top-color:#ff9f1c}.gt{font-family:'JetBrains Mono',monospace;font-size:30px;color:#fff}.gs{color:#ff9f1c}
.mag{filter:drop-shadow(0 0 16px #ff9f1c)}.foot{color:#ff9f1c99;font-size:22px}''',
f'''<div class="hdr">OUTCOMES &lt;GO&gt; &nbsp;|&nbsp; COLONIAL LEDGER</div><h1>The ratio <span>nobody</span> charts</h1><h2>&gt; BAD vs GOOD OUTCOMES<br>&gt; BEFORE / AFTER EUROPEAN RULE</h2>
{chart("PRE-COLONIAL<br>NIGERIAN REGIMES","EUROPEAN<br>COLONIALISM",mag("#ff9f1c"))}<div class="foot">ILLUSTRATIVE. NOT EXACT FIGURES.</div>''')

# N5  FT-style ------------------------------------------------------------
page("n5-pink-paper", '''.stage{background:#fff1e5;color:#33302e}
.k{position:absolute;top:84px;left:60px;font-weight:800;font-size:30px;letter-spacing:4px;color:#0d7680;text-transform:uppercase}
.k:after{content:"";display:block;margin-top:14px;width:120px;height:6px;background:#0d7680}
h1{position:absolute;top:190px;left:60px;right:60px;font-family:'Bitstream Charter','Liberation Serif',serif;font-weight:700;font-size:134px;line-height:.98;letter-spacing:-3px}
h1 i{color:#990f3d}
h2{position:absolute;top:625px;left:60px;right:80px;font-family:'Bitstream Charter',serif;font-size:46px;line-height:1.2;color:#66605c}
.grid i{border-top:2px solid #33302e22}
.bad .bar{background:#990f3d}.good .bar{background:#0d7680}.lab{color:#33302e;font-size:32px}
.grp{border-top:3px solid #33302e}.grp.eu{border-top:6px solid #990f3d}.gt{font-family:'Bitstream Charter',serif;font-size:36px;text-transform:none;font-weight:700}.gs{font-family:'Bitstream Charter',serif;font-style:italic}
.mag{filter:drop-shadow(0 6px 4px #0003)}.foot{color:#66605c;font-family:'Bitstream Charter',serif;font-style:italic;font-size:26px}''',
f'''<div class="k">The big picture</div><h1>Colonialism’s <i>uncomfortable</i> arithmetic</h1><h2>Weigh the harm against the good, before and after.</h2>
{chart("Pre-colonial<br>African regimes","European<br>colonialism",mag("#33302e"))}<div class="foot">Illustrative, not exact figures.</div>''')
