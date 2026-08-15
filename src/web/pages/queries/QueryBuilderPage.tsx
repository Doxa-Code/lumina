import { useState } from 'react';
import { Play, Save, Plus, Trash2, Code, Table, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { useProjectStore } from '../../stores/projectStore';
import { trpc } from '../../lib/trpc';

type DataSource = 'traces' | 'logs' | 'metrics';
type Aggregation = 'count' | 'avg' | 'sum' | 'min' | 'max' | 'p50' | 'p95' | 'p99';
type Operator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with';
type ViewMode = 'builder' | 'sql' | 'results';

interface Filter {
  id: string;
  field: string;
  operator: Operator;
  value: string;
}

interface QueryConfig {
  dataSource: DataSource;
  aggregation: Aggregation;
  aggregationField: string;
  groupBy: string[];
  filters: Filter[];
  timeRange: string;
  limit: number;
}

const DATA_SOURCE_FIELDS: Record<DataSource, string[]> = {
  traces: [
    'serviceName',
    'name',
    'kind',
    'statusCode',
    'durationMs',
    'attributes.*',
    'resourceAttributes.*',
  ],
  logs: [
    'serviceName',
    'severityNumber',
    'severityText',
    'body',
    'attributes.*',
    'resourceAttributes.*',
  ],
  metrics: [
    'name',
    'type',
    'value',
    'attributes.*',
  ],
};

const OPERATORS: { value: Operator; label: string }[] = [
  { value: '=', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '>', label: 'greater than' },
  { value: '<', label: 'less than' },
  { value: '>=', label: 'greater or equal' },
  { value: '<=', label: 'less or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
];

const TIME_RANGES = [
  { value: '15m', label: 'Last 15 minutes' },
  { value: '1h', label: 'Last hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

function generateId(): string {
  return Math.random().toString(36).substring(7);
}

function queryToSQL(config: QueryConfig): string {
  const table = config.dataSource === 'traces' ? 'spans' : config.dataSource;

  let sql = `SELECT`;

  if (config.aggregation === 'count') {
    sql += ` COUNT(*)`;
  } else {
    sql += ` ${config.aggregation.toUpperCase()}(${config.aggregationField})`;
  }

  if (config.groupBy.length > 0) {
    sql += `, ${config.groupBy.join(', ')}`;
  }

  sql += `\nFROM ${table}`;

  sql += `\nWHERE timestamp >= NOW() - INTERVAL '${config.timeRange}'`;

  if (config.filters.length > 0) {
    for (const filter of config.filters) {
      let condition: string;
      switch (filter.operator) {
        case 'contains':
          condition = `${filter.field} LIKE '%${filter.value}%'`;
          break;
        case 'not_contains':
          condition = `${filter.field} NOT LIKE '%${filter.value}%'`;
          break;
        case 'starts_with':
          condition = `${filter.field} LIKE '${filter.value}%'`;
          break;
        case 'ends_with':
          condition = `${filter.field} LIKE '%${filter.value}'`;
          break;
        default:
          condition = `${filter.field} ${filter.operator} '${filter.value}'`;
      }
      sql += `\n  AND ${condition}`;
    }
  }

  if (config.groupBy.length > 0) {
    sql += `\nGROUP BY ${config.groupBy.join(', ')}`;
  }

  sql += `\nLIMIT ${config.limit}`;

  return sql;
}

export function QueryBuilderPage() {
  const { currentProject } = useProjectStore();
  const [viewMode, setViewMode] = useState<ViewMode>('builder');
  const [queryConfig, setQueryConfig] = useState<QueryConfig>({
    dataSource: 'traces',
    aggregation: 'count',
    aggregationField: '*',
    groupBy: [],
    filters: [],
    timeRange: '24h',
    limit: 100,
  });
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [queryName, setQueryName] = useState('');
  const [queryDescription, setQueryDescription] = useState('');

  const utils = trpc.useUtils();

  // Execute query mutation
  const executeQueryMutation = trpc.queries.execute.useMutation({
    onSuccess: (data) => {
      setResults(data);
      setViewMode('results');
    },
  });

  // Save query mutation
  const saveQueryMutation = trpc.queries.save.useMutation({
    onSuccess: () => {
      utils.queries.list.invalidate();
      setSaveDialogOpen(false);
      setQueryName('');
      setQueryDescription('');
    },
  });

  const isRunning = executeQueryMutation.isPending;

  const addFilter = () => {
    setQueryConfig((prev) => ({
      ...prev,
      filters: [
        ...prev.filters,
        {
          id: generateId(),
          field: DATA_SOURCE_FIELDS[prev.dataSource][0],
          operator: '=',
          value: '',
        },
      ],
    }));
  };

  const removeFilter = (id: string) => {
    setQueryConfig((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.id !== id),
    }));
  };

  const updateFilter = (id: string, updates: Partial<Filter>) => {
    setQueryConfig((prev) => ({
      ...prev,
      filters: prev.filters.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }));
  };

  const runQuery = () => {
    executeQueryMutation.mutate({
      dataSource: queryConfig.dataSource,
      aggregation: queryConfig.aggregation,
      aggregationField: queryConfig.aggregationField,
      groupBy: queryConfig.groupBy,
      filters: queryConfig.filters.map((f) => ({
        field: f.field,
        operator: f.operator,
        value: f.value,
      })),
      timeRange: queryConfig.timeRange,
      limit: queryConfig.limit,
    });
  };

  const handleSaveQuery = () => {
    if (!queryName.trim()) return;
    saveQueryMutation.mutate({
      name: queryName,
      description: queryDescription || undefined,
      config: {
        dataSource: queryConfig.dataSource,
        aggregation: queryConfig.aggregation,
        aggregationField: queryConfig.aggregationField,
        groupBy: queryConfig.groupBy,
        filters: queryConfig.filters.map((f) => ({
          field: f.field,
          operator: f.operator,
          value: f.value,
        })),
        timeRange: queryConfig.timeRange,
        limit: queryConfig.limit,
      },
    });
  };

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to build queries</p>
      </div>
    );
  }

  const generatedSQL = queryToSQL(queryConfig);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Query Builder</h1>
          <p className="text-muted-foreground">
            Build and run queries against your telemetry data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save Query
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Query</DialogTitle>
                <DialogDescription>
                  Save this query to reuse it later.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="query-name">Name</Label>
                  <Input
                    id="query-name"
                    placeholder="My Query"
                    value={queryName}
                    onChange={(e) => setQueryName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="query-description">Description (optional)</Label>
                  <Input
                    id="query-description"
                    placeholder="Description of this query"
                    value={queryDescription}
                    onChange={(e) => setQueryDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveQuery}
                  disabled={!queryName.trim() || saveQueryMutation.isPending}
                >
                  {saveQueryMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="sm" onClick={runQuery} disabled={isRunning}>
            <Play className="h-4 w-4 mr-2" />
            {isRunning ? 'Running...' : 'Run Query'}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'builder'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setViewMode('builder')}
        >
          <Table className="h-4 w-4 inline mr-2" />
          Builder
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'sql'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setViewMode('sql')}
        >
          <Code className="h-4 w-4 inline mr-2" />
          SQL
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'results'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setViewMode('results')}
        >
          <BarChart3 className="h-4 w-4 inline mr-2" />
          Results
        </button>
      </div>

      {viewMode === 'builder' && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {(['traces', 'logs', 'metrics'] as const).map((source) => (
                  <Button
                    key={source}
                    variant={queryConfig.dataSource === source ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setQueryConfig((prev) => ({
                        ...prev,
                        dataSource: source,
                        filters: [],
                        groupBy: [],
                      }))
                    }
                  >
                    {source.charAt(0).toUpperCase() + source.slice(1)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aggregation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-center">
                <select
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={queryConfig.aggregation}
                  onChange={(e) =>
                    setQueryConfig((prev) => ({
                      ...prev,
                      aggregation: e.target.value as Aggregation,
                    }))
                  }
                >
                  <option value="count">COUNT</option>
                  <option value="avg">AVG</option>
                  <option value="sum">SUM</option>
                  <option value="min">MIN</option>
                  <option value="max">MAX</option>
                  <option value="p50">P50</option>
                  <option value="p95">P95</option>
                  <option value="p99">P99</option>
                </select>

                {queryConfig.aggregation !== 'count' && (
                  <>
                    <span className="text-muted-foreground">of</span>
                    <select
                      className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={queryConfig.aggregationField}
                      onChange={(e) =>
                        setQueryConfig((prev) => ({
                          ...prev,
                          aggregationField: e.target.value,
                        }))
                      }
                    >
                      {DATA_SOURCE_FIELDS[queryConfig.dataSource].map((field) => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Filters</CardTitle>
                <Button variant="outline" size="sm" onClick={addFilter}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Filter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {queryConfig.filters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No filters applied</p>
              ) : (
                <div className="space-y-3">
                  {queryConfig.filters.map((filter, index) => (
                    <div key={filter.id} className="flex items-center gap-2">
                      {index > 0 && (
                        <span className="text-xs text-muted-foreground w-8">AND</span>
                      )}
                      <select
                        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex-1"
                        value={filter.field}
                        onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                      >
                        {DATA_SOURCE_FIELDS[queryConfig.dataSource].map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                      <select
                        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={filter.operator}
                        onChange={(e) =>
                          updateFilter(filter.id, { operator: e.target.value as Operator })
                        }
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        placeholder="Value"
                        value={filter.value}
                        onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFilter(filter.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Group By</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {DATA_SOURCE_FIELDS[queryConfig.dataSource]
                  .filter((f) => !f.includes('*'))
                  .map((field) => (
                    <Button
                      key={field}
                      variant={queryConfig.groupBy.includes(field) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        setQueryConfig((prev) => ({
                          ...prev,
                          groupBy: prev.groupBy.includes(field)
                            ? prev.groupBy.filter((f) => f !== field)
                            : [...prev.groupBy, field],
                        }))
                      }
                    >
                      {field}
                    </Button>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Time Range & Limit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1 block">Time Range</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={queryConfig.timeRange}
                    onChange={(e) =>
                      setQueryConfig((prev) => ({ ...prev, timeRange: e.target.value }))
                    }
                  >
                    {TIME_RANGES.map((range) => (
                      <option key={range.value} value={range.value}>
                        {range.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <label className="text-sm text-muted-foreground mb-1 block">Limit</label>
                  <Input
                    type="number"
                    value={queryConfig.limit}
                    onChange={(e) =>
                      setQueryConfig((prev) => ({ ...prev, limit: parseInt(e.target.value) || 100 }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === 'sql' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generated SQL</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md text-sm font-mono overflow-x-auto">
              {generatedSQL}
            </pre>
          </CardContent>
        </Card>
      )}

      {viewMode === 'results' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Query Results</CardTitle>
          </CardHeader>
          <CardContent>
            {results === null ? (
              <p className="text-muted-foreground text-center py-8">
                Run a query to see results
              </p>
            ) : results.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No results found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {Object.keys(results[0]).map((key) => (
                        <th key={key} className="text-left py-2 px-4 font-medium">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        {Object.values(row).map((value, vidx) => (
                          <td key={vidx} className="py-2 px-4 font-mono">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
