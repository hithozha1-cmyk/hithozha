import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Category } from '@/lib/types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data, error: queryError } = await supabase
      .from('categories')
      .select('id, slug, name_en, name_ta, icon, sort_order')
      .order('sort_order', { ascending: true });
    if (queryError) {
      setError(true);
    } else {
      setCategories((data ?? []) as Category[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { categories, loading, error, reload: load };
}
