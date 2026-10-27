import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/global.css';
import JoinPage from './pages/JoinPage';
import PlayPage from './pages/PlayPage';
import DisplayPage from './pages/DisplayPage';
import AdminPage from './pages/AdminPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<JoinPage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/display" element={<DisplayPage />} />
        <Route path="/display/:code" element={<DisplayPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
