import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Category } from '@/lib/types';

/** Active categories for the app; admins pass includeInactive to manage the hidden ones too. */
export function useCategories(includeInactive = false) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    let query = supabase.from('categories').select('id, slug, name_en, name_ta, icon, sort_order, is_active');
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error: queryError } = await query.order('sort_order', { ascending: true });
    if (queryError) {
      setError(true);
    } else {
      setCategories((data ?? []) as Category[]);
    }
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  return { categories, loading, error, reload: load };
}
