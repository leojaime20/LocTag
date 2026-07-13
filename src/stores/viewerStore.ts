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
  zoomIn: (view: ViewKind) => void;
  zoomOut: (view: ViewKind) => void;
  reset: (view: ViewKind) => void;
  centerMarker: (view: ViewKind) => void;
}

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
  zoomIn: (view) =>
    set((state) => ({
      views: {
        ...state.views,
        [view]: { ...state.views[view], zoom: Math.min(state.views[view].zoom + 0.15, 3) },
      },
    })),
  zoomOut: (view) =>
    set((state) => ({
      views: {
        ...state.views,
        [view]: { ...state.views[view], zoom: Math.max(state.views[view].zoom - 0.15, 0.5) },
      },
    })),
  reset: (view) =>
    set((state) => ({
      views: { ...state.views, [view]: { ...defaultView } },
    })),
  centerMarker: (view) =>
    set((state) => ({
      views: { ...state.views, [view]: { ...state.views[view], panX: 0, panY: 0 } },
    })),
}));
