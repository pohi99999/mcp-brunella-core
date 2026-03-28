import { createRoot } from 'react-dom/client';

import { PSalesStandaloneApp } from './App';

import '../dashboard/main.css';
import '../dashboard/styles/theme.css';
import '../dashboard/index.css';

createRoot(document.getElementById('root')!).render(<PSalesStandaloneApp />);
