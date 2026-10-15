export interface Size {
  width: number;
  height: number;
}
export interface Camera {
  zoom: number;
  centerX: number;
  centerY: number;
}
export interface PageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function viewportRect(page: Size, viewport: Size, camera: Camera): PageRect {
  const scale = Math.min(viewport.width / page.width, viewport.height / page.height) * camera.zoom;
  const width = viewport.width / scale,
    height = viewport.height / scale;
  const clamp = (center: number, extent: number, total: number) =>
    extent >= total ? total / 2 : Math.min(total - extent / 2, Math.max(extent / 2, center));
  return {
    x: clamp(camera.centerX, width, page.width) - width / 2,
    y: clamp(camera.centerY, height, page.height) - height / 2,
    width,
    height,
  };
}
export function pointInPage(point: { x: number; y: number }, page: Size) {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x <= page.width &&
    point.y <= page.height
  );
}
export function pageToScreen(point: { x: number; y: number }, rect: PageRect, size: Size) {
  return {
    x: ((point.x - rect.x) * size.width) / rect.width,
    y: ((point.y - rect.y) * size.height) / rect.height,
  };
}
export function screenToPage(point: { x: number; y: number }, rect: PageRect, size: Size) {
  return {
    x: rect.x + (point.x * rect.width) / size.width,
    y: rect.y + (point.y * rect.height) / size.height,
  };
}
