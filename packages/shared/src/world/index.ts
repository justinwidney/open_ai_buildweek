/** Cross-platform contracts. An engine package can replace the static loader later. */
export type PathAngle = 0 | 45 | -45;

export interface WorldPlatform {
  id: string;
  title: string;
  subtitle: string;
  position: readonly [number, number, number];
  radius: number;
  kind: "start" | "skill" | "milestone";
}

export interface WorldPath {
  id: string;
  label: string;
  angle: PathAngle;
  platforms: readonly WorldPlatform[];
}

export interface WorldDefinition {
  id: string;
  name: string;
  accent: string;
  paths: readonly WorldPath[];
}
