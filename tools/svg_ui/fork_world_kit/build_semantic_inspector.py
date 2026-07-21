#!/usr/bin/env python3
"""Build a self-contained SVG fork/component inspector.

The output lets a designer switch variants, toggle semantic feature groups,
click any drawable to see its stable id/role/bounding box, and display every
fork bbox at once.  It intentionally embeds the SVGs so it also works from a
``file://`` URL.
"""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path


def build(variants_dir: Path, output: Path) -> None:
    index = json.loads((variants_dir / "manifest.json").read_text(encoding="utf-8"))
    scenes: list[str] = []
    compact: dict[str, dict] = {}
    options: list[str] = []
    for position, item in enumerate(index["variants"]):
        variant = item["id"]
        source = (variants_dir / item["svg"]).read_text(encoding="utf-8")
        source = re.sub(r"^.*?(?=<svg\b)", "", source, flags=re.S)
        manifest = json.loads((variants_dir / item["manifest"]).read_text(encoding="utf-8"))
        compact[variant] = {
            "forks": [
                {
                    "fork_id": fork["fork_id"],
                    "side": fork["side"],
                    "attach": fork["attach"],
                    "bbox": fork["bbox"],
                    "selectors": fork["selectors"],
                }
                for fork in manifest["forks"]
            ],
            "graph": manifest["road_network"],
        }
        hidden = "" if position == 0 else " hidden"
        scenes.append(f'<div class="scene{hidden}" data-variant="{variant}">{source}</div>')
        options.append(f'<option value="{variant}">{variant}</option>')

    data_json = json.dumps(compact, separators=(",", ":")).replace("</", "<\\/")
    document = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Semantic road / fork inspector</title>
<style>
  :root {{ color-scheme:dark; font:14px/1.4 Inter,ui-sans-serif,system-ui,sans-serif; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; min-height:100vh; display:grid; grid-template-columns:300px 1fr;
          background:#101722; color:#e9eef6; }}
  aside {{ padding:18px; background:#182232; border-right:1px solid #344157; overflow:auto; }}
  main {{ min-width:0; display:grid; place-items:center; padding:16px; }}
  h1 {{ font-size:18px; margin:0 0 14px; }}
  h2 {{ font-size:12px; color:#9fb2ca; text-transform:uppercase; letter-spacing:.12em;
        margin:20px 0 8px; }}
  select {{ width:100%; padding:8px; border-radius:6px; border:1px solid #52627a;
            background:#0f1723; color:inherit; }}
  label {{ display:flex; gap:8px; align-items:center; margin:7px 0; }}
  button {{ width:100%; padding:8px; margin:5px 0; background:#26364c; color:inherit;
            border:1px solid #4c617c; border-radius:6px; cursor:pointer; }}
  button:hover {{ background:#31445e; }}
  .stage {{ width:min(100%,1200px); box-shadow:0 16px 60px #0009; background:#21324a; }}
  .scene {{ width:100%; }} .scene.hidden {{ display:none; }}
  .scene>svg {{ display:block; width:100%; height:auto; cursor:crosshair; }}
  .feature-hidden {{ visibility:hidden !important; }}
  #selection {{ min-height:120px; padding:10px; background:#0d1520; border-radius:7px;
                white-space:pre-wrap; overflow-wrap:anywhere; color:#bdd0e7; }}
  #routes {{ margin:0; padding-left:18px; color:#bdd0e7; }}
  #routes button {{ text-align:left; font-size:12px; padding:5px; }}
  .note {{ color:#8fa1b8; font-size:12px; }}
</style></head><body>
<aside>
  <h1>Road semantics inspector</h1>
  <div class="note">Click any painted part to inspect its stable selector and bbox.</div>
  <h2>Variant</h2><select id="variant">{''.join(options)}</select>
  <h2>Feature visibility</h2>
  <label><input type="checkbox" data-toggle="road" checked> traced main-road parts</label>
  <label><input type="checkbox" data-toggle="fork-road|fork-road-top" checked> generated fork road</label>
  <label><input type="checkbox" data-toggle="fork-land" checked> fork land</label>
  <label><input type="checkbox" data-toggle="fork-underside" checked> fork underside</label>
  <label><input type="checkbox" data-toggle="fork-vegetation" checked> fork vegetation</label>
  <button id="boxes">Show all fork bounding boxes</button>
  <button id="clear">Clear selection</button>
  <h2>Selected component</h2><div id="selection">Nothing selected.</div>
  <h2>Tracked route edges</h2><div id="routes"></div>
</aside>
<main><div class="stage">{''.join(scenes)}</div></main>
<script>
const DATA={data_json};
const select=document.querySelector('#variant'), selection=document.querySelector('#selection'), routes=document.querySelector('#routes');
const NS='http://www.w3.org/2000/svg'; let showingAll=false;
const active=()=>document.querySelector('.scene:not(.hidden)');
const svg=()=>active().querySelector('svg');
function overlay(){{
  let group=svg().querySelector('#inspector-overlay');
  if(!group){{ group=document.createElementNS(NS,'g'); group.id='inspector-overlay'; group.dataset.feature='inspector'; group.style.pointerEvents='none'; svg().append(group); }}
  return group;
}}
function clearOverlay(){{ const group=svg().querySelector('#inspector-overlay'); if(group)group.replaceChildren(); showingAll=false; document.querySelector('#boxes').textContent='Show all fork bounding boxes'; }}
function rectFor(element,label,color='#ff335f'){{
  const box=element.getBBox(), group=overlay();
  const rect=document.createElementNS(NS,'rect');
  for(const [key,value] of Object.entries({{x:box.x,y:box.y,width:box.width,height:box.height}}))rect.setAttribute(key,value);
  rect.setAttribute('fill','none'); rect.setAttribute('stroke',color); rect.setAttribute('stroke-width','3'); rect.setAttribute('vector-effect','non-scaling-stroke'); group.append(rect);
  const text=document.createElementNS(NS,'text'); text.setAttribute('x',box.x+5); text.setAttribute('y',Math.max(16,box.y+16));
  text.setAttribute('fill',color); text.setAttribute('stroke','#fff'); text.setAttribute('stroke-width','3'); text.setAttribute('paint-order','stroke'); text.setAttribute('font-size','13'); text.textContent=label; group.append(text);
  return box;
}}
function inspect(element){{
  clearOverlay(); const box=rectFor(element,element.id||element.dataset.feature);
  const d=element.dataset;
  selection.textContent=[`id: ${{element.id||'(none)'}}`,`feature: ${{d.feature||'(none)'}}`,`fork: ${{d.forkId||'(none)'}}`,`role: ${{d.role||d.routeRole||'(none)'}}`,`path: ${{d.pathId||'(none)'}}`,`bbox: ${{[box.x,box.y,box.width,box.height].map(n=>n.toFixed(1)).join(', ')}}`,`selector: #${{element.id}}`].join('\n');
}}
function refreshRoutes(){{
  const graph=DATA[select.value].graph;
  routes.replaceChildren(); const list=document.createElement('ul'); list.id='routes';
  for(const edge of graph.edges){{ const li=document.createElement('li'), button=document.createElement('button');
    button.textContent=`${{edge.id}} · ${{edge.role}}`; button.onclick=()=>{{ const target=edge.selector?.startsWith('#')?svg().querySelector(edge.selector):svg().querySelector(`[data-path-id="${{edge.id}}"]`); if(target)inspect(target); }};
    li.append(button); list.append(li); }} routes.append(list);
}}
function switchVariant(){{
  document.querySelectorAll('.scene').forEach(scene=>scene.classList.toggle('hidden',scene.dataset.variant!==select.value));
  clearOverlay(); selection.textContent=`variant: ${{select.value}}\nforks: ${{DATA[select.value].forks.length}}\njunctions: ${{DATA[select.value].graph.junctions.length}}`;
  document.querySelectorAll('[data-toggle]').forEach(input=>{{ input.dataset.toggle.split('|').forEach(feature=>svg().querySelectorAll(`[data-feature="${{feature}}"]`).forEach(el=>el.classList.toggle('feature-hidden',!input.checked))); }}); refreshRoutes();
}}
select.addEventListener('change',switchVariant);
document.querySelectorAll('[data-toggle]').forEach(input=>input.addEventListener('change',()=>input.dataset.toggle.split('|').forEach(feature=>svg().querySelectorAll(`[data-feature="${{feature}}"]`).forEach(el=>el.classList.toggle('feature-hidden',!input.checked)))));
document.querySelector('.stage').addEventListener('click',event=>{{ const target=event.target.closest('[data-feature]'); if(target&&target.id!=='inspector-overlay'&&target.dataset.feature!=='inspector')inspect(target); }});
document.querySelector('#clear').onclick=()=>{{clearOverlay();selection.textContent='Nothing selected.';}};
document.querySelector('#boxes').onclick=()=>{{
  const wasShowing=showingAll; clearOverlay(); if(wasShowing)return; showingAll=true; document.querySelector('#boxes').textContent='Hide fork bounding boxes';
  svg().querySelectorAll('g[data-feature="fork"]').forEach(group=>rectFor(group,group.dataset.forkId||group.id,'#ffd22e'));
}};
switchVariant();
</script></body></html>"""
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(document, encoding="utf-8")
    print(f"wrote {output} ({len(index['variants'])} embedded variants)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("variants_dir")
    parser.add_argument("output")
    args = parser.parse_args()
    build(Path(args.variants_dir), Path(args.output))


if __name__ == "__main__":
    main()
