import type { SelectOption } from '@/components/Select';
import type { Category, Subcategory } from '@/lib/types';

/** Builds the flat subcategory picker list used to post a job, publish a package, or filter browse.
 * Grouped by category in the category's own curated order (not alphabetical), with each label
 * prefixed by its category name for context in a 300+ item list. */
export function subcategoryOptions(categories: Category[], subcategories: Subcategory[], language: string): SelectOption[] {
  const categoryOrder = new Map(categories.map((c) => [c.slug, c.sort_order]));
  const categoryName = new Map(categories.map((c) => [c.slug, language === 'ta' ? c.name_ta : c.name_en]));
  return [...subcategories]
    .sort((a, b) => {
      const orderDiff = (categoryOrder.get(a.category_slug) ?? 0) - (categoryOrder.get(b.category_slug) ?? 0);
      return orderDiff !== 0 ? orderDiff : a.sort_order - b.sort_order;
    })
    .map((s) => ({
      value: s.slug,
      label: `${categoryName.get(s.category_slug) ?? s.category_slug} · ${language === 'ta' ? s.name_ta : s.name_en}`,
    }));
}
