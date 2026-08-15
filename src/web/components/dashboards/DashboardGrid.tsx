import React, { useState, useMemo } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { WidgetContainer } from './WidgetContainer';
import { trpc } from '../../lib/trpc';

interface Widget {
  id: string;
  type: string;
  title: string | null;
  description: string | null;
  config: Record<string, any>;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

interface DashboardGridProps {
  widgets: Widget[];
  isEditMode: boolean;
  dashboardId: string;
  timeBounds: {
    from: string;
    to: string;
  };
}

export function DashboardGrid({ widgets, isEditMode, dashboardId, timeBounds }: DashboardGridProps) {
  const [layouts, setLayouts] = useState<Layout[]>(() =>
    widgets.map((widget) => ({
      i: widget.id,
      x: widget.position.x,
      y: widget.position.y,
      w: widget.position.w,
      h: widget.position.h,
      minW: 2,
      minH: 2,
    }))
  );

  const updateLayoutMutation = trpc.dashboards.updateLayout.useMutation();

  const handleLayoutChange = (newLayout: Layout[]) => {
    if (!isEditMode) return;

    setLayouts(newLayout);

    // Debounced update to backend
    const updatedWidgets = newLayout.map((layout) => ({
      id: layout.i,
      position: {
        x: layout.x,
        y: layout.y,
        w: layout.w,
        h: layout.h,
      },
    }));

    updateLayoutMutation.mutate({
      dashboardId,
      widgets: updatedWidgets,
    });
  };

  return (
    <GridLayout
      className="layout"
      layout={layouts}
      cols={12}
      rowHeight={100}
      width={1200}
      isDraggable={isEditMode}
      isResizable={isEditMode}
      onLayoutChange={handleLayoutChange}
      compactType="vertical"
      preventCollision={false}
    >
      {widgets.map((widget) => (
        <div key={widget.id}>
          <WidgetContainer
            widget={widget}
            timeBounds={timeBounds}
            isEditMode={isEditMode}
          />
        </div>
      ))}
    </GridLayout>
  );
}
