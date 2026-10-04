import { toPaise } from '@/lib/money';
import { supabase } from '@/lib/supabase';

export const MIN_PACKAGE_RUPEES = 50;

export type ServicePackage = {
  id: string;
  freelancer_id: string;
  title: string;
  description: string;
  category_slug: string;
  price_paise: number;
  delivery_days: number;
  active: boolean;
};

export const PACKAGE_COLUMNS = 'id, freelancer_id, title, description, category_slug, price_paise, delivery_days, active';

export type PackageFormValues = {
  title: string;
  description: string;
  category: string | null;
  /** Rupees as typed. */
  price: string;
  days: string;
};

export const EMPTY_PACKAGE: PackageFormValues = { title: '', description: '', category: null, price: '', days: '' };

export const packageToFormValues = (p: ServicePackage): PackageFormValues => ({
  title: p.title,
  description: p.description,
  category: p.category_slug,
  price: String(Math.round(p.price_paise / 100)),
  days: String(p.delivery_days),
});

export type PackageField = keyof PackageFormValues;
export type PackageRow = Pick<ServicePackage, 'title' | 'description' | 'category_slug' | 'price_paise' | 'delivery_days'>;

const E = 'packages.errors';

/** Checks the form. Returns i18n keys for each invalid field, and the database row when all is valid. */
export function validatePackage(values: PackageFormValues): { errors: Partial<Record<PackageField, string>>; row: PackageRow | null } {
  const errors: Partial<Record<PackageField, string>> = {};
  const title = values.title.trim();
  const description = values.description.trim();
  if (title.length < 5 || title.length > 80) errors.title = `${E}.title`;
  if (description.length < 20 || description.length > 600) errors.description = `${E}.description`;
  if (!values.category) errors.category = `${E}.category`;

  const rupees = Number(values.price);
  if (!/^\d+$/.test(values.price.trim()) || rupees < MIN_PACKAGE_RUPEES || rupees > 10_000_000) errors.price = `${E}.price`;
  const days = Number(values.days);
  if (!/^\d+$/.test(values.days.trim()) || days < 1 || days > 60) errors.days = `${E}.days`;

  if (Object.keys(errors).length > 0 || !values.category) return { errors, row: null };
  return { errors, row: { title, description, category_slug: values.category, price_paise: toPaise(rupees), delivery_days: days } };
}

/** The freelancer's packages. Owners get paused ones too; everyone else only active ones (the database decides). */
export async function fetchPackages(freelancerId: string): Promise<ServicePackage[] | null> {
  const { data, error } = await supabase
    .from('service_packages')
    .select(PACKAGE_COLUMNS)
    .eq('freelancer_id', freelancerId)
    .order('created_at', { ascending: true });
  return error ? null : ((data ?? []) as ServicePackage[]);
}

export type SaveResult = 'saved' | 'limit' | 'failed';

export async function savePackage(id: string | null, row: PackageRow): Promise<SaveResult> {
  const { error } = id
    ? await supabase.from('service_packages').update(row).eq('id', id)
    : await supabase.from('service_packages').insert(row);
  if (!error) return 'saved';
  return error.code === '54000' ? 'limit' : 'failed';
}

export const setPackageActive = async (id: string, active: boolean): Promise<boolean> =>
  !(await supabase.from('service_packages').update({ active }).eq('id', id)).error;

export const deletePackage = async (id: string): Promise<boolean> => !(await supabase.from('service_packages').delete().eq('id', id)).error;

export type OrderResult = { ok: true; orderId: string } | { ok: false };

/** Orders a package. The order starts "awaiting payment", like any order. */
export async function orderPackage(id: string, note: string): Promise<OrderResult> {
  const { data, error } = await supabase.rpc('order_package', { p_package_id: id, p_note: note.trim() || null });
  return error || typeof data !== 'string' ? { ok: false } : { ok: true, orderId: data };
}
