import { create } from 'zustand';

import type { ViewKind } from '../types/domain';

interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

interface ViewerStore {
  activeMobileView: ViewKind;
  views: Record<ViewKind, ViewState>;
  setActiveMobileView: (view: ViewKind) => void;
  setZoom: (view: ViewKind, zoom: number) => void;
  zoomIn: (view: ViewKind) => void;
  zoomOut: (view: ViewKind) => void;
  reset: (view: ViewKind, zoom?: number) => void;
  centerMarker: (view: ViewKind) => void;
}

const minZoom = 0.35;
const maxZoom = 3;

const defaultView: ViewState = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

export const useViewerStore = create<ViewerStore>((set) => ({
  activeMobileView: 'plant',
  views: {
    plant: { ...defaultView },
    side: { ...defaultView },
  },
  setActiveMobileView: (view) => set({ activeMobileView: view }),
  setZoom: (view, zoom) =>
    set((state) => ({
      views: {
        ...state.views,
        [view]: { ...state.views[view], zoom: Math.min(Math.max(zoom, minZoom), maxZoom) },
      },
    })),
  zoomIn: (view) =>
    set((state) => ({
      views: {
        ...state.views,
        [view]: { ...state.views[view], zoom: Math.min(state.views[view].zoom + 0.15, maxZoom) },
      },
    })),
  zoomOut: (view) =>
    set((state) => ({
      views: {
        ...state.views,
        [view]: { ...state.views[view], zoom: Math.max(state.views[view].zoom - 0.15, minZoom) },
      },
    })),
  reset: (view, zoom = defaultView.zoom) =>
    set((state) => ({
      views: { ...state.views, [view]: { ...defaultView, zoom } },
    })),
  centerMarker: (view) =>
    set((state) => ({
      views: { ...state.views, [view]: { ...state.views[view], panX: 0, panY: 0 } },
    })),
}));
