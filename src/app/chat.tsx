"use client";

import { useChat } from "@ai-sdk/react";
import { Send, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { StickToBottom } from "use-stick-to-bottom";
import { ChatMessage } from "~/components/chat-message";
import { SignInModal } from "~/components/sign-in-modal";
import { toast } from "sonner";
import type { AppMessage } from "~/types";

interface ChatProps {
  userName: string;
  id: string;
  isNewChat: boolean;
  initialMessages?: AppMessage[];
}

export const ChatPage = ({ userName, id, isNewChat, initialMessages }: ChatProps) => {
  const [input, setInput] = useState("");
  const router = useRouter();
  const { data: session, status } = useSession();
  const chat = useChat<AppMessage>({
    resume: false,
    messages: initialMessages,

    onData: (data) => {
      if (data.type === "data-new-chat") {
        const chatData = data.data;
        router.push(`/?id=${chatData.id}`);
      }
    },
    onFinish: () => {
      // Refresh the page to show updated title
      if (isNewChat) {
        router.refresh();
      }
    },
    onError: () => {
      // Handle stream errors
      toast.error("Unexpected error occurred", {
        description: "An error occurred while processing your request",
      });
    },
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const messageText = input.trim();
    setInput("");

    chat.sendMessage({
      text: messageText,
    }, {
      body: {
        chatId: id,
        isNewChat: isNewChat,
      },
    });

  };

  const isLoading = chat.status === "submitted" || chat.status === "streaming";


  return (
    <>
      <div className="flex flex-1 flex-col">
        <StickToBottom
          className="mx-auto w-full max-w-[65ch] overflow-y-auto flex-1 relative [&>div]:overflow-y-auto [&>div]:p-4 [&>div]:scrollbar-thin [&>div]:scrollbar-track-gray-800 [&>div]:scrollbar-thumb-gray-600 [&>div]:hover:scrollbar-thumb-gray-500"
          resize="smooth"
          initial="smooth"
        >
          <StickToBottom.Content
            className="flex flex-col gap-4"
            role="log"
            aria-label="Chat messages"
          >
            {chat.messages.map((message, index) => {
              return (
                <ChatMessage
                  key={message.id || index}
                  parts={message.parts}
                  role={message.role}
                  userName={userName}
                />
              );
            })}
          </StickToBottom.Content>
        </StickToBottom>

        <div className="border-t border-gray-700">
          <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-[65ch] p-4"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Say something..."
                autoFocus
                aria-label="Chat input"
                className="flex-1 rounded border border-gray-700 bg-gray-800 p-2 text-gray-200 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-600 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:hover:bg-gray-700"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SignInModal isOpen={false} onClose={() => { }} />
    </>
  );
};
