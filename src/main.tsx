import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AdminPanel from './pages/AdminPanel.tsx';
import StartTrial from './pages/StartTrial.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { AuthProvider } from './lib/AuthContext.tsx';
import './index.css';

const path = window.location.pathname;
const isAdminRoute = path.startsWith('/adminpanel');
const isTrialRoute = path.startsWith('/start-trial') || path.startsWith('/trial');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isTrialRoute ? (
        <StartTrial />
      ) : (
        <AuthProvider>
          {isAdminRoute ? <AdminPanel /> : <App />}
        </AuthProvider>
      )}
    </ErrorBoundary>
  </StrictMode>
);
