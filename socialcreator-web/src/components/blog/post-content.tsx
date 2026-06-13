"use client";

import Image from "next/image";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

interface PostContentProps {
  content: string;
}

export function PostContent({ content }: PostContentProps) {
  const components: Components = {
    h1: ({ children }) => (
      <h1 className="font-display text-display-xl text-ink mt-12 mb-6">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="font-display text-display-md text-ink mt-10 mb-4 pb-2 border-b border-hairline">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-display text-display-sm text-ink mt-8 mb-3">{children}</h3>
    ),
    h4: ({ children }) => <h4 className="text-title-md text-body-strong mt-6 mb-2">{children}</h4>,
    p: ({ children }) => <p className="text-body-md text-body leading-relaxed mb-4">{children}</p>,
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-primary underline underline-offset-2 hover:text-primary-active transition-colors"
        target={href?.startsWith("http") ? "_blank" : undefined}
        rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    ),
    ul: ({ children }) => <ul className="list-none space-y-2 mb-4">{children}</ul>,
    ol: ({ children }) => (
      <ol className="list-decimal list-inside space-y-2 mb-4 text-body">{children}</ol>
    ),
    li: ({ children, ...props }) => {
      // @ts-expect-error - ordered prop may not exist in all versions
      const ordered = props.ordered as boolean | undefined;
      return (
        <li className={`text-body leading-relaxed ${ordered ? "" : "flex items-start gap-3"}`}>
          {!ordered && (
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-2.5" />
          )}
          <span className="flex-1">{children}</span>
        </li>
      );
    },
    blockquote: ({ children }) => (
      <blockquote className="relative my-8 mx-0 pl-10 py-4 rounded-lg bg-primary/5 border border-primary/20">
        <div className="absolute left-3 top-4 w-5 h-5 text-primary" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Tip</title>
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
          </svg>
        </div>
        <div className="text-body leading-relaxed">{children}</div>
      </blockquote>
    ),
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || "");
      const isInline = !match && !className;

      if (isInline) {
        return (
          <code
            className="px-1.5 py-0.5 rounded-sm bg-surface-dark text-on-dark text-caption font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <div className="relative my-6 rounded-lg overflow-hidden">
          <div className="bg-surface-dark px-4 py-2 flex items-center justify-between">
            <span className="text-caption text-on-dark/60 font-mono">
              {match ? match[1] : "code"}
            </span>
          </div>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match ? match[1] : "text"}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: "14px",
            }}
          >
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        </div>
      );
    },
    pre: ({ children }) => (
      <pre className="not-prose my-6 rounded-lg overflow-hidden">{children}</pre>
    ),
    table: ({ children }) => (
      <div className="my-6 overflow-x-auto">
        <table className="w-full border-collapse rounded-lg overflow-hidden shadow-card">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-primary text-on-primary">{children}</thead>,
    tbody: ({ children }) => <tbody className="divide-y divide-hairline">{children}</tbody>,
    tr: ({ children }) => <tr className="hover:bg-canvas-soft transition-colors">{children}</tr>,
    th: ({ children }) => (
      <th className="px-4 py-3 text-left text-caption font-medium">{children}</th>
    ),
    td: ({ children }) => <td className="px-4 py-3 text-body-sm text-body">{children}</td>,
    hr: () => <hr className="my-10 border-hairline" />,
    strong: ({ children }) => (
      <strong className="font-body-strong text-body-strong">{children}</strong>
    ),
    em: ({ children }) => <em className="italic text-body">{children}</em>,
    img: ({ src, alt }) => (
      <figure className="my-6">
        {src && (
          <div className="relative w-full h-96 rounded-lg overflow-hidden">
            <Image
              src={typeof src === "string" ? src : ""}
              alt={alt || ""}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 800px"
            />
          </div>
        )}
        {alt && <figcaption className="mt-2 text-caption text-muted text-center">{alt}</figcaption>}
      </figure>
    ),
  };

  return (
    <div className="prose-blog">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
