import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

export interface HeatmapDataPoint {
  timestamp: number;
  latency: number;
}

interface HeatmapProps {
  data: HeatmapDataPoint[];
  timeBuckets?: number;
  onCellClick?: (bucket: HeatmapBucket) => void;
  className?: string;
}

interface HeatmapBucket {
  timeStart: number;
  timeEnd: number;
  latencyMin: number;
  latencyMax: number;
  count: number;
}

const LATENCY_BUCKETS = [
  { min: 0, max: 10, label: '<10ms' },
  { min: 10, max: 50, label: '10-50ms' },
  { min: 50, max: 100, label: '50-100ms' },
  { min: 100, max: 250, label: '100-250ms' },
  { min: 250, max: 500, label: '250-500ms' },
  { min: 500, max: 1000, label: '500ms-1s' },
  { min: 1000, max: 2000, label: '1-2s' },
  { min: 2000, max: 5000, label: '2-5s' },
  { min: 5000, max: Infinity, label: '>5s' },
];

export function Heatmap({ data, timeBuckets = 24, onCellClick, className }: HeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedBucket, setSelectedBucket] = useState<HeatmapBucket | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: width || 800, height: 400 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 80, bottom: 60, left: 100 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Find time range
    const minTime = d3.min(data, d => d.timestamp) || 0;
    const maxTime = d3.max(data, d => d.timestamp) || 1;
    const timeRange = maxTime - minTime;
    const bucketDuration = timeRange / timeBuckets;

    // Create buckets
    const buckets: HeatmapBucket[][] = [];
    for (let i = 0; i < timeBuckets; i++) {
      buckets[i] = [];
      for (let j = 0; j < LATENCY_BUCKETS.length; j++) {
        buckets[i][j] = {
          timeStart: minTime + i * bucketDuration,
          timeEnd: minTime + (i + 1) * bucketDuration,
          latencyMin: LATENCY_BUCKETS[j].min,
          latencyMax: LATENCY_BUCKETS[j].max,
          count: 0,
        };
      }
    }

    // Fill buckets with data
    data.forEach(point => {
      const timeBucketIndex = Math.min(
        Math.floor((point.timestamp - minTime) / bucketDuration),
        timeBuckets - 1
      );
      const latencyBucketIndex = LATENCY_BUCKETS.findIndex(
        bucket => point.latency >= bucket.min && point.latency < bucket.max
      );

      if (latencyBucketIndex !== -1 && timeBucketIndex >= 0) {
        buckets[timeBucketIndex][latencyBucketIndex].count++;
      }
    });

    // Flatten buckets for rendering
    const flatBuckets: (HeatmapBucket & { x: number; y: number })[] = [];
    buckets.forEach((timeBucket, i) => {
      timeBucket.forEach((bucket, j) => {
        flatBuckets.push({
          ...bucket,
          x: i,
          y: j,
        });
      });
    });

    // Color scale
    const maxCount = d3.max(flatBuckets, d => d.count) || 1;
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
      .domain([0, maxCount]);

    // Scales
    const xScale = d3.scaleBand()
      .domain(d3.range(timeBuckets).map(String))
      .range([0, width])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(LATENCY_BUCKETS.map((_, i) => String(i)))
      .range([0, height])
      .padding(0.05);

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'absolute hidden bg-black/90 text-white px-3 py-2 rounded text-sm pointer-events-none z-50')
      .style('position', 'absolute');

    // Draw cells
    g.selectAll('rect')
      .data(flatBuckets)
      .join('rect')
      .attr('x', d => xScale(String(d.x))!)
      .attr('y', d => yScale(String(d.y))!)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => d.count === 0 ? '#f1f5f9' : colorScale(d.count))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const timeStr = new Date(d.timeStart).toLocaleTimeString() + ' - ' +
                        new Date(d.timeEnd).toLocaleTimeString();
        const latencyBucket = LATENCY_BUCKETS[d.y];

        tooltip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`)
          .html(`
            <div class="space-y-1">
              <div class="font-bold">Requests: ${d.count.toLocaleString()}</div>
              <div class="text-xs space-y-0.5">
                <div><span class="text-gray-400">Time:</span> ${timeStr}</div>
                <div><span class="text-gray-400">Latency:</span> ${latencyBucket.label}</div>
                ${d.count > 0 ? '<div class="text-gray-400 mt-1">Click to drill down</div>' : ''}
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
      .on('click', (_event, d) => {
        if (d.count > 0) {
          setSelectedBucket(d);
          onCellClick?.(d);
        }
      });

    // X axis (time)
    const xAxis = d3.axisBottom(xScale)
      .tickValues(d3.range(0, timeBuckets, Math.ceil(timeBuckets / 6)).map(String))
      .tickFormat((d) => {
        const index = parseInt(d as string);
        const time = minTime + index * bucketDuration;
        return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      });

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    // Y axis (latency)
    const yAxis = d3.axisLeft(yScale)
      .tickFormat((d) => LATENCY_BUCKETS[parseInt(d as string)].label);

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('font-size', '11px');

    // Axis labels
    g.append('text')
      .attr('transform', `translate(${width / 2},${height + 50})`)
      .style('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text('Time');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -60)
      .attr('x', -height / 2)
      .style('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text('Latency');

    // Legend
    const legendWidth = 20;
    const legendHeight = height;
    const legendScale = d3.scaleLinear()
      .domain([0, maxCount])
      .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5)
      .tickFormat(d => d3.format('.0f')(d as number));

    const legend = g.append('g')
      .attr('transform', `translate(${width + 20}, 0)`);

    // Create gradient for legend
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'legend-gradient')
      .attr('x1', '0%')
      .attr('x2', '0%')
      .attr('y1', '100%')
      .attr('y2', '0%');

    const numStops = 10;
    d3.range(numStops).forEach(i => {
      gradient.append('stop')
        .attr('offset', `${(i / (numStops - 1)) * 100}%`)
        .attr('stop-color', colorScale((maxCount * i) / (numStops - 1)));
    });

    legend.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#legend-gradient)')
      .attr('stroke', '#000')
      .attr('stroke-width', 1);

    legend.append('g')
      .attr('transform', `translate(${legendWidth}, 0)`)
      .call(legendAxis)
      .selectAll('text')
      .attr('font-size', '10px');

    legend.append('text')
      .attr('transform', `translate(${legendWidth / 2}, ${legendHeight + 20})`)
      .style('text-anchor', 'middle')
      .attr('font-size', '10px')
      .text('Requests');

    return () => {
      tooltip.remove();
    };
  }, [data, timeBuckets, dimensions, onCellClick]);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader>
        <CardTitle>Latency Heatmap</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div ref={containerRef} className="w-full">
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="bg-white"
          />
        </div>
        {selectedBucket && selectedBucket.count > 0 && (
          <div className="mt-4 p-4 bg-muted/20 border-2 border-border rounded">
            <h3 className="font-bold mb-2">Selected Time Window</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time Range:</span>
                <span className="font-mono">
                  {new Date(selectedBucket.timeStart).toLocaleTimeString()} - {new Date(selectedBucket.timeEnd).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latency Range:</span>
                <span className="font-mono">
                  {LATENCY_BUCKETS.find(b => b.min === selectedBucket.latencyMin)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Request Count:</span>
                <span className="font-mono font-bold">{selectedBucket.count.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
