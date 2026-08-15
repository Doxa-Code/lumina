import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

export interface ServiceNode {
  id: string;
  name: string;
  requestCount: number;
  errorRate: number;
  avgLatency: number;
}

export interface ServiceEdge {
  source: string;
  target: string;
  requestCount: number;
}

interface ServiceMapProps {
  nodes: ServiceNode[];
  edges: ServiceEdge[];
  onNodeClick?: (node: ServiceNode) => void;
  className?: string;
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  requestCount: number;
  errorRate: number;
  avgLatency: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  requestCount: number;
}

export function ServiceMap({ nodes, edges, onNodeClick, className }: ServiceMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<ServiceNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: width || 800, height: height || 600 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;

    const g = svg.append('g');

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create D3 nodes with proper typing
    const d3Nodes: D3Node[] = nodes.map(node => ({
      ...node,
      x: width / 2,
      y: height / 2,
    }));

    // Create D3 links with proper typing
    const d3Links: D3Link[] = edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      requestCount: edge.requestCount,
    }));

    // Calculate node size scale
    const maxRequests = d3.max(nodes, d => d.requestCount) || 1;
    const radiusScale = d3.scaleSqrt()
      .domain([0, maxRequests])
      .range([20, 60]);

    // Calculate edge width scale
    const maxEdgeRequests = d3.max(edges, e => e.requestCount) || 1;
    const edgeWidthScale = d3.scaleLinear()
      .domain([0, maxEdgeRequests])
      .range([1, 8]);

    // Color scale based on health
    const getNodeColor = (node: ServiceNode) => {
      if (node.errorRate > 5) return '#ef4444'; // red
      if (node.errorRate > 1) return '#eab308'; // yellow
      return '#22c55e'; // green
    };

    // Create force simulation
    const simulation = d3.forceSimulation<D3Node>(d3Nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(d3Links)
        .id(d => d.id)
        .distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<D3Node>().radius(d => radiusScale(d.requestCount) + 10));

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(d3Links)
      .join('line')
      .attr('stroke', '#64748b')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', d => edgeWidthScale(d.requestCount));

    // Create arrow markers
    svg.append('defs').selectAll('marker')
      .data(['arrow'])
      .join('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#64748b');

    link.attr('marker-end', 'url(#arrow)');

    // Create node groups
    const node = g.append('g')
      .selectAll('g')
      .data(d3Nodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, D3Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    // Add circles for nodes
    node.append('circle')
      .attr('r', d => radiusScale(d.requestCount))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 3);

    // Add labels
    node.append('text')
      .text(d => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none');

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'absolute hidden bg-black/90 text-white px-3 py-2 rounded text-sm pointer-events-none z-50')
      .style('position', 'absolute');

    node
      .on('mouseenter', (event, d) => {
        tooltip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`)
          .html(`
            <div class="space-y-1">
              <div class="font-bold">${d.name}</div>
              <div class="text-xs">
                <div>Requests: ${d.requestCount.toLocaleString()}</div>
                <div>Error Rate: ${d.errorRate.toFixed(2)}%</div>
                <div>Avg Latency: ${d.avgLatency.toFixed(2)}ms</div>
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
        const originalNode = nodes.find(n => n.id === d.id);
        if (originalNode) {
          setSelectedNode(originalNode);
          onNodeClick?.(originalNode);
        }
      });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as D3Node).x!)
        .attr('y1', d => (d.source as D3Node).y!)
        .attr('x2', d => (d.target as D3Node).x!)
        .attr('y2', d => (d.target as D3Node).y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: D3Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: D3Node) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: D3Node) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [nodes, edges, dimensions, onNodeClick]);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader>
        <CardTitle>Service Dependency Map</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={containerRef} className="relative w-full h-[600px]">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="bg-muted/20"
          />
          {selectedNode && (
            <div className="absolute top-4 right-4 bg-card border-2 border-border p-4 rounded max-w-xs">
              <h3 className="font-bold mb-2">{selectedNode.name}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requests:</span>
                  <span className="font-mono">{selectedNode.requestCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Error Rate:</span>
                  <span className={cn(
                    'font-mono',
                    selectedNode.errorRate > 5 ? 'text-red-500' :
                    selectedNode.errorRate > 1 ? 'text-yellow-500' :
                    'text-green-500'
                  )}>
                    {selectedNode.errorRate.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Latency:</span>
                  <span className="font-mono">{selectedNode.avgLatency.toFixed(2)}ms</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
