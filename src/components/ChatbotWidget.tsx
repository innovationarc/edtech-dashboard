// src/components/ChatbotWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Send, X, AlertTriangle, Info, Sparkles, Zap } from 'lucide-react';
import GhostIcon from './ui/GhostIcon';
import { useDashboard } from '../contexts/DashboardContext';
import { novaRAGService } from '../services/novaRAGService';

interface ChatbotWidgetProps { eyeOffset?: { x: number; y: number }; }
interface ChatMessage { sender: 'user' | 'ai'; text: string; timestamp: Date; }

const TypingIndicator = () => (
  <div className="nova-typing-indicator">
    <span /><span /><span />
  </div>
);

const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({ eyeOffset }) => {
  const { accentColor, user, siteName } = useDashboard();

  // ── DIAGNOSTIC LOGS — remove after confirming fix ──────────────────────────
  console.log('[ChatbotWidget] RENDER — user:', user?.uid ?? 'null', '| role:', user?.role ?? 'null');
  // ──────────────────────────────────────────────────────────────────────────

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlying = useRef(false);
  // Unique session ID for this widget open — persists across messages, resets on page reload
  const sessionId = useRef<string>(
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );

  // ── DIAGNOSTIC: mount / unmount tracking ──────────────────────────────────
  useEffect(() => {
    console.log('[ChatbotWidget] MOUNTED — uid:', user?.uid ?? 'null', '| role:', user?.role ?? 'null');
    return () => {
      console.log('[ChatbotWidget] UNMOUNTED — this means the widget tree was torn down');
    };
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 10);
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const close = () => { isFlying.current = true; setIsOpen(false); };
    const land = () => { isFlying.current = false; };
    window.addEventListener('ghost-close-chat', close);
    window.addEventListener('ghost-land', land);
    return () => {
      window.removeEventListener('ghost-close-chat', close);
      window.removeEventListener('ghost-land', land);
    };
  }, []);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === '' || isLoading) return;
    const userMessageText = inputMessage.trim();
    setMessages(p => [...p, { sender: 'user', text: userMessageText, timestamp: new Date() }]);
    setInputMessage('');
    setIsLoading(true);
    setErrorDetails('');
    try {
      // Full RAG pipeline:
      //   • embedText uses 'vector' key group (Gemini)
      //   • callWithFailover uses 'chatbot' key group (Groq)
      //   • memory + context docs injected into prompt automatically
      const response = await novaRAGService.sendMessage(
        userMessageText,
        user ?? null,
        sessionId.current,
        siteName
      );
      setMessages(p => [...p, { sender: 'ai', text: response.text, timestamp: new Date() }]);
      // Navigation: dispatch custom event → DashboardLayout handles useNavigate
      if (response.navigateTo) {
        console.log('[ChatbotWidget] NAVIGATE dispatching — path:', response.navigateTo);
        window.dispatchEvent(
          new CustomEvent('nova-navigate', { detail: { path: response.navigateTo } })
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorDetails(`Error: ${errorMsg}\n\nPossible causes:\n1. No AI key configured (Admin → AI Model Settings → 'chatbot' group)\n2. No vector key configured (Admin → AI Model Settings → 'vector' group)\n3. CORS blocking\n4. Network issue\n5. Rate limit exceeded — failover exhausted`);
      setMessages(p => [...p, { sender: 'ai', text: `Something went wrong. Tap the info icon for details.`, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGhostTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      window.dispatchEvent(new CustomEvent('ghost-fly'));
    } else {
      tapTimer.current = setTimeout(() => {
        if (tapCount.current === 1 && !isFlying.current) setIsOpen(prev => !prev);
        tapCount.current = 0;
      }, 200);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) handleSendMessage();
  };

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const accent = accentColor || '#6366f1';
  const panelBottom = 104;

  const portalContent = (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap');

        :root {
          --nova-accent: ${accent};
          --nova-accent-dim: ${accent}22;
          --nova-accent-mid: ${accent}66;
          --nova-bg: #0f1117;
          --nova-surface: #171923;
          --nova-surface2: #1e2333;
          --nova-border: rgba(255,255,255,0.07);
          --nova-text: #e2e8f0;
          --nova-muted: #64748b;
          --nova-radius: 20px;
          --nova-nav-h: 0px;
        }

        .nova-widget * { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; box-sizing: border-box; }

        /* Ghost button */
        @keyframes nova-pulse {
          0%,100% { filter: drop-shadow(0 0 10px var(--nova-accent-mid)) drop-shadow(0 6px 20px rgba(0,0,0,0.4)); }
          50%      { filter: drop-shadow(0 0 22px var(--nova-accent)) drop-shadow(0 10px 28px rgba(0,0,0,0.5)); }
        }
        .nova-ghost-btn {
          animation: nova-pulse 3.4s ease-in-out infinite;
          transition: transform 0.2s cubic-bezier(.34,1.56,.64,1);
          background: none !important; border: none !important; padding: 0 !important;
          cursor: pointer; display: block;
          width: 72px; height: 72px;
        }
        .nova-ghost-btn:hover {
          animation: none; transform: scale(1.12);
          filter: drop-shadow(0 0 28px var(--nova-accent)) drop-shadow(0 12px 32px rgba(0,0,0,0.55));
        }

        /* Chat panel — fixed to viewport, NOT relative to transformed parent */
        .nova-panel {
          position: fixed; z-index: 49;
          right: 20px;
          width: min(420px, calc(100vw - 24px));
          height: min(580px, calc(100dvh - var(--nova-nav-h) - 110px));
          display: flex; flex-direction: column;
          background: var(--nova-bg);
          border: 1px solid var(--nova-border);
          border-radius: var(--nova-radius);
          box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
          overflow: hidden;
          transform-origin: bottom right;
          transition: opacity 0.25s ease, transform 0.3s cubic-bezier(.34,1.3,.64,1);
        }
        .nova-panel.entering { opacity: 1; transform: scale(1) translateY(0); }
        .nova-panel.exiting  { opacity: 0; transform: scale(0.92) translateY(12px); pointer-events: none; }

        /* Header */
        .nova-header {
          flex-shrink: 0;
          padding: 16px 18px;
          background: var(--nova-surface);
          border-bottom: 1px solid var(--nova-border);
          display: flex; align-items: center; gap: 12px;
        }
        .nova-avatar {
          width: 40px; height: 40px; border-radius: 12px;
          background: linear-gradient(135deg, var(--nova-accent), var(--nova-accent)88);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px var(--nova-accent-mid), inset 0 1px 0 rgba(255,255,255,0.15);
          flex-shrink: 0;
        }
        .nova-status-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px #22c55e88;
          animation: nova-status-pulse 2s ease-in-out infinite;
        }
        @keyframes nova-status-pulse {
          0%,100% { opacity: 1; } 50% { opacity: 0.5; }
        }
        .nova-header-actions { margin-left: auto; display: flex; gap: 4px; }
        .nova-icon-btn {
          width: 32px; height: 32px; border-radius: 8px;
          background: transparent; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--nova-muted); transition: all 0.15s ease;
        }
        .nova-icon-btn:hover { background: rgba(255,255,255,0.08); color: var(--nova-text); }

        /* Messages */
        .nova-messages {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 14px;
          scroll-behavior: smooth;
        }
        .nova-messages::-webkit-scrollbar { width: 4px; }
        .nova-messages::-webkit-scrollbar-track { background: transparent; }
        .nova-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        /* Empty state */
        .nova-empty {
          margin: auto; text-align: center; padding: 24px 16px;
          display: flex; flex-direction: column; align-items: center; gap: 16px;
        }
        .nova-empty-icon {
          width: 56px; height: 56px; border-radius: 16px;
          background: var(--nova-accent-dim);
          border: 1px solid var(--nova-accent-mid);
          display: flex; align-items: center; justify-content: center;
          color: var(--nova-accent);
        }
        .nova-chips {
          display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
          margin-top: 4px;
        }
        .nova-chip {
          padding: 6px 12px; border-radius: 20px;
          background: var(--nova-surface2); border: 1px solid var(--nova-border);
          color: var(--nova-muted); font-size: 12px; cursor: pointer;
          transition: all 0.15s ease; white-space: nowrap;
        }
        .nova-chip:hover { background: var(--nova-accent-dim); border-color: var(--nova-accent-mid); color: var(--nova-text); }

        /* Message bubbles */
        .nova-msg-row { display: flex; gap: 8px; align-items: flex-end; }
        .nova-msg-row.user { flex-direction: row-reverse; }
        .nova-bubble {
          max-width: 78%; padding: 10px 14px; border-radius: 16px;
          font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-word;
        }
        .nova-bubble.ai {
          background: var(--nova-surface2);
          border: 1px solid var(--nova-border);
          color: var(--nova-text);
          border-bottom-left-radius: 4px;
        }
        .nova-bubble.user {
          background: var(--nova-accent);
          color: #fff;
          border-bottom-right-radius: 4px;
          box-shadow: 0 4px 16px var(--nova-accent-mid);
        }
        .nova-timestamp {
          font-size: 10px; color: var(--nova-muted);
          padding: 0 4px; margin-top: 2px; align-self: flex-end;
        }
        .nova-mini-avatar {
          width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
          background: linear-gradient(135deg, var(--nova-accent), var(--nova-accent)88);
          display: flex; align-items: center; justify-content: center;
        }

        /* Typing */
        .nova-typing-indicator {
          display: flex; gap: 4px; align-items: center; padding: 12px 16px;
        }
        .nova-typing-indicator span {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--nova-muted); display: block;
          animation: nova-bounce 1.2s ease-in-out infinite;
        }
        .nova-typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
        .nova-typing-indicator span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes nova-bounce {
          0%,60%,100% { transform: translateY(0); opacity: 0.4; }
          30%          { transform: translateY(-5px); opacity: 1; }
        }

        /* Input area */
        .nova-input-area {
          flex-shrink: 0; padding: 12px 16px;
          background: var(--nova-surface);
          border-top: 1px solid var(--nova-border);
        }
        .nova-input-row {
          display: flex; align-items: center; gap: 10px;
          background: var(--nova-surface2);
          border: 1px solid var(--nova-border);
          border-radius: 14px; padding: 6px 6px 6px 14px;
          transition: border-color 0.2s ease;
        }
        .nova-input-row:focus-within { border-color: var(--nova-accent-mid); }
        .nova-input {
          flex: 1; background: transparent; border: none; outline: none;
          color: var(--nova-text); font-size: 13.5px; font-family: inherit;
          padding: 5px 0;
        }
        .nova-input::placeholder { color: var(--nova-muted); }
        .nova-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .nova-send-btn {
          width: 36px; height: 36px; border-radius: 10px; border: none; cursor: pointer;
          background: var(--nova-accent); color: #fff; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s cubic-bezier(.34,1.56,.64,1);
          box-shadow: 0 2px 10px var(--nova-accent-mid);
        }
        .nova-send-btn:hover:not(:disabled) { transform: scale(1.08); box-shadow: 0 4px 16px var(--nova-accent-mid); }
        .nova-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .nova-footer-hint { font-size: 10.5px; color: var(--nova-muted); text-align: center; margin-top: 8px; }

        /* Modal */
        .nova-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.75);
          display: flex; align-items: center; justify-content: center;
          z-index: 50; padding: 16px; backdrop-filter: blur(4px);
          animation: nova-fade-in 0.15s ease;
        }
        @keyframes nova-fade-in { from { opacity:0 } to { opacity:1 } }
        .nova-modal {
          background: var(--nova-surface); border: 1px solid var(--nova-border);
          border-radius: 18px; width: min(440px, 100%);
          box-shadow: 0 24px 64px rgba(0,0,0,0.6);
          overflow: hidden;
          animation: nova-modal-in 0.2s cubic-bezier(.34,1.3,.64,1);
        }
        @keyframes nova-modal-in { from { opacity:0; transform:scale(0.94) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }
        .nova-modal-header {
          padding: 16px 20px; border-bottom: 1px solid var(--nova-border);
          display: flex; align-items: center; justify-content: space-between;
        }
        .nova-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .nova-card {
          background: var(--nova-surface2); border: 1px solid var(--nova-border);
          border-radius: 12px; padding: 12px 14px;
          font-size: 13px; color: var(--nova-muted); line-height: 1.6;
        }
        .nova-card strong { color: var(--nova-text); }
        .nova-primary-btn {
          width: 100%; padding: 11px; border-radius: 11px; border: none; cursor: pointer;
          background: var(--nova-accent); color: #fff; font-size: 14px; font-weight: 500;
          font-family: inherit; transition: opacity 0.15s;
        }
        .nova-primary-btn:hover { opacity: 0.88; }

        /* Mobile adjustments */
        @media (max-width: 480px) {
          .nova-panel { right: 12px; left: 12px; width: auto; border-radius: 18px; }
          .nova-ghost-btn { right: 16px; }
        }
        @media (max-height: 600px) {
          .nova-panel { height: calc(100dvh - 110px); }
        }
      `}</style>

      {/* Info Modal */}
      {showInfo && (
        <div className="nova-modal-overlay nova-widget" onClick={() => setShowInfo(false)}>
          <div className="nova-modal" onClick={e => e.stopPropagation()}>
            <div className="nova-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} style={{ color: accent }} />
                <span style={{ color: 'var(--nova-text)', fontWeight: 600, fontSize: 15 }}>About Nova</span>
              </div>
              <button className="nova-icon-btn" onClick={() => setShowInfo(false)}><X size={18} /></button>
            </div>
            <div className="nova-modal-body">
              <p style={{ fontSize: 13, color: 'var(--nova-muted)', lineHeight: 1.6 }}>
                Nova is your AI assistant — here to help with platform questions, studies, scheduling, and anything else you need.
              </p>
              <div className="nova-card">
                <strong>✦ Capabilities</strong>
                <ul style={{ marginTop: 6, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>Platform navigation & feature help</li>
                  <li>Study guidance & concept explanations</li>
                  <li>Assignment and schedule queries</li>
                  <li>Powered by Admin → AI Model Settings</li>
                </ul>
              </div>
              <div className="nova-card" style={{ borderColor: `${accent}44`, background: `${accent}0d` }}>
                <strong style={{ color: accent }}>💡 Tip</strong>
                <p style={{ marginTop: 4 }}>Be specific in your questions for the most accurate answers.</p>
              </div>
              <button className="nova-primary-btn" onClick={() => setShowInfo(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorDetails && (
        <div className="nova-modal-overlay nova-widget" onClick={() => setErrorDetails('')}>
          <div className="nova-modal" onClick={e => e.stopPropagation()}>
            <div className="nova-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} style={{ color: '#f87171' }} />
                <span style={{ color: 'var(--nova-text)', fontWeight: 600, fontSize: 15 }}>Error Details</span>
              </div>
              <button className="nova-icon-btn" onClick={() => setErrorDetails('')}><X size={18} /></button>
            </div>
            <div className="nova-modal-body">
              <pre style={{ fontSize: 12, color: '#f87171', background: 'var(--nova-surface2)', padding: '12px 14px', borderRadius: 10, whiteSpace: 'pre-wrap', overflowX: 'auto', fontFamily: 'ui-monospace, monospace', lineHeight: 1.6, border: '1px solid var(--nova-border)' }}>{errorDetails}</pre>
              <button className="nova-primary-btn" onClick={() => setErrorDetails('')}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className={`nova-panel nova-widget ${isVisible ? 'entering' : 'exiting'}`} style={{ bottom: panelBottom }} role="dialog" aria-label="Nova assistant">
          {/* Header */}
          <div className="nova-header">
            <div className="nova-avatar">
              <Zap size={20} color="#fff" strokeWidth={2.5} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ color: 'var(--nova-text)', fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.01em' }}>Nova</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="nova-status-dot" />
                <span style={{ fontSize: 11.5, color: 'var(--nova-muted)' }}>AI Assistant · Online</span>
              </div>
            </div>
            <div className="nova-header-actions">
              <button className="nova-icon-btn" onClick={() => setShowInfo(true)} aria-label="About Nova"><Info size={17} /></button>
              <button className="nova-icon-btn" onClick={() => setIsOpen(false)} aria-label="Close"><X size={17} /></button>
            </div>
          </div>

          {/* Messages */}
          <div className="nova-messages">
            {messages.length === 0 && (
              <div className="nova-empty">
                <div className="nova-empty-icon">
                  <Sparkles size={26} />
                </div>
                <div>
                  <p style={{ color: 'var(--nova-text)', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Hi, I'm Nova ✦</p>
                  <p style={{ color: 'var(--nova-muted)', fontSize: 13, lineHeight: 1.6, maxWidth: 260 }}>Your AI assistant. Ask me anything about the platform, your studies, or anything else.</p>
                </div>
                <div className="nova-chips">
                  {['How do I submit an exam?', 'Explain my schedule', 'Help with my studies', 'Platform features'].map(q => (
                    <button key={q} className="nova-chip" onClick={() => { setInputMessage(q); inputRef.current?.focus(); }}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`nova-msg-row ${msg.sender}`}>
                {msg.sender === 'ai' && (
                  <div className="nova-mini-avatar">
                    <Zap size={13} color="#fff" strokeWidth={2.5} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                  <div className={`nova-bubble ${msg.sender}`}>{msg.text}</div>
                  <span className="nova-timestamp">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="nova-msg-row ai">
                <div className="nova-mini-avatar">
                  <Zap size={13} color="#fff" strokeWidth={2.5} />
                </div>
                <div className="nova-bubble ai" style={{ padding: '4px 6px' }}>
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="nova-input-area">
            <div className="nova-input-row">
              <input
                ref={inputRef}
                type="text"
                className="nova-input"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Nova anything..."
                disabled={isLoading}
                aria-label="Message input"
              />
              <button className="nova-send-btn" onClick={handleSendMessage} disabled={isLoading || !inputMessage.trim()} aria-label="Send">
                <Send size={15} strokeWidth={2.2} />
              </button>
            </div>
            <p className="nova-footer-hint">Nova · AI-Powered Assistant</p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Ghost button — renders as normal flow inside DashboardLayout's transformed wrapper */}
      <button onClick={handleGhostTap} className="nova-ghost-btn nova-widget"
        style={{ ['--ghost-glow-color' as any]: accent + 'a6', ['--ghost-glow-color-full' as any]: accent }}
        aria-label={isOpen ? 'Close Nova' : 'Open Nova'}>
        <GhostIcon size={72} isActive={isOpen} />
      </button>

      {/* Portal: renders modals + chat panel at document.body, escaping the transformed parent */}
      {ReactDOM.createPortal(portalContent, document.body)}
    </>
  );
};

export default ChatbotWidget;
