#!/usr/bin/env python3
"""
build_viewer.py (v3) — Walk the ROAD GRAPH with turns at forks.

Camera: advances along the current edge polyline; dolly is driven by the
walked point's height (deeper into the layer stack as the road climbs);
perspective-origin steers with the road; the world sinks (--drop) so the road
stays low; layers fade before pass-through. At a junction, arrow keys pick the
branch (on-screen arrows show options); default continuation is the branch
that leads toward the castle (Dijkstra by arc length).

Controls: scroll = walk forward/back . arrows = choose turn at a fork .
click = set castle focal . I = isometric tilt . mouse = sway

Usage: python build_viewer.py slices/ viewer.html [--spacing 260] [--drop 0.12]
"""
import argparse, json, os, re


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sdir", nargs="?", default="slices")
    ap.add_argument("out", nargs="?", default="viewer.html")
    ap.add_argument("--spacing", type=int, default=260)
    ap.add_argument("--drop", type=float, default=0.12)
    args = ap.parse_args()
    meta = json.load(open(os.path.join(args.sdir, "slices.json")))
    W, H = meta["width"], meta["height"]
    N = len(meta["slices"])
    graph = meta.get("graph")
    if not graph:
        raise SystemExit("slices.json has no graph — run extract_path_graph.py first")

    layers = []
    for s in meta["slices"]:
        svg = open(os.path.join(args.sdir, s["file"])).read()
        svg = re.sub(r"^.*?<svg", "<svg", svg, flags=re.S)
        depth = (N - 1 - s["z"]) * args.spacing
        layers.append(f'<div class="layer" data-depth="{depth}" '
                      f'style="transform:translateZ({-depth}px)">{svg}</div>')

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Walk the Road Graph</title>
<style>
  html,body {{ margin:0; height:100%; background:#0e1420; overflow:hidden;
               font:12px system-ui; color:#cfd8e3; }}
  #stage {{ position:absolute; inset:0; display:flex; align-items:center;
            justify-content:center; }}
  #cam {{ width:{W}px; height:{H}px; perspective:1100px; }}
  #world {{ width:100%; height:100%; position:relative; transform-style:preserve-3d; }}
  .layer {{ position:absolute; inset:0; transform-style:preserve-3d; }}
  .layer svg {{ width:100%; height:100%; display:block; }}
  #hud {{ position:fixed; left:12px; bottom:12px; background:#0009;
          padding:10px 14px; border-radius:8px; line-height:1.8; z-index:9; }}
  #turns {{ position:fixed; z-index:9; pointer-events:none; font-size:26px;
            text-shadow:0 0 6px #000; transition:opacity .2s; }}
  .arrow {{ margin:0 7px; opacity:.5; }}
  .arrow.sel {{ opacity:1; color:#ffd76a; }}
  #focus {{ position:fixed; width:14px; height:14px; border:2px solid #ffd76a;
            border-radius:50%; margin:-8px 0 0 -8px; pointer-events:none; z-index:9; }}
</style></head><body>
<div id="stage"><div id="cam"><div id="world">
{chr(10).join(layers)}
</div></div></div>
<div id="turns"></div><div id="focus"></div>
<div id="hud">scroll = walk &nbsp; &#8592;/&#8593;/&#8594; = choose branch at forks &nbsp;
click = castle target &nbsp; <b>I</b> = iso &nbsp; <span id="pv"></span></div>
<script>
const G = {json.dumps(graph)};
const SPACING={args.spacing}, N={N}, HPX={H};
const MAXD = SPACING*(N-1)-60, DROP={args.drop}*HPX, FADE=SPACING*.85;
const cam=document.getElementById('cam'), world=document.getElementById('world'),
      layers=[...document.querySelectorAll('.layer')],
      turnsEl=document.getElementById('turns'), pv=document.getElementById('pv'),
      focusEl=document.getElementById('focus');
const nodeById={{}}; G.nodes.forEach(n=>nodeById[n.id]=n);
// adjacency: node -> [{{to, pts oriented away from node}}]
const adj={{}};
G.edges.forEach(e=>{{
  (adj[e.a]=adj[e.a]||[]).push({{to:e.b, pts:e.pts, exit:e.exit}});
  (adj[e.b]=adj[e.b]||[]).push({{to:e.a, pts:[...e.pts].reverse()}});
}});
const alen=p=>{{let s=0;for(let i=1;i<p.length;i++)s+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);return s;}};
// Dijkstra: distance to castle (guides the default branch)
const dist={{}}; G.nodes.forEach(n=>dist[n.id]=1e9); dist[G.castle]=0;
for(let k=0;k<G.nodes.length;k++)
  G.edges.forEach(e=>{{const L=alen(e.pts);
    if(dist[e.a]+L<dist[e.b])dist[e.b]=dist[e.a]+L;
    if(dist[e.b]+L<dist[e.a])dist[e.a]=dist[e.b]+L;}});

let node=G.start, opts=adj[G.start]||[],
    pick=()=>opts.reduce((b,o)=>dist[o.to]<dist[b.to]?o:b,opts[0]),
    cur=pick(), from=G.start, s=0, iso=false, sx=0, sy=0, sel=0;
let castle=[nodeById[G.castle].x, nodeById[G.castle].y];
const history=[];
const yStart=nodeById[G.start].y, yCastle=castle[1];

function sample(pts,s){{
  let acc=0;
  for(let i=1;i<pts.length;i++){{
    const seg=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
    if(acc+seg>=s){{const k=(s-acc)/seg;
      return [pts[i-1][0]+(pts[i][0]-pts[i-1][0])*k,
              pts[i-1][1]+(pts[i][1]-pts[i-1][1])*k,
              pts[i][0]-pts[i-1][0]];}}
    acc+=seg;
  }}
  const L=pts.length; return [pts[L-1][0],pts[L-1][1],pts[L-1][0]-pts[L-2][0]];
}}
function options(atNode,cameFrom){{
  return (adj[atNode]||[]).filter(o=>!(o.to===cameFrom&&(adj[atNode].length>1)));
}}
function arrowFor(o,atNode){{
  if(o.exit) return '\\u21d7';          // fork off-scene
  const dx=o.pts[Math.min(2,o.pts.length-1)][0]-nodeById[atNode].x;
  return dx<-0.015?'\\u2190':dx>0.015?'\\u2192':'\\u2191';
}}
function apply(){{
  const L=alen(cur.pts); s=Math.max(0,Math.min(L,s));
  const [px,py,hdx]=sample(cur.pts,s);
  const prog=Math.max(0,Math.min(1,(yStart-py)/(yStart-yCastle)));
  const dolly=prog*MAXD;
  cam.style.perspectiveOrigin=`${{(px*100).toFixed(2)}}% ${{(py*100).toFixed(2)}}%`;
  const lean=Math.max(-8,Math.min(8,hdx*900));
  const tilt=iso?'rotateX(26deg) rotateZ(-4deg) ':'';
  world.style.transform=`${{tilt}}rotateY(${{lean}}deg) translate3d(${{sx}}px, ${{sy+prog*DROP}}px, ${{dolly}}px)`;
  for(const Ly of layers){{
    const gap=+Ly.dataset.depth-dolly;
    Ly.style.opacity=gap<0?0:gap>FADE?1:(gap/FADE)**1.3;
    Ly.style.visibility=gap<-10?'hidden':'visible';
  }}
  // junction UI when nearing the end of the edge
  const nearEnd=(L-s)<0.07, endOpts=nearEnd?options(cur.to,from):[];
  if(endOpts.length>1){{
    sel=Math.max(0,Math.min(endOpts.length-1,sel));
    const r=cam.getBoundingClientRect(), nd=nodeById[cur.to];
    turnsEl.style.left=(r.left+nd.x*r.width-40)+'px';
    turnsEl.style.top=(r.top+nd.y*r.height-46)+'px';
    turnsEl.innerHTML=endOpts.map((o,i)=>
      `<span class="arrow${{i===sel?' sel':''}}">${{arrowFor(o,cur.to)}}</span>`).join('');
    turnsEl.style.opacity=1;
    turnsEl.dataset.n=endOpts.length;
  }} else turnsEl.style.opacity=0;
  pv.textContent=`node ${{from}}\\u2192${{cur.to}} ${{ (prog*100)|0 }}%`;
  const r=cam.getBoundingClientRect();
  focusEl.style.left=(r.left+castle[0]*r.width)+'px';
  focusEl.style.top=(r.top+castle[1]*r.height)+'px';
}}
function advance(d){{
  const L=alen(cur.pts);
  s+=d;
  if(s>=L){{                       // arrive at node: take selected branch
    if(cur.exit){{                  // fork taken -> load the next scene
      const f=document.createElement('div');
      f.style.cssText='position:fixed;inset:0;background:#0e1420;opacity:0;transition:opacity .7s;z-index:99';
      document.body.appendChild(f);
      requestAnimationFrame(()=>f.style.opacity=1);
      setTimeout(()=>location.href=cur.exit,750);
      s=L; apply(); return;
    }}
    const endOpts=options(cur.to,from);
    if(!endOpts.length){{ s=L; apply(); return; }}   // dead end
    const chosen=endOpts.length>1?endOpts[sel]:endOpts[0];
    history.push({{cur,from,sBack:L}});
    from=cur.to; cur=chosen; s-=L; sel=0;
    // default selection for the NEXT fork = toward castle
    const nxt=options(cur.to,from);
    sel=nxt.indexOf(nxt.reduce((b,o)=>dist[o.to]<dist[b.to]?o:b,nxt[0]));
  }}
  if(s<0&&history.length){{ const h=history.pop(); cur=h.cur; from=h.from; s=h.sBack+s; }}
  apply();
}}
addEventListener('wheel',e=>advance(e.deltaY<0?0.014:-0.014),{{passive:true}});
addEventListener('keydown',e=>{{
  const k=e.key;
  if(k==='ArrowLeft')sel--,apply();
  else if(k==='ArrowRight')sel++,apply();
  else if(k==='ArrowUp')advance(0.02);
  else if(k==='ArrowDown')advance(-0.02);
  else if(k.toLowerCase()==='i')iso=!iso,apply();
}});
addEventListener('mousemove',e=>{{
  sx=(e.clientX/innerWidth-.5)*-24; sy=(e.clientY/innerHeight-.5)*-12; apply();
}});
addEventListener('click',e=>{{
  const r=cam.getBoundingClientRect();
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
  castle=[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]; apply();
}});
function fit(){{const sc=Math.min(innerWidth/{W},innerHeight/{H});
  document.getElementById('stage').style.transform=`scale(${{sc}})`;apply();}}
addEventListener('resize',fit); fit();
</script></body></html>"""
    open(args.out, "w").write(html)
    print(f"wrote {args.out} ({os.path.getsize(args.out)//1024} KB) — graph walk: "
          f"{len(graph['nodes'])} nodes, {len(graph['edges'])} edges, "
          f"start {graph['start']} -> castle {graph['castle']}")


if __name__ == "__main__":
    main()
