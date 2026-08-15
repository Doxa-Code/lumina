import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Key, Plus, Copy, Trash2, Check, Eye, EyeOff, BookOpen, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { CodeBlock } from '../../components/ui/code-block';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { timeAgo } from '../../lib/utils';

export function ApiKeysPage() {
  const { currentProject } = useProjectStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: apiKeys, isLoading } = trpc.projects.listApiKeys.useQuery(
    { projectId: currentProject?.id! },
    { enabled: !!currentProject }
  );

  const createKeyMutation = trpc.projects.createApiKey.useMutation({
    onSuccess: (data) => {
      setCreatedKey(data.key);
      setNewKeyName('');
      setShowCreateForm(false);
      utils.projects.listApiKeys.invalidate();
    },
  });

  const deleteKeyMutation = trpc.projects.deleteApiKey.useMutation({
    onSuccess: () => {
      utils.projects.listApiKeys.invalidate();
    },
  });

  const handleCreateKey = () => {
    if (!currentProject || !newKeyName) return;
    createKeyMutation.mutate({
      projectId: currentProject.id,
      name: newKeyName,
      permissions: ['ingest'],
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to manage API keys</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground">
          Manage API keys for {currentProject.name}
        </p>
      </div>

      {createdKey && (
        <Card className="border-green-500/50 bg-green-500/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-green-500 mb-2">API Key Created</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Make sure to copy your API key now. You won't be able to see it again!
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted p-3 rounded font-mono text-sm">
                    {createdKey}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(createdKey, 'new-key')}
                  >
                    {copiedId === 'new-key' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCreatedKey(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Project API Keys</CardTitle>
              <CardDescription>
                Use these keys to send telemetry data via OpenTelemetry
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showCreateForm && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/30">
              <h4 className="font-medium mb-3">Create New API Key</h4>
              <div className="flex gap-3">
                <Input
                  placeholder="Key name (e.g., Production Backend)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleCreateKey}
                  disabled={!newKeyName || createKeyMutation.isPending}
                >
                  {createKeyMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : apiKeys?.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No API keys yet</p>
              <p className="text-sm text-muted-foreground">
                Create an API key to start sending telemetry data
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {apiKeys?.map((key) => (
                <div key={key.id} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{key.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3">
                        <code className="bg-muted px-1.5 py-0.5 rounded">
                          {key.keyPrefix}...
                        </code>
                        <span>
                          Created {timeAgo(key.createdAt)}
                        </span>
                        {key.lastUsedAt && (
                          <span>Last used {timeAgo(key.lastUsedAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {(key.permissions as string[]).map((perm: string) => (
                        <span
                          key={perm}
                          className="text-xs bg-muted px-2 py-0.5 rounded capitalize"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => deleteKeyMutation.mutate({ keyId: key.id })}
                      disabled={deleteKeyMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Instrumentation Examples
              </CardTitle>
              <CardDescription className="mt-1">
                Complete OpenTelemetry setup guides for all major languages and frameworks
              </CardDescription>
            </div>
            <Link to="/docs/instrumentation">
              <Button>
                View All Examples
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['Node.js', 'Python', 'Go', 'Java', 'Rust', '.NET', 'Ruby', 'PHP'].map((lang) => (
              <Link
                key={lang}
                to="/docs/instrumentation"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
              >
                <span>{lang}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <CodeBlock
            title="Node.js / TypeScript"
            language="typescript"
            highlightLines={[5, 6, 7]}
            code={`import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: '${window.location.origin}/v1/traces',
    headers: { 'Authorization': 'Bearer <YOUR_API_KEY>' }
  }),
});

sdk.start();`}
          />

          <CodeBlock
            title="cURL"
            language="bash"
            highlightLines={[3]}
            code={`curl -X POST ${window.location.origin}/v1/traces \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -d '{"resourceSpans": [...]}'`}
          />

          <div className="pt-2">
            <Link
              to="/docs/instrumentation"
              className="text-primary hover:underline text-sm flex items-center gap-1"
            >
              See all instrumentation examples
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
