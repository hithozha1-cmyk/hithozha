import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Subcategory } from '@/lib/types';

/** Active subcategories for the app; admins pass includeInactive to manage the hidden ones too.
 * This is the granular service type (e.g. "Logo design") that jobs and packages actually tag by. */
export function useSubcategories(includeInactive = false) {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    let query = supabase
      .from('subcategories')
      .select('id, category_slug, slug, name_en, name_ta, description_en, sort_order, is_active');
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error: queryError } = await query
      .order('category_slug', { ascending: true })
      .order('sort_order', { ascending: true });
    if (queryError) {
      setError(true);
    } else {
      setSubcategories((data ?? []) as Subcategory[]);
    }
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  return { subcategories, loading, error, reload: load };
}
