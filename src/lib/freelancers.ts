import { supabase } from '@/lib/supabase';

export type FreelancerPage = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  freelancer_profiles: {
    headline: string | null;
    bio: string | null;
    skills: string[];
    languages: string[];
    experience_level: string | null;
    availability: string | null;
    rating_avg: number;
    rating_count: number;
    completed_orders: number;
    portfolio_urls: string[];
    portfolio_website: string | null;
  } | null;
};

export type FreelancerReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: { full_name: string | null; avatar_url: string | null } | null;
};

const PAGE_SELECT =
  'id, full_name, avatar_url, city, freelancer_profiles(headline, bio, skills, languages, experience_level, availability, rating_avg, rating_count, completed_orders, portfolio_urls, portfolio_website)';

export async function fetchFreelancer(id: string): Promise<FreelancerPage | null> {
  const { data, error } = await supabase.from('profiles').select(PAGE_SELECT).eq('id', id).maybeSingle();
  return error || !data ? null : (data as unknown as FreelancerPage);
}

export async function fetchFreelancerReviews(id: string): Promise<FreelancerReview[] | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name, avatar_url)')
    .eq('freelancer_id', id)
    .order('created_at', { ascending: false })
    .limit(50);
  return error ? null : ((data ?? []) as unknown as FreelancerReview[]);
}
