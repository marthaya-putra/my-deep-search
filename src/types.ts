import type { UIMessage } from "@ai-sdk/react";
import type { Action } from "./system-context";

export type Source = {
  title: string;
  url: string;
  snippet: string;
  favicon?: string;
};




    export type AppMessage = UIMessage<never, {
     "new-action": Action;
     "sources-found": {
      sources: Source[];
      query: string;
     },
     'new-chat': { id: string }
    }>; 
