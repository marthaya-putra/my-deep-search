import { generateText } from "ai";
import type { ModelMessage } from "ai";
import { model } from "./models";

export function isNewChatCreated(
  data: unknown,
): data is {
  type: "NEW_CHAT_CREATED";
  chatId: string;
} {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "NEW_CHAT_CREATED" &&
    "chatId" in data &&
    typeof (data as Record<string, unknown>).chatId === "string"
  );
}

/**
 * Extracts text content from ModelMessage objects, handling different content formats
 * @param messages Array of ModelMessage objects
 * @returns Array of text strings extracted from the messages
 */
export const extractMessageTexts = (messages: ModelMessage[]): string[] => {
  return messages.map((m) => {
    if (typeof m.content === 'string') {
      return m.content;
    } else if (Array.isArray(m.content)) {
      const textPart = m.content.find(part => part.type === 'text');
      return textPart?.text ?? '';
    }
    return '';
  }).filter(text => text.length > 0);
};

export const generateChatTitle = async (
  messages: ModelMessage[],
) => {
  // Extract text content from messages, handling different content formats
  const messageTexts = extractMessageTexts(messages);
  console.log("messageTexts: ", messageTexts);

  const { text } = await generateText({
    model,
    system: `You are a chat title generator.
      You will be given a chat history, and you will need to generate a title for the chat.
      The title should be a single sentence that captures the essence of the chat.
      The title should be no more than 50 characters.
      The title should be in the same language as the chat history.
      `,
    prompt: `Here is the chat history:

      ${messageTexts.join("\n")}
    `,
  });

  console.log("text: ", text);

  return text;
};
