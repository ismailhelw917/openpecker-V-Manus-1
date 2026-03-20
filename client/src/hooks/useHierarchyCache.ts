import { useEffect, useState } from 'react';

interface HierarchyItem {
  opening: string | null;
  subset: string | null;
  variation: string | null;
  puzzleCount?: number;
}

/**
 * Custom hook for instant hierarchy loading from static JSON
 * The hierarchy is pre-generated at build time and bundled with the app
 * Zero server requests, instant access
 */
export function useHierarchyCache() {
  const [hierarchy, setHierarchy] = useState<HierarchyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadHierarchy = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load from static JSON file (bundled with app)
        const response = await fetch('/hierarchy.json');
        if (!response.ok) {
          throw new Error(`Failed to load hierarchy: ${response.statusText}`);
        }

        const data = await response.json() as HierarchyItem[];
        setHierarchy(data);
        console.log(`[HierarchyCache] Loaded ${data.length} hierarchy items`);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        console.error('[HierarchyCache] Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadHierarchy();
  }, []);

  return {
    hierarchy,
    isLoading,
    error,
  };
}

/**
 * Client-side filtering functions (zero server load)
 */
export const hierarchyFilters = {
  /**
   * Get unique openings from cached hierarchy
   */
  getOpenings(hierarchy: HierarchyItem[]): string[] {
    const openings = new Set<string>();
    hierarchy.forEach(item => {
      if (item.opening) openings.add(item.opening);
    });
    return Array.from(openings).sort();
  },

  /**
   * Get subsets for a specific opening
   */
  getSubsets(hierarchy: HierarchyItem[], opening: string): string[] {
    const subsets = new Set<string>();
    hierarchy.forEach(item => {
      if (item.opening === opening && item.subset) {
        subsets.add(item.subset);
      }
    });
    return Array.from(subsets).sort();
  },

  /**
   * Get variations for a specific opening and subset
   */
  getVariations(
    hierarchy: HierarchyItem[],
    opening: string,
    subset: string
  ): string[] {
    const variations = new Set<string>();
    hierarchy.forEach(item => {
      if (
        item.opening === opening &&
        item.subset === subset &&
        item.variation
      ) {
        variations.add(item.variation);
      }
    });
    return Array.from(variations).sort();
  },

  /**
   * Get total puzzle count for opening
   */
  getOpeningCount(hierarchy: HierarchyItem[], opening: string): number {
    return hierarchy
      .filter(h => h.opening === opening)
      .reduce((sum, item) => sum + (item.puzzleCount || 0), 0);
  },

  /**
   * Get total puzzle count for subset
   */
  getSubsetCount(
    hierarchy: HierarchyItem[],
    opening: string,
    subset: string
  ): number {
    return hierarchy
      .filter(h => h.opening === opening && h.subset === subset)
      .reduce((sum, item) => sum + (item.puzzleCount || 0), 0);
  },

  /**
   * Get total puzzle count for variation
   */
  getVariationCount(
    hierarchy: HierarchyItem[],
    opening: string,
    subset: string,
    variation: string
  ): number {
    return hierarchy
      .filter(
        h =>
          h.opening === opening &&
          h.subset === subset &&
          h.variation === variation
      )
      .reduce((sum, item) => sum + (item.puzzleCount || 0), 0);
  },

  /**
   * Search openings by query (client-side)
   */
  searchOpenings(hierarchy: HierarchyItem[], query: string): string[] {
    const openings = this.getOpenings(hierarchy);
    return openings.filter(opening =>
      opening.toLowerCase().includes(query.toLowerCase())
    );
  },
};
