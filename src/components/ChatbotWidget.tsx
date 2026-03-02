// src/components/ChatbotWidget.tsx
// METHOD 1: Using environment variable for API key

import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Loader, AlertTriangle, Info } from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

// ─── Animated SVG Ghost ───────────────────────────────────────────────────────
const GhostSVG: React.FC<{ size?: number }> = ({ size = 64 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ overflow: 'visible' }}
  >
    <defs>
      {/* Soft glow filter */}
      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="softglow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Ghost body gradient — white top, lavender-blue bottom */}
      <radialGradient id="bodyGrad" cx="50%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="60%" stopColor="#e8e4f8" />
        <stop offset="100%" stopColor="#c4b8f0" />
      </radialGradient>

      {/* Iridescent shimmer at hem */}
      <linearGradient id="hemGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stopColor="#a78bfa" stopOpacity="0.7" />
        <stop offset="30%"  stopColor="#818cf8" stopOpacity="0.9" />
        <stop offset="60%"  stopColor="#38bdf8" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.7" />
      </linearGradient>

      {/* Ambient glow behind ghost */}
      <radialGradient id="auraGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stopColor="#8b5cf6" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
      </radialGradient>

      {/* Clip path so hem waves don't draw outside body silhouette */}
      <clipPath id="bodyClip">
        <ellipse cx="50" cy="45" rx="34" ry="40" />
      </clipPath>
    </defs>

    {/* ── Ambient aura pulse ── */}
    <ellipse cx="50" cy="75" rx="38" ry="10" fill="url(#auraGrad)">
      <animate attributeName="rx" values="38;44;38" dur="3s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
    </ellipse>

    {/* ── Main ghost group — floats up/down ── */}
    <g>
      <animateTransform
        attributeName="transform"
        type="translate"
        values="0,0; 0,-9; 0,0"
        dur="3.2s"
        repeatCount="indefinite"
        calcMode="spline"
        keySplines="0.45 0.05 0.55 0.95; 0.45 0.05 0.55 0.95"
      />

      {/* ── Flowing cloth hem (animated wavy bottom) ── */}
      {/*
        The hem is an SVG <path> whose d attribute is animated between
        three different wave shapes, creating a rippling fabric effect.
        Each "lobe" of the bottom hem independently oscillates.
      */}
      <path filter="url(#glow)">
        {/* Wave shape 1 → 2 → 3 → 1 */}
        <animate
          attributeName="d"
          dur="2.1s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1"
          values="
            M16,60 C16,20 84,20 84,60 C84,60 78,72 72,65 C66,58 62,78 56,72 C50,66 46,78 40,72 C34,66 30,58 24,65 C18,72 16,60 16,60 Z;
            M16,60 C16,20 84,20 84,60 C84,60 80,70 74,64 C68,58 63,76 57,70 C51,64 47,76 41,70 C35,64 29,60 23,67 C17,74 16,60 16,60 Z;
            M16,60 C16,20 84,20 84,60 C84,60 77,74 71,67 C65,60 61,80 55,73 C49,66 45,80 39,73 C33,66 31,57 25,64 C19,71 16,60 16,60 Z;
            M16,60 C16,20 84,20 84,60 C84,60 78,72 72,65 C66,58 62,78 56,72 C50,66 46,78 40,72 C34,66 30,58 24,65 C18,72 16,60 16,60 Z
          "
        />
        <animate attributeName="fill" values="url(#bodyGrad);url(#bodyGrad)" dur="1s" repeatCount="indefinite" />
        {/* fill set via attribute below */}
      </path>

      {/* Ghost body — static shape, layered over hem */}
      <path
        d="M16,60 C16,20 84,20 84,60 L84,55 C84,20 16,20 16,55 Z"
        fill="url(#bodyGrad)"
        filter="url(#glow)"
      />

      {/* Actual cleaner body: dome + straight sides down to ~y=65 */}
      <path
        d="M16,62 C16,22 84,22 84,62 L84,62 C84,62 78,62 78,62 L78,62 C78,62 78,62 78,62"
        fill="url(#bodyGrad)"
      />

      {/* Solid ghost body silhouette */}
      <ellipse cx="50" cy="42" rx="34" ry="36" fill="url(#bodyGrad)" filter="url(#glow)" />

      {/* ── Cloth hem with wave animation ── */}
      <g filter="url(#glow)">
        {/* Back layer of hem (slightly darker) */}
        <path fill="#d4c8f5" opacity="0.6">
          <animate
            attributeName="d"
            dur="2.5s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1"
            values="
              M16,68 C20,62 26,74 32,67 C38,60 44,74 50,68 C56,62 62,74 68,67 C74,60 80,68 84,68 L84,72 C80,72 74,64 68,71 C62,78 56,66 50,72 C44,78 38,66 32,71 C26,76 20,68 16,72 Z;
              M16,68 C20,64 26,76 32,69 C38,62 44,76 50,70 C56,64 62,76 68,69 C74,62 80,70 84,68 L84,72 C80,74 74,62 68,69 C62,76 56,64 50,70 C44,76 38,64 32,69 C26,74 20,66 16,72 Z;
              M16,68 C20,62 26,74 32,67 C38,60 44,74 50,68 C56,62 62,74 68,67 C74,60 80,68 84,68 L84,72 C80,72 74,64 68,71 C62,78 56,66 50,72 C44,78 38,66 32,71 C26,76 20,68 16,72 Z
            "
          />
        </path>

        {/* Front hem with iridescent shimmer */}
        <path fill="url(#hemGrad)" opacity="0.85">
          <animate
            attributeName="d"
            dur="1.8s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1"
            values="
              M16,70 C21,63 27,77 33,70 C39,63 45,77 50,71 C55,65 61,77 67,70 C73,63 79,71 84,70 L84,75 C79,75 73,67 67,74 C61,81 55,69 50,75 C45,81 39,69 33,74 C27,79 21,71 16,75 Z;
              M16,70 C21,65 27,79 33,72 C39,65 45,79 50,73 C55,67 61,79 67,72 C73,65 79,73 84,70 L84,75 C79,77 73,65 67,72 C61,79 55,67 50,73 C45,79 39,67 33,72 C27,77 21,69 16,75 Z;
              M16,70 C21,63 27,77 33,70 C39,63 45,77 50,71 C55,65 61,77 67,70 C73,63 79,71 84,70 L84,75 C79,75 73,67 67,74 C61,81 55,69 50,75 C45,81 39,69 33,74 C27,79 21,71 16,75 Z
            "
          />
        </path>
      </g>

      {/* ── Arms ── */}
      {/* Left arm */}
      <ellipse cx="18" cy="52" rx="8" ry="5" fill="url(#bodyGrad)" transform="rotate(-30 18 52)">
        <animateTransform attributeName="transform" type="rotate"
          values="-30 18 52; -20 18 52; -30 18 52" dur="3.2s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.45 0.05 0.55 0.95; 0.45 0.05 0.55 0.95" />
      </ellipse>
      {/* Right arm */}
      <ellipse cx="82" cy="52" rx="8" ry="5" fill="url(#bodyGrad)" transform="rotate(30 82 52)">
        <animateTransform attributeName="transform" type="rotate"
          values="30 82 52; 20 82 52; 30 82 52" dur="3.2s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.45 0.05 0.55 0.95; 0.45 0.05 0.55 0.95" />
      </ellipse>

      {/* ── Eyes ── */}
      {/* Left eye */}
      <ellipse cx="39" cy="38" rx="7" ry="8" fill="#1a0a2e" filter="url(#softglow)">
        <animate attributeName="ry" values="8;1;8" dur="4s" begin="1s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.5 0 0.5 1; 0.5 0 0.5 1" />
      </ellipse>
      {/* Left eye highlight */}
      <ellipse cx="41" cy="35" rx="2" ry="2.5" fill="white" opacity="0.7" />

      {/* Right eye */}
      <ellipse cx="61" cy="38" rx="7" ry="8" fill="#1a0a2e" filter="url(#softglow)">
        <animate attributeName="ry" values="8;1;8" dur="4s" begin="1s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.5 0 0.5 1; 0.5 0 0.5 1" />
      </ellipse>
      {/* Right eye highlight */}
      <ellipse cx="63" cy="35" rx="2" ry="2.5" fill="white" opacity="0.7" />

      {/* ── Mouth (O shape) ── */}
      <ellipse cx="50" cy="54" rx="5" ry="6" fill="#1a0a2e" opacity="0.85" />
      <ellipse cx="50" cy="54" rx="3.5" ry="4.5" fill="#3b1d6e" opacity="0.6" />
    </g>
  </svg>
);

// ─── Main Widget ──────────────────────────────────────────────────────────────
const ChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const MODEL = 'gemini-2.5-flash';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === '' || isLoading) return;

    if (!API_KEY) {
      setErrorDetails(`API Key Missing!\n\nPlease create a .env file in your project root with:\nVITE_GEMINI_API_KEY=your_api_key_here\n\nThen restart your development server.`);
      setMessages((prev) => [...prev, {
        sender: 'ai',
        text: `❌ API key not configured. Please check .env file.`
      }]);
      return;
    }

    const userMessageText = inputMessage.trim();
    setMessages((prev) => [...prev, { sender: 'user', text: userMessageText }]);
    setInputMessage('');
    setIsLoading(true);
    setErrorDetails('');

    try {
      const tutorPrompt = `You are an AI tutor designed to help students learn.\nYour primary goal is to guide students to find answers themselves, not to give direct solutions.\nWhen a student asks a question, provide hints, ask guiding questions, or suggest resources.\nDo NOT provide the direct answer to a problem or question.\nIf a student asks for a direct answer, politely redirect them to think through the problem or provide a hint.\n\nStudent's question: "${userMessageText}"\n\nRespond as a helpful tutor who guides rather than tells.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: tutorPrompt }] }] })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error (${response.status})`);
      }

      const data = await response.json();
      if (!data.candidates?.[0]?.content) throw new Error('Invalid response structure from Gemini API');

      const aiText = data.candidates[0].content.parts[0].text;
      setMessages((prev) => [...prev, { sender: 'ai', text: aiText }]);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorDetails(`Error: ${errorMsg}\n\nPossible causes:\n1. CORS blocking (browser security restriction)\n2. Network connectivity issue\n3. API key problem\n4. Rate limiting\n\nCheck the browser console (F12) for more details.\n\nIf CORS error: This means your browser is blocking direct API calls. \nYou'll need to use Method 2 (with Edge Function) instead.`);
      setMessages((prev) => [...prev, { sender: 'ai', text: `❌ ${errorMsg}\n\nClick the info icon for details.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) handleSendMessage();
  };

  return (
    <>
      <style>{`
        @keyframes btn-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.5), 0 8px 32px rgba(0,0,0,0.35); }
          50%       { box-shadow: 0 0 0 10px rgba(139,92,246,0), 0 12px 40px rgba(0,0,0,0.4); }
        }
        .ghost-btn {
          animation: btn-pulse 3s ease-in-out infinite;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .ghost-btn:hover {
          animation: none;
          transform: scale(1.12);
          box-shadow: 0 0 0 12px rgba(139,92,246,0.15), 0 16px 48px rgba(0,0,0,0.5);
        }
      `}</style>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Info className="text-blue-500" size={20} />
                About AI Tutor
              </h3>
              <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3 text-sm text-gray-300">
              <p>AI Tutor powered by Google Gemini 2.5 Flash!</p>
              <div className="bg-gray-700 p-3 rounded space-y-2">
                <p className="font-medium text-white mb-2">✨ Features:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Powered by Gemini 2.5 Flash</li>
                  <li>Guides you to find answers yourself</li>
                  <li>Perfect for homework help & studying</li>
                  <li>Secure API key from .env</li>
                </ul>
              </div>
              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 p-2 rounded text-xs">
                <p className="text-blue-300">💡 <strong>Tip:</strong> Ask questions like "How do I..." or "Can you help me understand..." for best results!</p>
              </div>
              {!API_KEY && (
                <div className="bg-red-900 bg-opacity-30 border border-red-700 p-2 rounded text-xs">
                  <p className="text-red-300">⚠️ <strong>Warning:</strong> API key not found. Add VITE_GEMINI_API_KEY to .env file.</p>
                </div>
              )}
              <button onClick={() => setShowInfo(false)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors">
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={20} />
                Error Details
              </h3>
              <button onClick={() => setErrorDetails('')} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4">
              <pre className="text-xs text-red-400 bg-gray-900 p-4 rounded whitespace-pre-wrap">{errorDetails}</pre>
              <button onClick={() => setErrorDetails('')} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ghost Toggle Button ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ghost-btn fixed bottom-4 right-4 w-16 h-16 rounded-full z-40 flex items-center justify-center bg-transparent border-0 p-0"
        style={{ background: 'none' }}
        aria-label={isOpen ? 'Close chatbot' : 'Open chatbot'}
      >
        {isOpen ? (
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-xl">
            <X size={28} className="text-white" />
          </div>
        ) : (
          <GhostSVG size={72} />
        )}
      </button>

      {/* ── Chat Window ── */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 w-96 h-[32rem] bg-gray-800 rounded-2xl shadow-2xl flex flex-col z-40 border border-gray-700">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl">🎓</div>
              <div>
                <h3 className="text-white font-semibold">AI Tutor</h3>
                <p className="text-xs text-blue-100">Gemini 2.5 Flash</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowInfo(true)} className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded transition-colors" aria-label="Info">
                <Info size={18} />
              </button>
              <button onClick={() => setIsOpen(false)} className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded transition-colors" aria-label="Close">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-900">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-8 space-y-4">
                <div className="text-5xl">👋</div>
                <div>
                  <p className="text-white font-medium mb-2">Welcome to AI Tutor!</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    I'm here to help you learn by guiding you to find answers yourself. Ask me any question about your studies!
                  </p>
                </div>
                <div className="text-xs bg-gray-800 border border-gray-700 p-3 rounded-lg text-left space-y-2">
                  <p className="font-medium text-white">💡 Try asking:</p>
                  <ul className="space-y-1 text-gray-400">
                    <li>• "How do I solve quadratic equations?"</li>
                    <li>• "Help me understand photosynthesis"</li>
                    <li>• "What's the best way to write an essay?"</li>
                    <li>• "Can you explain Newton's laws?"</li>
                  </ul>
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-gray-800 text-gray-200 border border-gray-700'
                } whitespace-pre-wrap break-words text-sm shadow-lg`}>
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="p-3 rounded-2xl bg-gray-800 border border-gray-700 flex items-center gap-2 shadow-lg">
                  <Loader size={16} className="animate-spin text-blue-500" />
                  <span className="text-sm text-gray-200">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-gray-800 border-t border-gray-700 rounded-b-2xl">
            <div className="flex items-center gap-2 bg-gray-900 rounded-full p-2 border border-gray-700">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 bg-transparent text-white px-3 py-1 focus:outline-none text-sm placeholder-gray-500"
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2 rounded-full hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                disabled={isLoading}
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
