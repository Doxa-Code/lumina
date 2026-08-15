import { ValueObject } from '../../shared/ValueObject.js';

export enum SpanStatusCode {
  UNSET = 'UNSET',
  OK = 'OK',
  ERROR = 'ERROR',
}

interface SpanStatusProps {
  code: SpanStatusCode;
  message?: string;
}

export class SpanStatus extends ValueObject<SpanStatusProps> {
  private constructor(props: SpanStatusProps) {
    super(props);
  }

  get code(): SpanStatusCode {
    return this.props.code;
  }

  get message(): string | undefined {
    return this.props.message;
  }

  get isError(): boolean {
    return this.props.code === SpanStatusCode.ERROR;
  }

  get isOk(): boolean {
    return this.props.code === SpanStatusCode.OK;
  }

  static create(code: string | number, message?: string): SpanStatus {
    let statusCode: SpanStatusCode;

    if (typeof code === 'number') {
      const codes: SpanStatusCode[] = [
        SpanStatusCode.UNSET,
        SpanStatusCode.OK,
        SpanStatusCode.ERROR,
      ];
      statusCode = codes[code] || SpanStatusCode.UNSET;
    } else {
      const upperCode = code.toUpperCase();
      if (!Object.values(SpanStatusCode).includes(upperCode as SpanStatusCode)) {
        throw new Error(`Invalid SpanStatusCode: ${code}`);
      }
      statusCode = upperCode as SpanStatusCode;
    }

    return new SpanStatus({ code: statusCode, message });
  }

  static unset(): SpanStatus {
    return new SpanStatus({ code: SpanStatusCode.UNSET });
  }

  static ok(): SpanStatus {
    return new SpanStatus({ code: SpanStatusCode.OK });
  }

  static error(message?: string): SpanStatus {
    return new SpanStatus({ code: SpanStatusCode.ERROR, message });
  }

  toString(): string {
    return this.props.message
      ? `${this.props.code}: ${this.props.message}`
      : this.props.code;
  }
}
