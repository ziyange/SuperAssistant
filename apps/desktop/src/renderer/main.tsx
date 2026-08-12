/* global document */
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

const root = document.getElementById('super-assistant-root');
if (!root) throw new Error('Missing Super Assistant root.');
createRoot(root).render(<App />);
