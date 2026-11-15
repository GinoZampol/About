#!/usr/bin/env bash
# Builds the GitHub Pages site into <repo>/docs: a landing page plus three self-contained worlds
# (current main world, variant 1B, and the frozen version 5). Run from anywhere inside the repo.
set -euo pipefail
REPO="$(git rev-parse --show-toplevel)"; L="$REPO/leviathan"; OUT="$REPO/docs"; V5=eda0fff
rm -rf "$OUT"; mkdir -p "$OUT/vendor/addons/csm"; touch "$OUT/.nojekyll"
cp "$L/node_modules/three/build/three.module.js" "$L/node_modules/three/build/three.core.js" "$OUT/vendor/"
cp "$L/node_modules/three/examples/jsm/csm/"CSM.js "$L/node_modules/three/examples/jsm/csm/"CSMFrustum.js "$L/node_modules/three/examples/jsm/csm/"CSMShader.js "$OUT/vendor/addons/csm/"
page() {  # $1 = source index.html, $2 = target dir, $3 = title
  sed -e 's#"../node_modules/three/build/three.module.js"#"../vendor/three.module.js"#' \
      -e 's#"../node_modules/three/examples/jsm/"#"../vendor/addons/"#' \
      -e 's#src="./main.js"#src="client/main.js"#' -e "s#<title>The Leviathan</title>#<title>$3</title>#" "$1" > "$2/index.html"
}
world() {  # $1 = target name, $2 = data dir, $3 = title
  mkdir -p "$OUT/$1/client" "$OUT/$1/shared" "$OUT/$1/data"
  cp "$L"/client/*.js "$OUT/$1/client/"; cp "$L"/shared/*.mjs "$OUT/$1/shared/"; cp "$L/$2"/* "$OUT/$1/data/"
  page "$L/client/index.html" "$OUT/$1" "$3"
}
world world data "The Leviathan"
world world-b data_b "The Leviathan 1B"
# frozen version 5, taken straight from its commit
mkdir -p "$OUT/v5"; git -C "$REPO" archive "$V5" leviathan/client leviathan/shared leviathan/data | tar -x -C "$OUT/v5" --strip-components=1
page "$OUT/v5/client/index.html" "$OUT/v5" "The Leviathan v5"; rm "$OUT/v5/client/index.html"
# version 5 looked for its data relative to the page; point it at its own folder
sed -i "s#const dataUrl = Q.get('data') || '../data/';#const dataUrl = Q.get('data') || new URL('../data/', import.meta.url).href;#" "$OUT/v5/client/main.js"
cat > "$OUT/index.html" <<'HTML'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Leviathan</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; background: #0b0e12; color: #e8e6df; font: 16px/1.5 Georgia, serif; display: flex; align-items: center; justify-content: center; }
  main { max-width: 34rem; padding: 2rem max(16px, env(safe-area-inset-left, 0px)); }
  h1 { font-size: 1.9rem; letter-spacing: .18em; margin: 0 0 .3rem; }
  p { color: #b9b5aa; margin: 0 0 1.6rem; }
  a { display: block; color: inherit; text-decoration: none; border: 1px solid #ffffff22; padding: .9rem 1.1rem; margin-bottom: .7rem; }
  a:hover, a:focus-visible { border-color: #c8b68a; outline: none; }
  a b { display: block; font-weight: 600; } a span { color: #b9b5aa; font-size: .9rem; }
</style></head><body><main>
<h1>THE LEVIATHAN</h1>
<p>A generated 50 × 50 km world you can fly or walk through in the browser. Each world downloads about 14 MB.</p>
<a href="world/"><b>The main world</b><span>Coast Range, Central Valley, the Spine, the Crown, mesa and dune sea</span></a>
<a href="world-b/"><b>Version 1B</b><span>A central ocean, one great massif, prairie, sand sea, cold north</span></a>
<a href="v5/"><b>Version 5 (frozen)</b><span>An earlier snapshot, kept for comparison</span></a>
</main></body></html>
HTML
du -sh "$OUT"
