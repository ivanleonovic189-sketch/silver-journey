import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import WavesBackground from './components/WavesBackground';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WavesBackground />
    <div className="ep-app-root">
      <App />
    </div>
  </React.StrictMode>
);