import { generateObject } from "ai";
import { z } from "zod";
import { model } from "~/models";
import type { ModelMessage } from "ai";
import { extractMessageTexts } from "~/utils";

type SearchResult = {
  date: string;
  title: string;
  url: string;
  snippet: string;
  scrapedContent: string;
  summary: string;
};

type SearchHistoryEntry = {
  query: string;
  results: SearchResult[];
};

export interface ContinueAction {
  title: string;
  reasoning: string;
  type: "continue";
  feedback: string;
}

export interface AnswerAction {
  title: string;
  reasoning: string;
  type: "answer";
  feedback: string;
}

export type Action =
  | ContinueAction
  | AnswerAction;

export const actionSchema = z.object({
  title: z
    .string()
    .describe(
      "The title of the action, to be displayed in the UI. Be extremely concise. 'Continuing research', 'Providing final answer'",
    ),
  reasoning: z
    .string()
    .describe("The reason you chose this step."),
  type: z
    .enum(["continue", "answer"])
    .describe(
      `The type of action to take.
      - 'continue': Continue researching - we need more information to answer the question.
      - 'answer': Answer the user's question and complete the loop.`,
    ),
  feedback: z
    .string()
    .describe("Detailed feedback about what information is missing or what gaps need to be filled. This will be used to guide the next search queries."),
});

export class SystemContext {
  /**
   * The user's original query
   */
  private userQuery: string;

  /**
   * The full conversation history for context
   */
  private messageHistory: ModelMessage[];

  /**
   * The current step in the loop
   */
  private step = 0;

  /**
   * The history of all searches performed (including scraped content)
   */
  private searchHistory: SearchHistoryEntry[] = [];

  /**
   * The user's location information
   */
  private userLocation?: {
    longitude?: string;
    latitude?: string;
    city?: string;
    country?: string;
  };

  /**
   * The most recent feedback from getNextAction
   */
  private lastFeedback?: string;

  constructor(
    userQuery: string, 
    messageHistory?: ModelMessage[],
    userLocation?: {
      longitude?: string;
      latitude?: string;
      city?: string;
      country?: string;
    }
  ) {
    this.userQuery = userQuery;
    this.messageHistory = messageHistory ?? [];
    this.userLocation = userLocation;
  }

  shouldStop() {
    return this.step >= 2;
  }

  incrementStep() {
    this.step++;
  }

  getUserQuery() {
    return this.userQuery;
  }

  reportSearch(search: SearchHistoryEntry) {
    this.searchHistory.push(search);
  }

  getSearchHistory(): string {
    return this.searchHistory
      .map((search) =>
        [
          `## Query: "${search.query}"`,
          ...search.results.map((result) =>
            [
              `### ${result.date} - ${result.title}`,
              result.url,
              result.snippet,
              `<summary>`,
              result.summary,
              `</summary>`,
            ].join("\n\n"),
          ),
        ].join("\n\n"),
      )
      .join("\n\n");
  }

  getMessageHistory(): string {
    if (this.messageHistory.length === 0) {
      return "No previous conversation history.";
    }

    const messageTexts = extractMessageTexts(this.messageHistory);
    
    return this.messageHistory
      .map((message, index) => {
        const role = message.role === 'assistant' ? 'ai' : message.role;
        const content = messageTexts[index] ?? '';
        return `<${role}>${content}</${role}>`;
      })
      .join('\n');
  }

  getUserLocation(): string {
    if (!this.userLocation) {
      return "User location: Unknown";
    }

    const { longitude, latitude, city, country } = this.userLocation;
    const locationParts = [];
    
    if (city) locationParts.push(city);
    if (country) locationParts.push(country);
    if (latitude && longitude) locationParts.push(`(${latitude}, ${longitude})`);
    
    return `User location: ${locationParts.join(', ') || 'Unknown'}`;
  }

  setLastFeedback(feedback: string) {
    this.lastFeedback = feedback;
  }

  getLastFeedback(): string {
    return this.lastFeedback ?? "No previous feedback available.";
  }
}

export const getNextAction = async (
  context: SystemContext,
  langfuseTraceId?: string,
) => {
  const userQuery = context.getUserQuery();
  const searchHistory = context.getSearchHistory();
  const messageHistory = context.getMessageHistory();
  const userLocation = context.getUserLocation();
  
  const result = await generateObject({
    model,
    schema: actionSchema,
    system: `You are a research query optimizer. Your task is to analyze search results against the original research goal and either decide to answer the question or to search for more information.

PROCESS:
1. Identify ALL information explicitly requested in the original research goal
2. Analyze what specific information has been successfully retrieved in the search results
3. Identify ALL information gaps between what was requested and what was found
4. For entity-specific gaps: Create targeted queries for each missing attribute of identified entities
5. For general knowledge gaps: Create focused queries to find the missing conceptual information

When providing feedback, be specific about:
- What information is still missing
- What aspects of the question remain unanswered
- What specific entities or concepts need more research
- What type of information would be most valuable to find next`,
    prompt: `User Question: "${userQuery}"

User Location:
${userLocation}

Conversation History:
${messageHistory}

Here is the current context of your research:

Context:
${searchHistory || "No search performed yet."}

Analyze the research results against the original question and determine your next action:

1. Choose "continue" if you need more information to provide a comprehensive answer to the user's question.
2. Choose "answer" only if you have sufficient search results with scraped content to provide a complete and accurate answer.

IMPORTANT: When the user asks a follow-up question (like "that's not working"), use the conversation history to understand what they're referring to and determine if you have enough context to answer.

LOCATION CONTEXT: Consider the user's location information when determining if you have sufficient context for location-specific queries.

Provide detailed feedback about what information is missing or what gaps need to be filled. This feedback will be used to guide the next search queries.`,
    experimental_telemetry: langfuseTraceId ? {
      isEnabled: true,
      functionId: "get-next-action",
      metadata: {
        langfuseTraceId: langfuseTraceId,
      },
    } : undefined,
  });

  // Store the feedback in the context
  context.setLastFeedback(result.object.feedback);

  return result.object;
};

export const queryRewriterSchema = z.object({
  plan: z
    .string()
    .describe("A detailed research plan that outlines the logical progression of information needed to answer the user's question."),
  queries: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe("A numbered list of exactly 3 sequential search queries that are specific, focused, and progress logically from foundational to specific information."),
});

export type QueryRewriterResult = z.infer<typeof queryRewriterSchema>;

export const queryRewriter = async (
  context: SystemContext,
  langfuseTraceId?: string,
): Promise<QueryRewriterResult> => {
  const userQuery = context.getUserQuery();
  const searchHistory = context.getSearchHistory();
  const messageHistory = context.getMessageHistory();
  const userLocation = context.getUserLocation();
  const lastFeedback = context.getLastFeedback();
  
  const result = await generateObject({
    model,
    schema: queryRewriterSchema,
    system: `You are a strategic research planner with expertise in breaking down complex questions into logical search steps. Your primary role is to create a detailed research plan before generating any search queries.

First, analyze the question thoroughly:
- Break down the core components and key concepts
- Identify any implicit assumptions or context needed
- Consider what foundational knowledge might be required
- Think about potential information gaps that need filling

Then, develop a strategic research plan that:
- Outlines the logical progression of information needed
- Identifies dependencies between different pieces of information
- Considers multiple angles or perspectives that might be relevant
- Anticipates potential dead-ends or areas needing clarification

Finally, translate this plan into a numbered list of exactly 3 sequential search queries that:
- Are specific and focused (avoid broad queries that return general information)
- Are written in natural language without Boolean operators (no AND/OR)
- Progress logically from foundational to specific information
- Build upon each other in a meaningful way

IMPORTANT: You must generate exactly 3 queries - no more, no less. Choose the most essential queries that will provide the most valuable information for answering the user's question.

Remember that initial queries can be exploratory - they help establish baseline information or verify assumptions before proceeding to more targeted searches. Each query should serve a specific purpose in your overall research plan.

IMPORTANT: Pay special attention to any feedback from the previous evaluation step, as this will guide you toward the most valuable information to search for next.`,
    prompt: `User Question: "${userQuery}"

User Location:
${userLocation}

Conversation History:
${messageHistory}

Current Research Context:
${searchHistory || "No search performed yet."}

Previous Evaluation Feedback:
${lastFeedback}

Based on the user's question, current research context, and the previous evaluation feedback, create a strategic research plan and generate exactly 3 search queries needed to answer the question comprehensively.

The feedback from the previous evaluation step should be your primary guide for what information to search for next. Focus your queries on addressing the specific gaps and missing information identified in the feedback.

If this is a follow-up question, consider the conversation history to understand what additional information is needed.

Use the user's location information to make queries more relevant and localized when appropriate.

REMEMBER: Generate exactly 3 queries - no more, no less.`,
    experimental_telemetry: langfuseTraceId ? {
      isEnabled: true,
      functionId: "query-rewriter",
      metadata: {
        langfuseTraceId: langfuseTraceId,
      },
    } : undefined,
  });

  return result.object;
};
