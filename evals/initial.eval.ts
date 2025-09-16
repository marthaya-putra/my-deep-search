import { evalite, createScorer } from "evalite";
import { askDeepSearch } from "~/deep-search";
import type { UIMessage } from "ai";
import { convertToModelMessages, generateObject } from "ai";
import { factualityModel } from "~/models";
import { z } from "zod";
import { devData } from "./dev";
import { ciData } from "./ci";
import { regressionData } from "./regression";
import { env } from "~/env";
import { AnswerRelevancy } from "./answer-relevancy";

export const checkFactuality = async (opts: {
  question: string;
  groundTruth: string;
  submission: string;
}) => {
  const { object } = await generateObject({
    model: factualityModel,
    /**
     * Prompt taken from autoevals:
     *
     * {@link https://github.com/braintrustdata/autoevals/blob/5aa20a0a9eb8fc9e07e9e5722ebf71c68d082f32/templates/factuality.yaml}
     */
    prompt: `
      You are comparing a submitted answer to an expert answer on a given question. Here is the data:
      [BEGIN DATA]
      ************
      [Question]: ${opts.question}
      ************
      [Expert]: ${opts.groundTruth}
      ************
      [Submission]: ${opts.submission}
      ************
      [END DATA]

      Compare the factual content of the submitted answer with the expert answer. Ignore any differences in style, grammar, or punctuation.
      The submitted answer may either be a subset or superset of the expert answer, or it may conflict with it. Determine which case applies. Answer the question by selecting one of the following options:
      (A) The submitted answer is a subset of the expert answer and is fully consistent with it.
      (B) The submitted answer is a superset of the expert answer and is fully consistent with it.
      (C) The submitted answer contains all the same details as the expert answer.
      (D) There is a disagreement between the submitted answer and the expert answer.
      (E) The answers differ, but these differences don't matter from the perspective of factuality.
    `,
    schema: z.object({
      answer: z
        .enum(["A", "B", "C", "D", "E"])
        .describe("Your selection."),
      rationale: z
        .string()
        .describe(
          "Why you chose this answer. Be very detailed.",
        ),
    }),
  });

  /**
   * LLM's are well documented at being poor at generating
   */
  const scores = {
    A: 0.4,
    B: 0.6,
    C: 1,
    D: 0,
    E: 1,
  };


  return {
    score: scores[object.answer],
    metadata: {
      rationale: object.rationale,
    },
  };
};

// This is the scorer that can be passed into the scorers in Evalite
export const Factuality = createScorer<
  UIMessage[],
  string,
  string
>({
  name: "Factuality",
  scorer: async ({ input, expected, output }) => {
    // Extract the question text from the UIMessage format
    const firstPart = input[0]?.parts?.[0];
    const question = (firstPart?.type === "text" && "text" in firstPart) 
      ? firstPart.text 
      : "Unknown question";
    
    return checkFactuality({
      question,
      groundTruth: expected!,
      submission: output,
    });
  },
});

// Set up data based on environment variable
const data = [...devData];

// If CI, add the CI data
if (env.EVAL_DATASET === "ci") {
  data.push(...ciData);
  // If Regression, add the regression data AND the CI data
} else if (env.EVAL_DATASET === "regression") {
  data.push(...ciData, ...regressionData);
}

evalite("Deep Search Eval", {
  data: async (): Promise<{ input: UIMessage[]; expected: string }[]> => {
    return data;
  },
  task: async (input) => {
    return askDeepSearch(convertToModelMessages(input));
  },
  scorers: [
    {
      name: "Contains Links",
      description: "Checks if the output contains any markdown links.",
      scorer: ({ output }) => {
        // Regex to match markdown links: [text](url)
        const markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/;
        const containsLinks = markdownLinkRegex.test(output);

        return containsLinks ? 1 : 0;
      },
    },
    Factuality,
    AnswerRelevancy,
  ],
});
