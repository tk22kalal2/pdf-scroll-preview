import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { marked } from "marked";

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
    
    // Keep track of toast ID to ensure we can dismiss it
    let loadingToastId: string | number;
    
    try {
      // Display thinking message
      setMessages(prev => [...prev, { role: "assistant", content: "Thinking..." }]);
      
      // Show loading toast with auto-dismiss
      loadingToastId = toast.loading("Processing your question...", {
        duration: 10000, // Maximum duration if not manually dismissed
      });
      
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
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `You are a helpful assistant that answers questions about PDF content in the ABSOLUTE SIMPLEST language possible.
              You are given OCR text extracted from a PDF document and must answer questions related to it — whether they are directly in the text or not.
              
              Follow these strict guidelines:
              
              1. Use EXTREMELY simple language — explain as if to a 7-year-old
              2. Format answers EXCLUSIVELY in bullet points with proper spacing between each point
              3. Every bullet point MUST be separated by one line break for readability
              4. Use <strong> HTML tags for important keywords, concepts and definitions
              5. Keep explanations short, direct and extremely easy to understand
              6. If asked to explain any concept, give 1-2 very simple examples
              7. If the answer is not in the text, use your own knowledge to help
              8. ALWAYS add helpful examples or real-life applications
              9. NEVER use technical or medical jargon - explain everything in simple terms
              10. ALWAYS format using HTML <ul><li> for bullet points with proper spacing
              11. Add clear line breaks between different parts of your answer
              12. If asked, create simple tables, comparisons, or explanations using HTML formatting
              13. Always be helpful and supportive
              
              Here's the OCR extracted text for reference:
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
      
      // Always dismiss the loading toast regardless of outcome
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
      }
      
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
      
      // Dismiss any previous toast and show error
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
      }
      toast.error("Failed to generate response", { duration: 3000 });
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
                      ? 'prose prose-headings:my-2 prose-p:my-2 prose-ul:my-2 prose-li:my-1 dark:prose-invert max-w-none' 
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
