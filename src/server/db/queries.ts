import { and, count, eq, gte, desc, asc } from "drizzle-orm";
import { db } from "./index";
import { userRequests, users, chats, messages } from "./schema";
import type { UIMessage } from "ai";

export async function getUserRequestCountToday(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await db
    .select({ count: count() })
    .from(userRequests)
    .where(
      and(
        eq(userRequests.userId, userId),
        gte(userRequests.timestamp, today)
      )
    );
  
  return result[0]?.count ?? 0;
}

export async function addUserRequest(userId: string, requestType = "chat", metadata?: Record<string, unknown>) {
  return await db.insert(userRequests).values({
    userId,
    requestType,
    metadata,
  });
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const result = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId));
  
  return result[0]?.isAdmin ?? false;
}

export const upsertChat = async (opts: {
  userId: string;
  chatId: string;
  title?: string;
  messages: UIMessage[];
}) => {
  const { userId, chatId, title, messages: messageList } = opts;

  // Check if chat exists and belongs to the user
  const [existingChat] = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);

  await db.transaction(async (tx) => {
    if (existingChat) {
      if(existingChat.userId !== userId) {
        throw new Error("Chat not found!");
      }
      // Chat exists and belongs to user, update it
      // First delete all existing messages
      await tx.delete(messages).where(eq(messages.chatId, chatId));
      
      // Update chat title and timestamp only if title is provided
      if (title) {
        console.log("updating title: ", title);
        await tx
          .update(chats)
          .set({ 
            title, 
            updatedAt: new Date() 
          })
          .where(eq(chats.id, chatId));
      } else {
        // Just update timestamp if no title provided
        await tx
          .update(chats)
          .set({ 
            updatedAt: new Date() 
          })
          .where(eq(chats.id, chatId));
      }
    } else {
      // Chat doesn't exist, create new one
      await tx.insert(chats).values({
        id: chatId,
        userId,
        title: title ?? "New Chat",
      });
    }
  });


  // Insert all messages
  const messageValues = messageList.map((message, index) => ({
    chatId,
    role: message.role,
    parts: message.parts || [],
    order: index,
  }));

  if (messageValues.length > 0) {
    await db.insert(messages).values(messageValues);
  }

  return { chatId, title: title ?? "New Chat", messageCount: messageList.length };
};

export const getChat = async (opts: {
  userId: string;
  chatId: string;
}) => {
  const { userId, chatId } = opts;

  // Get chat with messages, ensuring it belongs to the user
  const chat = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .limit(1);

  if (chat.length === 0) {
    return null;
  }

  const chatMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.order));

  return {
    ...chat[0],
    messages: chatMessages,
  };
};

export const getChats = async (userId: string) => {
  // Get all chats for a user without messages
  const userChats = await db
    .select({
      id: chats.id,
      title: chats.title,
      createdAt: chats.createdAt,
      updatedAt: chats.updatedAt,
    })
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.updatedAt));

  return userChats;
};

