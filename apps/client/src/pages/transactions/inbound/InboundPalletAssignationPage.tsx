import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../../components/PageHeader';

export function InboundPalletAssignationPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  return (
    <section className="space-y-6">
      <PageHeader
        title="Pallet Assignment"
        onBack={() => navigate(`/transactions/inbound/${id ?? ''}`)}
      />
    </section>
  );
}
