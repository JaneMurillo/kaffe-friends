import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Página no encontrada');
  return (
    <div className="container section">
      <EmptyState
        title="Esta taza está vacía"
        message="La página que buscas no existe o el lugar ya fue eliminado."
        action={
          <Link to="/" className="btn btn--primary">
            Volver al inicio
          </Link>
        }
      />
    </div>
  );
}
