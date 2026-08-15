import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { formatDuration } from '../../lib/utils';

interface Span {
  id: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  serviceName: string;
  serviceNamespace?: string | null;
  serviceVersion?: string | null;
  name: string;
  kind: string;
  statusCode: string;
  statusMessage?: string | null;
  startTime: string;
  endTime: string;
  durationMs?: number | null;
  attributes: unknown;
  resourceAttributes: unknown;
  events: unknown;
  links?: unknown;
}

interface TraceWaterfallProps {
  spans: Span[];
  selectedSpanId?: string;
  onSpanClick?: (span: Span) => void;
  traceStartTime: string;
  traceDurationMs: number;
}

interface SpanNode {
  span: Span;
  depth: number;
  children: SpanNode[];
}

// Color based on span type/operation
function getSpanColor(span: Span): string {
  const name = span.name.toLowerCase();
  const kind = span.kind.toLowerCase();
  const attributes = (span.attributes || {}) as Record<string, unknown>;

  // HTTP/API Gateway requests - Green
  if (
    kind === 'server' ||
    name.startsWith('get ') ||
    name.startsWith('post ') ||
    name.startsWith('put ') ||
    name.startsWith('delete ') ||
    name.startsWith('patch ') ||
    attributes['http.method'] ||
    attributes['http.request.method']
  ) {
    return 'bg-green-500';
  }

  // Lambda Invoke (the invocation itself) - Purple
  if (
    name.includes('invoke') ||
    name === 'lambda' ||
    (attributes['rpc.service'] === 'Lambda' && attributes['rpc.method'] === 'Invoke')
  ) {
    return 'bg-purple-500';
  }

  // Lambda function execution - Orange
  if (
    span.serviceName.toLowerCase().includes('lambda') ||
    attributes['faas.name'] ||
    attributes['cloud.platform'] === 'aws_lambda' ||
    attributes['aws.lambda.invoked_arn']
  ) {
    return 'bg-orange-500';
  }

  // DynamoDB - Gray
  if (
    name.includes('dynamodb') ||
    name.includes('query') ||
    attributes['db.system'] === 'dynamodb' ||
    attributes['rpc.service'] === 'DynamoDB'
  ) {
    return 'bg-gray-400';
  }

  // Other databases - Gray
  if (attributes['db.system']) {
    return 'bg-gray-400';
  }

  // Overhead/Internal - Gray
  if (name.includes('overhead') || kind === 'internal') {
    return 'bg-gray-400';
  }

  // Default - Gray
  return 'bg-gray-400';
}

export function TraceWaterfall({
  spans,
  selectedSpanId,
  onSpanClick,
  traceStartTime,
  traceDurationMs,
}: TraceWaterfallProps) {
  const { tree, flatList } = useMemo(() => {
    const spanMap = new Map<string, Span>();
    const childrenMap = new Map<string, Span[]>();

    for (const span of spans) {
      spanMap.set(span.spanId, span);
      if (span.parentSpanId) {
        const children = childrenMap.get(span.parentSpanId) || [];
        children.push(span);
        childrenMap.set(span.parentSpanId, children);
      }
    }

    const rootSpans = spans.filter((s) => !s.parentSpanId || !spanMap.has(s.parentSpanId));

    const buildTree = (span: Span, depth: number): SpanNode => {
      const children = childrenMap.get(span.spanId) || [];
      children.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      return {
        span,
        depth,
        children: children.map((c) => buildTree(c, depth + 1)),
      };
    };

    const tree = rootSpans
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .map((s) => buildTree(s, 0));

    const flatList: SpanNode[] = [];
    const flatten = (node: SpanNode) => {
      flatList.push(node);
      node.children.forEach(flatten);
    };
    tree.forEach(flatten);

    return { tree, flatList };
  }, [spans]);

  const traceStart = new Date(traceStartTime).getTime();

  return (
    <div className="w-full">
      <div className="flex border-b text-xs text-muted-foreground py-2 px-4">
        <div className="w-72 shrink-0">Service / Operation</div>
        <div className="flex-1 flex justify-between px-2">
          <span>0ms</span>
          <span>{formatDuration(traceDurationMs / 4)}</span>
          <span>{formatDuration(traceDurationMs / 2)}</span>
          <span>{formatDuration((traceDurationMs * 3) / 4)}</span>
          <span>{formatDuration(traceDurationMs)}</span>
        </div>
      </div>

      <div className="divide-y">
        {flatList.map((node) => {
          const span = node.span;
          const spanStart = new Date(span.startTime).getTime();
          const spanDuration = span.durationMs || 0;
          const leftPercent = ((spanStart - traceStart) / traceDurationMs) * 100;
          const widthPercent = (spanDuration / traceDurationMs) * 100;
          const spanColor = getSpanColor(span);

          return (
            <div
              key={span.id}
              className={cn(
                'flex items-center py-2 px-4 cursor-pointer hover:bg-muted/50 transition-colors',
                selectedSpanId === span.spanId && 'bg-muted'
              )}
              onClick={() => onSpanClick?.(span)}
            >
              <div
                className="w-72 shrink-0 flex items-center gap-2 overflow-hidden"
                style={{ paddingLeft: `${node.depth * 16}px` }}
              >
                <div className={cn('w-2 h-2 rounded-full shrink-0', spanColor)} />
                <div className="truncate">
                  <span className="text-sm font-medium">{span.serviceName}</span>
                  <span className="text-xs text-muted-foreground ml-2 truncate">
                    {span.name}
                  </span>
                </div>
              </div>

              <div className="flex-1 relative h-6">
                <div
                  className={cn(
                    'absolute h-full rounded-sm flex items-center px-2 text-xs text-white',
                    span.statusCode === 'ERROR' ? 'bg-red-500' : spanColor
                  )}
                  style={{
                    left: `${Math.max(0, leftPercent)}%`,
                    width: `${Math.max(0.5, widthPercent)}%`,
                    minWidth: '4px',
                  }}
                >
                  <span className="truncate">{formatDuration(spanDuration)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
