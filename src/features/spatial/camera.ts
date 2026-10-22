export interface SpatialCamera {
  key: string;
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  near: number;
  far: number;
}
