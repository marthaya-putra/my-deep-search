import type { UIMessage } from "ai";

export const ciData: { input: UIMessage[]; expected: string }[] = [
  {
    input: [
      {
        id: "5",
        role: "user",
        parts: [
          {
            type: "text",
            text: "How many ministers are in the current Indonesian government? How it differs from the previous government?",
          },
        ],
      },
    ],
    expected: "The number of ministers of the current president of Indonesia is 48, It has 14 more ministers than the previous government",
  },
];
