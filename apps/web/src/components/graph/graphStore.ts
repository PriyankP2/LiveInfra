import { create } from 'zustand'
import type { GraphNode } from '@liveinfra/shared'

interface GraphStore {
  selectedNodeId: string | null
  hoveredNodeId: string | null
  searchQuery: string
  blastRadiusNodeId: string | null
  blastRadiusAffectedIds: string[]   // node IDs within blast radius (for canvas highlighting)
  hiddenTypes: string[]
  activeRegions: string[]            // only these regions are shown; empty = none selected
  // Cached graph nodes for command palette search — synced by DashboardClient
  cachedNodes: GraphNode[]
  // Camera focus — set to a nodeId to animate the Sigma camera to that node
  focusNodeId: string | null
  // Resolved customer UUID — set by DashboardClient after customer.resolve, used by AutoRcaToast
  resolvedCustomerId: string | null
  setSelectedNode: (id: string | null) => void
  setHoveredNode: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setBlastRadiusNode: (id: string | null) => void
  setBlastRadiusAffected: (ids: string[]) => void
  toggleType: (type: string) => void
  toggleRegion: (region: string) => void
  setActiveRegions: (regions: string[]) => void
  setCachedNodes: (nodes: GraphNode[]) => void
  setFocusNode: (id: string | null) => void
  setResolvedCustomerId: (id: string | null) => void
}

export const useGraphStore = create<GraphStore>((set) => ({
  selectedNodeId: null,
  hoveredNodeId: null,
  searchQuery: '',
  blastRadiusNodeId: null,
  blastRadiusAffectedIds: [],
  hiddenTypes: [],
  activeRegions: [],
  cachedNodes: [],
  focusNodeId: null,
  resolvedCustomerId: null,
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setBlastRadiusNode: (id) => set({ blastRadiusNodeId: id }),
  setBlastRadiusAffected: (ids) => set({ blastRadiusAffectedIds: ids }),
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
  setCachedNodes: (nodes) => set({ cachedNodes: nodes }),
  setFocusNode: (id) => set({ focusNodeId: id }),
  setResolvedCustomerId: (id) => set({ resolvedCustomerId: id }),
}))
