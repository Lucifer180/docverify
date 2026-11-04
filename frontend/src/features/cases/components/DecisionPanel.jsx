import { useState } from 'react';
import Button from '../../../components/common/Button';
import { Textarea } from '../../../components/common/Input';
import Alert from '../../../components/common/Alert';
import { caseService } from '../../../services/case.service';
import { useToast } from '../../../context/ToastContext';
import { DECISIONS } from '../../../constants/app.constants';
import { cx, errorMessage } from '../../../utils/format';

const STYLES = {
  approved: 'peer-checked:border-green-600 peer-checked:bg-green-50 peer-checked:text-green-900',
  correction_requested: 'peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-checked:text-amber-900',
  rejected: 'peer-checked:border-red-600 peer-checked:bg-red-50 peer-checked:text-red-900',
};

/** The human decision. Comments are required for rejections, correction requests and approving flagged cases. */
export default function DecisionPanel({ detail, onDone }) {
  const toast = useToast();
  const [decision, setDecision] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const flagged = detail.case.preliminaryStatus === 'flagged';
  const needsComment = decision === 'rejected' || decision === 'correction_requested' || (decision === 'approved' && flagged);
  const busy = detail.summary.processing > 0;

  const submit = async () => {
    if (!decision) { setError('Choose a decision'); return; }
    if (needsComment && !comment.trim()) { setError('Please add a comment explaining this decision'); return; }
    setSaving(true); setError('');
    try {
      await caseService.decide(detail.case.id, decision, comment.trim() || undefined);
      toast.success(`Decision recorded: ${DECISIONS[decision].past}`);
      setDecision(''); setComment('');
      onDone?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {busy && <Alert tone="info">Wait until all documents have finished processing.</Alert>}
      {flagged && !busy && (
        <Alert tone="warning">
          This case has {detail.summary.errors} error(s) and {detail.summary.warnings} warning(s). Check each flagged field against the original document.
        </Alert>
      )}
      <fieldset className="grid gap-2 sm:grid-cols-3" disabled={busy}>
        <legend className="sr-only">Decision</legend>
        {Object.entries(DECISIONS).map(([key, d]) => (
          <label key={key} className="cursor-pointer">
            <input type="radio" name="decision" value={key} checked={decision === key} onChange={() => { setDecision(key); setError(''); }} className="peer sr-only" />
            <span className={cx('block rounded-lg border border-line px-3 py-2.5 text-center text-sm font-medium transition hover:bg-stone-50', STYLES[key])}>
              {d.label}
            </span>
          </label>
        ))}
      </fieldset>
      <Textarea label={needsComment ? 'Comment (required)' : 'Comment (optional)'} value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder={decision === 'correction_requested' ? 'Tell the submitter exactly what to fix or re-upload' : 'Reason for this decision'}
        maxLength={2000} disabled={busy} />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={submit} loading={saving} disabled={busy || !decision}
          variant={decision === 'rejected' ? 'danger' : decision === 'correction_requested' ? 'warning' : decision === 'approved' ? 'success' : 'primary'}>
          {decision ? DECISIONS[decision].label : 'Record decision'}
        </Button>
      </div>
    </div>
  );
}
