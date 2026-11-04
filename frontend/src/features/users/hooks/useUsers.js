import { useState } from 'react';
import { userService } from '../../../services/user.service';
import { useAsync } from '../../../hooks/useAsync';
import { useDebounce } from '../../../hooks/useDebounce';

export function useUsers() {
  const [filters, setFilters] = useState({ role: '', search: '', offset: 0, limit: 20 });
  const search = useDebounce(filters.search);
  const params = { limit: filters.limit, offset: filters.offset, ...(filters.role && { role: filters.role }), ...(search && { search }) };
  const state = useAsync(() => userService.list(params), [JSON.stringify(params)]);
  return { ...state, filters, update: (p) => setFilters((f) => ({ ...f, offset: 0, ...p })), setOffset: (offset) => setFilters((f) => ({ ...f, offset })) };
}
