import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  screenshot?: string;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [screenshot, setScreenshot] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatEndpoint = process.env.REACT_APP_BROWSER_CHAT_ENDPOINT || 'http://localhost:8000/browser/chat';
  const screenshotEndpoint = process.env.REACT_APP_BROWSER_SCREENSHOT_ENDPOINT || 'http://localhost:8000/browser/screenshot';

  useEffect(() => {
    scrollToBottom();
  }, [messages, screenshot]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (messages.length > 0) {
        try {
          const response = await axios.get(screenshotEndpoint, {
            responseType: 'arraybuffer'
          });
          const base64 = Buffer.from(response.data, 'binary').toString('base64');
          setScreenshot(base64);
        } catch (error) {
          console.error('Screenshot error:', error);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await axios.post(chatEndpoint, {
        message: input,
        session_id: messages.length > 0 ? messages[messages.length - 1].id : undefined
      });

      const agentMessage: Message = {
        id: response.data.session_id,
        text: response.data.response,
        sender: 'agent',
        timestamp: new Date(),
        screenshot: response.data.screenshot
      };

      setMessages(prev => [...prev, agentMessage]);
      if (response.data.screenshot) {
        setScreenshot(response.data.screenshot);
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-bold">Brunella Browser Automation</h1>
        <p className="text-sm text-gray-400">Magyar nyelvű chat és élő böngésző példány</p>
      </div>

      {screenshot && (
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <h2 className="text-sm font-semibold mb-2">Élő Böngésző Képernyő:</h2>
          <img
            src={`data:image/png;base64,${screenshot}`}
            alt="Live Browser"
            className="w-full h-auto rounded-lg border border-gray-600"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md p-3 rounded-lg ${message.sender === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              {message.screenshot && (
                <img
                  src={`data:image/png;base64,${message.screenshot}`}
                  alt="Agent Screenshot"
                  className="w-full h-auto rounded mb-2"
                />
              )}
              <p className="text-sm">{message.text}</p>
              <span className="text-xs text-gray-400">
                {message.timestamp.toLocaleTimeString('hu-HU')}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-700 p-3 rounded-lg">
              <span className="text-sm">Gondolkodok...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Írd meg az utasítást magyarul..."
            className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={isTyping}
            className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-600"
          >
            Küldés
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
