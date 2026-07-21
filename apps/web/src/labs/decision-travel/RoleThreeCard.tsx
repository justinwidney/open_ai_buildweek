import { RoundedBox, useTexture } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import * as THREE from "three";
import type { StartupCostItem } from "./decisionCatalog";

interface RoleThreeCardProps {
  artworkSrc: string;
  title: string;
  category: string;
  outlook: string;
  note: string;
  startupSummary: string;
  startupItems: readonly StartupCostItem[];
  cost: number;
  timeLabel: string;
  startingSalary: number;
  provisionsLabel?: string;
  costQuestion?: string;
  leftFooterLabel?: string;
  leftFooterValue?: string;
  rightFooterLabel?: string;
  rightFooterValue?: string;
}

interface CardController {
  dragging: boolean;
  targetX: number;
  targetY: number;
  velocityX: number;
  velocityY: number;
}

interface CardPalette {
  border: string;
  gold: string;
  ink: string;
  parchment: string;
  parchmentDeep: string;
  violet: string;
}

const DEFAULT_PALETTE: CardPalette = {
  border: "#6f4c25",
  gold: "#d5ad4f",
  ink: "#302315",
  parchment: "#fbefce",
  parchmentDeep: "#d0a465",
  violet: "#6a4a97",
};

const TEXTURE_WIDTH = 768;
const TEXTURE_HEIGHT = 1075;
// Leave enough projection room for the near edge of the card at maximum pitch.
// The CSS canvas keeps the same aspect ratio as the card, so this distance also
// provides a consistent safe area on narrow phone screens.
const CARD_CAMERA_DISTANCE = 11.6;

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCardGround(ctx: CanvasRenderingContext2D, palette: CardPalette) {
  const parchment = ctx.createLinearGradient(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  parchment.addColorStop(0, palette.parchment);
  parchment.addColorStop(0.58, "#ead39d");
  parchment.addColorStop(1, palette.parchmentDeep);
  ctx.fillStyle = parchment;
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 14;
  roundedRect(ctx, 12, 12, TEXTURE_WIDTH - 24, TEXTURE_HEIGHT - 24, 28);
  ctx.stroke();
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = 5;
  roundedRect(ctx, 28, 28, TEXTURE_WIDTH - 56, TEXTURE_HEIGHT - 56, 20);
  ctx.stroke();
  ctx.strokeStyle = "rgba(83, 53, 25, .45)";
  ctx.lineWidth = 2;
  roundedRect(ctx, 39, 39, TEXTURE_WIDTH - 78, TEXTURE_HEIGHT - 78, 14);
  ctx.stroke();
}

function wrappedLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCenteredLines(ctx: CanvasRenderingContext2D, text: string, centerX: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3) {
  const lines = wrappedLines(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, centerX, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function textureFromCanvas(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function drawFrontTexture(props: RoleThreeCardProps, palette: CardPalette) {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  drawCardGround(ctx, palette);

  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 6;
  roundedRect(ctx, 49, 49, 670, 670, 12);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#785827";
  ctx.font = "700 24px system-ui, sans-serif";
  ctx.fillText(`${props.category.toUpperCase()} · ${props.outlook.toUpperCase()}`, TEXTURE_WIDTH / 2, 774);
  ctx.fillStyle = palette.ink;
  ctx.font = "700 54px Georgia, serif";
  let y = drawCenteredLines(ctx, props.title, TEXTURE_WIDTH / 2, 842, 650, 60, 2);
  ctx.fillStyle = "#61492e";
  ctx.font = "28px Georgia, serif";
  y = drawCenteredLines(ctx, props.note, TEXTURE_WIDTH / 2, y + 15, 620, 37, 3);
  ctx.fillStyle = "#8b672f";
  ctx.font = "700 20px system-ui, sans-serif";
  ctx.fillText("DRAG TO TURN THE CARD", TEXTURE_WIDTH / 2, Math.min(1024, y + 48));
  return textureFromCanvas(canvas);
}

function drawBackTexture(props: RoleThreeCardProps, palette: CardPalette) {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  drawCardGround(ctx, palette);
  ctx.textAlign = "center";
  ctx.fillStyle = "#785827";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillText(props.provisionsLabel ?? "REQUIRED PROVISIONS", TEXTURE_WIDTH / 2, 83);
  ctx.fillStyle = palette.ink;
  ctx.font = "700 47px Georgia, serif";
  let y = drawCenteredLines(ctx, props.costQuestion ?? `Why this path costs ${money(props.cost)}`, TEXTURE_WIDTH / 2, 137, 650, 53, 2);
  ctx.fillStyle = "#624a30";
  ctx.font = "25px Georgia, serif";
  y = drawCenteredLines(ctx, props.startupSummary, TEXTURE_WIDTH / 2, y + 20, 640, 34, 3) + 19;

  for (const item of props.startupItems) {
    const boxHeight = 135;
    ctx.fillStyle = "rgba(255, 249, 222, .58)";
    ctx.strokeStyle = "rgba(102, 67, 31, .46)";
    ctx.lineWidth = 2;
    roundedRect(ctx, 57, y, 654, boxHeight - 10, 14);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "#382719";
    ctx.font = "700 27px Georgia, serif";
    ctx.fillText(item.label, 78, y + 37);
    ctx.fillStyle = "#685239";
    ctx.font = "20px system-ui, sans-serif";
    wrappedLines(ctx, item.description, 490).slice(0, 3).forEach((line, index) => ctx.fillText(line, 78, y + 72 + index * 25));
    ctx.textAlign = "right";
    ctx.fillStyle = palette.violet;
    ctx.font = "700 29px Georgia, serif";
    ctx.fillText(money(item.amount), 689, y + 39);
    y += boxHeight;
  }

  const footerY = Math.max(y + 9, 937);
  ctx.strokeStyle = "rgba(102, 67, 31, .46)";
  ctx.beginPath();
  ctx.moveTo(62, footerY);
  ctx.lineTo(706, footerY);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = "#79592d";
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.fillText(props.leftFooterLabel ?? "TIME TO BEGIN", 74, footerY + 35);
  ctx.fillStyle = palette.ink;
  ctx.font = "700 28px Georgia, serif";
  ctx.fillText(props.leftFooterValue ?? props.timeLabel, 74, footerY + 69);
  ctx.textAlign = "right";
  ctx.fillStyle = "#79592d";
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.fillText(props.rightFooterLabel ?? "EXPECTED STARTING PAY", 694, footerY + 35);
  ctx.fillStyle = palette.ink;
  ctx.font = "700 28px Georgia, serif";
  ctx.fillText(props.rightFooterValue ?? `${money(props.startingSalary)}/yr`, 694, footerY + 69);
  return textureFromCanvas(canvas);
}

function LivingCard({ controller, palette, props }: { controller: React.MutableRefObject<CardController>; palette: CardPalette; props: RoleThreeCardProps }) {
  const group = useRef<THREE.Group>(null);
  const artworkTexture = useTexture(props.artworkSrc);
  const frontTexture = useMemo(
    () => drawFrontTexture(props, palette),
    [palette, props.category, props.note, props.outlook, props.title],
  );
  const backTexture = useMemo(
    () => drawBackTexture(props, palette),
    [palette, props.cost, props.costQuestion, props.leftFooterLabel, props.leftFooterValue, props.provisionsLabel, props.rightFooterLabel, props.rightFooterValue, props.startingSalary, props.startupItems, props.startupSummary, props.timeLabel, props.title],
  );
  useEffect(() => {
    artworkTexture.colorSpace = THREE.SRGBColorSpace;
    artworkTexture.anisotropy = 8;
    artworkTexture.needsUpdate = true;
  }, [artworkTexture]);
  useEffect(() => () => frontTexture.dispose(), [frontTexture]);
  useEffect(() => () => backTexture.dispose(), [backTexture]);

  useFrame(({ clock }, delta) => {
    const card = group.current;
    if (!card) return;
    const state = controller.current;
    if (!state.dragging) {
      state.targetY += state.velocityY * delta * 60;
      state.targetX = THREE.MathUtils.clamp(state.targetX + state.velocityX * delta * 60, -0.68, 0.68);
      const decay = Math.pow(0.9, delta * 60);
      state.velocityX *= decay;
      state.velocityY *= decay;
    }
    const elapsed = clock.getElapsedTime();
    card.rotation.x = THREE.MathUtils.damp(card.rotation.x, state.targetX + Math.sin(elapsed * 0.72) * 0.025, 7, delta);
    card.rotation.y = THREE.MathUtils.damp(card.rotation.y, state.targetY + Math.sin(elapsed * 0.46) * 0.035, 7, delta);
    card.rotation.z = THREE.MathUtils.damp(card.rotation.z, Math.sin(elapsed * 0.58) * 0.018, 5, delta);
    card.position.y = Math.sin(elapsed * 1.08) * 0.085;
  });

  return (
    <group ref={group} rotation={[-0.08, -0.18, 0]}>
      <RoundedBox args={[4, 5.65, 0.2]} radius={0.15} smoothness={5} castShadow>
        <meshPhysicalMaterial color={palette.gold} roughness={0.44} metalness={0.2} clearcoat={0.28} />
      </RoundedBox>
      <mesh position={[0, 0, 0.106]} castShadow>
        <planeGeometry args={[3.82, 5.47]} />
        <meshBasicMaterial map={frontTexture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.61, 0.114]} castShadow>
        <planeGeometry args={[3.34, 3.34]} />
        <meshBasicMaterial map={artworkTexture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.106]} rotation={[0, Math.PI, 0]} castShadow>
        <planeGeometry args={[3.82, 5.47]} />
        <meshBasicMaterial map={backTexture} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function RoleThreeCard(props: RoleThreeCardProps) {
  const controller = useRef<CardController>({ dragging: false, targetX: -0.08, targetY: -0.18, velocityX: 0, velocityY: 0 });
  const lastPointer = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [palette, setPalette] = useState<CardPalette>(DEFAULT_PALETTE);

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    setPalette({
      border: token("--journey-color-card-border", DEFAULT_PALETTE.border),
      gold: token("--journey-color-gold", DEFAULT_PALETTE.gold),
      ink: token("--journey-color-card-ink", DEFAULT_PALETTE.ink),
      parchment: token("--journey-color-card-wash", DEFAULT_PALETTE.parchment),
      parchmentDeep: token("--journey-color-parchment-deep", DEFAULT_PALETTE.parchmentDeep),
      violet: token("--journey-color-violet", DEFAULT_PALETTE.violet),
    });
  }, []);

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    controller.current.dragging = true;
    controller.current.velocityX = 0;
    controller.current.velocityY = 0;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
  }

  function moveCard(event: PointerEvent<HTMLDivElement>) {
    if (!controller.current.dragging) return;
    const dx = event.clientX - lastPointer.current.x;
    const dy = event.clientY - lastPointer.current.y;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    controller.current.targetY += dx * 0.012;
    controller.current.targetX = THREE.MathUtils.clamp(controller.current.targetX + dy * 0.007, -0.68, 0.68);
    controller.current.velocityY = dx * 0.0018;
    controller.current.velocityX = dy * 0.001;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    controller.current.dragging = false;
    setDragging(false);
  }

  function rotateWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      controller.current.targetY += event.key === "ArrowLeft" ? -0.28 : 0.28;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      controller.current.targetX = THREE.MathUtils.clamp(controller.current.targetX + (event.key === "ArrowUp" ? -0.12 : 0.12), -0.68, 0.68);
    }
  }

  return (
    <div
      className={`role-three-card${dragging ? " is-dragging" : ""}`}
      onPointerDown={beginDrag}
      onPointerMove={moveCard}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={rotateWithKeyboard}
      role="application"
      tabIndex={0}
      aria-label={`Interactive ${props.title} commitment card. Drag left or right to turn it over; use arrow keys for keyboard control.`}
    >
      <Canvas camera={{ fov: 36, position: [0, 0, CARD_CAMERA_DISTANCE] }} dpr={[1, 1.75]} shadows gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={1.35} />
        <directionalLight position={[4, 6, 7]} intensity={2.2} color="#fff0c6" castShadow />
        <pointLight position={[-4, -2, 5]} intensity={1.2} color="#a8d7d0" />
        <Suspense fallback={null}>
          <LivingCard controller={controller} palette={palette} props={props} />
        </Suspense>
      </Canvas>
      <div className="role-three-card__accessible sr-only">
        <h3>{props.title} cost plan</h3>
        <p>{props.startupSummary}</p>
        <ul>{props.startupItems.map((item) => <li key={item.label}>{item.label}: {money(item.amount)}. {item.description}</li>)}</ul>
      </div>
    </div>
  );
}
