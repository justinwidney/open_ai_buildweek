import * as THREE from "three";

export interface ThreeLab {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  clock: THREE.Clock;
  resize(): void;
  dispose(): void;
}

export function createThreeLab(canvas: HTMLCanvasElement, options: { fov?: number; far?: number } = {}): ThreeLab {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(options.fov ?? 42, 1, .1, options.far ?? 180);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const clock = new THREE.Clock();
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  return {
    scene,
    camera,
    renderer,
    clock,
    resize,
    dispose: () => {
      observer.disconnect();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite)) return;
        if (object instanceof THREE.Mesh) object.geometry.dispose();
        const material = object.material;
        (Array.isArray(material) ? material : [material]).forEach((item) => item.dispose());
      });
      renderer.dispose();
    },
  };
}

export function addLabLighting(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xfff1ce, 0x243949, 2.5));
  const sun = new THREE.DirectionalLight(0xffd49a, 4.3);
  sun.position.set(-8, 14, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xb5c9ff, 1.4);
  rim.position.set(9, 4, -14);
  scene.add(rim);
}

export function makeWatercolorTexture(seed = 1, base = "#8799a8", accent = "#d5c8b2") {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.fillStyle = base;
  context.fillRect(0, 0, size, size);
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let index = 0; index < 210; index += 1) {
    const radius = 5 + random() * 42;
    context.globalAlpha = .018 + random() * .07;
    context.fillStyle = random() > .55 ? accent : "#3f5363";
    context.beginPath();
    context.ellipse(random() * size, random() * size, radius, radius * (.25 + random()), random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 2.2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function element<T extends HTMLElement>(id: string) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing lab element #${id}`);
  return found as T;
}
