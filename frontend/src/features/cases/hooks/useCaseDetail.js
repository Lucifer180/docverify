import { useState } from 'react';
import { caseService } from '../../../services/case.service';
import { useAsync } from '../../../hooks/useAsync';
import { POLL_INTERVAL_MS } from '../../../constants/app.constants';
import { isProcessing } from '../case.utils';

/** Loads a case and keeps polling while any document is still being processed. */
export function useCaseDetail(caseId) {
  const [reveal, setReveal] = useState(false);
  const state = useAsync(() => caseService.get(caseId, { reveal }), [caseId, reveal], {
    poll: isProcessing, interval: POLL_INTERVAL_MS,
  });
  return { ...state, reveal, setReveal };
}
