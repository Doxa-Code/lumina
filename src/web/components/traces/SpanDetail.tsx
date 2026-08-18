import { useState } from 'react';
import { X, Copy, ExternalLink, ChevronRight, Check } from 'lucide-react';
import { Button } from '../ui/button';
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

interface SpanDetailProps {
  span: Span;
  onClose: () => void;
  onCopySuccess?: () => void;
}

type TabType = 'span' | 'logs' | 'events' | 'raw';

// JSON syntax highlighting component
function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const indent = '  '.repeat(depth);

  if (value === null) {
    return <span className="text-purple-400">null</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-purple-400">{value ? 'true' : 'false'}</span>;
  }

  if (typeof value === 'number') {
    return <span className="text-cyan-400">{value}</span>;
  }

  if (typeof value === 'string') {
    // Check if it's a URL
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return <span className="text-green-400">"{value}"</span>;
    }
    return <span className="text-green-400">"{value}"</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-foreground">[]</span>;
    }
    return (
      <span>
        <span className="text-foreground">[</span>
        {value.map((item, idx) => (
          <span key={idx}>
            {'\n' + '  '.repeat(depth + 1)}
            <JsonValue value={item} depth={depth + 1} />
            {idx < value.length - 1 && ','}
          </span>
        ))}
        {'\n' + indent}<span className="text-foreground">]</span>
      </span>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-foreground">{'{}'}</span>;
    }
    return (
      <span>
        <span className="text-foreground">{'{'}</span>
        {entries.map(([key, val], idx) => (
          <span key={key}>
            {'\n' + '  '.repeat(depth + 1)}
            <span className="text-blue-400">{key}</span>
            <span className="text-foreground">: </span>
            <JsonValue value={val} depth={depth + 1} />
            {idx < entries.length - 1 && ','}
          </span>
        ))}
        {'\n' + indent}<span className="text-foreground">{'}'}</span>
      </span>
    );
  }

  return <span>{String(value)}</span>;
}


export function SpanDetail({ span, onClose, onCopySuccess }: SpanDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('span');
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(span, null, 2));
    setCopiedJson(true);
    onCopySuccess?.();
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Extract request details for View Request
  const getRequestDetails = () => {
    const attrs = (span.attributes || {}) as Record<string, unknown>;
    const details: Record<string, unknown> = {};

    // HTTP details
    if (attrs['http.method']) details['Method'] = attrs['http.method'];
    if (attrs['http.url']) details['URL'] = attrs['http.url'];
    if (attrs['http.target']) details['Target'] = attrs['http.target'];
    if (attrs['http.host']) details['Host'] = attrs['http.host'];
    if (attrs['http.scheme']) details['Scheme'] = attrs['http.scheme'];
    if (attrs['http.status_code']) details['Status Code'] = attrs['http.status_code'];
    if (attrs['http.request_content_length']) details['Request Size'] = attrs['http.request_content_length'];
    if (attrs['http.response_content_length']) details['Response Size'] = attrs['http.response_content_length'];
    if (attrs['http.user_agent']) details['User Agent'] = attrs['http.user_agent'];

    // Request headers
    const headers: Record<string, unknown> = {};
    Object.entries(attrs).forEach(([key, value]) => {
      if (key.startsWith('http.request.header.')) {
        headers[key.replace('http.request.header.', '')] = value;
      }
    });
    if (Object.keys(headers).length > 0) {
      details['Request Headers'] = headers;
    }

    // Response headers
    const responseHeaders: Record<string, unknown> = {};
    Object.entries(attrs).forEach(([key, value]) => {
      if (key.startsWith('http.response.header.')) {
        responseHeaders[key.replace('http.response.header.', '')] = value;
      }
    });
    if (Object.keys(responseHeaders).length > 0) {
      details['Response Headers'] = responseHeaders;
    }

    return details;
  };

  const requestDetails = getRequestDetails();
  const hasRequestDetails = Object.keys(requestDetails).length > 0;

  // Build the span data structure similar to Baselime
  const spanData: Record<string, unknown> = {};

  // Group HTTP attributes
  const httpAttrs: Record<string, unknown> = {};
  const dbAttrs: Record<string, unknown> = {};
  const netAttrs: Record<string, unknown> = {};
  const otherAttrs: Record<string, unknown> = {};

  const spanAttrs = (span.attributes || {}) as Record<string, unknown>;
  Object.entries(spanAttrs).forEach(([key, value]) => {
    if (key.startsWith('http.') || key.startsWith('http_')) {
      httpAttrs[key.replace('http.', '').replace('http_', '')] = value;
    } else if (key.startsWith('db.')) {
      dbAttrs[key.replace('db.', '')] = value;
    } else if (key.startsWith('net.') || key.startsWith('network.')) {
      netAttrs[key.replace('net.', '').replace('network.', '')] = value;
    } else {
      otherAttrs[key] = value;
    }
  });

  if (Object.keys(httpAttrs).length > 0) {
    spanData['http'] = httpAttrs;
  }
  if (Object.keys(dbAttrs).length > 0) {
    spanData['db'] = dbAttrs;
  }
  if (Object.keys(netAttrs).length > 0) {
    spanData['net'] = netAttrs;
  }
  Object.assign(spanData, otherAttrs);

  const spanEvents = (span.events || []) as Array<{ name: string; timestamp: string; attributes: Record<string, unknown> }>;

  const tabs = [
    { id: 'span' as const, label: 'Span' },
    { id: 'logs' as const, label: 'Logs' },
    { id: 'events' as const, label: `Span Events (${spanEvents.length})` },
    { id: 'raw' as const, label: 'Raw data' },
  ];

  return (
    <div className="w-[450px] border-l bg-card h-full flex flex-col relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Span Title */}
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-sm font-medium ${span.statusCode === 'ERROR' ? 'text-red-400' : 'text-primary'}`}>
            {span.kind}
          </span>
          <span className="text-foreground font-medium">{span.name}</span>
        </div>

        {/* Timing info */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground mb-1">start time</div>
            <div className="font-mono text-xs">
              {new Date(span.startTime).toLocaleString('en-US', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">end time</div>
            <div className="font-mono text-xs">
              {new Date(span.endTime).toLocaleString('en-US', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">duration</div>
            <div className="font-mono text-xs">{formatDuration(span.durationMs || 0)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'span' && (
          <div>
            {/* Action buttons */}
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setShowRequestDialog(true)}
                disabled={!hasRequestDetails}
                title={hasRequestDetails ? 'View HTTP request details' : 'No HTTP request details available'}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View request
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={copyJson}>
                {copiedJson ? (
                  <Check className="h-3 w-3 mr-1 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                {copiedJson ? 'Copied!' : 'Copy JSON'}
              </Button>
            </div>

            {/* Request Dialog */}
            {showRequestDialog && hasRequestDetails && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-card border rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] flex flex-col mx-4">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold">HTTP Request Details</h3>
                    <Button variant="ghost" size="icon" onClick={() => setShowRequestDialog(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="p-4 overflow-auto flex-1">
                    <div className="bg-background rounded-lg p-4 border">
                      <pre className="text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
                        <JsonValue value={requestDetails} />
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* JSON View of attributes */}
            <div className="bg-background rounded-lg p-4 border">
              <pre className="text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
                <span className="text-foreground">{'{'}</span>
                {Object.entries(spanData).map(([key, value], idx, arr) => (
                  <span key={key}>
                    {'\n  '}
                    <span className="text-muted-foreground">{key}</span>
                    <span className="text-foreground">: </span>
                    {typeof value === 'object' ? (
                      <span>
                        <span className="text-foreground">{'{'}</span>
                        {Object.entries(value as Record<string, unknown>).map(([k, v], i, a) => (
                          <span key={k}>
                            {'\n    '}
                            <span className="text-muted-foreground">{k}</span>
                            <span className="text-foreground">: </span>
                            <span className="text-green-400">
                              {typeof v === 'string' ? `"${v}"` : String(v)}
                            </span>
                            {i < a.length - 1 && ','}
                          </span>
                        ))}
                        {'\n  '}<span className="text-foreground">{'}'}</span>
                      </span>
                    ) : (
                      <span className="text-green-400">
                        {typeof value === 'string' ? `"${value}"` : String(value)}
                      </span>
                    )}
                    {idx < arr.length - 1 && ','}
                  </span>
                ))}
                {'\n'}<span className="text-foreground">{'}'}</span>
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">No logs correlated with this span</p>
          </div>
        )}

        {activeTab === 'events' && (
          <div>
            {spanEvents.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-sm">No events in this span</p>
              </div>
            ) : (
              <div className="space-y-4">
                {spanEvents.map((event, idx) => (
                  <div key={idx} className="bg-background rounded-lg p-4 border overflow-hidden">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm font-medium break-all">{event.name}</span>
                      <span className="text-xs text-muted-foreground font-mono shrink-0">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {Object.keys(event.attributes).length > 0 && (
                      <pre className="text-xs font-mono leading-relaxed text-muted-foreground mt-2 overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(event.attributes, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <div>
            <div className="flex justify-end mb-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={copyJson}>
                {copiedJson ? (
                  <Check className="h-3 w-3 mr-1 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                {copiedJson ? 'Copied!' : 'Copy JSON'}
              </Button>
            </div>
            <div className="bg-background rounded-lg p-4 border">
              <pre className="text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap text-muted-foreground">
                {JSON.stringify(span, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
