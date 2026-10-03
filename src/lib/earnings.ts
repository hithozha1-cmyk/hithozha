import { supabase } from '@/lib/supabase';

export type EarningsOrder = {
  id: string;
  title: string;
  status: string;
  freelancer_earnings_paise: number;
  completed_at: string | null;
  payments: { status: string; paid_out_at: string | null }[];
};

export type EarningsSummary = {
  /** Paid by the client, held until the client approves. */
  inEscrow: number;
  /** Approved and released, waiting for Hithozha to pay it out. */
  awaitingPayout: number;
  paidOut: number;
};

const paidOutAt = (order: EarningsOrder): string | null => order.payments.find((p) => p.paid_out_at)?.paid_out_at ?? null;

export function summarizeEarnings(orders: EarningsOrder[]): EarningsSummary {
  const total: EarningsSummary = { inEscrow: 0, awaitingPayout: 0, paidOut: 0 };
  for (const order of orders) {
    const paise = order.freelancer_earnings_paise;
    if (order.status === 'in_progress' || order.status === 'delivered' || order.status === 'disputed') total.inEscrow += paise;
    else if (order.status === 'completed') {
      if (paidOutAt(order)) total.paidOut += paise;
      else if (order.payments.some((p) => p.status === 'released')) total.awaitingPayout += paise;
    }
  }
  return total;
}

export const orderPaidOutAt = paidOutAt;

export async function fetchEarningsOrders(userId: string): Promise<EarningsOrder[] | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, title, status, freelancer_earnings_paise, completed_at, payments(status, paid_out_at)')
    .eq('freelancer_id', userId)
    .in('status', ['in_progress', 'delivered', 'disputed', 'completed'])
    .order('created_at', { ascending: false })
    .limit(200);
  return error ? null : ((data ?? []) as unknown as EarningsOrder[]);
}
