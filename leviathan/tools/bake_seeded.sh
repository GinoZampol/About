#!/bin/bash
# Bakes one seeded world. The bake it replaces is never thrown away: if data_s<seed> exists and has been
# published, it is first moved to the next free data_s<seed>-v<n> (with its map), so it stays on the menu.
cd "$(dirname "$0")/.."
# optional second argument: a rectangular world, e.g. 80x40 (folder data_s<seed>-80x40)
seed=$1; sz=${2:-50x50}; s=$seed; [ "$sz" != 50x50 ] && s=$seed-$sz; mkdir -p .cache; L=.cache/bake_$s.log
if [ -d data_s$s ]; then n=1; while [ -d data_s$s-v$n ]; do n=$((n+1)); done
  # (not if the latest kept version is already this exact bake)
  if [ $n -eq 1 ] || ! cmp -s data_s$s/height.bin data_s$s-v$((n-1))/height.bin; then
    cp -r data_s$s data_s$s-v$n; cp docs/map_ecology_s$s.png docs/map_ecology_s$s-v$n.png 2>/dev/null; fi; fi
node --max-old-space-size=9000 worldgen/generate.mjs --res 4096 --variant S --seed $seed --size $sz ${STAGE:+--stage $STAGE} --out data_s$s > $L 2>&1; echo "exit $?" >> $L
