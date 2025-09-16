import {    
  type ModelMessage,
  type StreamTextResult,
  type UIMessageStreamWriter,
} from "ai";
import { runAgentLoop } from "~/run-agent-loop";
import type { AppMessage } from "~/types";

export const streamFromDeepSearch = async (opts: {
  messages: ModelMessage[];
  langfuseTraceId?: string;
  writeMessagePart?: UIMessageStreamWriter<AppMessage>["write"];
  userLocation?: {
    longitude?: string;
    latitude?: string;
    city?: string;
    country?: string;
  };
}): Promise<StreamTextResult<Record<string, never>, string>> => {
  // Get the latest user message to use as the query
  const lastUserMessage = opts.messages.findLast(msg => msg.role === 'user');
  
  // Handle different content formats
  let userQuery = '';
  if (typeof lastUserMessage?.content === 'string') {
    userQuery = lastUserMessage.content;
  } else if (Array.isArray(lastUserMessage?.content)) {
    // Handle content parts array format
    const textPart = lastUserMessage.content.find(part => part.type === 'text');
    userQuery = textPart?.text ?? '';
  }
  
  // Extract langfuseTraceId from telemetry if available
  const langfuseTraceId = opts.langfuseTraceId;
  
  // Run the agent loop and return the result
  return await runAgentLoop(userQuery, {
    writeMessageParts: opts.writeMessagePart,
    langfuseTraceId,
    messageHistory: opts.messages, // Pass the full message history for context
    userLocation: opts.userLocation,
  });
};

export async function askDeepSearch(
  messages: ModelMessage[],
) {
  const result = await streamFromDeepSearch({
    messages,
    langfuseTraceId: undefined,
  });

  // Consume the stream - without this,
  // the stream will never finish
  await result.consumeStream();

  return await result.text;
}
