import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn, formatDuration } from '../../lib/utils';

export interface Span {
  spanId: string;
  name: string;
  serviceName: string;
  startTime: number;
  duration: number;
  kind?: string;
  status?: string;
  parentSpanId?: string;
  attributes?: Record<string, any>;
}

interface FlameGraphProps {
  spans: Span[];
  onSpanClick?: (span: Span) => void;
  className?: string;
}

interface FlameSpan extends Span {
  depth: number;
  children: FlameSpan[];
  x: number;
  width: number;
  y: number;
  height: number;
}

const SPAN_HEIGHT = 24;
const SPAN_PADDING = 2;

export function FlameGraph({ spans, onSpanClick, className }: FlameGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const [zoomedSpan, setZoomedSpan] = useState<FlameSpan | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setDimensions(prev => ({ ...prev, width: width || 800 }));
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || spans.length === 0) return;

    // Build span hierarchy
    const spanMap = new Map<string, FlameSpan>();
    const rootSpans: FlameSpan[] = [];

    // Initialize spans
    spans.forEach(span => {
      spanMap.set(span.spanId, {
        ...span,
        depth: 0,
        children: [],
        x: 0,
        width: 0,
        y: 0,
        height: SPAN_HEIGHT,
      });
    });

    // Build parent-child relationships
    spans.forEach(span => {
      const flameSpan = spanMap.get(span.spanId)!;
      if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
        const parent = spanMap.get(span.parentSpanId)!;
        parent.children.push(flameSpan);
        flameSpan.depth = parent.depth + 1;
      } else {
        rootSpans.push(flameSpan);
      }
    });

    // Find time bounds
    const minTime = d3.min(spans, s => s.startTime) || 0;
    const maxTime = d3.max(spans, s => s.startTime + s.duration) || 1;
    const totalDuration = maxTime - minTime;

    // Calculate positions based on zoom
    const baseSpan = zoomedSpan || (rootSpans.length > 0 ? rootSpans[0] : null);
    const viewStart = baseSpan ? baseSpan.startTime : minTime;
    const viewDuration = baseSpan ? baseSpan.duration : totalDuration;

    const xScale = d3.scaleLinear()
      .domain([viewStart, viewStart + viewDuration])
      .range([0, dimensions.width]);

    // Calculate positions for all spans
    const allSpans: FlameSpan[] = [];
    const processSpan = (span: FlameSpan) => {
      span.x = xScale(span.startTime);
      span.width = xScale(span.startTime + span.duration) - span.x;
      span.y = span.depth * (SPAN_HEIGHT + SPAN_PADDING);
      allSpans.push(span);
      span.children.forEach(processSpan);
    };
    rootSpans.forEach(processSpan);

    // Calculate required height
    const maxDepth = d3.max(allSpans, s => s.depth) || 0;
    const height = (maxDepth + 1) * (SPAN_HEIGHT + SPAN_PADDING) + 40;
    setDimensions(prev => ({ ...prev, height }));

    // Color scales
    const serviceColors = d3.scaleOrdinal(d3.schemeTableau10);
    const kindColors: Record<string, string> = {
      'SERVER': '#3b82f6',
      'CLIENT': '#22c55e',
      'INTERNAL': '#8b5cf6',
      'PRODUCER': '#f59e0b',
      'CONSUMER': '#ec4899',
    };

    const getSpanColor = (span: Span) => {
      if (span.status === 'ERROR') return '#ef4444';
      if (span.kind && kindColors[span.kind]) return kindColors[span.kind];
      return serviceColors(span.serviceName);
    };

    // Render
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'absolute hidden bg-black/90 text-white px-3 py-2 rounded text-sm pointer-events-none z-50 max-w-md')
      .style('position', 'absolute');

    // Draw spans
    const spanGroups = g.selectAll('g.span')
      .data(allSpans)
      .join('g')
      .attr('class', 'span')
      .style('cursor', 'pointer')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);

    spanGroups.append('rect')
      .attr('width', d => Math.max(1, d.width))
      .attr('height', SPAN_HEIGHT)
      .attr('fill', d => getSpanColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('rx', 2);

    spanGroups.append('text')
      .attr('x', 4)
      .attr('y', SPAN_HEIGHT / 2)
      .attr('dy', '.35em')
      .attr('font-size', '11px')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none')
      .text(d => {
        const availableWidth = d.width - 8;
        if (availableWidth < 40) return '';
        const text = `${d.name} (${formatDuration(d.duration)})`;
        if (text.length * 6 > availableWidth) {
          return text.substring(0, Math.floor(availableWidth / 6)) + '...';
        }
        return text;
      });

    spanGroups
      .on('mouseenter', (event, d) => {
        tooltip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`)
          .html(`
            <div class="space-y-1">
              <div class="font-bold">${d.name}</div>
              <div class="text-xs space-y-0.5">
                <div><span class="text-gray-400">Service:</span> ${d.serviceName}</div>
                <div><span class="text-gray-400">Duration:</span> ${formatDuration(d.duration)}</div>
                ${d.kind ? `<div><span class="text-gray-400">Kind:</span> ${d.kind}</div>` : ''}
                ${d.status ? `<div><span class="text-gray-400">Status:</span> ${d.status}</div>` : ''}
                <div class="text-gray-400 mt-1">Click to zoom</div>
              </div>
            </div>
          `)
          .classed('hidden', false);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      })
      .on('mouseleave', () => {
        tooltip.classed('hidden', true);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        setZoomedSpan(d);
        setSelectedSpan(d);
        onSpanClick?.(d);
      });

    // Reset zoom on background click
    svg.on('click', () => {
      if (zoomedSpan) {
        setZoomedSpan(null);
        setSelectedSpan(null);
      }
    });

    // Time axis
    const xAxis = d3.axisBottom(xScale)
      .ticks(10)
      .tickFormat(d => formatDuration((d as number) - viewStart));

    g.append('g')
      .attr('transform', `translate(0, ${height - 30})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-size', '10px');

    return () => {
      tooltip.remove();
    };
  }, [spans, dimensions.width, zoomedSpan, onSpanClick]);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Trace Flame Graph</CardTitle>
        {zoomedSpan && (
          <button
            onClick={() => {
              setZoomedSpan(null);
              setSelectedSpan(null);
            }}
            className="text-sm text-primary hover:underline"
          >
            Reset Zoom
          </button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div ref={containerRef} className="relative w-full overflow-x-auto">
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="bg-muted/20"
          />
        </div>
        {selectedSpan && (
          <div className="border-t-2 border-border p-4 bg-card">
            <h3 className="font-bold mb-2">{selectedSpan.name}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Service</div>
                <div className="font-mono">{selectedSpan.serviceName}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Duration</div>
                <div className="font-mono">{formatDuration(selectedSpan.duration)}</div>
              </div>
              {selectedSpan.kind && (
                <div>
                  <div className="text-muted-foreground">Kind</div>
                  <div className="font-mono">{selectedSpan.kind}</div>
                </div>
              )}
              {selectedSpan.status && (
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className={cn(
                    'font-mono',
                    selectedSpan.status === 'ERROR' ? 'text-red-500' : 'text-green-500'
                  )}>
                    {selectedSpan.status}
                  </div>
                </div>
              )}
            </div>
            {selectedSpan.attributes && Object.keys(selectedSpan.attributes).length > 0 && (
              <div className="mt-4">
                <div className="text-muted-foreground text-sm mb-2">Attributes</div>
                <div className="space-y-1 text-xs font-mono">
                  {Object.entries(selectedSpan.attributes).slice(0, 5).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="ml-2 truncate max-w-xs">{JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
