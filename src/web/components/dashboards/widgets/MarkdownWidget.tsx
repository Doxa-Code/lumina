import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownWidgetProps {
  data: {
    content: string;
  };
  config: {
    content: string;
  };
}

export function MarkdownWidget({ data, config }: MarkdownWidgetProps) {
  const content = data.content || config.content || '';

  if (!content) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">No content</p>
      </div>
    );
  }

  return (
    <div className="prose prose-sm prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
