import { Entity } from '../../shared/Entity.js';
import { Attributes } from '../value-objects/Attributes.js';

export enum MetricType {
  GAUGE = 'GAUGE',
  COUNTER = 'COUNTER',
  HISTOGRAM = 'HISTOGRAM',
  SUMMARY = 'SUMMARY',
}

export interface HistogramBucket {
  bound: number;
  count: number;
}

export interface MetricProps {
  id: string;
  projectId: string;
  serviceName: string;
  metricName: string;
  metricType: MetricType;
  unit?: string;
  description?: string;
  timestamp: Date;
  valueInt?: number;
  valueDouble?: number;
  histogramCount?: number;
  histogramSum?: number;
  histogramBuckets?: HistogramBucket[];
  attributes: Attributes;
  resourceAttributes: Attributes;
  ingestedAt: Date;
}

export class Metric extends Entity<string> {
  private readonly _projectId: string;
  private readonly _serviceName: string;
  private readonly _metricName: string;
  private readonly _metricType: MetricType;
  private readonly _unit?: string;
  private readonly _description?: string;
  private readonly _timestamp: Date;
  private readonly _valueInt?: number;
  private readonly _valueDouble?: number;
  private readonly _histogramCount?: number;
  private readonly _histogramSum?: number;
  private readonly _histogramBuckets?: HistogramBucket[];
  private readonly _attributes: Attributes;
  private readonly _resourceAttributes: Attributes;
  private readonly _ingestedAt: Date;

  private constructor(props: MetricProps) {
    super(props.id);
    this._projectId = props.projectId;
    this._serviceName = props.serviceName;
    this._metricName = props.metricName;
    this._metricType = props.metricType;
    this._unit = props.unit;
    this._description = props.description;
    this._timestamp = props.timestamp;
    this._valueInt = props.valueInt;
    this._valueDouble = props.valueDouble;
    this._histogramCount = props.histogramCount;
    this._histogramSum = props.histogramSum;
    this._histogramBuckets = props.histogramBuckets;
    this._attributes = props.attributes;
    this._resourceAttributes = props.resourceAttributes;
    this._ingestedAt = props.ingestedAt;
  }

  get projectId(): string {
    return this._projectId;
  }

  get serviceName(): string {
    return this._serviceName;
  }

  get metricName(): string {
    return this._metricName;
  }

  get metricType(): MetricType {
    return this._metricType;
  }

  get unit(): string | undefined {
    return this._unit;
  }

  get description(): string | undefined {
    return this._description;
  }

  get timestamp(): Date {
    return this._timestamp;
  }

  get value(): number {
    return this._valueDouble ?? this._valueInt ?? 0;
  }

  get valueInt(): number | undefined {
    return this._valueInt;
  }

  get valueDouble(): number | undefined {
    return this._valueDouble;
  }

  get histogramCount(): number | undefined {
    return this._histogramCount;
  }

  get histogramSum(): number | undefined {
    return this._histogramSum;
  }

  get histogramBuckets(): HistogramBucket[] | undefined {
    return this._histogramBuckets ? [...this._histogramBuckets] : undefined;
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

  get isHistogram(): boolean {
    return this._metricType === MetricType.HISTOGRAM;
  }

  get isCounter(): boolean {
    return this._metricType === MetricType.COUNTER;
  }

  get isGauge(): boolean {
    return this._metricType === MetricType.GAUGE;
  }

  static create(
    props: Omit<MetricProps, 'id' | 'ingestedAt'> & { id?: string }
  ): Metric {
    return new Metric({
      ...props,
      id: props.id || crypto.randomUUID(),
      ingestedAt: new Date(),
    });
  }

  static reconstitute(props: MetricProps): Metric {
    return new Metric(props);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      projectId: this._projectId,
      serviceName: this._serviceName,
      metricName: this._metricName,
      metricType: this._metricType,
      unit: this._unit,
      description: this._description,
      timestamp: this._timestamp.toISOString(),
      valueInt: this._valueInt,
      valueDouble: this._valueDouble,
      histogramCount: this._histogramCount,
      histogramSum: this._histogramSum,
      histogramBuckets: this._histogramBuckets,
      attributes: this._attributes.toJSON(),
      resourceAttributes: this._resourceAttributes.toJSON(),
      ingestedAt: this._ingestedAt.toISOString(),
    };
  }
}
