"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";

interface PostContentProps {
  content: string;
}

export function PostContent({ content }: PostContentProps) {
  const components: Components = {
    h1: ({ children }) => (
      <h1 className="font-display text-display-xl text-ink mt-12 mb-6">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="font-display text-display-md text-ink mt-10 mb-4 pb-2 border-b border-hairline">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-display text-display-sm text-ink mt-8 mb-3">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-title-md text-body-strong mt-6 mb-2">
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className="text-body-md text-body leading-relaxed mb-4">
        {children}
      </p>
    ),
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
    ul: ({ children }) => (
      <ul className="list-none space-y-2 mb-4">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside space-y-2 mb-4 text-body">
        {children}
      </ol>
    ),
    li: ({ children, ordered }) => (
      <li className={`text-body leading-relaxed ${ordered ? "" : "flex items-start gap-3"}`}>
        {!ordered && (
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-2.5" />
        )}
        <span className="flex-1">{children}</span>
      </li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="relative my-8 mx-0 pl-6 py-1 border-l-4 border-primary">
        <div className="absolute -left-2 -top-2 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-lg">💡</span>
        </div>
        <div className="bg-canvas-soft rounded-lg p-4 text-body leading-relaxed">
          {children}
        </div>
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
            {...props}
          >
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        </div>
      );
    },
    pre: ({ children }) => (
      <pre className="not-prose my-6 rounded-lg overflow-hidden">
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="my-6 overflow-x-auto">
        <table className="w-full border-collapse rounded-lg overflow-hidden shadow-card">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-primary text-on-primary">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-hairline">
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-canvas-soft transition-colors">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-3 text-left text-caption font-medium">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 text-body-sm text-body">
        {children}
      </td>
    ),
    hr: () => (
      <hr className="my-10 border-hairline" />
    ),
    strong: ({ children }) => (
      <strong className="font-body-strong text-body-strong">
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic text-body">
        {children}
      </em>
    ),
    img: ({ src, alt }) => (
      <figure className="my-6">
        <img
          src={src}
          alt={alt || ""}
          className="rounded-lg w-full object-cover max-h-96"
        />
        {alt && (
          <figcaption className="mt-2 text-caption text-muted text-center">
            {alt}
          </figcaption>
        )}
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