import type { UIMessage } from "ai";

export const devData: { input: UIMessage[]; expected: string }[] = [
  {
    input: [
      {
        id: "4",
        role: "user",
        parts: [
          {
            type: "text",
            text: "From which party is the current president of Indonesia?",
          },
        ],
      },
    ],
    expected: "The current president of Indonesia is from the Gerindra Party",
  },
];
