import { useState, useRef, useEffect } from 'react';
import { FiMessageCircle, FiX, FiSend, FiMinimize2 } from 'react-icons/fi';

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! 👋 Welcome to Fintranzact. I&apos;m here to help you with any questions about our accounting software. How can I assist you today?",
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      text: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate bot response (replace with actual API call later)
    setTimeout(() => {
      const botResponse = generateBotResponse(inputMessage);
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          text: botResponse,
          sender: 'bot',
          timestamp: new Date(),
        },
      ]);
      setIsTyping(false);
    }, 1000);
  };

  const generateBotResponse = (userMessage) => {
    const message = userMessage.toLowerCase();

    // Simple keyword-based responses (can be replaced with AI/API later)
    if (message.includes('price') || message.includes('pricing') || message.includes('cost')) {
      return "Our pricing plans are flexible and designed to fit businesses of all sizes. You can view detailed pricing information on our pricing page. Would you like me to help you choose the right plan?";
    }

    if (message.includes('gst') || message.includes('tax')) {
      return "Fintranzact offers comprehensive GST filing features including GSTR-1 and GSTR-3B generation, e-invoicing with IRN, and automatic GST calculations. All features are fully compliant with Indian tax regulations.";
    }

    if (message.includes('trial') || message.includes('free') || message.includes('demo')) {
      return "Yes! We offer a free trial so you can explore all features. You can sign up for free without a credit card. Would you like me to guide you through the registration process?";
    }

    if (message.includes('feature') || message.includes('what can') || message.includes('capabilities')) {
      return "Fintranzact offers complete accounting solutions including:\n• GST filing (GSTR-1, GSTR-3B)\n• E-invoicing with IRN\n• Financial reports (Balance Sheet, P&L, Trial Balance)\n• Ledger management\n• Inventory management\n• TDS management\n\nWould you like to know more about any specific feature?";
    }

    if (message.includes('support') || message.includes('help') || message.includes('contact')) {
      return "Our support team is available to help you! You can reach us at:\n• Email: support@fintranzact.com\n• Phone: +91 84900 9684\n• Address: 212, 2nd floor, Runway Heights, Ayodhya Chowk, Rajkot - 360001\n\nWe&apos;re here Monday-Friday, 9AM-6PM IST.";
    }

    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
      return "Hello! I&apos;m here to help you learn more about Fintranzact. What would you like to know?";
    }

    if (message.includes('accounting') || message.includes('software')) {
      return "Fintranzact is a complete accounting software designed for Indian businesses. It helps you manage your finances, file GST returns, generate e-invoices, and create comprehensive financial reports - all in one platform.";
    }

    // Default response
    return "Thank you for your question! For detailed information, I recommend:\n• Visiting our Features page to learn about our capabilities\n• Checking our Pricing page for plan details\n• Contacting our support team at support@fintranzact.com\n\nIs there anything specific about Fintranzact you'd like to know?";
  };

  const toggleChat = () => {
    if (isOpen && !isMinimized) {
      setIsMinimized(true);
    } else if (isOpen && isMinimized) {
      setIsMinimized(false);
    } else {
      setIsOpen(true);
      setIsMinimized(false);
    }
  };

  const closeChat = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Chatbot Button */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="fixed bottom-6 right-6 z-50 bg-primary-600 text-white p-4 rounded-full shadow-2xl hover:bg-primary-700 transition-all transform hover:scale-110 flex items-center justify-center group"
          aria-label="Open chatbot"
        >
          <FiMessageCircle className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
        </button>
      )}

      {/* Chatbot Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl transition-all duration-300 ${
            isMinimized
              ? 'w-80 h-16'
              : 'w-96 h-[600px]'
          } flex flex-col border border-gray-200`}
        >
          {/* Header */}
          <div className="bg-primary-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <FiMessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Fintranzact Support</h3>
                {!isMinimized && (
                  <p className="text-xs text-primary-100">We&apos;re here to help!</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isMinimized && (
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1 hover:bg-white/20 rounded transition"
                  aria-label="Minimize"
                >
                  <FiMinimize2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={closeChat}
                className="p-1 hover:bg-white/20 rounded transition"
                aria-label="Close"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        message.sender === 'user'
                          ? 'bg-primary-600 text-white'
                          : 'bg-white text-gray-800 border border-gray-200'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-line">{message.text}</p>
                      <p
                        className={`text-xs mt-1 ${
                          message.sender === 'user' ? 'text-primary-100' : 'text-gray-500'
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white text-gray-800 border border-gray-200 rounded-2xl px-4 py-2">
                      <div className="flex space-x-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim()}
                    className="bg-primary-600 text-white p-2 rounded-xl hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Send message"
                  >
                    <FiSend className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Powered by Fintranzact • Usually replies in seconds
                </p>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
