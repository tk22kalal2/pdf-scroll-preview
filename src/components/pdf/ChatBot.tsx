
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
    
    // Variable to hold toast ID for dismissal
    let loadingToastId: string | number = "";
    
    try {
      // Display thinking message
      setMessages(prev => [...prev, { role: "assistant", content: "Thinking..." }]);
      
      // Show loading toast with auto-dismiss
      loadingToastId = toast.loading("Processing your question...", {
        duration: 10000, // Maximum duration if not manually dismissed
        position: "top-right"
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
              content: `You are a helpful educational assistant that answers questions about PDF content in the SIMPLEST language possible, maintaining complete accuracy of the information.

Your purpose is to help the user understand the PDF content by explaining concepts clearly and completely.

Follow these essential guidelines:

1. Use extremely simple language - explain as if to a 7th grade student
2. Format ALL answers as bullet points with this exact structure:
   <ul>
      <li>First point here with important terms in <strong>bold</strong></li>
      
      <li>Second point here (notice the line break between points)</li>
      
      <li>And so on...</li>
   </ul>

3. Always maintain 100% of the information from the PDF text
4. For each concept:
   - Start with what it is in basic terms
   - Connect it to fundamental concepts
   - Give 1-2 simple real-world examples
   - Explain why it matters

5. Break complex ideas into multiple simple bullet points
6. Use <strong> HTML tags for important keywords, terms and definitions
7. If information isn't in the PDF, use your knowledge but clearly state this fact
8. Never skip important details - be thorough while keeping language simple
9. Use proper spacing between bullet points for readability
10. Create simple tables with HTML when comparing items or concepts
11. NEVER use technical jargon without explaining it in simple terms

Here's the complete OCR extracted text for reference:
${ocrText}`
            },
            ...messages.filter(m => m.role !== "assistant" || m.content !== "Thinking..."),
            {
              role: "user",
              content: input.trim()
            }
          ],
          temperature: 0.5, // Lower temperature for more focused answers
          max_tokens: 1000  // Allow for detailed responses
        })
      });
      
      // Always dismiss the loading toast regardless of outcome
      if (typeof loadingToastId === 'string' || typeof loadingToastId === 'number') {
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
      if (typeof loadingToastId === 'string' || typeof loadingToastId === 'number') {
        toast.dismiss(loadingToastId);
      }
      toast.error("Failed to generate response", { duration: 3000, position: "top-right" });
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
                      ? 'prose prose-headings:my-2 prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-ul:space-y-2 dark:prose-invert max-w-none' 
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
