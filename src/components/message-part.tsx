"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import type { AppMessage, Source } from "~/types";

const components: Components = {
  // Override default elements with custom styling
  p: ({ children }) => <p className="mb-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-4">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  code: ({ className, children, ...props }) => (
    <code className={`${className ?? ""} bg-gray-600 px-1 py-0.5 rounded text-sm`} {...props}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded bg-gray-600 p-2 text-xs">
      {children}
    </pre>
  ),
  a: ({ children, ...props }) => (
    <a
      className="text-blue-400 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
};

const Markdown = ({ children }: { children: string }) => {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
};

const SourceCard = ({ source }: { source: Source }) => {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-gray-600 bg-gray-800 p-3 transition-colors hover:bg-gray-700"
    >
      <div className="flex items-start gap-3">
        {source.favicon && (
          <img
            src={source.favicon}
            alt=""
            className="size-4 flex-shrink-0 mt-0.5"
            onError={(e) => {
              // Hide favicon if it fails to load
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-gray-200 line-clamp-2">
            {source.title}
          </h4>
          <p className="mt-1 text-xs text-gray-400 line-clamp-2">
            {source.snippet}
          </p>
          <p className="mt-1 text-xs text-blue-400 truncate">
            {source.url}
          </p>
        </div>
      </div>
    </a>
  );
};

const SourcesDisplay = ({ sources, query }: { sources: Source[]; query: string }) => {
  return (
    <div className="mt-3">
      <div className="mb-2 text-sm font-medium text-blue-400">
        Found {sources.length} sources for: &ldquo;{query}&rdquo;
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {sources.map((source, index) => (
          <SourceCard key={`${source.url}-${index}`} source={source} />
        ))}
      </div>
    </div>
  );
};

export const MessagePart = ({
  messagePart,
}: {  
  messagePart: AppMessage["parts"][number];
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  if (!messagePart) return null;

  // Handle SOURCES_FOUND annotation type
  if(messagePart.type === "text") {
    return (
      <div className="prose prose-invert max-w-none">
        <Markdown>{messagePart.text}</Markdown>
      </div>
    );
  }
  if (messagePart.type === "data-sources-found") {
    return (
      <div className="mb-4 w-full">
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`min-w-34 flex w-full flex-shrink-0 items-center rounded px-2 py-1 text-left text-sm transition-colors ${
              isOpen
                ? "bg-gray-700 text-gray-200"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-300"
            }`}
          >
            <span
              className={`z-10 mr-3 flex size-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-500 text-xs font-bold ${
                isOpen
                  ? "border-blue-400 text-white"
                  : "bg-gray-800 text-gray-300"
              }`}
            >
              •
            </span>
            Found {messagePart.data.sources.length} sources
          </button>
          <div className={`${isOpen ? "mt-1" : "hidden"}`}>
            {isOpen && (
              <div className="px-2 py-1">
                <SourcesDisplay sources={messagePart.data.sources} query={messagePart.data.query} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if(messagePart.type === "data-new-action") {
  return (
    <div className="mb-4 w-full">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`min-w-34 flex w-full flex-shrink-0 items-center rounded px-2 py-1 text-left text-sm transition-colors ${
            isOpen
              ? "bg-gray-700 text-gray-200"
              : "text-gray-400 hover:bg-gray-800 hover:text-gray-300"
          }`}
        >
          <span
            className={`z-10 mr-3 flex size-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-500 text-xs font-bold ${
              isOpen
                ? "border-blue-400 text-white"
                : "bg-gray-800 text-gray-300"
            }`}
          >
            •
          </span>
          {messagePart.data.title}
        </button>
        <div className={`${isOpen ? "mt-1" : "hidden"}`}>
          {isOpen && (
            <div className="px-2 py-1">
              <div className="text-sm italic text-gray-400">
                <Markdown>{messagePart.data.reasoning}</Markdown>
              </div>
              {messagePart.data.type === "continue" && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                  <SearchIcon className="size-4" />
                  <span>Continuing research...</span>
                </div>
              )}
              {messagePart.data.feedback && (
                <div className="mt-3 rounded bg-gray-800 p-3">
                  <div className="mb-2 text-sm font-medium text-blue-400">
                    Evaluation Feedback:
                  </div>
                  <div className="text-sm text-gray-300">
                    <Markdown>{messagePart.data.feedback}</Markdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    );
  }

  return null;
};
