import React, { useState, useEffect } from 'react';
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
import { trpc } from '../../lib/trpc';

interface Widget {
  id: string;
  type: string;
  title: string | null;
  description: string | null;
  config: Record<string, any>;
}

interface WidgetConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widget: Widget;
}

export function WidgetConfigDialog({ open, onOpenChange, widget }: WidgetConfigDialogProps) {
  const utils = trpc.useUtils();
  const [widgetTitle, setWidgetTitle] = useState(widget.title || '');
  const [widgetConfig, setWidgetConfig] = useState<Record<string, any>>(widget.config);

  useEffect(() => {
    if (open) {
      setWidgetTitle(widget.title || '');
      setWidgetConfig(widget.config);
    }
  }, [open, widget]);

  const updateWidgetMutation = trpc.dashboards.updateWidget.useMutation({
    onSuccess: () => {
      utils.dashboards.get.invalidate();
      onOpenChange(false);
    },
  });

  const handleSave = () => {
    updateWidgetMutation.mutate({
      id: widget.id,
      title: widgetTitle,
      config: widgetConfig,
    });
  };

  const renderConfigForm = () => {
    switch (widget.type) {
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
        return (
          <p className="text-sm text-muted-foreground">
            Configuration not available for this widget type.
          </p>
        );
    }
  };

  const isMarkdown = widget.type === 'markdown';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isMarkdown ? 'max-w-3xl' : 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle>Configure Widget</DialogTitle>
          <DialogDescription>
            Update the widget settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {widget.type !== 'markdown' && (
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
            <Button
              onClick={handleSave}
              disabled={updateWidgetMutation.isPending}
            >
              {updateWidgetMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
