import * as THREE from "three";

export interface PlatformTraveler {
  readonly group: THREE.Group;
  readonly isMoving: boolean;
  travel(curves: readonly THREE.Curve<THREE.Vector3>[], nowMs: number, reducedMotion?: boolean): boolean;
  update(nowMs: number): void;
  cancel(): void;
  dispose(): void;
}

interface ActiveTravel {
  startedAtMs: number;
  durationMs: number;
  curves: readonly THREE.Curve<THREE.Vector3>[];
  lengths: number[];
  totalLength: number;
}

function easeInOutCubic(progress: number) {
  return progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

export function createPlatformTraveler(): PlatformTraveler {
  const group = new THREE.Group();
  group.name = "platform-traveler";
  const auraMaterial = new THREE.MeshBasicMaterial({
    color: 0xffdd78,
    transparent: true,
    opacity: .34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe79b,
    emissive: 0xa55f20,
    emissiveIntensity: .72,
    roughness: .34,
  });
  const auraGeometry = new THREE.SphereGeometry(.28, 16, 12);
  const coreGeometry = new THREE.IcosahedronGeometry(.105, 1);
  group.add(new THREE.Mesh(auraGeometry, auraMaterial), new THREE.Mesh(coreGeometry, coreMaterial));
  group.position.set(0, .54, 0);
  group.visible = false;

  let active: ActiveTravel | undefined;
  let disposed = false;
  const sample = new THREE.Vector3();

  const placeAtDistance = (travel: ActiveTravel, distance: number) => {
    let remaining = Math.max(0, Math.min(distance, travel.totalLength));
    for (let index = 0; index < travel.curves.length; index += 1) {
      const length = travel.lengths[index]!;
      if (remaining <= length || index === travel.curves.length - 1) {
        travel.curves[index]!.getPointAt(length === 0 ? 1 : remaining / length, sample);
        group.position.copy(sample);
        group.position.y += .44;
        return;
      }
      remaining -= length;
    }
  };

  return {
    group,
    get isMoving() { return active !== undefined; },
    travel: (curves, nowMs, reducedMotion = false) => {
      if (disposed || curves.length === 0) return false;
      const lengths = curves.map((curve) => curve.getLength());
      const totalLength = lengths.reduce((sum, length) => sum + length, 0);
      active = {
        curves,
        lengths,
        totalLength,
        startedAtMs: nowMs,
        durationMs: reducedMotion ? 0 : THREE.MathUtils.clamp(totalLength * 85, 700, 2300),
      };
      group.visible = true;
      placeAtDistance(active, reducedMotion ? totalLength : 0);
      if (reducedMotion) active = undefined;
      return true;
    },
    update: (nowMs) => {
      if (!active) return;
      const progress = Math.min(1, Math.max(0, (nowMs - active.startedAtMs) / active.durationMs));
      placeAtDistance(active, easeInOutCubic(progress) * active.totalLength);
      const pulse = Math.sin(nowMs * .008) * .08 + 1;
      group.scale.setScalar(pulse);
      group.rotation.y = nowMs * .0012;
      if (progress >= 1) active = undefined;
    },
    cancel: () => { active = undefined; group.visible = false; },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      auraGeometry.dispose();
      coreGeometry.dispose();
      auraMaterial.dispose();
      coreMaterial.dispose();
      group.removeFromParent();
    },
  };
}
