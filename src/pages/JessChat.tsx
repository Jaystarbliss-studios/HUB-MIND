import React from 'react';
import { useNavigate } from 'react-router-dom';
import { JessChatPanel } from '../components/JessChatPanel';

export default function JessChat() {
  const navigate = useNavigate();
  return <div className="jess-chat-page-shell"><JessChatPanel pageMode onClose={() => navigate('/workspace')} /></div>;
}
