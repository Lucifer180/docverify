import { useState } from 'react';
import { caseService } from '../../../services/case.service';
import { useAsync } from '../../../hooks/useAsync';
import { useDebounce } from '../../../hooks/useDebounce';

export function useCases(initial = {}) {
  const [filters, setFilters] = useState({ status: '', preliminaryStatus: '', search: '', mine: false, offset: 0, limit: 15, ...initial });
  const search = useDebounce(filters.search);
  const params = {
    limit: filters.limit, offset: filters.offset,
    ...(filters.status && { status: filters.status }),
    ...(filters.preliminaryStatus && { preliminaryStatus: filters.preliminaryStatus }),
    ...(search && { search }),
    ...(filters.mine && { mine: true }),
  };
  const state = useAsync(() => caseService.list(params), [JSON.stringify(params)], {
    poll: (d) => d.items.some((c) => c.preliminaryStatus === 'processing'), interval: 4000,
  });
  const update = (patch) => setFilters((f) => ({ ...f, offset: 0, ...patch }));
  return { ...state, filters, update, setOffset: (offset) => setFilters((f) => ({ ...f, offset })) };
}
