import React, { useState } from 'react';
import { MoreVertical, Trash2, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { trpc } from '../../lib/trpc';
import { MetricTimeseriesWidget } from './widgets/MetricTimeseriesWidget';
import { MetricStatWidget } from './widgets/MetricStatWidget';
import { TraceListWidget } from './widgets/TraceListWidget';
import { LogStreamWidget } from './widgets/LogStreamWidget';
import { AlertListWidget } from './widgets/AlertListWidget';
import { MarkdownWidget } from './widgets/MarkdownWidget';
import { WidgetConfigDialog } from './WidgetConfigDialog';

interface Widget {
  id: string;
  type: string;
  title: string | null;
  description: string | null;
  config: Record<string, any>;
}

interface WidgetContainerProps {
  widget: Widget;
  timeBounds: {
    from: string;
    to: string;
  };
  isEditMode: boolean;
}

export function WidgetContainer({ widget, timeBounds, isEditMode }: WidgetContainerProps) {
  const utils = trpc.useUtils();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  const { data, isLoading, error } = trpc.dashboards.getWidgetData.useQuery(
    {
      widgetId: widget.id,
      from: timeBounds.from,
      to: timeBounds.to,
    },
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  const removeWidgetMutation = trpc.dashboards.removeWidget.useMutation({
    onSuccess: () => {
      utils.dashboards.get.invalidate();
    },
  });

  const handleRemove = () => {
    removeWidgetMutation.mutate({ id: widget.id });
  };

  const handleConfigure = () => {
    setIsConfigOpen(true);
  };

  const renderWidget = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-center p-4">
          <div>
            <p className="text-sm text-red-500 font-medium mb-1">Error loading widget</p>
            <p className="text-xs text-muted-foreground">{error.message}</p>
          </div>
        </div>
      );
    }

    if (!data) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">No data available</p>
        </div>
      );
    }

    switch (widget.type) {
      case 'metric_timeseries':
        return <MetricTimeseriesWidget data={data} config={widget.config} />;
      case 'metric_stat':
        return <MetricStatWidget data={data} config={widget.config} />;
      case 'trace_list':
        return <TraceListWidget data={data} config={widget.config} />;
      case 'log_stream':
        return <LogStreamWidget data={data} config={widget.config} />;
      case 'alert_list':
        return <AlertListWidget data={data} config={widget.config} />;
      case 'markdown':
        return <MarkdownWidget data={data} config={widget.config} />;
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              Widget type "{widget.type}" not implemented
            </p>
          </div>
        );
    }
  };

  const isMarkdown = widget.type === 'markdown';

  return (
    <Card className="h-full flex flex-col">
      {/* Hide header for markdown widgets unless in edit mode */}
      {(!isMarkdown || isEditMode) && (
        <CardHeader className={`flex-shrink-0 ${isMarkdown ? 'pb-1 pt-2' : 'pb-3'}`}>
          <div className="flex items-start justify-between">
            {!isMarkdown && (
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm truncate">
                  {widget.title || 'Untitled Widget'}
                </CardTitle>
                {widget.description && (
                  <CardDescription className="text-xs truncate">
                    {widget.description}
                  </CardDescription>
                )}
              </div>
            )}
            {isMarkdown && <div className="flex-1" />}
            {isEditMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-2">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleConfigure}>
                    <Settings className="h-3 w-3 mr-2" />
                    Configure
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsRemoveDialogOpen(true)} className="text-red-500">
                    <Trash2 className="h-3 w-3 mr-2" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className={`flex-1 min-h-0 overflow-auto ${isMarkdown && !isEditMode ? 'pt-4' : ''}`}>
        {renderWidget()}
      </CardContent>

      <WidgetConfigDialog
        open={isConfigOpen}
        onOpenChange={setIsConfigOpen}
        widget={widget}
      />

      <ConfirmDialog
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        title="Remove Widget"
        description="Are you sure you want to remove this widget?"
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleRemove}
      />
    </Card>
  );
}
