// src/components/ChatbotWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Loader, AlertTriangle, Info } from 'lucide-react';
import GhostIcon from './ui/GhostIcon';
import { useDashboard } from '../contexts/DashboardContext';
import { callWithFailover } from '../services/aiModelConfigService';

interface ChatbotWidgetProps { eyeOffset?: { x: number; y: number }; }
interface ChatMessage { sender: 'user' | 'ai'; text: string; }

const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({ eyeOffset }) => {
  const { accentColor } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // API key & model now managed by Admin → AI Model Settings (Key Groups / Legacy Config)
  // Falls back to VITE_GEMINI_API_KEY via aiModelConfigService if no group assigned
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);
  const isFlying = useRef(false);
  useEffect(() => {
    const close = () => { isFlying.current = true; setIsOpen(false); };
    const land  = () => { isFlying.current = false; };
    window.addEventListener('ghost-close-chat', close);
    window.addEventListener('ghost-land',       land);
    return () => {
      window.removeEventListener('ghost-close-chat', close);
      window.removeEventListener('ghost-land',       land);
    };
  }, []);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === '' || isLoading) return;
    const userMessageText = inputMessage.trim();
    setMessages(p => [...p, { sender: 'user', text: userMessageText }]);
    setInputMessage(''); setIsLoading(true); setErrorDetails('');
    try {
      const tutorPrompt = `You are an AI tutor designed to help students learn.\nYour primary goal is to guide students to find answers themselves, not to give direct solutions.\nWhen a student asks a question, provide hints, ask guiding questions, or suggest resources.\nDo NOT provide the direct answer to a problem or question.\nIf a student asks for a direct answer, politely redirect them to think through the problem or provide a hint.\n\nStudent's question: "${userMessageText}"\n\nRespond as a helpful tutor who guides rather than tells.`;
      // Uses Admin → AI Model Settings: Key Group assigned to "chatbot" feature, or falls back to Legacy Config / VITE_GEMINI_API_KEY
      const text = await callWithFailover(tutorPrompt, 'chatbot', 1024, 0.7);
      setMessages(p => [...p, { sender: 'ai', text }]);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorDetails(`Error: ${errorMsg}\n\nPossible causes:\n1. No AI key configured (Admin → AI Model Settings)\n2. CORS blocking\n3. Network issue\n4. Rate limit exceeded — failover exhausted`);
      setMessages(p => [...p, { sender: 'ai', text: `❌ ${errorMsg}\n\nClick the info icon for details.` }]);
    } finally { setIsLoading(false); }
  };

  const handleGhostTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      window.dispatchEvent(new CustomEvent('ghost-fly'));
    } else {
      tapTimer.current = setTimeout(() => {
        if (tapCount.current === 1 && !isFlying.current) {
          setIsOpen(prev => !prev);
        }
        tapCount.current = 0;
      }, 200);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && !isLoading) handleSendMessage(); };

  return (
    <>
      <style>{`
        @keyframes ghost-halo {
          0%,100% { filter: drop-shadow(0 0 10px var(--ghost-glow-color, rgba(167,139,250,0.65))) drop-shadow(0 6px 20px rgba(0,0,0,0.4)); }
          50%      { filter: drop-shadow(0 0 24px var(--ghost-glow-color-full, rgba(167,139,250,1))) drop-shadow(0 10px 28px rgba(0,0,0,0.5)); }
        }
        .ghost-btn { animation: ghost-halo 3.4s ease-in-out infinite; transition: transform 0.2s ease; background: none !important; border: none !important; padding: 0 !important; cursor: pointer; }
        .ghost-btn:hover { animation: none; transform: scale(1.1); filter: drop-shadow(0 0 28px var(--ghost-glow-color-full, rgba(167,139,250,1))) drop-shadow(0 12px 32px rgba(0,0,0,0.55)); }
      `}</style>

      {showInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2"><Info className="text-blue-500" size={20}/>About AI Tutor</h3>
              <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-4 space-y-3 text-sm text-gray-300">
              <p>AI Tutor powered by your configured AI provider (Admin → AI Model Settings).</p>
              <div className="bg-gray-700 p-3 rounded"><p className="font-medium text-white mb-2">✨ Features:</p><ul className="list-disc list-inside space-y-1 text-xs"><li>Provider set in Admin → AI Model Settings</li><li>Guides you to find answers yourself</li><li>Perfect for homework help & studying</li><li>Automatic failover across key groups</li></ul></div>
              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 p-2 rounded text-xs"><p className="text-blue-300">💡 <strong>Tip:</strong> Ask questions like "How do I..." for best results!</p></div>
              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 p-2 rounded text-xs"><p className="text-blue-300">💡 Configure your AI keys in <strong>Admin → AI Model Settings</strong>.</p></div>
              <button onClick={() => setShowInfo(false)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors">Got it!</button>
            </div>
          </div>
        </div>
      )}

      {errorDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2"><AlertTriangle className="text-red-500" size={20}/>Error Details</h3>
              <button onClick={() => setErrorDetails('')} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-4">
              <pre className="text-xs text-red-400 bg-gray-900 p-4 rounded whitespace-pre-wrap">{errorDetails}</pre>
              <button onClick={() => setErrorDetails('')} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={handleGhostTap} className="ghost-btn fixed bottom-4 right-4 z-40" style={{ width: 72, height: 72, ['--ghost-glow-color' as any]: accentColor + 'a6', ['--ghost-glow-color-full' as any]: accentColor }} aria-label={isOpen ? 'Close chatbot' : 'Open chatbot'}>
        <GhostIcon size={72} isActive={isOpen} />
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-4 w-96 h-[32rem] bg-gray-800 rounded-2xl shadow-2xl flex flex-col z-40 border border-gray-700">
          <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl">🎓</div>
              <div><h3 className="text-white font-semibold">AI Tutor</h3><p className="text-xs text-blue-100">AI-Powered Tutor</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowInfo(true)} className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded transition-colors"><Info size={18}/></button>
              <button onClick={() => setIsOpen(false)} className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded transition-colors"><X size={20}/></button>
            </div>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-900">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-8 space-y-4">
                <div className="text-5xl">👋</div>
                <div><p className="text-white font-medium mb-2">Welcome to AI Tutor!</p><p className="text-xs text-gray-400 leading-relaxed">I'm here to help you learn by guiding you to find answers yourself. Ask me any question about your studies!</p></div>
                <div className="text-xs bg-gray-800 border border-gray-700 p-3 rounded-lg text-left space-y-2">
                  <p className="font-medium text-white">💡 Try asking:</p>
                  <ul className="space-y-1 text-gray-400"><li>• "How do I solve quadratic equations?"</li><li>• "Help me understand photosynthesis"</li><li>• "What's the best way to write an essay?"</li><li>• "Can you explain Newton's laws?"</li></ul>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-gray-800 text-gray-200 border border-gray-700'} whitespace-pre-wrap break-words text-sm shadow-lg`}>{msg.text}</div>
              </div>
            ))}
            {isLoading && <div className="flex justify-start"><div className="p-3 rounded-2xl bg-gray-800 border border-gray-700 flex items-center gap-2 shadow-lg"><Loader size={16} className="animate-spin text-blue-500"/><span className="text-sm text-gray-200">Thinking...</span></div></div>}
            <div ref={messagesEndRef}/>
          </div>
          <div className="p-4 bg-gray-800 border-t border-gray-700 rounded-b-2xl">
            <div className="flex items-center gap-2 bg-gray-900 rounded-full p-2 border border-gray-700">
              <input type="text" value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder="Ask me anything..." className="flex-1 bg-transparent text-white px-3 py-1 focus:outline-none text-sm placeholder-gray-500" disabled={isLoading}/>
              <button onClick={handleSendMessage} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2 rounded-full hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105" disabled={isLoading}><Send size={18}/></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
