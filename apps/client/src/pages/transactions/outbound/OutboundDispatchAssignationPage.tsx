import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../../components/PageHeader';

export function OutboundDispatchAssignationPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  return (
    <section className="space-y-6">
      <PageHeader
        title="Dispatch Assignment"
        onBack={() => navigate(`/transactions/outbound/${id ?? ''}`)}
      />
    </section>
  );
}
