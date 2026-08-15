import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronDown, ChevronRight, Clock, Hash, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { timeAgo } from '../../lib/utils';

interface ErrorGroup {
  id: string;
  fingerprint: string;
  message: string;
  type: string | null;
  serviceName: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  status: string;
  affectedTraces: string[];
}

function ErrorGroupRow({
  group,
  isExpanded,
  onToggle,
  onUpdateStatus,
  isUpdating,
}: {
  group: ErrorGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (errorGroupId: string, status: 'active' | 'resolved' | 'ignored') => void;
  isUpdating: boolean;
}) {
  return (
    <div className="border-b last:border-b-0">
      <div
        className="flex items-start py-4 px-4 cursor-pointer hover:bg-muted/50 transition-colors gap-4"
        onClick={onToggle}
      >
        <button className="mt-1 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              group.status === 'open'
                ? 'bg-red-500/10 text-red-500'
                : group.status === 'resolved'
                ? 'bg-green-500/10 text-green-500'
                : 'bg-gray-500/10 text-gray-500'
            }`}>
              {group.status.toUpperCase()}
            </span>
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {group.serviceName}
            </span>
            <span className="text-xs text-muted-foreground">
              {group.type || 'Error'}
            </span>
          </div>
          <div className="text-sm font-medium truncate">{group.message}</div>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {group.count} occurrences
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              First: {timeAgo(group.firstSeen)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last: {timeAgo(group.lastSeen)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-2xl font-bold text-red-500">{group.count}</div>
            <div className="text-xs text-muted-foreground">events</div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 bg-muted/30 border-t ml-8">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Error Message</h4>
              <pre className="text-sm bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono">
                {group.message}
              </pre>
            </div>

            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-mono">{group.type || 'Error'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Service:</span>{' '}
                  <span>{group.serviceName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fingerprint:</span>{' '}
                  <code className="text-xs bg-muted px-1 rounded">{group.fingerprint.slice(0, 16)}...</code>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <span className="capitalize">{group.status}</span>
                </div>
              </div>
            </div>

            {group.affectedTraces.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  Recent Affected Traces
                </h4>
                <div className="space-y-1">
                  {group.affectedTraces.slice(0, 5).map((traceId) => (
                    <Link
                      key={traceId}
                      to={`/traces/${traceId}`}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <code className="font-mono">{traceId}</code>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {group.status !== 'resolved' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(group.id, 'resolved');
                  }}
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Updating...' : 'Mark as Resolved'}
                </Button>
              )}
              {group.status !== 'ignored' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(group.id, 'ignored');
                  }}
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Updating...' : 'Ignore'}
                </Button>
              )}
              {group.status !== 'open' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(group.id, 'active');
                  }}
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Updating...' : 'Reopen'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ErrorsPage() {
  const { currentProject } = useProjectStore();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved' | 'ignored'>('all');

  const utils = trpc.useUtils();

  // Fetch errors from API
  const apiStatus = statusFilter === 'all' ? undefined : (statusFilter === 'open' ? 'active' : statusFilter);
  const { data: errorGroups, isLoading } = trpc.errors.list.useQuery(
    { status: apiStatus as 'active' | 'resolved' | 'ignored' | undefined },
    { enabled: !!currentProject }
  );

  // Fetch stats for overview cards
  const { data: stats } = trpc.errors.stats.useQuery(
    undefined,
    { enabled: !!currentProject }
  );

  // Update error status mutation
  const updateStatusMutation = trpc.errors.updateStatus.useMutation({
    onSuccess: () => {
      utils.errors.list.invalidate();
      utils.errors.stats.invalidate();
    },
  });

  // Sync errors from spans automatically on mount
  const syncMutation = trpc.errors.sync.useMutation({
    onSuccess: () => {
      utils.errors.list.invalidate();
      utils.errors.stats.invalidate();
    },
  });

  useEffect(() => {
    if (currentProject && !syncMutation.isPending) {
      syncMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);

  const handleUpdateStatus = (errorGroupId: string, status: 'active' | 'resolved' | 'ignored') => {
    updateStatusMutation.mutate({ errorGroupId, status });
  };

  const filteredGroups = errorGroups || [];

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view errors</p>
      </div>
    );
  }

  const openCount = stats?.open || 0;
  const totalOccurrences = stats?.totalOccurrences || 0;
  const totalGroups = stats?.total || 0;
  const resolvedCount = stats?.resolved || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Errors</h1>
          <p className="text-muted-foreground">
            Grouped errors across all services
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-500">{openCount}</div>
            <div className="text-sm text-muted-foreground">Open Issues</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalOccurrences}</div>
            <div className="text-sm text-muted-foreground">Total Occurrences</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalGroups}</div>
            <div className="text-sm text-muted-foreground">Error Groups</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">
              {resolvedCount}
            </div>
            <div className="text-sm text-muted-foreground">Resolved</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        {(['all', 'open', 'resolved', 'ignored'] as const).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'open' && openCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 rounded-full">
                {openCount}
              </span>
            )}
          </Button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start py-4 px-4 gap-4 animate-pulse">
                <div className="h-4 w-4 bg-muted rounded mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-5 w-16 bg-muted rounded" />
                    <div className="h-5 w-24 bg-muted rounded" />
                  </div>
                  <div className="h-5 w-3/4 bg-muted rounded mb-2" />
                  <div className="flex gap-4">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-4 w-24 bg-muted rounded" />
                  </div>
                </div>
                <div className="h-8 w-12 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-2">No errors found</h3>
              <p className="text-sm text-muted-foreground">
                {statusFilter === 'all'
                  ? 'No errors have been captured yet'
                  : `No ${statusFilter} errors`}
              </p>
            </div>
          </CardContent>
        ) : (
          <div className="divide-y">
            {filteredGroups.map((group) => (
              <ErrorGroupRow
                key={group.id}
                group={group}
                isExpanded={expandedGroups.has(group.id)}
                onToggle={() => toggleGroup(group.id)}
                onUpdateStatus={handleUpdateStatus}
                isUpdating={updateStatusMutation.isPending}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
