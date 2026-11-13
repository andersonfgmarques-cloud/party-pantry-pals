import React from 'react';
import ReactDOM from 'react-dom/client';
import { DemoApp } from './demo-app';
import './styles.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode><DemoApp /></React.StrictMode>,
);
