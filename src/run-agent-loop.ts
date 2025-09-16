import type { StreamTextResult, UIMessageStreamWriter } from "ai";
import { streamText } from "ai";
import { searchSerper } from "~/serper";
import { bulkCrawlWebsites, type BulkCrawlOptions } from "~/crawler";
import { cacheWithRedis } from "~/server/redis/redis";
import { env } from "~/env";
import { SystemContext, getNextAction, queryRewriter, type Action } from "~/system-context";
import { answerQuestion } from "~/answer-question";
import { cachedSummarizeURL } from "~/summarize-url";
import { checkIsSafe } from "~/guardrail";
import { model } from "~/models";
import type { AppMessage, Source } from "~/types";
import type { ModelMessage } from "ai";

// Create a cached version of the scrapePages function
const scrapePages = cacheWithRedis(
  "scrapePages",
  async (options: BulkCrawlOptions) => {
    return await bulkCrawlWebsites(options);
  },
);

// Utility function to extract favicon URL from a website URL
const getFaviconUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch {
    return "";
  }
};

// Copied searchWeb tool implementation
export const searchWeb = async (query: string) => {
  const results: unknown = await searchSerper(
    { q: query, num: env.SEARCH_RESULTS_COUNT },
    undefined,
  );

  // Type guard to ensure results has the expected structure
  if (results && typeof results === 'object' && 'organic' in results && Array.isArray(results.organic)) {
    return results.organic.slice(0, 3).map((result: unknown) => {
      if (result && typeof result === 'object' && 'title' in result && 'link' in result && 'snippet' in result) {
        return {
          title: String(result.title),
          link: String(result.link),
          snippet: String(result.snippet),
          date: '', // Search results don't always have dates, so we'll use empty string
        };
      }
      return { title: '', link: '', snippet: '', date: '' };
    });
  }
  
  return [];
};

// Copied scrapePages tool implementation
export const scrapeUrl = async (urls: string[], maxRetries = 3) => {
  console.log("scraping urls: ", urls);
  const result = await scrapePages({
    urls,
    maxRetries,
  });

  if (result.success) {
    return result.results.map((r) => ({
      url: r.url,
      content: r.result.data,
      success: true as const,
    }));
  } else {
    // Return partial results even if some failed
    return result.results.map((r) => ({
      url: r.url,
      content: r.result.success ? r.result.data : null,
      error: r.result.success ? null : (r.result as { error: string }).error,
      success: r.result.success,
    }));
  }
};

export const runAgentLoop = async (
  userQuery: string,
  opts?: {
    writeMessageParts?: UIMessageStreamWriter<AppMessage>["write"];
    langfuseTraceId?: string;
    messageHistory?: ModelMessage[];
    userLocation?: {
      longitude?: string;
      latitude?: string;
      city?: string;
      country?: string;
    };
  }
): Promise<StreamTextResult<Record<string, never>, string>> => {
  // A persistent container for the state of our system
  const ctx = new SystemContext(userQuery, opts?.messageHistory, opts?.userLocation);

  // Check if the query is safe before proceeding
  const safetyCheck = await checkIsSafe(ctx);
  console.log("safetyCheck: ", safetyCheck);
  
  if (safetyCheck.classification === "refuse") {
    // Return a refusal response using streamText
    return streamText({
      model,
      system: "You are a helpful AI assistant that must refuse certain requests for safety reasons.",
      prompt: `The user has made a request that violates our safety guidelines. Please politely refuse to help with this request.

User's request: "${userQuery}"

Safety reason: ${safetyCheck.reason || "This query violates our safety guidelines."}

Please provide a brief, polite refusal message.`,
    });
  }

  // A loop that continues until we have an answer
  // or we've taken 10 actions
  while (!ctx.shouldStop()) {
    // First, get the research plan and queries
    const queryResult = await queryRewriter(ctx, opts?.langfuseTraceId);
    
    // Send progress annotation to the UI for the planning phase
    opts?.writeMessageParts?.({
      type: "data-new-action",
      data: {
        title: "Planning research strategy",
        reasoning: queryResult.plan,
        type: "continue",
      } as Action,
    });   

    // Execute all queries in parallel for maximum speed
    const searchPromises = queryResult.queries.map(async (query) => {
      // Search for results
      const searchResults = await searchWeb(query);
      
      // Extract URLs from search results
      const urls = searchResults.map(result => result.link);
      
      // Scrape the URLs
      const scrapeResults = await scrapeUrl(urls);
      
      // Combine search results with scraped content
      const combinedResults = searchResults.map((searchResult, index) => {
        const scrapeResult = scrapeResults[index];
        return {
          date: searchResult.date,
          title: searchResult.title,
          url: searchResult.link,
          snippet: searchResult.snippet,
          scrapedContent: scrapeResult?.success && scrapeResult?.content 
            ? String(scrapeResult.content)
            : "Failed to scrape content",
        };
      });

      // Summarize each URL in parallel
      const summarizationPromises = combinedResults.map(async (result) => {
        if (result.scrapedContent && result.scrapedContent !== "Failed to scrape content") {
          try {
            const summary = await cachedSummarizeURL({
              conversationHistory: opts?.messageHistory ?? [],
              scrapedContent: result.scrapedContent,
              searchMetadata: {
                title: result.title,
                url: result.url,
                snippet: result.snippet,
                date: result.date,
              },
              searchQuery: query,
              langfuseTraceId: opts?.langfuseTraceId,
            });
            return {
              ...result,
              summary,
            };
          } catch (error) {
            console.error(`Failed to summarize ${result.url}:`, error);
            return {
              ...result,
              summary: result.scrapedContent, // Fallback to original content
            };
          }
        }
        return {
          ...result,
          summary: result.scrapedContent, // Use original content if scraping failed
        };
      });

      // Wait for all summarizations to complete
      const summarizedResults = await Promise.all(summarizationPromises);
      
      return {
        query,
        results: summarizedResults,
        searchResults, // Include original search results for source collection
      };
    });

    // Wait for all searches to complete
    const allSearchResults = await Promise.all(searchPromises);
    
    // Collect all unique sources from all search queries
    const allSources = new Map<string, Source>();
    const allQueries: string[] = [];
    
    allSearchResults.forEach(searchResult => {
      allQueries.push(searchResult.query);
      searchResult.searchResults.forEach(result => {
        // Use URL as key to ensure uniqueness
        if (!allSources.has(result.link)) {
          allSources.set(result.link, {
            title: result.title,
            url: result.link,
            snippet: result.snippet,
            favicon: getFaviconUrl(result.link),
          });
        }
      });
    });
    
    // Send single sources annotation with all unique sources
    if (allSources.size > 0) {
      opts?.writeMessageParts?.({
        type: "data-sources-found",
        data: {
          sources: Array.from(allSources.values()),
          query: allQueries.join(", "), // Show all queries that were searched
        },
      });
    }
    
    // Report all search results to the context
    allSearchResults.forEach(searchResult => {
      ctx.reportSearch({
        query: searchResult.query,
        results: searchResult.results,
      });
    });

    // Now decide whether to continue or answer
    const nextAction = await getNextAction(ctx, opts?.langfuseTraceId);

    // Send progress annotation to the UI
    opts?.writeMessageParts?.({
      type: "data-new-action",
      data: nextAction as Action,
    });

    // Execute the action
    if (nextAction.type === "answer") {
      return answerQuestion(ctx, { langfuseTraceId: opts?.langfuseTraceId });
    }

    // We increment the step counter
    ctx.incrementStep();
  }

  // If we've taken 10 actions and still don't have an answer,
  // we ask the LLM to give its best attempt at an answer
    return answerQuestion(ctx, { isFinal: true, langfuseTraceId: opts?.langfuseTraceId });
};
