import {
  Component,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import { CanvasTexture, PerspectiveCamera, SRGBColorSpace, Vector3 } from 'three';
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
  labels: boolean;
  cut: number | null;
  conflicts: RegionMapConflict[];
  onSelect: (id: string) => void;
}

function CameraRig({
  bounds,
  focusBounds,
  view,
  frame,
}: Pick<SceneProps, 'bounds' | 'focusBounds' | 'view' | 'frame'>) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { get, size, invalidate } = useThree();
  useLayoutEffect(() => {
    // The camera is an imperative Three.js object owned by the renderer.
    const { camera } = get();
    if (!(camera instanceof PerspectiveCamera) || !controls.current) return;
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
  }, [bounds, focusBounds, view, frame, get, size.width, size.height, invalidate]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
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
            navegador. As listas e os diagnósticos continuam disponíveis.
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
        dpr={[1, 2]}
        camera={{ fov: 42, position: [2, -2, 2], up: [0, 0, 1] }}
        fallback={
          <p className="p-6" role="alert">
            Seu navegador não oferece WebGL. Use as listas de regiões e conflitos abaixo.
          </p>
        }
      >
        <color attach="background" args={['#f0f5f2']} />
        <CameraRig
          bounds={bounds}
          focusBounds={props.focusBounds}
          view={props.view}
          frame={props.frame}
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
                labels || selectedId === region.id || highlightedIds.includes(region.id)
                  ? region.name
                  : undefined
              }
              onSelect={() => onSelect(region.id)}
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
