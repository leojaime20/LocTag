interface Props {
  zoom: number;
  onZoom: (zoom: number) => void;
  onFit: () => void;
  onCenter: () => void;
  onFullscreen: () => void;
  hasMarker: boolean;
}
export function ViewerControls({ zoom, onZoom, onFit, onCenter, onFullscreen, hasMarker }: Props) {
  return (
    <div className="viewer-controls">
      <button className="icon-button" aria-label="Diminuir zoom" onClick={() => onZoom(zoom / 1.4)}>
        −
      </button>
      <span className="text-xs whitespace-nowrap">{zoom.toFixed(1)}×</span>
      <button className="icon-button" aria-label="Aumentar zoom" onClick={() => onZoom(zoom * 1.4)}>
        +
      </button>
      <button className="control-button" onClick={onFit}>
        Desenho completo
      </button>
      <button className="control-button" disabled={!hasMarker} onClick={onCenter}>
        Centralizar TAG
      </button>
      <button className="control-button" onClick={onFullscreen}>
        Tela cheia
      </button>
    </div>
  );
}
