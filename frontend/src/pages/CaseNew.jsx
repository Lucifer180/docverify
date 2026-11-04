import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import Card from '../components/common/Card';
import CaseForm from '../features/cases/components/CaseForm';
import { caseService } from '../services/case.service';
import { useToast } from '../context/ToastContext';

export default function CaseNew() {
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <>
      <PageHeader eyebrow="New case" title="Create a case"
        description="Enter the applicant’s details. Every document you upload is checked against these details and against each other." />
      <Card className="max-w-2xl">
        <CaseForm submitLabel="Create case and add documents" onCancel={() => navigate(-1)}
          onSubmit={async (values) => {
            const created = await caseService.create(values);
            toast.success(`Case ${created.reference} created`);
            navigate(`/cases/${created.id}`, { replace: true });
          }} />
      </Card>
    </>
  );
}
