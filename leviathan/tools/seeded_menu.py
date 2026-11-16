#!/usr/bin/env python3
"""Builds the menu page of the seeded worlds: tools/seeded_menu.py <leviathan dir> <site world-s dir>.
One card per baked world (data_s<seed>/): a small top-down map, the seed, the highest summit, the land area."""
import json, os, sys, glob, html
from PIL import Image

L, OUT = sys.argv[1], sys.argv[2]
cards = []
for d in sorted(glob.glob(os.path.join(L, 'data_s*'))):
    seed = os.path.basename(d)[len('data_s'):]
    meta = json.load(open(os.path.join(d, 'world.json')))
    src = os.path.join(L, 'docs', f'map_ecology_s{seed}.png')
    if os.path.exists(src):
        im = Image.open(src).convert('RGB')
        # crop to the playable 50 km (the map covers the 56 km generated domain)
        n = im.size[0]; m = round(n * 3 / 56)
        im = im.crop((m, m, n - m, n - m)).resize((420, 420), Image.LANCZOS)
        im.save(os.path.join(OUT, f's{seed}', 'map.jpg'), quality=84)
    names = [l['name'] for l in meta.get('landmarks', [])]
    cards.append((seed, meta.get('maxElevation', 0), meta.get('landKm2', 0), names))

items = '\n'.join(
    f'<a class="card" href="play/?data=../s{s}/"><img src="s{s}/map.jpg" alt="Map of world {s}" width="420" height="420" loading="lazy">'
    f'<b>World {s}</b><span>Highest summit {h:,} m</span></a>' for s, h, land, names in cards)
page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seeded worlds</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{ margin: 0; background: #0b0e12; color: #e8e6df; font: 16px/1.5 Georgia, serif; }}
  main {{ max-width: 1100px; margin: 0 auto; padding: 2rem 16px 3rem; }}
  h1 {{ font-size: 1.7rem; letter-spacing: .16em; margin: 0 0 .3rem; }}
  p {{ color: #b9b5aa; margin: 0 0 1.6rem; max-width: 46rem; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 1rem; }}
  .card {{ display: block; color: inherit; text-decoration: none; border: 1px solid #ffffff22; padding: .6rem; }}
  .card:hover, .card:focus-visible {{ border-color: #c8b68a; outline: none; }}
  .card img {{ display: block; width: 100%; height: auto; margin-bottom: .5rem; }}
  .card b {{ display: block; font-weight: 600; }} .card span {{ color: #b9b5aa; font-size: .9rem; }}
  .back {{ display: inline-block; color: #b9b5aa; margin-bottom: 1.2rem; text-decoration: none; }}
</style></head><body><main>
<a class="back" href="../">&larr; All worlds</a>
<h1>SEEDED WORLDS</h1>
<p>Each world comes from a random seed alone. The seed sets the slow causes (a sinking basin, uneven uplift,
one zone of thickened crust, volcanic islands, a rain wind) and an erosion simulation of about three million
years makes the land. Each world downloads about 14 MB.</p>
<div class="grid">
{items}
</div>
</main></body></html>
'''
open(os.path.join(OUT, 'index.html'), 'w').write(page)
print(f'{len(cards)} seeded worlds in the menu')
