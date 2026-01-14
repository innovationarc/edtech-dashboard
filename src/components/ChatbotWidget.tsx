// src/components/ChatbotWidget.tsx
// METHOD 1: Using environment variable for API key
// Copy this entire file to your Bolt project

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Loader, AlertTriangle, Info } from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

const ChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get API key from environment variable
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  
  // Using Gemini 2.5 Flash (from your working Python code)
  const MODEL = 'gemini-2.5-flash';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === '' || isLoading) return;

    // Check if API key is available
    if (!API_KEY) {
      setErrorDetails(`API Key Missing!

Please create a .env file in your project root with:
VITE_GEMINI_API_KEY=your_api_key_here

Then restart your development server.`);
      setMessages((prev) => [...prev, { 
        sender: 'ai', 
        text: `❌ API key not configured. Please check .env file.` 
      }]);
      return;
    }

    const userMessageText = inputMessage.trim();
    const newMessage: ChatMessage = { sender: 'user', text: userMessageText };
    setMessages((prev) => [...prev, newMessage]);
    setInputMessage('');
    setIsLoading(true);
    setErrorDetails('');

    try {
      // Build the AI tutor prompt
      const tutorPrompt = `You are an AI tutor designed to help students learn.
Your primary goal is to guide students to find answers themselves, not to give direct solutions.
When a student asks a question, provide hints, ask guiding questions, or suggest resources.
Do NOT provide the direct answer to a problem or question.
If a student asks for a direct answer, politely redirect them to think through the problem or provide a hint.

Student's question: "${userMessageText}"

Respond as a helpful tutor who guides rather than tells.`;

      console.log('🤖 Sending to Gemini API...');

      // Use the exact same API call as your working Python code
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: tutorPrompt
              }]
            }]
          })
        }
      );

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.error?.message || `API Error (${response.status})`);
      }

      const data = await response.json();
      console.log('✅ Response received successfully');
      
      // Extract text the same way as Python: response.text
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response structure from Gemini API');
      }

      const aiText = data.candidates[0].content.parts[0].text;
      const aiReply: ChatMessage = { sender: 'ai', text: aiText };
      setMessages((prev) => [...prev, aiReply]);
      
    } catch (error) {
      console.error('❌ Error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      setErrorDetails(`Error: ${errorMsg}

Possible causes:
1. CORS blocking (browser security restriction)
2. Network connectivity issue
3. API key problem
4. Rate limiting

Check the browser console (F12) for more details.

If CORS error: This means your browser is blocking direct API calls. 
You'll need to use Method 2 (with Edge Function) instead.`);
      
      setMessages((prev) => [...prev, { 
        sender: 'ai', 
        text: `❌ ${errorMsg}\n\nClick the info icon for details.` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Info className="text-blue-500" size={20} />
                About AI Tutor
              </h3>
              <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
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
              <button
                onClick={() => setShowInfo(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Details Modal */}
      {errorDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={20} />
                Error Details
              </h3>
              <button onClick={() => setErrorDetails('')} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <pre className="text-xs text-red-400 bg-gray-900 p-4 rounded whitespace-pre-wrap">
                {errorDetails}
              </pre>
              <button
                onClick={() => setErrorDetails('')}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chatbot Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-full shadow-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 z-40 transform hover:scale-110"
        aria-label={isOpen ? "Close chatbot" : "Open chatbot"}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {/* Chatbot Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 w-96 h-[32rem] bg-gray-800 rounded-2xl shadow-2xl flex flex-col z-40 border border-gray-700">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl">
                🎓
              </div>
              <div>
                <h3 className="text-white font-semibold">AI Tutor</h3>
                <p className="text-xs text-blue-100">Gemini 2.5 Flash</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowInfo(true)} 
                className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded transition-colors"
                aria-label="Info"
              >
                <Info size={18} />
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-900">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 text-sm mt-8 space-y-4">
                <div className="text-5xl">👋</div>
                <div>
                  <p className="text-white font-medium mb-2">Welcome to AI Tutor!</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    I'm here to help you learn by guiding you to find answers yourself.
                    Ask me any question about your studies!
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
            ) : null}
            
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'bg-gray-800 text-gray-200 border border-gray-700'
                  } whitespace-pre-wrap break-words text-sm shadow-lg`}
                >
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

          {/* Input Area */}
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