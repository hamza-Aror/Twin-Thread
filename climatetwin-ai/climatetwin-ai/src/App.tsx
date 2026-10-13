import { I18nProvider } from './i18n';
import { AppStateProvider, useApp } from './hooks/AppState';
import { Shell } from './components/Shell';
import { OverviewPage } from './pages/OverviewPage';
import { OutlookPage } from './pages/OutlookPage';
import { ExplainPage } from './pages/ExplainPage';
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
    case 'explain':
      return <ExplainPage />;
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
      return <OverviewPage />;
  }
}

export default function App() {
  return (
    <I18nProvider>
      <AppStateProvider>
        <Shell>
          <CurrentPage />
        </Shell>
      </AppStateProvider>
    </I18nProvider>
  );
}
