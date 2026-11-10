import { EstablishmentBrowser, type SectionScope } from '../components/establishments/EstablishmentBrowser';
import { PageHeader } from '../components/layout/PageHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

function BrowsePage({
  kicker,
  title,
  intro,
  scope,
}: {
  kicker: string;
  title: string;
  intro: string;
  scope?: SectionScope;
}) {
  useDocumentTitle(title);
  return (
    <>
      <PageHeader kicker={kicker} title={title} intro={intro} />
      <EstablishmentBrowser scope={scope} />
    </>
  );
}

export const AllPage = () => (
  <BrowsePage
    kicker="El directorio"
    title="Todas las cafeterías"
    intro="Cada lugar de mi guía: cafeterías y panaderías."
  />
);

export const CafesPage = () => (
  <BrowsePage
    kicker="De la taza"
    title="Solo cafeterías"
    intro="Los lugares donde el café es protagonista."
    scope={{ type: 'cafeteria' }}
  />
);

export const BakeriesPage = () => (
  <BrowsePage
    kicker="Del horno"
    title="Solo panaderías"
    intro="Pan recién hecho y olor a mantequilla."
    scope={{ type: 'panaderia' }}
  />
);

