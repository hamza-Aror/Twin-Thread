import { I18nProvider } from './i18n';
import { ThemeProvider } from './theme/ThemeProvider';
import { AppStateProvider, useApp } from './hooks/AppState';
import { Shell } from './components/Shell';
import { DashboardPage } from './pages/DashboardPage';
import { OutlookPage } from './pages/OutlookPage';
import { SafeWindowPage } from './pages/SafeWindowPage';
import { MapPage } from './pages/MapPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { AlertsPage } from './pages/AlertsPage';
import { MethodPage } from './pages/MethodPage';

function CurrentPage() {
  const { route } = useApp();
  switch (route) {
    case 'outlook':
      return <OutlookPage />;
    case 'window':
      return <SafeWindowPage />;
    case 'map':
      return <MapPage />;
    case 'simulator':
      return <SimulatorPage />;
    case 'alerts':
      return <AlertsPage />;
    case 'method':
      return <MethodPage />;
    default:
      return <DashboardPage />;
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AppStateProvider>
          <Shell>
            <CurrentPage />
          </Shell>
        </AppStateProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
