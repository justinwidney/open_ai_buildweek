# Porting the depth slices to Three.js

## Option A — texture planes (simplest)
Rasterize each slice_N.svg to PNG (or load via SVGLoader->canvas) and place:

    const spacing = 2.5;               // world units between layers
    slices.forEach((tex, i) => {
      const depth = (N - 1 - i) * spacing;   // slice_0 farthest
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(aspect * size, size),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      plane.position.z = -depth;
      plane.renderOrder = i;                 // paint far -> near
      scene.add(plane);
    });

Dolly-zoom to the castle: tween camera.position toward the focal ray:

    const focal = new THREE.Vector3(fx3d, fy3d, -castleDepth);
    // per frame: camera.position.lerp(focal.clone().add(offset), t)

Caveat: CSS/SMIL animations inside the SVG do NOT run once rasterized to a
texture. Two fixes:
  1. Keep clouds / waterfalls / water sheens on their own planes and animate
     in Three.js instead (texture.offset.x for cloud drift, offset.y loop for
     falls, a sine on material.opacity for the water sheen layer). The
     animator's class tags make it easy to export those groups separately.
  2. Or re-rasterize the animated slices to a canvas each frame
     (CanvasTexture.needsUpdate = true) — costly but faithful.

## Option B — CSS3DRenderer (animations keep running)
three/examples/jsm/renderers/CSS3DRenderer wraps DOM elements as 3D objects.
Feed each slice's <div><svg> in as a CSS3DObject at z = -depth: your CSS
keyframe animations continue playing, and you can mix WebGL objects (player,
particles) with a THREE.Scene rendered behind/among the layers.

## Isometric camera
    const cam = new THREE.OrthographicCamera(...);
    cam.position.set(d, d * 0.9, d); cam.lookAt(scene.position);
For layered 2.5D art, a perspective camera with a mild fov (20-30) and a
rotateX-tilted layer group usually *looks* more correct than true ortho,
because the slices are flat billboards.

## Zoom-into-castle staging tip
Give yourself headroom: rasterize slice_0/slice_1 at 2-3x resolution (they are
what fills the screen at full dolly), and fade each nearer layer's opacity to
0 just before the camera passes through it to avoid a screen-filling smear.
