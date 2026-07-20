import * as THREE from "three";

function disposeMaterial(material: THREE.Material, textures: Set<THREE.Texture>) {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture && !textures.has(value)) {
      textures.add(value);
      value.dispose();
    }
  }
  material.dispose();
}

/** Dispose resources owned by a scene subtree without double-disposing shared references. */
export function disposeObjectTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    const candidate = object as THREE.Mesh;
    if (candidate.geometry && !geometries.has(candidate.geometry)) {
      geometries.add(candidate.geometry);
      candidate.geometry.dispose();
    }
    if (!candidate.material) return;
    const list = Array.isArray(candidate.material) ? candidate.material : [candidate.material];
    for (const material of list) {
      if (materials.has(material)) continue;
      materials.add(material);
      disposeMaterial(material, textures);
    }
  });
}
