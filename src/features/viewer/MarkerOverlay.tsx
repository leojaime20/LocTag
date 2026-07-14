import type { PdfPoint } from '../../utils/calibration';

interface MarkerOverlayProps {
  marker: PdfPoint | null;
  label: string | null;
  width?: number;
  height?: number;
}

export function MarkerOverlay({ marker, label, width = 1000, height = 500 }: MarkerOverlayProps) {
  if (!marker) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g transform={`translate(${marker.x} ${marker.y})`}>
        <circle className="marker-pulse" r="20" />
        <circle className="marker-core" r="8" />
        {label && (
          <text className="marker-label" x="0" y="-26" textAnchor="middle">
            {label}
          </text>
        )}
      </g>
    </svg>
  );
}
