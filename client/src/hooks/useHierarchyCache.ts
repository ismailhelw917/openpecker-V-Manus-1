import { useEffect, useState } from 'react';

interface VariationItem {
  variation: string;
  puzzleCount: number;
}

interface HierarchyItem {
  opening: string;
  puzzleCount: number;
  variations: VariationItem[];
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
        
        // Validate data structure
        if (!Array.isArray(data)) {
          throw new Error('Hierarchy data is not an array');
        }
        
        // Filter out invalid entries
        const validData = data.filter(item => 
          item.opening && 
          Array.isArray(item.variations) && 
          item.puzzleCount > 0
        );
        
        setHierarchy(validData);
        console.log(`[HierarchyCache] Loaded ${validData.length} hierarchy items`);
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
 * Works with 2-level hierarchy: Opening → Variation
 */
export const hierarchyFilters = {
  /**
   * Get unique openings from cached hierarchy
   */
  getOpenings(hierarchy: HierarchyItem[]): string[] {
    return hierarchy
      .map(item => item.opening)
      .filter(opening => opening && opening.length > 0)
      .sort();
  },

  /**
   * Get variations for a specific opening
   */
  getVariations(
    hierarchy: HierarchyItem[],
    opening: string
  ): VariationItem[] {
    const openingItem = hierarchy.find(item => item.opening === opening);
    return openingItem?.variations || [];
  },

  /**
   * Get total puzzle count for opening
   */
  getOpeningCount(hierarchy: HierarchyItem[], opening: string): number {
    const openingItem = hierarchy.find(item => item.opening === opening);
    return openingItem?.puzzleCount || 0;
  },

  /**
   * Get total puzzle count for variation
   */
  getVariationCount(
    hierarchy: HierarchyItem[],
    opening: string,
    variation: string
  ): number {
    const openingItem = hierarchy.find(item => item.opening === opening);
    if (!openingItem) return 0;
    
    const variationItem = openingItem.variations.find(v => v.variation === variation);
    return variationItem?.puzzleCount || 0;
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
