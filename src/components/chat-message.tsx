import { MessagePart } from "./message-part";
import type { AppMessage } from "~/types";

interface ChatMessageProps {
  parts: AppMessage["parts"];
  role: string;
  userName: string;
}


export const ChatMessage = ({ parts, role, userName }: ChatMessageProps) => {
  const isAI = role === "assistant";

  return (
    <div className="mb-6">
      <div
        className={`rounded-lg p-4 ${isAI ? "bg-gray-800 text-gray-300 items-start" : "bg-gray-900 text-gray-300"
          }`}
      >
        <p className="mb-2 text-sm font-semibold text-gray-400">
          {isAI ? "AI" : userName}
        </p>

        <div className="space-y-3">
          {parts.map((part, index) => (
            <div key={index}>
              <MessagePart messagePart={part} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
