import * as THREE from "three";
import { pixelRatioForQuality, type QualityTier } from "./quality";

export function createWorldRenderer(quality: QualityTier) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: quality === "high" || quality === "medium",
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(pixelRatioForQuality(quality));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = quality !== "off";
  renderer.shadowMap.type = quality === "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.domElement.className = "world-experience__canvas";
  return renderer;
}
