import { Entity } from '../../shared/Entity.js';
import { TraceId } from '../value-objects/TraceId.js';
import { SpanId } from '../value-objects/SpanId.js';
import { Severity } from '../value-objects/Severity.js';
import { Attributes } from '../value-objects/Attributes.js';

export interface LogProps {
  id: string;
  projectId: string;
  traceId?: TraceId;
  spanId?: SpanId;
  serviceName: string;
  serviceNamespace?: string;
  timestamp: Date;
  observedTimestamp: Date;
  severity: Severity;
  body: string;
  attributes: Attributes;
  resourceAttributes: Attributes;
  ingestedAt: Date;
}

export class Log extends Entity<string> {
  private readonly _projectId: string;
  private readonly _traceId?: TraceId;
  private readonly _spanId?: SpanId;
  private readonly _serviceName: string;
  private readonly _serviceNamespace?: string;
  private readonly _timestamp: Date;
  private readonly _observedTimestamp: Date;
  private readonly _severity: Severity;
  private readonly _body: string;
  private readonly _attributes: Attributes;
  private readonly _resourceAttributes: Attributes;
  private readonly _ingestedAt: Date;

  private constructor(props: LogProps) {
    super(props.id);
    this._projectId = props.projectId;
    this._traceId = props.traceId;
    this._spanId = props.spanId;
    this._serviceName = props.serviceName;
    this._serviceNamespace = props.serviceNamespace;
    this._timestamp = props.timestamp;
    this._observedTimestamp = props.observedTimestamp;
    this._severity = props.severity;
    this._body = props.body;
    this._attributes = props.attributes;
    this._resourceAttributes = props.resourceAttributes;
    this._ingestedAt = props.ingestedAt;
  }

  get projectId(): string {
    return this._projectId;
  }

  get traceId(): TraceId | undefined {
    return this._traceId;
  }

  get spanId(): SpanId | undefined {
    return this._spanId;
  }

  get serviceName(): string {
    return this._serviceName;
  }

  get serviceNamespace(): string | undefined {
    return this._serviceNamespace;
  }

  get timestamp(): Date {
    return this._timestamp;
  }

  get observedTimestamp(): Date {
    return this._observedTimestamp;
  }

  get severity(): Severity {
    return this._severity;
  }

  get body(): string {
    return this._body;
  }

  get attributes(): Attributes {
    return this._attributes;
  }

  get resourceAttributes(): Attributes {
    return this._resourceAttributes;
  }

  get ingestedAt(): Date {
    return this._ingestedAt;
  }

  get isError(): boolean {
    return this._severity.isError;
  }

  get isWarning(): boolean {
    return this._severity.isWarning;
  }

  get hasTraceContext(): boolean {
    return this._traceId !== undefined && this._spanId !== undefined;
  }

  static create(
    props: Omit<LogProps, 'id' | 'ingestedAt' | 'observedTimestamp'> & {
      id?: string;
      observedTimestamp?: Date;
    }
  ): Log {
    return new Log({
      ...props,
      id: props.id || crypto.randomUUID(),
      observedTimestamp: props.observedTimestamp || new Date(),
      ingestedAt: new Date(),
    });
  }

  static reconstitute(props: LogProps): Log {
    return new Log(props);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      projectId: this._projectId,
      traceId: this._traceId?.value,
      spanId: this._spanId?.value,
      serviceName: this._serviceName,
      serviceNamespace: this._serviceNamespace,
      timestamp: this._timestamp.toISOString(),
      observedTimestamp: this._observedTimestamp.toISOString(),
      severity: {
        number: this._severity.number,
        text: this._severity.text,
      },
      body: this._body,
      attributes: this._attributes.toJSON(),
      resourceAttributes: this._resourceAttributes.toJSON(),
      ingestedAt: this._ingestedAt.toISOString(),
    };
  }
}
