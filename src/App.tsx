import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes';
import { DashboardProvider } from './contexts/DashboardContext';

function App() {
  return (
    <DashboardProvider>
      <Router>
        <AppRoutes />
      </Router>
    </DashboardProvider>
  );
}

export default App;