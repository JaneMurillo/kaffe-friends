/** Ilustraciones propias de la marca: sustituyen a la fotografía cuando un lugar aún no tiene. */
interface ArtProps {
  className?: string;
}

export function CupIllustration({ className }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 120 110" aria-hidden="true" fill="none">
      <path d="M46 34c-5-7 5-10 0-18M62 34c-5-7 5-10 0-18" stroke="var(--caramel)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M24 44h72v18a36 36 0 0 1-72 0z" fill="currentColor" />
      <path d="M96 50h6a11 11 0 0 1 0 22h-9" stroke="currentColor" strokeWidth="5" />
      <path d="M14 102h92" stroke="var(--caramel)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function BreadIllustration({ className }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 120 110" aria-hidden="true" fill="none">
      <path
        d="M14 62c0-20 20-32 46-32s46 12 46 32c0 7-5 12-10 12v12a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6V74c-5 0-10-5-10-12z"
        fill="currentColor"
      />
      <path d="M42 46l8 16M60 42l8 18M78 46l8 15" stroke="var(--caramel)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/** Logotipo: sello circular con la taza y el vapor. */
export function LogoMark({ className }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="var(--espresso)" />
      <circle cx="32" cy="32" r="27" fill="none" stroke="var(--caramel)" strokeWidth="1" />
      <path d="M18 29h25v8a12.500 12.500 0 0 1-25 0z" fill="var(--cream)" />
      <path d="M43 31h2.500a4.800 4.800 0 0 1 0 9.600H42" fill="none" stroke="var(--cream)" strokeWidth="2.600" />
      <path
        d="M26 23c-2-3 2-4 0-8M34 23c-2-3 2-4 0-8"
        fill="none"
        stroke="var(--caramel)"
        strokeWidth="2.600"
        strokeLinecap="round"
      />
    </svg>
  );
}
