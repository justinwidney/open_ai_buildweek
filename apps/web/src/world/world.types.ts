export type Vec3 = readonly [number, number, number];

export type PlatformKind = "start" | "front" | "left" | "right";

export interface WorldPlatform {
  id: string;
  title: string;
  subtitle: string;
  position: Vec3;
  radius: number;
  kind: PlatformKind;
}

/** A linked route in the starting world, expressed in world-facing degrees. */
export interface WorldPath {
  id: string;
  angle: 45 | 90 | 135;
  platformIds: readonly string[];
}

export interface WorldDefinition {
  startingCamera: { position: Vec3; lookAt: Vec3 };
  platforms: WorldPlatform[];
  paths: WorldPath[];
}

export interface WorldTuning {
  /** Scales the pointer and travel response of the separated art layers. */
  parallaxDepth: number;
  /** Scales the camera-locked forward travel duration. */
  travelDuration: number;
  /** Scales transition blur without softening the scene while idle. */
  motionBlur: number;
  /** Scales the 180 degree world-turn duration. */
  turnDuration: number;
  /** Platform silhouette preset; changing it rebuilds the current world slice. */
  rockProfile: "soft" | "storybook" | "shattered";
  /** Keeps the supplied watercolor layers available for A/B comparison. */
  backdropEnabled: boolean;
  /** Relative height of the locked 2.5D camera. One is the authored high view. */
  cameraHeight: number;
  /** Relative downward pitch of the locked 2.5D camera. */
  cameraTilt: number;
  /** Shows a perspective placement grid for near, mid, and far composition. */
  depthGridEnabled: boolean;
  /** Loads painted surface maps; disable to judge silhouettes and proportions. */
  texturesEnabled: boolean;
  /** Shows purpose props such as signs, trees, flowers, lanterns, and milestones. */
  detailsEnabled: boolean;
  /** Shows the Three.js gameplay hierarchy; disable for a background-only study. */
  platformsEnabled: boolean;
  /** Global transparency calibration for isolated background sprites. */
  spriteOpacity: number;
  /** Global saturation calibration for isolated background sprites. */
  spriteSaturation: number;
  /** Adds a restrained parchment warmth to isolated background sprites. */
  spriteWarmth: number;
}

export type WorldCommandInput =
  | { type: "travel-next" }
  | { type: "turn"; direction?: 1 | -1 }
  | { type: "reset" };

export type WorldCommand = WorldCommandInput & { id: number };

export interface WorldExperienceProps {
  className?: string;
  /** Called when a platform is selected from the 3D world. */
  onPlatformSelect?: (platform: WorldPlatform) => void;
  /** Lets a parent UI show the currently generated world. */
  onWorldChange?: (worldIndex: number) => void;
  /** Optional live values used by the focused World Effects Lab. */
  tuning?: WorldTuning;
  /** One-shot command used by the lab without adding a second render loop. */
  command?: WorldCommand;
}
