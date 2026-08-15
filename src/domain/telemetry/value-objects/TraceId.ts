import { ValueObject } from '../../shared/ValueObject.js';

interface TraceIdProps {
  value: string;
}

export class TraceId extends ValueObject<TraceIdProps> {
  private constructor(props: TraceIdProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(value: string): TraceId {
    if (!value || value.length !== 32) {
      throw new Error('TraceId must be a 32-character hex string');
    }
    if (!/^[a-f0-9]+$/i.test(value)) {
      throw new Error('TraceId must be a valid hex string');
    }
    return new TraceId({ value: value.toLowerCase() });
  }

  static fromString(value: string): TraceId {
    return TraceId.create(value);
  }

  toString(): string {
    return this.props.value;
  }
}
