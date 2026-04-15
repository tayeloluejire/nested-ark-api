import useSWR from 'swr';
import api from '@/lib/api';

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export function useLiveProjects() {
  const { data, error, mutate, isLoading } = useSWR('/api/projects', fetcher, {
    refreshInterval: 5000, revalidateOnFocus: true,
  });
  return { projects: data?.projects ?? [], count: data?.count ?? 0, isLoading, error, mutate };
}

export function useLiveMilestones(projectId?: string) {
  const url = projectId ? `/api/milestones?project_id=${projectId}` : '/api/milestones';
  const { data, error, mutate, isLoading } = useSWR(url, fetcher, { refreshInterval: 5000 });
  return { milestones: data?.milestones ?? [], isLoading, error, mutate };
}

export function useLiveInvestments() {
  const { data, error, mutate, isLoading } = useSWR('/api/investments', fetcher, { refreshInterval: 5000 });
  return { investments: data?.investments ?? [], isLoading, error, mutate };
}

export function useLiveLedger() {
  const { data, error, isLoading } = useSWR('/api/ledger', fetcher, { refreshInterval: 3000 });
  return { entries: data?.logs ?? [], isLoading, error };
}

export function useContractorProfile() {
  const { data, error, mutate, isLoading } = useSWR('/api/contractors/profile/me', fetcher, {
    shouldRetryOnError: false, revalidateOnFocus: false,
  });
  return { profile: data?.contractor ?? null, hasProfile: !!data?.contractor, isLoading, error, mutate };
}

export function useLiveMarket() {
  const { data, error, isLoading } = useSWR('/api/market/summary', fetcher, {
    refreshInterval: 60000, // 1 min
  });
  return { summary: data?.summary ?? null, isLoading, error };
}

export function useLiveTicker() {
  const { data, isLoading } = useSWR('/api/ticker', fetcher, {
    refreshInterval: 15000, // 15s
  });
  return { items: data?.items ?? [], isLoading };
}
