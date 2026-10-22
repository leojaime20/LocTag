import {
  Component,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import { CanvasTexture, PerspectiveCamera, SRGBColorSpace, Vector3 } from 'three';
import type { SpatialCamera } from './camera';
import type { RegionBounds } from '../../types/domain';
import {
  boundsCenter,
  boundsSize,
  cutRegion,
  regionColor,
  type MappedRegion,
  type RegionMapConflict,
  type RegionMapView,
} from '../../utils/regionMap';

interface SceneProps {
  regions: MappedRegion[];
  bounds: RegionBounds;
  focusBounds: RegionBounds;
  view: RegionMapView;
  frame: number;
  selectedId: string | null;
  highlightedIds: string[];
  opacity: number;
  labels: boolean | 'none';
  marker?: [number, number, number];
  cameraKey?: string;
  savedCameraRef?: RefObject<SpatialCamera | null>;
  zoom?: { step: number; serial: number };
  maxDpr?: number;
  cut: number | null;
  conflicts: RegionMapConflict[];
  onSelect?: (id: string) => void;
}

function CameraRig({
  bounds,
  focusBounds,
  view,
  frame,
  cameraKey,
  savedCameraRef,
  zoom,
}: Pick<
  SceneProps,
  'bounds' | 'focusBounds' | 'view' | 'frame' | 'cameraKey' | 'savedCameraRef' | 'zoom'
>) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { get, size, invalidate } = useThree();
  const lastZoom = useRef(zoom?.serial);
  const activeKey = useRef(cameraKey);
  const save = () => {
    const { camera } = get();
    if (
      !savedCameraRef ||
      !activeKey.current ||
      !(camera instanceof PerspectiveCamera) ||
      !controls.current
    )
      return;
    savedCameraRef.current = {
      key: activeKey.current,
      position: camera.position.toArray(),
      target: controls.current.target.toArray(),
      up: camera.up.toArray(),
      near: camera.near,
      far: camera.far,
    };
  };
  useLayoutEffect(() => {
    // The camera is an imperative Three.js object owned by the renderer.
    const { camera } = get();
    activeKey.current = cameraKey;
    if (!(camera instanceof PerspectiveCamera) || !controls.current) return;
    const restored = savedCameraRef?.current;
    if (cameraKey && restored?.key === cameraKey) {
      camera.position.fromArray(restored.position);
      camera.up.fromArray(restored.up);
      camera.near = restored.near;
      camera.far = restored.far;
      camera.updateProjectionMatrix();
      controls.current.target.fromArray(restored.target);
      controls.current.update();
      invalidate();
      return;
    }
    const scale = 1 / Math.max(...boundsSize(bounds));
    const origin = new Vector3(...boundsCenter(bounds));
    const target = new Vector3(...boundsCenter(focusBounds)).sub(origin).multiplyScalar(scale);
    const radius = Math.max((new Vector3(...boundsSize(focusBounds)).length() * scale) / 2, 0.001);
    const verticalFov = (camera.fov * Math.PI) / 180;
    const horizontalFov = 2 * Math.atan((Math.tan(verticalFov / 2) * size.width) / size.height);
    const distance = (radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2)) * 1.2;
    const direction = new Vector3(
      ...(
        {
          iso: [1, -1, 0.8],
          top: [0, 0, 1],
          front: [0, -1, 0],
          side: [1, 0, 0],
        } satisfies Record<RegionMapView, [number, number, number]>
      )[view],
    ).normalize();
    camera.up.set(0, view === 'top' ? 1 : 0, view === 'top' ? 0 : 1);
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.near = Math.max(radius / 1000, 0.000001);
    camera.far = Math.max(100, distance * 100);
    camera.updateProjectionMatrix();
    controls.current.target.copy(target);
    controls.current.update();
    invalidate();
  }, [
    bounds,
    focusBounds,
    view,
    frame,
    get,
    size.width,
    size.height,
    invalidate,
    cameraKey,
    savedCameraRef,
  ]);
  useLayoutEffect(() => {
    if (!zoom || lastZoom.current === zoom.serial || !controls.current) return;
    lastZoom.current = zoom.serial;
    const { camera } = get();
    camera.position
      .sub(controls.current.target)
      .multiplyScalar(zoom.step > 0 ? 0.8 : 1.25)
      .add(controls.current.target);
    controls.current.update();
    invalidate();
  }, [zoom, get, invalidate]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      onChange={save}
      enableDamping={false}
      minDistance={0.0001}
      maxDistance={50}
    />
  );
}

// Native sprites keep names facing the camera without a separate React DOM root per label.
function RegionLabel({
  text,
  selected,
  height,
}: {
  text: string;
  selected: boolean;
  height: number;
}) {
  const { size } = useThree();
  const label = useMemo(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    context.font = '600 24px system-ui, sans-serif';
    const width = Math.min(480, Math.ceil(context.measureText(text).width) + 24);
    canvas.width = width;
    canvas.height = 48;
    context.fillStyle = selected ? '#fdc82f' : '#fffffff0';
    context.beginPath();
    context.roundRect(1, 1, width - 2, 46, 8);
    context.fill();
    context.strokeStyle = selected ? '#b68e16' : '#aebfb5';
    context.stroke();
    context.font = '600 24px system-ui, sans-serif';
    context.fillStyle = '#1e3026';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, width / 2, 24, width - 24);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return { texture, width };
  }, [text, selected]);
  useLayoutEffect(() => {
    return () => label.texture.dispose();
  }, [label]);
  // sizeAttenuation=false keeps labels readable at every zoom (camera FOV is 42°).
  const pixelScale = (2 * Math.tan((21 * Math.PI) / 180)) / size.height;
  return (
    <sprite
      position={[0, 0, height / 2]}
      scale={[(label.width / 2) * pixelScale, 24 * pixelScale, 1]}
      renderOrder={1000}
    >
      <spriteMaterial
        map={label.texture}
        sizeAttenuation={false}
        depthTest={false}
        depthWrite={false}
        transparent
      />
    </sprite>
  );
}

function Block({
  bounds,
  origin,
  scale,
  color,
  opacity,
  emphasized = false,
  label,
  onSelect,
}: {
  bounds: RegionBounds;
  origin: number[];
  scale: number;
  color: string;
  opacity: number;
  emphasized?: boolean;
  label?: string;
  onSelect?: () => void;
}) {
  const center = boundsCenter(bounds).map((value, index) => (value - origin[index]) * scale) as [
    number,
    number,
    number,
  ];
  const size = boundsSize(bounds).map((value) => value * scale) as [number, number, number];
  return (
    <mesh
      position={center}
      onClick={
        onSelect
          ? (event) => {
              event.stopPropagation();
              onSelect();
            }
          : undefined
      }
    >
      <boxGeometry args={size} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
      <Edges color={emphasized ? '#07180e' : color} lineWidth={emphasized ? 2 : 1} />
      {label && <RegionLabel text={label} selected={emphasized} height={size[2]} />}
    </mesh>
  );
}

function TagMarker({ position }: { position: [number, number, number] }) {
  const { size } = useThree();
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#07180e';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(32, 32, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#e11d48';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(32, 20);
    ctx.lineTo(32, 44);
    ctx.moveTo(20, 32);
    ctx.lineTo(44, 32);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, []);
  useLayoutEffect(() => () => texture.dispose(), [texture]);
  const scale = (32 * 2 * Math.tan((21 * Math.PI) / 180)) / size.height;
  return (
    <sprite
      name="selected-tag-marker"
      position={position}
      scale={[scale, scale, 1]}
      renderOrder={2000}
    >
      <spriteMaterial
        map={texture}
        transparent
        depthTest={false}
        depthWrite={false}
        sizeAttenuation={false}
      />
    </sprite>
  );
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div role="alert" className="p-6 space-y-3">
          <p>
            Não foi possível abrir o mapa 3D. Verifique o suporte a WebGL e a aceleração gráfica do
            navegador. As outras visualizações e informações continuam disponíveis.
          </p>
          <button className="button-secondary" onClick={() => this.setState({ failed: false })}>
            Tentar abrir o mapa novamente
          </button>
        </div>
      );
    return this.props.children;
  }
}

export default function RegionMapScene(props: SceneProps) {
  const { bounds, regions, selectedId, highlightedIds, cut, opacity, labels, conflicts, onSelect } =
    props;
  const origin = boundsCenter(bounds);
  const scale = 1 / Math.max(...boundsSize(bounds));
  const floor = (bounds.zMin - origin[2]) * scale;
  const visibleIds = new Set(regions.map((region) => region.id));
  return (
    <SceneBoundary>
      <Canvas
        frameloop="demand"
        dpr={[1, props.maxDpr ?? 2]}
        camera={{ fov: 42, position: [2, -2, 2], up: [0, 0, 1] }}
        fallback={
          <p className="p-6" role="alert">
            Seu navegador não oferece WebGL. As outras visualizações continuam disponíveis.
          </p>
        }
      >
        <color attach="background" args={['#f0f5f2']} />
        <CameraRig
          bounds={bounds}
          focusBounds={props.focusBounds}
          view={props.view}
          frame={props.frame}
          cameraKey={props.cameraKey}
          savedCameraRef={props.savedCameraRef}
          zoom={props.zoom}
        />
        <gridHelper
          args={[2, 20, '#9cafa2', '#d4e0d8']}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, floor - 0.002]}
        />
        <axesHelper args={[0.18]} position={[-0.65, -0.65, floor]} />
        {regions.map((region) => {
          const section = cutRegion(region, cut);
          if (!section) return null;
          return (
            <Block
              key={region.id}
              bounds={section}
              origin={origin}
              scale={scale}
              color={region.archived ? '#88978e' : regionColor(region.id)}
              opacity={opacity}
              emphasized={selectedId === region.id || highlightedIds.includes(region.id)}
              label={
                labels !== 'none' &&
                (labels || selectedId === region.id || highlightedIds.includes(region.id))
                  ? region.name
                  : undefined
              }
              onSelect={onSelect ? () => onSelect(region.id) : undefined}
            />
          );
        })}
        {conflicts
          .filter(
            (conflict) =>
              !conflict.contact && visibleIds.has(conflict.a.id) && visibleIds.has(conflict.b.id),
          )
          .map((conflict) => {
            const section = cutRegion(conflict.intersection, cut);
            return (
              section && (
                <Block
                  key={JSON.stringify([conflict.a.id, conflict.b.id])}
                  bounds={section}
                  origin={origin}
                  scale={scale}
                  color="#e11d48"
                  opacity={0.65}
                />
              )
            );
          })}
        {props.marker && (
          <TagMarker
            position={
              props.marker.map((value, index) => (value - origin[index]) * scale) as [
                number,
                number,
                number,
              ]
            }
          />
        )}
        {cut !== null && (
          <mesh position={[0, 0, (cut - origin[2]) * scale]}>
            <planeGeometry args={[1.3, 1.3]} />
            <meshBasicMaterial
              color="#008542"
              transparent
              opacity={0.08}
              depthWrite={false}
              side={2}
            />
          </mesh>
        )}
      </Canvas>
    </SceneBoundary>
  );
}
