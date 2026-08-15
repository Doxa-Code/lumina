import { ValueObject } from '../../shared/ValueObject.js';

interface SpanIdProps {
  value: string;
}

export class SpanId extends ValueObject<SpanIdProps> {
  private constructor(props: SpanIdProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(value: string): SpanId {
    if (!value || value.length !== 16) {
      throw new Error('SpanId must be a 16-character hex string');
    }
    if (!/^[a-f0-9]+$/i.test(value)) {
      throw new Error('SpanId must be a valid hex string');
    }
    return new SpanId({ value: value.toLowerCase() });
  }

  static fromString(value: string): SpanId {
    return SpanId.create(value);
  }

  toString(): string {
    return this.props.value;
  }
}
