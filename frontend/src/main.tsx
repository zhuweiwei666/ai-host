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
import './index.css';

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
        </Route>
        
        {/* Pages that might not need sidebar or are distinct */}
        <Route path="/create" element={<EditAgent />} />
        <Route path="/edit/:id" element={<EditAgent />} />
        <Route path="/chat/:id" element={<ChatPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
