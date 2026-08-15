import React, { useState } from 'react';
import {
  LineChart,
  BarChart3,
  Activity,
  FileText,
  AlertTriangle,
  Terminal,
  Hash,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface WidgetType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'metrics' | 'traces' | 'logs' | 'alerts' | 'other';
}

const WIDGET_TYPES: WidgetType[] = [
  {
    id: 'metric_timeseries',
    name: 'Metric Timeseries',
    description: 'Line or area chart showing metric values over time',
    icon: <LineChart className="h-5 w-5" />,
    category: 'metrics',
  },
  {
    id: 'metric_stat',
    name: 'Metric Stat',
    description: 'Big number display with sparkline and trend',
    icon: <Hash className="h-5 w-5" />,
    category: 'metrics',
  },
  {
    id: 'trace_list',
    name: 'Recent Traces',
    description: 'List of recent traces with latency and status',
    icon: <Activity className="h-5 w-5" />,
    category: 'traces',
  },
  {
    id: 'log_stream',
    name: 'Log Stream',
    description: 'Live stream of recent log entries',
    icon: <Terminal className="h-5 w-5" />,
    category: 'logs',
  },
  {
    id: 'alert_list',
    name: 'Active Alerts',
    description: 'List of active and recent alerts',
    icon: <AlertTriangle className="h-5 w-5" />,
    category: 'alerts',
  },
  {
    id: 'markdown',
    name: 'Markdown',
    description: 'Custom markdown content for notes and documentation',
    icon: <FileText className="h-5 w-5" />,
    category: 'other',
  },
];

interface WidgetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: string, config: Record<string, any>) => void;
}

export function WidgetPicker({ open, onOpenChange, onSelect }: WidgetPickerProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [widgetTitle, setWidgetTitle] = useState('');
  const [widgetConfig, setWidgetConfig] = useState<Record<string, any>>({});

  const handleSelect = () => {
    if (!selectedType) return;

    onSelect(selectedType, {
      ...widgetConfig,
      title: widgetTitle,
    });

    // Reset
    setSelectedType(null);
    setWidgetTitle('');
    setWidgetConfig({});
    onOpenChange(false);
  };

  const renderConfigForm = () => {
    if (!selectedType) return null;

    switch (selectedType) {
      case 'metric_timeseries':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="metricName">Metric Name</Label>
              <Input
                id="metricName"
                value={widgetConfig.metricName || ''}
                onChange={(e) =>
                  setWidgetConfig({ ...widgetConfig, metricName: e.target.value })
                }
                placeholder="e.g., http.server.duration"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aggregation">Aggregation</Label>
              <Select
                value={widgetConfig.aggregation || 'avg'}
                onValueChange={(value) =>
                  setWidgetConfig({ ...widgetConfig, aggregation: value })
                }
              >
                <SelectTrigger id="aggregation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avg">Average</SelectItem>
                  <SelectItem value="sum">Sum</SelectItem>
                  <SelectItem value="min">Min</SelectItem>
                  <SelectItem value="max">Max</SelectItem>
                  <SelectItem value="count">Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'metric_stat':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="metricName">Metric Name</Label>
              <Input
                id="metricName"
                value={widgetConfig.metricName || ''}
                onChange={(e) =>
                  setWidgetConfig({ ...widgetConfig, metricName: e.target.value })
                }
                placeholder="e.g., http.server.active_requests"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit (Optional)</Label>
              <Input
                id="unit"
                value={widgetConfig.unit || ''}
                onChange={(e) =>
                  setWidgetConfig({ ...widgetConfig, unit: e.target.value })
                }
                placeholder="e.g., ms, req/s, %"
              />
            </div>
          </div>
        );

      case 'trace_list':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">Service Name (Optional)</Label>
              <Input
                id="serviceName"
                value={widgetConfig.serviceName || ''}
                onChange={(e) =>
                  setWidgetConfig({ ...widgetConfig, serviceName: e.target.value })
                }
                placeholder="Filter by service name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit">Limit</Label>
              <Input
                id="limit"
                type="number"
                value={widgetConfig.limit || 20}
                onChange={(e) =>
                  setWidgetConfig({
                    ...widgetConfig,
                    limit: parseInt(e.target.value),
                  })
                }
                min={1}
                max={100}
              />
            </div>
          </div>
        );

      case 'log_stream':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">Service Name (Optional)</Label>
              <Input
                id="serviceName"
                value={widgetConfig.serviceName || ''}
                onChange={(e) =>
                  setWidgetConfig({ ...widgetConfig, serviceName: e.target.value })
                }
                placeholder="Filter by service name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit">Limit</Label>
              <Input
                id="limit"
                type="number"
                value={widgetConfig.limit || 50}
                onChange={(e) =>
                  setWidgetConfig({
                    ...widgetConfig,
                    limit: parseInt(e.target.value),
                  })
                }
                min={1}
                max={1000}
              />
            </div>
          </div>
        );

      case 'alert_list':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="limit">Limit</Label>
              <Input
                id="limit"
                type="number"
                value={widgetConfig.limit || 20}
                onChange={(e) =>
                  setWidgetConfig({
                    ...widgetConfig,
                    limit: parseInt(e.target.value),
                  })
                }
                min={1}
                max={100}
              />
            </div>
          </div>
        );

      case 'markdown':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content">Markdown Content</Label>
              <textarea
                id="content"
                className="w-full h-64 px-3 py-2 border-2 border-input bg-background font-mono text-sm rounded resize-y"
                value={widgetConfig.content || ''}
                onChange={(e) =>
                  setWidgetConfig({ ...widgetConfig, content: e.target.value })
                }
                placeholder="# Title&#10;&#10;Your markdown content here...&#10;&#10;Supports GFM:&#10;- [ ] Task lists&#10;- Tables&#10;- ~~Strikethrough~~"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={selectedType === 'markdown' ? 'max-w-3xl' : 'max-w-2xl'}>
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
          <DialogDescription>
            Choose a widget type and configure it for your dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Widget Type Selection */}
          {!selectedType ? (
            <div className="grid grid-cols-2 gap-3">
              {WIDGET_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className="p-4 border-2 border-border rounded hover:border-primary hover:bg-primary/5 transition-colors text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-primary/10 text-primary">
                      {type.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm mb-1">{type.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {type.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedType(null)}
              >
                ← Back to widget types
              </Button>

              {selectedType !== 'markdown' && (
                <div className="space-y-2">
                  <Label htmlFor="title">Widget Title</Label>
                  <Input
                    id="title"
                    value={widgetTitle}
                    onChange={(e) => setWidgetTitle(e.target.value)}
                    placeholder="e.g., API Response Time"
                  />
                </div>
              )}

              {renderConfigForm()}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSelect} disabled={selectedType !== 'markdown' && !widgetTitle.trim()}>
                  Add Widget
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
