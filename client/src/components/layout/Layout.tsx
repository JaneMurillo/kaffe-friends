import { Menu, Plus, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogoMark } from '../ui/Illustrations';
import { PageLoader } from '../ui/States';

const SECTIONS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/todas', label: 'Todas las cafeterías' },
  { to: '/top', label: 'Top cafeterías' },
  { to: '/solo-cafeterias', label: 'Solo cafeterías' },
  { to: '/solo-panaderias', label: 'Solo panaderías' },
  { to: '/pasaporte', label: 'Pasaporte Guadalajara' },
  { to: '/mapa', label: 'Mapa cafetero' },
];

function Brand() {
  return (
    <Link to="/" className="brand">
      <LogoMark className="brand__mark" />
      <span className="brand__text">
        <span className="brand__name">Los Amigos del Kaffe</span>
        <span className="brand__slogan">Un café a la vez</span>
      </span>
    </Link>
  );
}

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Cada vista empieza arriba y cierra el menú móvil.
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="site-header">
        <div className="site-header__top container">
          <Brand />
          <div className="site-header__actions">
            <Link to="/agregar" className="btn btn--primary site-header__add">
              <Plus aria-hidden size={18} />
              <span className="site-header__add-label">Agregar cafetería</span>
            </Link>
            <button
              type="button"
              className="icon-btn site-header__menu"
              aria-expanded={menuOpen}
              aria-controls="navegacion"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
            </button>
          </div>
        </div>
        <nav id="navegacion" className={`site-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Secciones">
          <ul className="site-nav__list container">
            {SECTIONS.map((section) => (
              <li key={section.to}>
                <NavLink to={section.to} end={section.end} className="site-nav__link">
                  {section.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="contenido" className="site-main" tabIndex={-1}>
        <Suspense fallback={<PageLoader />}>
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </Suspense>
      </main>

      <footer className="site-footer">
        <div className="container site-footer__grid">
          <div>
            <p className="site-footer__name">Los Amigos del Kaffe</p>
            <p className="site-footer__slogan">Un café a la vez.</p>
            <p className="site-footer__text">
              Mi guía personal y privada de los mejores lugares de café y panadería de Guadalajara.
            </p>
          </div>
          <nav aria-label="Herramientas">
            <p className="site-footer__heading">Herramientas</p>
            <ul className="site-footer__links">
              <li>
                <Link to="/amigos">Opiniones por amigo</Link>
              </li>
              <li>
                <Link to="/top?ranking=comunitario">Ranking comunitario</Link>
              </li>
              <li>
                <Link to="/respaldos">Respaldos y restauración</Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </>
  );
}
