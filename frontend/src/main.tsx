import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout'; // Import Layout
import Agents from './pages/Agents';
import EditAgent from './pages/EditAgent';
import ChatPage from './pages/ChatPage';
import UserList from './pages/UserList'; 
import AgentStats from './pages/AgentStats'; // Import AgentStats
import VoiceModelsPage from './pages/VoiceModelsPage'; // Import VoiceModelsPage
import ApiDocs from './pages/ApiDocs'; // Import ApiDocs
import './index.css';

// Suppress browser extension errors in console
// These errors come from browser extensions (contentScript.bundle.js) and don't affect the app
if (typeof window !== 'undefined') {
  // Filter unhandled promise rejections from browser extensions
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || event.reason?.toString() || '';
    if (errorMessage.includes('contentScript.bundle.js') && 
        errorMessage.includes('Access to storage') &&
        errorMessage.includes('is not allowed from this context')) {
      // Prevent the error from showing in console
      event.preventDefault();
      return;
    }
  });

  // Filter console errors from browser extensions
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const errorMessage = args[0]?.toString() || '';
    if (errorMessage.includes('contentScript.bundle.js') && 
        errorMessage.includes('Access to storage') &&
        errorMessage.includes('is not allowed from this context')) {
      // Silently ignore browser extension errors
      return;
    }
    originalError.apply(console, args);
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Wrap pages that need sidebar in Layout */}
        <Route element={<Layout />}>
        <Route path="/" element={<Agents />} />
          <Route path="/stats" element={<AgentStats />} /> {/* Stats Route */}
          <Route path="/users" element={<UserList />} />
          <Route path="/voice-models" element={<VoiceModelsPage />} />
          <Route path="/api-docs" element={<ApiDocs />} /> {/* API Docs Route */}
        </Route>
        
        {/* Pages that might not need sidebar or are distinct */}
        <Route path="/create" element={<EditAgent />} />
        <Route path="/edit/:id" element={<EditAgent />} />
        <Route path="/chat/:id" element={<ChatPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
