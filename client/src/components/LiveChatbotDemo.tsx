import { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Sparkles, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { apiService } from '@/lib/apiService';

interface LiveChatbotDemoProps {
  clientName: string;
  clientServices?: string[];
  clientDescription?: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export const LiveChatbotDemo = ({
  clientName,
  clientServices = [],
  clientDescription = '',
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground
}: LiveChatbotDemoProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi there! 👋 I'm ${clientName}'s AI assistant. I'm here to help answer any questions about our services. What can I help you with today?`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll within the chat container only - NOT the page
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const suggestedQuestions = [
    `What services does ${clientName} offer?`,
    `How can I schedule an appointment?`,
    `What are your business hours?`,
    `Can you tell me about pricing?`
  ];

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Create placeholder for assistant message
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true
    }]);

    try {
      const response = await apiService.chatWithProposal({
        messages: messages.filter(m => m.id !== 'welcome').concat(userMessage).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        })),
        clientName,
        clientServices,
        clientDescription
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          // Process complete lines
          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                setMessages(prev => prev.map(m => 
                  m.id === assistantId 
                    ? { ...m, content: fullContent }
                    : m
                ));
              }
            } catch {
              // Continue on parse error
            }
          }
        }
      }

      // Finalize message
      setMessages(prev => prev.map(m => 
        m.id === assistantId 
          ? { ...m, content: fullContent || "I apologize, I couldn't process that. Could you try asking again?", isStreaming: false }
          : m
      ));

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(m => 
        m.id === assistantId 
          ? { ...m, content: "I'm having trouble connecting right now. Please try again in a moment!", isStreaming: false }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSendMessage();
    }
  };

  // Prevent form submission from scrolling the page
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSendMessage();
  };

  return (
    <div 
      className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'fixed inset-4 z-50' : ''}`}
      style={{ 
        backgroundColor: cardBackground,
        border: `2px solid color-mix(in srgb, ${secondaryColor} 30%, transparent)`,
        boxShadow: `0 0 40px color-mix(in srgb, ${secondaryColor} 15%, transparent)`
      }}
    >
      {/* Backdrop for expanded mode */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Header */}
      <div 
        className="px-4 py-3 flex items-center justify-between"
        style={{ 
          background: `linear-gradient(135deg, ${secondaryColor}, ${primaryColor})` 
        }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-white animate-pulse" />
          </div>
          <div>
            <h4 className="text-white font-medium text-sm">{clientName} AI Assistant</h4>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-white/80" />
              <span className="text-white/80 text-xs">Try it live!</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4 text-white" />
            ) : (
              <Maximize2 className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className={`overflow-y-auto p-4 space-y-4 ${isExpanded ? 'h-[calc(100%-140px)]' : 'h-64'}`}
        style={{ 
          background: `linear-gradient(180deg, color-mix(in srgb, ${secondaryColor} 5%, ${cardBackground}), ${cardBackground})`
        }}
      >
        {messages.map((message) => (
          <div 
            key={message.id}
            className={`flex items-start gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div 
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ 
                backgroundColor: message.role === 'assistant' 
                  ? `color-mix(in srgb, ${secondaryColor} 20%, transparent)` 
                  : `color-mix(in srgb, ${textColor} 10%, transparent)` 
              }}
            >
              {message.role === 'assistant' ? (
                <Bot className="w-3.5 h-3.5" style={{ color: secondaryColor }} />
              ) : (
                <User className="w-3.5 h-3.5" style={{ color: textMutedColor }} />
              )}
            </div>
            <div 
              className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl ${
                message.role === 'assistant' ? 'rounded-tl-sm' : 'rounded-tr-sm'
              }`}
              style={{ 
                backgroundColor: message.role === 'assistant' 
                  ? `color-mix(in srgb, ${secondaryColor} 12%, transparent)` 
                  : `color-mix(in srgb, ${primaryColor} 15%, transparent)`,
                color: textColor,
                border: `1px solid color-mix(in srgb, ${message.role === 'assistant' ? secondaryColor : primaryColor} 20%, transparent)`
              }}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
                {message.isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse" />
                )}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 2 && !isLoading && (
        <div className="px-4 pb-2">
          <p className="text-xs mb-2" style={{ color: textMutedColor }}>Try asking:</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedQuestions.slice(0, 2).map((q, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(q)}
                className="px-2.5 py-1 rounded-full text-xs transition-all hover:scale-105"
                style={{ 
                  backgroundColor: `color-mix(in srgb, ${secondaryColor} 10%, transparent)`,
                  color: secondaryColor,
                  border: `1px solid color-mix(in srgb, ${secondaryColor} 25%, transparent)`
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form 
        onSubmit={handleFormSubmit}
        className="p-3 border-t"
        style={{ 
          borderColor: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`,
          backgroundColor: `color-mix(in srgb, ${secondaryColor} 5%, ${cardBackground})`
        }}
      >
        <div 
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ 
            backgroundColor: `color-mix(in srgb, ${textColor} 5%, transparent)`,
            border: `1px solid color-mix(in srgb, ${secondaryColor} 20%, transparent)`
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                handleSendMessage();
              }
            }}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-50"
            style={{ color: textColor }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-1.5 rounded-lg transition-all disabled:opacity-40"
            style={{ 
              backgroundColor: secondaryColor,
              color: 'white'
            }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-center text-[10px] mt-2 opacity-60" style={{ color: textMutedColor }}>
          Powered by Melleka Marketing AI • This is a live demo
        </p>
      </form>
    </div>
  );
};
