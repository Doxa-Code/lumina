import { Entity } from '../../shared/Entity.js';
import { TraceId } from '../value-objects/TraceId.js';
import { SpanId } from '../value-objects/SpanId.js';
import { SpanKind } from '../value-objects/SpanKind.js';
import { SpanStatus } from '../value-objects/SpanStatus.js';
import { Attributes } from '../value-objects/Attributes.js';

export interface SpanEvent {
  name: string;
  timestamp: Date;
  attributes: Attributes;
}

export interface SpanLink {
  traceId: TraceId;
  spanId: SpanId;
  attributes: Attributes;
}

export interface SpanProps {
  id: string;
  traceId: TraceId;
  spanId: SpanId;
  parentSpanId?: SpanId;
  projectId: string;
  serviceName: string;
  serviceNamespace?: string;
  serviceVersion?: string;
  name: string;
  kind: SpanKind;
  status: SpanStatus;
  startTime: Date;
  endTime: Date;
  attributes: Attributes;
  resourceAttributes: Attributes;
  events: SpanEvent[];
  links: SpanLink[];
  ingestedAt: Date;
}

export class Span extends Entity<string> {
  private readonly _traceId: TraceId;
  private readonly _spanId: SpanId;
  private readonly _parentSpanId?: SpanId;
  private readonly _projectId: string;
  private readonly _serviceName: string;
  private readonly _serviceNamespace?: string;
  private readonly _serviceVersion?: string;
  private readonly _name: string;
  private readonly _kind: SpanKind;
  private readonly _status: SpanStatus;
  private readonly _startTime: Date;
  private readonly _endTime: Date;
  private readonly _attributes: Attributes;
  private readonly _resourceAttributes: Attributes;
  private readonly _events: SpanEvent[];
  private readonly _links: SpanLink[];
  private readonly _ingestedAt: Date;

  private constructor(props: SpanProps) {
    super(props.id);
    this._traceId = props.traceId;
    this._spanId = props.spanId;
    this._parentSpanId = props.parentSpanId;
    this._projectId = props.projectId;
    this._serviceName = props.serviceName;
    this._serviceNamespace = props.serviceNamespace;
    this._serviceVersion = props.serviceVersion;
    this._name = props.name;
    this._kind = props.kind;
    this._status = props.status;
    this._startTime = props.startTime;
    this._endTime = props.endTime;
    this._attributes = props.attributes;
    this._resourceAttributes = props.resourceAttributes;
    this._events = props.events;
    this._links = props.links;
    this._ingestedAt = props.ingestedAt;
  }

  get traceId(): TraceId {
    return this._traceId;
  }

  get spanId(): SpanId {
    return this._spanId;
  }

  get parentSpanId(): SpanId | undefined {
    return this._parentSpanId;
  }

  get projectId(): string {
    return this._projectId;
  }

  get serviceName(): string {
    return this._serviceName;
  }

  get serviceNamespace(): string | undefined {
    return this._serviceNamespace;
  }

  get serviceVersion(): string | undefined {
    return this._serviceVersion;
  }

  get name(): string {
    return this._name;
  }

  get kind(): SpanKind {
    return this._kind;
  }

  get status(): SpanStatus {
    return this._status;
  }

  get startTime(): Date {
    return this._startTime;
  }

  get endTime(): Date {
    return this._endTime;
  }

  get durationMs(): number {
    return this._endTime.getTime() - this._startTime.getTime();
  }

  get attributes(): Attributes {
    return this._attributes;
  }

  get resourceAttributes(): Attributes {
    return this._resourceAttributes;
  }

  get events(): SpanEvent[] {
    return [...this._events];
  }

  get links(): SpanLink[] {
    return [...this._links];
  }

  get ingestedAt(): Date {
    return this._ingestedAt;
  }

  get isError(): boolean {
    return this._status.isError;
  }

  get isRoot(): boolean {
    return this._parentSpanId === undefined;
  }

  static create(props: Omit<SpanProps, 'id' | 'ingestedAt'> & { id?: string }): Span {
    return new Span({
      ...props,
      id: props.id || crypto.randomUUID(),
      ingestedAt: new Date(),
    });
  }

  static reconstitute(props: SpanProps): Span {
    return new Span(props);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      traceId: this._traceId.value,
      spanId: this._spanId.value,
      parentSpanId: this._parentSpanId?.value,
      projectId: this._projectId,
      serviceName: this._serviceName,
      serviceNamespace: this._serviceNamespace,
      serviceVersion: this._serviceVersion,
      name: this._name,
      kind: this._kind.value,
      status: {
        code: this._status.code,
        message: this._status.message,
      },
      startTime: this._startTime.toISOString(),
      endTime: this._endTime.toISOString(),
      durationMs: this.durationMs,
      attributes: this._attributes.toJSON(),
      resourceAttributes: this._resourceAttributes.toJSON(),
      events: this._events.map((e) => ({
        name: e.name,
        timestamp: e.timestamp.toISOString(),
        attributes: e.attributes.toJSON(),
      })),
      links: this._links.map((l) => ({
        traceId: l.traceId.value,
        spanId: l.spanId.value,
        attributes: l.attributes.toJSON(),
      })),
      ingestedAt: this._ingestedAt.toISOString(),
    };
  }
}
