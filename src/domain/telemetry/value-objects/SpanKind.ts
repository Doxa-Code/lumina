import { ValueObject } from '../../shared/ValueObject.js';

export enum SpanKindEnum {
  INTERNAL = 'INTERNAL',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  PRODUCER = 'PRODUCER',
  CONSUMER = 'CONSUMER',
}

interface SpanKindProps {
  value: SpanKindEnum;
}

export class SpanKind extends ValueObject<SpanKindProps> {
  private constructor(props: SpanKindProps) {
    super(props);
  }

  get value(): SpanKindEnum {
    return this.props.value;
  }

  static create(value: string | number): SpanKind {
    if (typeof value === 'number') {
      const kinds: SpanKindEnum[] = [
        SpanKindEnum.INTERNAL,
        SpanKindEnum.SERVER,
        SpanKindEnum.CLIENT,
        SpanKindEnum.PRODUCER,
        SpanKindEnum.CONSUMER,
      ];
      return new SpanKind({ value: kinds[value] || SpanKindEnum.INTERNAL });
    }

    const upperValue = value.toUpperCase();
    if (!Object.values(SpanKindEnum).includes(upperValue as SpanKindEnum)) {
      throw new Error(`Invalid SpanKind: ${value}`);
    }
    return new SpanKind({ value: upperValue as SpanKindEnum });
  }

  static internal(): SpanKind {
    return new SpanKind({ value: SpanKindEnum.INTERNAL });
  }

  static server(): SpanKind {
    return new SpanKind({ value: SpanKindEnum.SERVER });
  }

  static client(): SpanKind {
    return new SpanKind({ value: SpanKindEnum.CLIENT });
  }

  toString(): string {
    return this.props.value;
  }
}
