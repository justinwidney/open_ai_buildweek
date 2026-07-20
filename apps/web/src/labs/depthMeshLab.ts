import * as THREE from "three";
import "./lab.css";
import { addLabLighting, createThreeLab, element } from "./threeLab";

const ASSETS = {
  "tree-island-hd": "/lab-assets/platform-hires/tree-island-hd.png",
  "waterfall-island-hd": "/lab-assets/platform-hires/waterfall-shrine-hd.png",
  "castle-island-hd": "/lab-assets/platform-hires/castle-island-hd.png",
  "carved-platform": "/lab-assets/platform-details/carved-platform.png",
  "small-platform": "/lab-assets/platform-details/small-platform.png",
  "tree-island": "/lab-assets/platform-details/tree-island.png",
  "waterfall-island": "/lab-assets/platform-details/waterfall-island.png",
  "castle-island": "/lab-assets/platform-details/castle-island.png",
  "storybook-tree": "/lab-assets/platform-details/storybook-tree.png",
  "flower-bed": "/lab-assets/platform-details/flower-bed.png",
  lantern: "/lab-assets/platform-details/lantern.png",
  sign: "/lab-assets/platform-details/sign.png",
  "purple-flag": "/lab-assets/platform-details/purple-flag.png",
  "rope-bridge": "/lab-assets/platform-details/rope-bridge.png",
} as const;

type AssetId = keyof typeof ASSETS;

interface SampleGrid {
  columns: number;
  rows: number;
  alpha: Float32Array;
  depth: Float32Array;
  aspect: number;
}

interface MeshBuild {
  root: THREE.Group;
  material: THREE.MeshStandardMaterial;
  outline: THREE.LineSegments;
  texture: THREE.CanvasTexture;
  triangles: number;
  contours: number;
  outlineSvg: string;
}

const sceneCanvas = element<HTMLCanvasElement>("scene");
const sourcePreview = element<HTMLCanvasElement>("source-preview");
const depthPreview = element<HTMLCanvasElement>("depth-preview");
const assetControl = element<HTMLSelectElement>("asset");
const alphaControl = element<HTMLInputElement>("alpha");
const depthControl = element<HTMLInputElement>("depth");
const resolutionControl = element<HTMLInputElement>("resolution");
const angleControl = element<HTMLInputElement>("angle");
const surfaceControl = element<HTMLSelectElement>("surface");
const outlineControl = element<HTMLInputElement>("outline");
const alphaOutput = element<HTMLOutputElement>("alpha-output");
const depthOutput = element<HTMLOutputElement>("depth-output");
const resolutionOutput = element<HTMLOutputElement>("resolution-output");
const angleOutput = element<HTMLOutputElement>("angle-output");
const triangleCount = element<HTMLElement>("triangle-count");
const contourCount = element<HTMLElement>("contour-count");
const sourceSize = element<HTMLElement>("source-size");
const status = element<HTMLElement>("status");
const busy = element<HTMLElement>("busy");

const lab = createThreeLab(sceneCanvas, { fov: 34 });
lab.scene.fog = new THREE.FogExp2(0x8daac3, 0.012);
addLabLighting(lab.scene);
lab.camera.position.set(0, 0.25, 14);
lab.camera.lookAt(0, 0, 0);

let sourceCanvas: HTMLCanvasElement | null = null;
let current: MeshBuild | null = null;
let requestSerial = 0;
let rebuildFrame = 0;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), { once: true });
    image.src = src;
  });
}

function imageToCanvas(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("2D canvas is unavailable");
  context.drawImage(image, 0, 0);
  return canvas;
}

function drawPreview(target: HTMLCanvasElement, source: CanvasImageSource) {
  const context = target.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, target.width, target.height);
  const sourceWidth = source instanceof HTMLCanvasElement || source instanceof HTMLImageElement ? source.width : target.width;
  const sourceHeight = source instanceof HTMLCanvasElement || source instanceof HTMLImageElement ? source.height : target.height;
  const scale = Math.min(target.width / sourceWidth, target.height / sourceHeight) * 0.91;
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, (target.width - width) / 2, (target.height - height) / 2, width, height);
}

function sampleGrid(canvas: HTMLCanvasElement, requestedColumns: number): SampleGrid {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("2D canvas is unavailable");
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const aspect = canvas.width / canvas.height;
  const columns = Math.max(8, Math.round(requestedColumns * Math.min(1, aspect)));
  const rows = Math.max(8, Math.round(requestedColumns / Math.max(1, aspect)));
  const alpha = new Float32Array((columns + 1) * (rows + 1));
  const depth = new Float32Array(alpha.length);
  for (let row = 0; row <= rows; row += 1) {
    const sourceY = Math.min(canvas.height - 1, Math.round((row / rows) * (canvas.height - 1)));
    for (let column = 0; column <= columns; column += 1) {
      const sourceX = Math.min(canvas.width - 1, Math.round((column / columns) * (canvas.width - 1)));
      const pixelIndex = (sourceY * canvas.width + sourceX) * 4;
      const gridIndex = row * (columns + 1) + column;
      const red = (pixels[pixelIndex] ?? 0) / 255;
      const green = (pixels[pixelIndex + 1] ?? 0) / 255;
      const blue = (pixels[pixelIndex + 2] ?? 0) / 255;
      alpha[gridIndex] = (pixels[pixelIndex + 3] ?? 0) / 255;
      // Perceptual luminance: pale painted highlights project toward the viewer.
      depth[gridIndex] = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    }
  }
  return { columns, rows, alpha, depth, aspect };
}

function drawDepthPreview(grid: SampleGrid, threshold: number) {
  const scratch = document.createElement("canvas");
  scratch.width = grid.columns + 1;
  scratch.height = grid.rows + 1;
  const context = scratch.getContext("2d");
  if (!context) return;
  const image = context.createImageData(scratch.width, scratch.height);
  for (let index = 0; index < grid.depth.length; index += 1) {
    const value = Math.round(grid.depth[index]! * 255);
    const visible = grid.alpha[index]! >= threshold;
    image.data[index * 4] = value;
    image.data[index * 4 + 1] = value;
    image.data[index * 4 + 2] = value;
    image.data[index * 4 + 3] = visible ? 255 : 0;
  }
  context.putImageData(image, 0, 0);
  drawPreview(depthPreview, scratch);
}

function gridPoint(grid: SampleGrid, column: number, row: number, depthStrength: number) {
  const index = row * (grid.columns + 1) + column;
  const worldHeight = 8;
  const worldWidth = worldHeight * grid.aspect;
  return new THREE.Vector3(
    (column / grid.columns - 0.5) * worldWidth,
    (0.5 - row / grid.rows) * worldHeight,
    (grid.depth[index]! - 0.46) * depthStrength,
  );
}

function contourEdge(
  grid: SampleGrid,
  column: number,
  row: number,
  edge: number,
  threshold: number,
  depthStrength: number,
) {
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
  const edgeCorners = [[0, 1], [1, 2], [2, 3], [3, 0]] as const;
  const [startCorner, endCorner] = edgeCorners[edge]!;
  const [startX, startY] = corners[startCorner]!;
  const [endX, endY] = corners[endCorner]!;
  const startIndex = (row + startY) * (grid.columns + 1) + column + startX;
  const endIndex = (row + endY) * (grid.columns + 1) + column + endX;
  const startAlpha = grid.alpha[startIndex]!;
  const endAlpha = grid.alpha[endIndex]!;
  const denominator = endAlpha - startAlpha;
  const amount = Math.abs(denominator) < 0.0001 ? 0.5 : THREE.MathUtils.clamp((threshold - startAlpha) / denominator, 0, 1);
  const start = gridPoint(grid, column + startX, row + startY, depthStrength);
  const end = gridPoint(grid, column + endX, row + endY, depthStrength);
  return start.lerp(end, amount).add(new THREE.Vector3(0, 0, 0.045));
}

function buildContour(grid: SampleGrid, threshold: number, depthStrength: number) {
  const positions: number[] = [];
  // Marching-squares edge pairs, clockwise corners: TL, TR, BR, BL.
  const cases: Record<number, number[][]> = {
    1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]],
    5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]],
    9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]],
    13: [[0, 1]], 14: [[3, 0]],
  };
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const stride = grid.columns + 1;
      const indices = [row * stride + column, row * stride + column + 1, (row + 1) * stride + column + 1, (row + 1) * stride + column];
      let mask = 0;
      indices.forEach((index, corner) => { if (grid.alpha[index]! >= threshold) mask |= 1 << corner; });
      const pairs = cases[mask];
      if (!pairs) continue;
      pairs.forEach(([startEdge, endEdge]) => {
        const start = contourEdge(grid, column, row, startEdge!, threshold, depthStrength);
        const end = contourEdge(grid, column, row, endEdge!, threshold, depthStrength);
        positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
      });
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: 0xffe49c, transparent: true, opacity: 0.95, depthTest: false });
  const line = new THREE.LineSegments(geometry, material);
  line.renderOrder = 4;
  const viewBoxHeight = 1000;
  const viewBoxWidth = Math.max(1, Math.round(grid.aspect * viewBoxHeight));
  const worldHeight = 8;
  const worldWidth = worldHeight * grid.aspect;
  const pathParts: string[] = [];
  for (let index = 0; index < positions.length; index += 6) {
    const startX = ((positions[index]! / worldWidth) + .5) * viewBoxWidth;
    const startY = (.5 - positions[index + 1]! / worldHeight) * viewBoxHeight;
    const endX = ((positions[index + 3]! / worldWidth) + .5) * viewBoxWidth;
    const endY = (.5 - positions[index + 4]! / worldHeight) * viewBoxHeight;
    pathParts.push(`M${startX.toFixed(2)} ${startY.toFixed(2)}L${endX.toFixed(2)} ${endY.toFixed(2)}`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}"><path d="${pathParts.join("")}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"/></svg>`;
  return { line, count: positions.length / 6, svg };
}

function buildRelief(canvas: HTMLCanvasElement, grid: SampleGrid, threshold: number, depthStrength: number): MeshBuild {
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let row = 0; row <= grid.rows; row += 1) {
    for (let column = 0; column <= grid.columns; column += 1) {
      const point = gridPoint(grid, column, row, depthStrength);
      positions.push(point.x, point.y, point.z);
      uvs.push(column / grid.columns, 1 - row / grid.rows);
    }
  }
  const indices: number[] = [];
  const stride = grid.columns + 1;
  const includeTriangle = (a: number, b: number, c: number) => {
    // Two in-mask corners and an in-mask centroid retain the antialiased edge without rectangular spill.
    const visibleCorners = Number(grid.alpha[a]! >= threshold) + Number(grid.alpha[b]! >= threshold) + Number(grid.alpha[c]! >= threshold);
    const centroidAlpha = (grid.alpha[a]! + grid.alpha[b]! + grid.alpha[c]!) / 3;
    if (visibleCorners >= 2 && centroidAlpha >= threshold * 0.82) indices.push(a, b, c);
  };
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const topLeft = row * stride + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + stride;
      const bottomRight = bottomLeft + 1;
      includeTriangle(topLeft, bottomLeft, topRight);
      includeTriangle(topRight, bottomLeft, bottomRight);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    alphaTest: threshold,
    transparent: true,
    roughness: 0.82,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const contour = buildContour(grid, threshold, depthStrength);
  const root = new THREE.Group();
  root.add(mesh, contour.line);
  return { root, material, outline: contour.line, texture, triangles: indices.length / 3, contours: contour.count, outlineSvg: contour.svg };
}

function disposeBuild(build: MeshBuild | null) {
  if (!build) return;
  build.root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
  build.texture.dispose();
  build.root.removeFromParent();
}

function updateOutputs() {
  alphaOutput.value = Number(alphaControl.value).toFixed(2);
  depthOutput.value = Number(depthControl.value).toFixed(2);
  resolutionOutput.value = resolutionControl.value;
  angleOutput.value = `${angleControl.value}°`;
}

function rebuild() {
  if (!sourceCanvas) return;
  const threshold = Number(alphaControl.value);
  const depthStrength = Number(depthControl.value);
  const grid = sampleGrid(sourceCanvas, Number(resolutionControl.value));
  const next = buildRelief(sourceCanvas, grid, threshold, depthStrength);
  next.root.rotation.y = THREE.MathUtils.degToRad(Number(angleControl.value));
  next.material.wireframe = surfaceControl.value === "wireframe";
  next.material.map = surfaceControl.value === "wireframe" ? null : next.texture;
  next.material.color.set(surfaceControl.value === "wireframe" ? 0xb9a9d4 : 0xffffff);
  next.outline.visible = outlineControl.checked;
  lab.scene.add(next.root);
  disposeBuild(current);
  current = next;
  drawDepthPreview(grid, threshold);
  triangleCount.textContent = next.triangles.toLocaleString();
  contourCount.textContent = next.contours.toLocaleString();
  status.textContent = `${assetControl.options[assetControl.selectedIndex]?.text ?? "Artwork"} · silhouette mesh`;
  updateOutputs();
}

function scheduleRebuild() {
  cancelAnimationFrame(rebuildFrame);
  rebuildFrame = requestAnimationFrame(rebuild);
}

async function loadSelectedAsset() {
  const serial = ++requestSerial;
  busy.classList.add("is-visible");
  status.textContent = "Loading source artwork";
  try {
    const assetId = assetControl.value as AssetId;
    const image = await loadImage(ASSETS[assetId]);
    if (serial !== requestSerial) return;
    sourceCanvas = imageToCanvas(image);
    sourceSize.textContent = `${image.naturalWidth}×${image.naturalHeight}`;
    drawPreview(sourcePreview, sourceCanvas);
    rebuild();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Artwork failed to load";
  } finally {
    if (serial === requestSerial) busy.classList.remove("is-visible");
  }
}

assetControl.addEventListener("change", loadSelectedAsset);
[alphaControl, depthControl, resolutionControl].forEach((control) => control.addEventListener("input", scheduleRebuild));
angleControl.addEventListener("input", () => {
  updateOutputs();
  if (current) current.root.rotation.y = THREE.MathUtils.degToRad(Number(angleControl.value));
});
surfaceControl.addEventListener("change", () => {
  if (!current) return;
  const wireframe = surfaceControl.value === "wireframe";
  current.material.wireframe = wireframe;
  current.material.map = wireframe ? null : current.texture;
  current.material.color.set(wireframe ? 0xb9a9d4 : 0xffffff);
  current.material.needsUpdate = true;
});
outlineControl.addEventListener("change", () => { if (current) current.outline.visible = outlineControl.checked; });
element("front").addEventListener("click", () => { angleControl.value = "0"; angleControl.dispatchEvent(new Event("input")); });
element("three-quarter").addEventListener("click", () => { angleControl.value = "24"; angleControl.dispatchEvent(new Event("input")); });
element("download-outline").addEventListener("click", () => {
  if (!current) return;
  const url = URL.createObjectURL(new Blob([current.outlineSvg], { type: "image/svg+xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${assetControl.value}-outline.svg`;
  link.click();
  URL.revokeObjectURL(url);
});
element("reset").addEventListener("click", () => {
  alphaControl.value = "0.16";
  depthControl.value = "1.15";
  resolutionControl.value = "96";
  angleControl.value = "24";
  surfaceControl.value = "texture";
  outlineControl.checked = true;
  rebuild();
});

function animate() {
  lab.renderer.render(lab.scene, lab.camera);
  requestAnimationFrame(animate);
}

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(rebuildFrame);
  disposeBuild(current);
  lab.dispose();
}, { once: true });

updateOutputs();
void loadSelectedAsset();
animate();
