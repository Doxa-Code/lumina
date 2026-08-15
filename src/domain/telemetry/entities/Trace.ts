import { AggregateRoot } from '../../shared/AggregateRoot.js';
import { TraceId } from '../value-objects/TraceId.js';
import { Span } from './Span.js';

export interface TraceProps {
  traceId: TraceId;
  projectId: string;
  spans: Span[];
}

export interface TraceNode {
  span: Span;
  children: TraceNode[];
}

export class Trace extends AggregateRoot<string> {
  private readonly _traceId: TraceId;
  private readonly _projectId: string;
  private readonly _spans: Map<string, Span>;

  private constructor(props: TraceProps) {
    super(props.traceId.value);
    this._traceId = props.traceId;
    this._projectId = props.projectId;
    this._spans = new Map(props.spans.map((s) => [s.spanId.value, s]));
  }

  get traceId(): TraceId {
    return this._traceId;
  }

  get projectId(): string {
    return this._projectId;
  }

  get spans(): Span[] {
    return Array.from(this._spans.values());
  }

  get spanCount(): number {
    return this._spans.size;
  }

  get rootSpan(): Span | undefined {
    return this.spans.find((s) => s.isRoot);
  }

  get startTime(): Date | undefined {
    const root = this.rootSpan;
    if (root) return root.startTime;

    const sorted = this.spans.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
    return sorted[0]?.startTime;
  }

  get endTime(): Date | undefined {
    const sorted = this.spans.sort(
      (a, b) => b.endTime.getTime() - a.endTime.getTime()
    );
    return sorted[0]?.endTime;
  }

  get durationMs(): number {
    const start = this.startTime;
    const end = this.endTime;
    if (!start || !end) return 0;
    return end.getTime() - start.getTime();
  }

  get hasErrors(): boolean {
    return this.spans.some((s) => s.isError);
  }

  get errorCount(): number {
    return this.spans.filter((s) => s.isError).length;
  }

  get services(): string[] {
    const services = new Set(this.spans.map((s) => s.serviceName));
    return Array.from(services);
  }

  getSpan(spanId: string): Span | undefined {
    return this._spans.get(spanId);
  }

  getChildSpans(parentSpanId: string): Span[] {
    return this.spans.filter((s) => s.parentSpanId?.value === parentSpanId);
  }

  buildTree(): TraceNode | undefined {
    const root = this.rootSpan;
    if (!root) return undefined;

    const buildNode = (span: Span): TraceNode => {
      const children = this.getChildSpans(span.spanId.value);
      return {
        span,
        children: children
          .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
          .map(buildNode),
      };
    };

    return buildNode(root);
  }

  static create(props: TraceProps): Trace {
    return new Trace(props);
  }

  static fromSpans(spans: Span[]): Trace | undefined {
    if (spans.length === 0) return undefined;

    const traceId = spans[0].traceId;
    const projectId = spans[0].projectId;

    if (!spans.every((s) => s.traceId.value === traceId.value)) {
      throw new Error('All spans must have the same traceId');
    }

    return new Trace({
      traceId,
      projectId,
      spans,
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      traceId: this._traceId.value,
      projectId: this._projectId,
      spanCount: this.spanCount,
      startTime: this.startTime?.toISOString(),
      endTime: this.endTime?.toISOString(),
      durationMs: this.durationMs,
      hasErrors: this.hasErrors,
      errorCount: this.errorCount,
      services: this.services,
      spans: this.spans.map((s) => s.toJSON()),
    };
  }
}
