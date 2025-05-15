// components/ChatWindow.tsx
"use client"

import { useState, useEffect, useRef, FormEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"; // Added ScrollBar
import { Repository } from "@/lib/github";
import { Skeleton } from "@/components/ui/skeleton"; // For loading state

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  isLoading?: boolean;
}

interface ChatWindowProps {
  repository: Repository; // Make repository prop mandatory
}

export default function ChatWindow({ repository }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (repository) {
      setMessages([
        {
          id: "initial-bot-message",
          content: `Hi! I'm CodeSense, your AI assistant for ${repository.name}. Ask me anything about this codebase!`,
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    }
  }, [repository]);

  useEffect(() => {
    // Scroll to bottom when new messages are added or bot starts typing
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [messages, isBotTyping]);

  const handleSendMessage = async (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || isBotTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: newMessage,
      sender: "user",
      timestamp: new Date(),
    };
    
    const currentQuestion = newMessage;
    setNewMessage(""); // Clear input immediately

    // Add user message and set bot typing state
    setMessages(prev => [...prev, userMessage]);
    setIsBotTyping(true);

    // Prepare chat history for the API (send only previous confirmed messages)
    const chatHistoryForApi = messages.filter(msg => !msg.isLoading); 

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: repository.owner.login,
          repoName: repository.name,
          question: currentQuestion,
          chatHistory: chatHistoryForApi, 
        }),
      });

      const data = await response.json(); // Always try to parse JSON

      if (!response.ok) {
        // Use error message from API if available, otherwise a generic one
        throw new Error(data.error || data.answer || `API Error: ${response.status}`);
      }
      
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: data.answer || "Sorry, I couldn't get a valid response.",
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botResponse]);

    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        content: `Error: ${errorMessage}`,
        sender: "bot",
        timestamp: new Date(),
      }]);
    } finally {
      setIsBotTyping(false);
    }
  };

  if (!repository) {
    return (
      <Card className="h-full flex flex-col items-center justify-center">
        <CardHeader><CardTitle>Loading Chat...</CardTitle></CardHeader>
        <CardContent><Skeleton className="w-48 h-8" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col shadow-xl">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-lg font-semibold tracking-tight">
          CodeSense: {repository.full_name}
        </CardTitle>
      </CardHeader>
      
      <ScrollArea className="flex-1 p-4" >
         <div ref={scrollViewportRef} className="h-full overflow-y-auto"> {/* This div is for the ref */}
            <div className="space-y-4 mb-2">
            {messages.map((message) => (
                <div
                key={message.id}
                className={`flex ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                }`}
                >
                <div
                    className={`flex gap-2.5 max-w-[85%] md:max-w-[75%] items-end ${
                    message.sender === "user" ? "flex-row-reverse" : ""
                    }`}
                >
                    <Avatar className="h-7 w-7 shrink-0 self-start mt-1"> {/* self-start, smaller */}
                    {message.sender === "user" ? (
                        <AvatarFallback className="text-xs">U</AvatarFallback>
                    ) : (
                        <>
                        <AvatarImage src="/codesense-avatar.png" alt="AI" /> {/* Place in /public */}
                        <AvatarFallback className="text-xs">AI</AvatarFallback>
                        </>
                    )}
                    </Avatar>
                    <div
                    className={`rounded-xl px-3.5 py-2.5 text-sm shadow-sm ${ // Softer corners, more padding
                        message.sender === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none" // Tail for user
                        : "bg-muted rounded-bl-none" // Tail for bot
                    }`}
                    >
                    <pre className="whitespace-pre-wrap font-sans break-words">
                        {message.content}
                    </pre>
                    <div className={`text-xs opacity-60 mt-1.5 ${message.sender === "user" ? "text-right" : "text-left"}`}>
                        {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        })}
                    </div>
                    </div>
                </div>
                </div>
            ))}
            {isBotTyping && (
                <div className="flex justify-start">
                    <div className="flex gap-2.5 max-w-[75%] items-end">
                        <Avatar className="h-7 w-7 shrink-0 self-start mt-1">
                            <AvatarImage src="/codesense-avatar.png" alt="AI" />
                            <AvatarFallback className="text-xs">AI</AvatarFallback>
                        </Avatar>
                        <div className="rounded-xl px-3.5 py-2.5 text-sm bg-muted rounded-bl-none shadow-sm">
                            <div className="flex items-center space-x-1.5">
                                <span className="sr-only">Typing...</span>
                                <div className="h-1.5 w-1.5 bg-foreground rounded-full animate-pulse delay-75"></div>
                                <div className="h-1.5 w-1.5 bg-foreground rounded-full animate-pulse delay-200"></div>
                                <div className="h-1.5 w-1.5 bg-foreground rounded-full animate-pulse delay-300"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>
         </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
      
      <CardFooter className="pt-3 pb-3 border-t bg-background">
        <form
          className="flex w-full items-center space-x-2"
          onSubmit={handleSendMessage}
        >
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ask about code, architecture, tests..."
            className="flex-1"
            disabled={isBotTyping}
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={isBotTyping || !newMessage.trim()}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}