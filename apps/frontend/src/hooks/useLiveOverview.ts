// src/hooks/useLiveOverview.ts
// Polls GET /api/admin/overview every 30 seconds for live dashboard data.
// Usage:
//   const { data, isLoading, error, mutate } = useLiveOverview();

import useSWR from 'swr';
import api from '@/lib/api';

interface Transaction {
  id: string;
  type: 'INVESTMENT' | 'RENTAL' | 'BID' | 'ESCROW';
  amount: number;
  currency: string;
  project_title: string;
  project_number: string;
  user_name: string;
  country: string;
  created_at: string;
}

export interface OverviewData {
  aum_usd: number;
  revenue_mtd_usd: number;
  revenue_all_time_usd: number;
  active_stakeholders: number;
  pending_escrow_usd: number;
  projects_by_status: {
    PENDING: number;
    ACTIVE: number;
    CONSTRUCTION: number;
    VERIFICATION: number;
    OPERATIONAL: number;
  };
  recent_transactions: Transaction[];
}

const fetcher = (url: string) => api.get(url).then(r => r.data);

export function useLiveOverview() {
  const { data, error, isLoading, mutate } = useSWR<OverviewData>(
    '/api/admin/overview',
    fetcher,
    {
      refreshInterval: 30_000,   // refresh every 30 seconds
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
    }
  );

  return { data, isLoading, error: error?.response?.data?.error ?? error?.message, mutate };
}
