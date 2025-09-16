import { createUIMessageStream, convertToModelMessages, createUIMessageStreamResponse } from "ai";
import { auth } from "~/server/auth";
import { addUserRequest, isUserAdmin, upsertChat } from "~/server/db/queries";
import { generateId } from "ai";
import { streamFromDeepSearch } from "~/deep-search";
import { Langfuse } from "langfuse";
import { env } from "~/env";
import { checkRateLimit, recordRateLimit, type RateLimitConfig } from "~/server/rate-limit";
import { generateChatTitle } from "~/utils";
import { geolocation } from "@vercel/functions";
import type { AppMessage } from "~/types";
import { revalidatePath } from "next/cache";

const langfuse = new Langfuse({
  environment: env.NODE_ENV,
});

export const maxDuration = 60;

// Rate limit configuration - removed unused constant

// Global rate limit configuration (for testing)
const GLOBAL_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 1,
  maxRetries: 3,
  windowMs: 60_000, // 60 seconds for testing
  keyPrefix: "global",
};

export async function POST(request: Request) {
  // Check if user is authenticated
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  // Get user's location for local development
  if (process.env.NODE_ENV === "development") {
    request.headers.set("x-vercel-ip-country", "UK");
    request.headers.set("x-vercel-ip-country-region", "GB");
    request.headers.set("x-vercel-ip-city", "Oxford");
  }

  // Get user's location from Vercel geolocation
  const { longitude, latitude, city, country } = geolocation(request);

  // Create Langfuse trace early so we can use it for all spans
  const trace = langfuse.trace({
    name: "chat",
    userId: session.user.id,
  });

  // Check if user is admin
  const isAdminSpan = trace.span({
    name: "check-user-admin",
    input: { userId },
  });
  const isAdmin = await isUserAdmin(userId);
  isAdminSpan.end({
    output: { isAdmin },
  });

  // Rate limiting check (skip for admin users)
  if (!isAdmin) {
    // Global rate limiting check - applies to all requests
    const globalRateLimitSpan = trace.span({
      name: "check-global-rate-limit",
      input: GLOBAL_RATE_LIMIT_CONFIG,
    });

    const rateLimitCheck = await checkRateLimit(GLOBAL_RATE_LIMIT_CONFIG);

    if (!rateLimitCheck.allowed) {
      console.log(`Global rate limit exceeded`);

      globalRateLimitSpan.end({
        output: { allowed: false, error: "Rate limit exceeded after retries" },
      });
      return new Response("Global rate limit exceeded", {
        status: 429,
      });
    }

    // Record the request in the global rate limit
    await recordRateLimit(GLOBAL_RATE_LIMIT_CONFIG);

    globalRateLimitSpan.end({
      output: {
        allowed: true,
        remaining: rateLimitCheck.remaining,
        totalHits: rateLimitCheck.totalHits + 1
      },
    });
  }

  const body = (await request.json()) as {
    messages: AppMessage[];
    chatId: string;
    isNewChat: boolean;
  };

  const { messages, chatId, isNewChat } = body;

  // Generate a chat ID if none provided
  const finalChatId = chatId;

  // Update the trace with the sessionId now that we have the chatId
  trace.update({
    sessionId: finalChatId,
  });

  // Generate a title promise for new chats
  let titlePromise: Promise<string> | undefined;

  if (isNewChat) {
    titlePromise = generateChatTitle(convertToModelMessages(messages));
  } else {
    titlePromise = Promise.resolve("");
  }

  // Create or update the chat with the user's message immediately
  // This ensures we have a chat record even if the stream fails
  const upsertChatInitialSpan = trace.span({
    name: "upsert-chat-initial",
    input: {
      userId,
      chatId: finalChatId,
      title: "New Chat",
      messageCount: messages.length
    },
  });
  const initialUpsertResult = await upsertChat({
    userId,
    chatId: finalChatId,
    title: isNewChat ? "New Chat" : undefined,
    messages,
  });
  upsertChatInitialSpan.end({
    output: initialUpsertResult,
  });

  // Record the request before processing
  const addUserRequestSpan = trace.span({
    name: "add-user-request",
    input: {
      userId,
      requestType: "chat",
      metadata: {
        messageCount: messages.length,
        timestamp: new Date().toISOString(),
        chatId: finalChatId,
      }
    },
  });
  const addRequestResult = await addUserRequest(userId, "chat", {
    messageCount: messages.length,
    timestamp: new Date().toISOString(),
    chatId: finalChatId,
  });
  addUserRequestSpan.end({
    output: addRequestResult,
  });

  const stream = createUIMessageStream<AppMessage>({
    execute: async ({ writer }) => {
      // If this is a new chat, send the chat ID to the frontend
      if (isNewChat) {
        writer.write({
          type: 'data-new-chat',
          transient: true,
          id: generateId(),
          data: {
            id: finalChatId,
          },
        });
      }

      const result = await streamFromDeepSearch({
        messages: convertToModelMessages(messages),
        langfuseTraceId: trace.id,
        userLocation: {
          longitude,
          latitude,
          city,
          country,
        },
        writeMessagePart: writer.write,
      });

      writer.merge(result.toUIMessageStream({ sendStart: false }));

    },
    onFinish: async ({ messages }) => {
      try {
        // Resolve the title promise if it exists
        const title = await titlePromise;

        const upsertChatFinalSpan = trace.span({
          name: "upsert-chat-final",
          input: {
            userId,
            chatId: finalChatId,
            title,
            messages
          },
        });


        const finalUpsertResult = await upsertChat({
          userId,
          chatId: finalChatId,
          title,
          messages,
        });

        upsertChatFinalSpan.end({
          output: finalUpsertResult,
        });
        console.log(`Chat ${finalChatId} completed and saved with ${messages.length} total messages`);

        // Flush the trace to Langfuse
        await langfuse.flushAsync();
      } catch (error) {
        console.error("Error saving chat in onFinish:", error);
      }
    },
  });

  return createUIMessageStreamResponse({
    stream,
  });
}
