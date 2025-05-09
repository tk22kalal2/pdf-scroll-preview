
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatBotProps {
  ocrText: string;
  onClose: () => void;
}

export const ChatBot = ({ ocrText, onClose }: ChatBotProps) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I can answer questions about the PDF content. What would you like to know?" }
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isProcessing) return;
    
    // Add user message
    const userMessage = { role: "user" as const, content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);
    
    try {
      // Display thinking message
      setMessages(prev => [...prev, { role: "assistant", content: "Thinking..." }]);
      
      // Get the Groq API key from the existing code
      const GROQ_API_KEY = "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";
      const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
      
      // Prepare the request to Groq API with improved prompt
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [
            {
              role: "system",
              content: `You are a helpful assistant that answers questions about PDF content in the simplest language possible.
              You're given OCR text extracted from a PDF document and need to answer questions about it.
              
              Follow these guidelines strictly:
              1. Use extremely simple language - explain as if to a 10-year-old
              2. Format answers in clear bullet points with proper spacing between each point
              3. Use <strong> HTML tags for important keywords and concepts
              4. Keep explanations short, direct and easy to understand
              5. If asked to explain a concept from the PDF, provide 1-2 simple examples
              6. If asked about something not in the text, politely say so
              7. Avoid technical jargon unless specifically asked to explain it
              8. Break down complex ideas into step-by-step explanations
              9. Always use bullet points with proper HTML formatting like <ul> and <li> for lists
              10. Add clear line breaks between different sections of your answer
              
              Here's the OCR extracted text to reference:
              ${ocrText}`
            },
            ...messages.filter(m => m.role !== "assistant" || m.content !== "Thinking..."),
            {
              role: "user",
              content: input.trim()
            }
          ],
          temperature: 0.2, // Lower temperature for more focused answers
          max_tokens: 1000  // Allow for detailed responses
        })
      });
      
      // Remove the "thinking" message
      setMessages(prev => prev.filter(m => m.content !== "Thinking..."));
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error("Groq API error:", errorData);
        throw new Error(`Groq API error: ${response.status}`);
      }
      
      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      
      // Add the AI response
      setMessages(prev => [...prev, { role: "assistant", content: aiResponse }]);
      
    } catch (error) {
      console.error("Error generating response:", error);
      // Remove the "thinking" message
      setMessages(prev => prev.filter(m => m.content !== "Thinking..."));
      // Add error message
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error while processing your question. Please try again." }]);
      toast.error("Failed to generate response");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full border-l">
      <div className="p-4 border-b flex justify-between items-center bg-slate-50">
        <h3 className="text-lg font-medium">PDF Chat Assistant</h3>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      
      <div className="flex-grow overflow-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
              }`}
            >
              {message.content === "Thinking..." ? (
                <div className="flex items-center space-x-2">
                  <span>Thinking</span>
                  <span className="animate-pulse">...</span>
                </div>
              ) : (
                <div 
                  className={`${
                    message.role === 'assistant' 
                      ? 'prose dark:prose-invert max-w-none' 
                      : 'text-inherit'
                  }`}
                  dangerouslySetInnerHTML={{ 
                    __html: message.role === 'assistant' 
                      ? marked.parse(message.content) 
                      : message.content 
                  }}
                />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about the PDF..."
            className="flex-grow px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isProcessing}
          />
          <Button type="submit" disabled={isProcessing}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
};
