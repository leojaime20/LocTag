import { create } from 'zustand';
import type { ViewKind } from '../types/domain';
import type { Camera } from '../utils/viewport';
interface ViewerStore {
  activeMobileView: ViewKind;
  views: Record<ViewKind, Camera>;
  setActiveMobileView: (view: ViewKind) => void;
  setCamera: (view: ViewKind, camera: Camera) => void;
}
export const useViewerStore = create<ViewerStore>((set) => ({
  activeMobileView: 'plant',
  views: { plant: { zoom: 1, centerX: 0, centerY: 0 }, side: { zoom: 1, centerX: 0, centerY: 0 } },
  setActiveMobileView: (view) => set({ activeMobileView: view }),
  setCamera: (view, camera) => set((state) => ({ views: { ...state.views, [view]: camera } })),
}));
