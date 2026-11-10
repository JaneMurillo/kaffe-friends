import { useParams } from 'react-router-dom';
import { EstablishmentForm } from '../components/forms/EstablishmentForm';
import { PageHeader } from '../components/layout/PageHeader';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../services/api';
import { TYPE_NOUNS } from '../utils/format';
import { NotFoundPage } from './NotFoundPage';

function EditForm({ id }: { id: number }) {
  const { data: place, error, reload } = useAsync(() => api.establishment(id), [id]);
  useDocumentTitle(place ? `Editar ${place.name}` : 'Editar');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!place) return <PageLoader />;
  return (
    <>
      <PageHeader kicker={`Editar ${TYPE_NOUNS[place.type]}`} title={place.name} />
      <EstablishmentForm place={place} />
    </>
  );
}

export function FormPage() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  useDocumentTitle(isEdit ? undefined : 'Agregar cafetería');

  if (isEdit) {
    const numericId = Number(id);
    return Number.isInteger(numericId) && numericId > 0 ? <EditForm id={numericId} /> : <NotFoundPage />;
  }
  return (
    <>
      <PageHeader
        kicker="Nuevo registro"
        title="Agregar cafetería"
        intro="Pega su enlace de Google Maps o escribe el nombre. Puedes guardar en cualquier momento y seguir después."
      />
      <EstablishmentForm />
    </>
  );
}
