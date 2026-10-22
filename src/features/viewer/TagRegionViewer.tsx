import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Region, SelectedTagContext } from '../../types/domain';
import type { SpatialCamera } from '../spatial/camera';
import RegionScene from '../spatial/RegionScene';
import { hasValidBounds } from '../../utils/regions';
import { enclosingBounds, type MappedRegion } from '../../utils/regionMap';

export default function TagRegionViewer({
  context,
  regions,
  savedCameraRef,
}: {
  context: SelectedTagContext;
  regions: Region[];
  savedCameraRef: RefObject<SpatialCamera | null>;
}) {
  const [all, setAll] = useState(false);
  const [frame, setFrame] = useState(0);
  const [zoom, setZoom] = useState({ step: 0, serial: 0 });
  const [expanded, setExpanded] = useState(false);
  const expandButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const restoreFocus = useRef(false);
  const volumes = useMemo(
    () => regions.filter((r): r is MappedRegion => !r.archived && hasValidBounds(r)),
    [regions],
  );
  const { tag, resolution } = context;
  const valid = [tag.x, tag.y, tag.z].every(Number.isFinite);
  const point = useMemo(
    () => ({ xMin: tag.x, xMax: tag.x, yMin: tag.y, yMax: tag.y, zMin: tag.z, zMax: tag.z }),
    [tag.x, tag.y, tag.z],
  );
  const bounds = useMemo(
    () =>
      valid
        ? enclosingBounds(
            volumes.length
              ? [...volumes, point]
              : [
                  {
                    xMin: tag.x - 5,
                    xMax: tag.x + 5,
                    yMin: tag.y - 5,
                    yMax: tag.y + 5,
                    zMin: tag.z - 5,
                    zMax: tag.z + 5,
                  },
                ],
          )!
        : null,
    [volumes, point, valid, tag.x, tag.y, tag.z],
  );
  const focus = useMemo(
    () => (all || !resolution.region ? bounds : enclosingBounds([resolution.region, point])),
    [all, bounds, resolution.region, point],
  );
  const cameraKey = JSON.stringify([
    tag.id,
    point,
    bounds,
    resolution.region && [
      resolution.region.id,
      resolution.region.xMin,
      resolution.region.xMax,
      resolution.region.yMin,
      resolution.region.yMax,
      resolution.region.zMin,
      resolution.region.zMax,
    ],
    resolution.matches.map((r) => r.id),
  ]);
  useEffect(() => {
    if (!expanded) {
      if (restoreFocus.current) {
        restoreFocus.current = false;
        expandButton.current?.focus();
      }
      return;
    }
    restoreFocus.current = true;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);
  const content = (
    <section
      className={`tag-region-viewer ${expanded ? 'is-expanded' : ''}`}
      aria-label={`Localização 3D de ${tag.tag}`}
    >
      <div className="tag-region-toolbar">
        <button
          className="button-secondary"
          onClick={() => {
            savedCameraRef.current = null;
            setAll(false);
            setFrame((n) => n + 1);
          }}
        >
          Centralizar TAG
        </button>
        <button
          className="button-secondary"
          onClick={() => {
            savedCameraRef.current = null;
            setAll(true);
            setFrame((n) => n + 1);
          }}
        >
          Ver todas
        </button>
        <button
          className="icon-button"
          aria-label="Aumentar zoom 3D"
          onClick={() => setZoom((v) => ({ step: 1, serial: v.serial + 1 }))}
        >
          +
        </button>
        <button
          className="icon-button"
          aria-label="Diminuir zoom 3D"
          onClick={() => setZoom((v) => ({ step: -1, serial: v.serial + 1 }))}
        >
          −
        </button>
        <button
          ref={expanded ? undefined : expandButton}
          className="button-secondary"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Sair da expansão' : 'Expandir 3D'}
        </button>
      </div>
      <div className="tag-region-canvas" aria-label="Cena 3D sem rótulos de regiões">
        {valid && bounds && focus ? (
          <RegionScene
            regions={volumes}
            bounds={bounds}
            focusBounds={focus}
            view="iso"
            frame={frame}
            selectedId={resolution.region?.id ?? null}
            highlightedIds={resolution.region ? [] : resolution.matches.map((r) => r.id)}
            opacity={0.18}
            labels="none"
            cut={null}
            conflicts={[]}
            marker={[tag.x, tag.y, tag.z]}
            savedCameraRef={savedCameraRef}
            cameraKey={cameraKey}
            zoom={zoom}
            maxDpr={1.5}
          />
        ) : (
          <p className="notice-error" role="alert">
            A TAG possui coordenadas inválidas. Não é possível posicioná-la no mapa 3D.
          </p>
        )}
      </div>
      <div className="tag-region-caption">
        <p>
          <span className="tag-marker-legend" aria-hidden="true" /> TAG selecionada · Z é a altura
        </p>
        <p>Um dedo gira. Dois dedos aproximam e deslocam.</p>
        {!volumes.length && <p role="status">Nenhuma região com volume válido disponível.</p>}
        {!resolution.region && volumes.length > 0 && (
          <p role="status">
            {resolution.matches.length
              ? 'A TAG corresponde a mais de uma região.'
              : 'A TAG está fora das regiões cadastradas.'}
          </p>
        )}
      </div>
    </section>
  );
  return (
    <>
      {expanded ? (
        <button ref={expandButton} className="button-secondary" onClick={() => setExpanded(false)}>
          Voltar à visualização na página
        </button>
      ) : (
        content
      )}
      {expanded &&
        createPortal(
          <dialog
            ref={dialog}
            className="tag-region-dialog"
            aria-label={`Localização 3D ampliada de ${tag.tag}`}
            onClose={() => setExpanded(false)}
            onCancel={() => setExpanded(false)}
          >
            {content}
          </dialog>,
          document.body,
        )}
    </>
  );
}
