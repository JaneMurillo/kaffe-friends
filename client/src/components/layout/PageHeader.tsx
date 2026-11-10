import type { ReactNode } from 'react';

export function PageHeader({
  kicker,
  title,
  intro,
  children,
}: {
  kicker: string;
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header container">
      <p className="kicker">{kicker}</p>
      <h1 className="page-header__title">{title}</h1>
      {intro && <p className="page-header__intro">{intro}</p>}
      {children}
    </header>
  );
}
