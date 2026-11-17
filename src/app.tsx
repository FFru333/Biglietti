import { useEffect } from 'preact/hooks';
import { useRoute } from './router';
import { requestPersistence } from './db';
import { Home } from './components/Home';
import { TicketView } from './components/TicketView';
import { TicketForm } from './components/TicketForm';
import { Settings } from './components/Settings';

export function App() {
  const route = useRoute();
  useEffect(() => void requestPersistence(), []);
  switch (route.name) {
    case 'view': return <TicketView key={route.id} id={route.id} />;
    case 'new': return <TicketForm />;
    case 'edit': return <TicketForm id={route.id} />;
    case 'settings': return <Settings />;
    default: return <Home />;
  }
}
