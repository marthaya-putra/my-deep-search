import { streamText, type StreamTextResult, smoothStream } from "ai";
import { model } from "~/models";
import type { SystemContext } from "~/system-context";
import { markdownJoinerTransform } from "~/markdown-transforms";

export const answerQuestion = (
  context: SystemContext,
  options: { isFinal?: boolean; langfuseTraceId?: string; onFinish?: (params: { text: string; usage: unknown }) => void | Promise<void> } = {},
): StreamTextResult<Record<string, never>, string> => {
  const { isFinal = false, langfuseTraceId, onFinish } = options;
  
  const userQuery = context.getUserQuery();
  const searchHistory = context.getSearchHistory();
  const messageHistory = context.getMessageHistory();
  const userLocation = context.getUserLocation();
  
  return streamText({
    model,
    system: `You are a helpful AI assistant that provides comprehensive answers based on web search and scraping research.

TODAY'S DATE: ${new Date().toLocaleDateString()}

Your task is to answer the user's question using the research context provided.${
  isFinal 
    ? " NOTE: This is the final attempt - you may not have all the information needed, but provide your best answer based on available research." 
    : ""
}

IMPORTANT GUIDELINES:
- Use the research context to provide accurate, detailed answers
- Always cite your sources with inline links using [title](url) format
- Include specific dates when discussing events or developments
- If multiple sources conflict, mention this and provide different perspectives
- Be comprehensive but focused on answering the specific question asked
- When responding to follow-up questions, reference the conversation history to provide context-aware answers
- Use the user's location information to provide localized and relevant results when appropriate`,
    prompt: `User Question: "${userQuery}"

${userLocation}

Conversation History:
${messageHistory}

Research Context:

${searchHistory || "No search research available."}

Based on this research and conversation history, provide a comprehensive answer to the user's question.`,
    onFinish: onFinish,
    experimental_telemetry: langfuseTraceId ? {
      isEnabled: true,
      functionId: "answer-question",
      metadata: {
        langfuseTraceId: langfuseTraceId,
      },
    } : undefined,
    // experimental_transform: [
    //   markdownJoinerTransform(),
    //   smoothStream({
    //     delayInMs: 5,
    //     chunking: "word",
    //   }),
    // ],
  });
};
