import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

interface MarkdownProps {
  content: string;
}

export default function Markdown({ content }: MarkdownProps) {
  return (
    <div className="prose prose-slate max-w-none prose-p:leading-relaxed prose-pre:p-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          return !inline && match ? (
            <div className="rounded-lg overflow-hidden my-4">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-slate-200 text-xs">
                <span>{match[1]}</span>
              </div>
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: 0,
                  fontSize: "0.875rem",
                }}
                {...props}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code
              className={`${className} bg-slate-100 text-slate-800 rounded px-1.5 py-0.5 text-sm font-mono`}
              {...props}
            >
              {children}
            </code>
          );
        },
        // Custom styling for other elements if needed
        a: ({ node, ...props }) => (
          <a
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
            {...props}
          />
        ),
        table: ({ node, ...props }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg" {...props} />
          </div>
        ),
        th: ({ node, ...props }) => (
          <th className="px-4 py-3 bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200" {...props} />
        ),
        td: ({ node, ...props }) => (
          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 border-b border-slate-200" {...props} />
        ),
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}