import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { auth } from "~/server/auth/index.ts";
import { ChatPage } from "./chat.tsx";
import { ClientAuthWrapper } from "../components/client-auth-wrapper.tsx";
import { getChats, getChat } from "~/server/db/queries";
import { randomUUID } from "crypto";
import type { AppMessage } from "~/types.ts";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const session = await auth();
  const userName = session?.user?.name ?? "Guest";
  const isAuthenticated = !!session?.user;
  const userId = session?.user?.id;
  const { id: chatIdFromUrl } = await searchParams;

  let chats: { id: string; title: string; createdAt: Date; updatedAt: Date }[] = [];
  let initialMessages: AppMessage[] | undefined = undefined;
  let chatId = chatIdFromUrl ?? randomUUID();
  const isNewChat = !chatIdFromUrl;

  if (isAuthenticated && userId) {
    chats = await getChats(userId);
    if (!isNewChat) {
      const chat = await getChat({ userId, chatId });
      if (chat && chat.messages) {
        initialMessages = chat.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          parts: msg.parts as AppMessage["parts"],
        }));
      }
    }
  }

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <div className="flex w-64 flex-col border-r border-gray-700 bg-gray-900">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-400">Your Chats</h2>
            {isAuthenticated && (
              <Link
                href="/"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                title="New Chat"
              >
                <PlusIcon className="size-5" />
              </Link>
            )}
          </div>
        </div>
        <div className="-mt-1 flex-1 space-y-2 overflow-y-auto px-4 pt-1 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600">
          {chats.length > 0 ? (
            chats.map((chat) => (
              <div key={chat.id} className="flex items-center gap-2">
                <Link
                  href={`/?id=${chat.id}`}
                  className={`flex-1 rounded-lg p-3 text-left text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    chat.id === chatId
                      ? "bg-gray-700"
                      : "hover:bg-gray-750 bg-gray-800"
                  }`}
                >
                  {chat.title}
                </Link>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">
              {isAuthenticated
                ? "No chats yet. Start a new conversation!"
                : "Sign in to start chatting"}
            </p>
          )}
        </div>
        <div className="p-4">
          <ClientAuthWrapper />
        </div>
      </div>

     { isAuthenticated && <ChatPage
        key={chatId}
        userName={userName}
        id={chatId}
        isNewChat={isNewChat}
        initialMessages={initialMessages}
      />}
    </div>
  );
}
