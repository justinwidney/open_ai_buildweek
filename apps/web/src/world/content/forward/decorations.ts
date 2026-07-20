import * as THREE from "three";

export interface DecorationMaterials {
  stone: THREE.Material;
  wood: THREE.Material;
  foliage: THREE.Material;
  foliageLight: THREE.Material;
  glow: THREE.Material;
  flower: THREE.Material;
}

export function createStorybookTree(materials: DecorationMaterials, scale = 1) {
  const tree = new THREE.Group();
  tree.name = "storybook-tree";

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.13, .22, 1.4, 8), materials.wood);
  trunk.position.y = .7;
  trunk.castShadow = true;
  tree.add(trunk);

  const branchGeometry = new THREE.CylinderGeometry(.055, .09, .82, 7);
  for (const [x, rotation] of [[-.25, -.62], [.25, .62]] as const) {
    const branch = new THREE.Mesh(branchGeometry, materials.wood);
    branch.position.set(x * .52, 1.23, 0);
    branch.rotation.z = rotation;
    branch.castShadow = true;
    tree.add(branch);
  }

  const crownGeometry = new THREE.IcosahedronGeometry(.72, 1);
  const crowns = [
    [-.52, 1.62, .02, .82], [.46, 1.58, -.05, .88], [0, 1.92, 0, 1],
    [-.06, 1.52, .28, .76], [.1, 1.57, -.32, .7],
  ] as const;
  crowns.forEach(([x, y, z, size], index) => {
    const crown = new THREE.Mesh(crownGeometry, index % 3 === 0 ? materials.foliageLight : materials.foliage);
    crown.position.set(x, y, z);
    crown.scale.set(size * 1.2, size * .72, size);
    crown.rotation.y = index * 1.17;
    crown.castShadow = true;
    tree.add(crown);
  });

  tree.scale.setScalar(scale);
  return tree;
}

export function createLantern(materials: DecorationMaterials, scale = 1) {
  const lantern = new THREE.Group();
  lantern.name = "route-lantern";

  const base = new THREE.Mesh(new THREE.CylinderGeometry(.24, .34, .28, 8), materials.stone);
  base.position.y = .14;
  base.castShadow = true;
  lantern.add(base);
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(.22, .68, .22), materials.stone);
  pedestal.position.y = .62;
  pedestal.castShadow = true;
  lantern.add(pedestal);

  const frameMaterial = materials.wood;
  const glow = new THREE.Mesh(new THREE.BoxGeometry(.29, .46, .29), materials.glow);
  glow.position.y = 1.18;
  lantern.add(glow);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(.31, .22, 4), frameMaterial);
  cap.position.y = 1.52;
  cap.rotation.y = Math.PI / 4;
  lantern.add(cap);
  const railGeometry = new THREE.CylinderGeometry(.025, .025, .54, 5);
  for (const x of [-.17, .17]) {
    for (const z of [-.17, .17]) {
      const rail = new THREE.Mesh(railGeometry, frameMaterial);
      rail.position.set(x, 1.2, z);
      lantern.add(rail);
    }
  }
  const light = new THREE.PointLight(0xffcf72, 1.5, 5, 2);
  light.position.y = 1.22;
  lantern.add(light);
  lantern.scale.setScalar(scale);
  return lantern;
}

export function createFlowerPatch(materials: DecorationMaterials, seed = 1, count = 18) {
  const patch = new THREE.Group();
  patch.name = "flower-patch";
  const stemGeometry = new THREE.CylinderGeometry(.012, .018, .26, 5);
  const bloomGeometry = new THREE.IcosahedronGeometry(.055, 0);
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399963 + seed;
    const distance = .08 + ((index * 47 + seed * 13) % 100) / 100 * .55;
    const height = .18 + ((index * 29) % 10) * .012;
    const stem = new THREE.Mesh(stemGeometry, materials.foliage);
    stem.position.set(Math.cos(angle) * distance, height * .5, Math.sin(angle) * distance * .55);
    stem.scale.y = height / .26;
    patch.add(stem);
    const bloom = new THREE.Mesh(bloomGeometry, index % 4 === 0 ? materials.foliageLight : materials.flower);
    bloom.position.set(stem.position.x, height, stem.position.z);
    patch.add(bloom);
  }
  return patch;
}

export function createMilestoneSpinner(materials: DecorationMaterials, scale = 1) {
  const milestone = new THREE.Group();
  milestone.name = "milestone-spinner";
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(.35, .46, .48, 10), materials.stone);
  pedestal.position.y = .24;
  pedestal.castShadow = true;
  milestone.add(pedestal);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(.38, 0), materials.glow);
  star.name = "decorative-spinner";
  star.position.y = .93;
  star.rotation.z = Math.PI / 4;
  milestone.add(star);
  milestone.scale.setScalar(scale);
  return milestone;
}
