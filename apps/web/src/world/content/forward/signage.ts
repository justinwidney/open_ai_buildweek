import * as THREE from "three";
import type { WorldPlatform } from "../../world.types";

const INK = "#30271f";
const PAPER = "#ead9b7";

function makeCanvasTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function drawPaper(context: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = context.createRadialGradient(width * .46, height * .38, 10, width * .5, height * .5, width * .72);
  gradient.addColorStop(0, "#fff3d3");
  gradient.addColorStop(.72, PAPER);
  gradient.addColorStop(1, "#b89565");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = .11;
  for (let index = 0; index < 260; index += 1) {
    const x = (index * 97) % width;
    const y = (index * 53) % height;
    context.fillStyle = index % 3 ? "#63472e" : "#fff8dc";
    context.fillRect(x, y, 2 + (index % 4), 1);
  }
  context.globalAlpha = 1;
}

export function createSkillSign(platform: WorldPlatform, accent: THREE.ColorRepresentation) {
  const group = new THREE.Group();
  group.name = `sign:${platform.id}`;
  group.userData.platform = platform;

  const width = Math.max(2.35, platform.radius * 1.18);
  const height = width * .57;
  const boardMaterial = new THREE.MeshStandardMaterial({ color: 0x6d492d, roughness: .93 });
  const postGeometry = new THREE.CylinderGeometry(.075, .105, 1.35, 7);
  for (const x of [-width * .32, width * .32]) {
    const post = new THREE.Mesh(postGeometry, boardMaterial);
    post.position.set(x, -.62, -.055);
    post.castShadow = true;
    group.add(post);
  }

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(width + .16, height + .16, .14, 1, 1, 1),
    boardMaterial,
  );
  board.castShadow = true;
  board.userData.platform = platform;
  group.add(board);

  const texture = makeCanvasTexture(768, 430, (context) => {
    drawPaper(context, 768, 430);
    context.strokeStyle = "#60472f";
    context.lineWidth = 18;
    context.strokeRect(18, 18, 732, 394);
    context.strokeStyle = new THREE.Color(accent).getStyle();
    context.lineWidth = 5;
    context.strokeRect(42, 42, 684, 346);
    context.fillStyle = INK;
    context.textAlign = "center";
    context.font = "600 74px Georgia, serif";
    context.fillText(platform.title.toUpperCase(), 384, 208);
    context.font = "italic 34px Georgia, serif";
    context.fillText(platform.subtitle, 384, 276);
    context.font = "28px Georgia, serif";
    context.fillText("✦", 384, 339);
  });
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: false, toneMapped: false }),
  );
  face.position.z = .076;
  face.userData.platform = platform;
  group.add(face);
  group.position.set(0, platform.radius * .62 + .95, .05);
  return group;
}

export function createFoundationInscription(platform: WorldPlatform) {
  const texture = makeCanvasTexture(1024, 512, (context) => {
    context.clearRect(0, 0, 1024, 512);
    context.fillStyle = "rgba(54, 39, 25, .78)";
    context.textAlign = "center";
    context.font = "600 56px Georgia, serif";
    context.fillText("1", 512, 116);
    context.font = "600 84px Georgia, serif";
    context.fillText(platform.title.toUpperCase(), 512, 234);
    context.font = "italic 48px Georgia, serif";
    context.fillText(platform.subtitle, 512, 316);
    context.font = "42px Georgia, serif";
    context.fillText("♡", 512, 402);
  });
  const inscription = new THREE.Mesh(
    new THREE.PlaneGeometry(platform.radius * 1.45, platform.radius * .73),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }),
  );
  inscription.name = "foundation-inscription";
  inscription.rotation.x = -Math.PI / 2;
  inscription.position.set(0, .105, -.15);
  inscription.userData.platform = platform;
  return inscription;
}

export function createRouteNumber(value: number, radius: number) {
  const texture = makeCanvasTexture(256, 256, (context) => {
    context.clearRect(0, 0, 256, 256);
    context.fillStyle = "rgba(55, 40, 25, .82)";
    context.textAlign = "center";
    context.font = "600 146px Georgia, serif";
    context.fillText(String(value), 128, 176);
  });
  const marker = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * .76, radius * .76),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = .11;
  return marker;
}
