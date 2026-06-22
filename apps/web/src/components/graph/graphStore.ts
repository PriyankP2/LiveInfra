import { create } from 'zustand'

interface GraphStore {
  selectedNodeId: string | null
  hoveredNodeId: string | null
  searchQuery: string
  blastRadiusNodeId: string | null
  hiddenTypes: string[]
  activeRegions: string[]        // only these regions are shown; empty = none selected
  setSelectedNode: (id: string | null) => void
  setHoveredNode: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setBlastRadiusNode: (id: string | null) => void
  toggleType: (type: string) => void
  toggleRegion: (region: string) => void
  setActiveRegions: (regions: string[]) => void
}

export const useGraphStore = create<GraphStore>((set) => ({
  selectedNodeId: null,
  hoveredNodeId: null,
  searchQuery: '',
  blastRadiusNodeId: null,
  hiddenTypes: [],
  activeRegions: [],
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setBlastRadiusNode: (id) => set({ blastRadiusNodeId: id }),
  toggleType: (type) =>
    set((s) => ({
      hiddenTypes: s.hiddenTypes.includes(type)
        ? s.hiddenTypes.filter((t) => t !== type)
        : [...s.hiddenTypes, type],
    })),
  toggleRegion: (region) =>
    set((s) => ({
      activeRegions: s.activeRegions.includes(region)
        ? s.activeRegions.filter((r) => r !== region)
        : [...s.activeRegions, region],
    })),
  setActiveRegions: (regions) => set({ activeRegions: regions }),
}))
