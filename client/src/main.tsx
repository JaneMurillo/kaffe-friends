import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/figtree';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/forms.css';
import './styles/pages.css';
import './styles/place.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthGate } from './components/layout/AuthGate';
import { FeedbackProvider } from './components/ui/Feedback';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FeedbackProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </FeedbackProvider>
    </BrowserRouter>
  </StrictMode>,
);
