import { ValueObject } from '../../shared/ValueObject.js';

export enum SeverityNumber {
  TRACE = 1,
  TRACE2 = 2,
  TRACE3 = 3,
  TRACE4 = 4,
  DEBUG = 5,
  DEBUG2 = 6,
  DEBUG3 = 7,
  DEBUG4 = 8,
  INFO = 9,
  INFO2 = 10,
  INFO3 = 11,
  INFO4 = 12,
  WARN = 13,
  WARN2 = 14,
  WARN3 = 15,
  WARN4 = 16,
  ERROR = 17,
  ERROR2 = 18,
  ERROR3 = 19,
  ERROR4 = 20,
  FATAL = 21,
  FATAL2 = 22,
  FATAL3 = 23,
  FATAL4 = 24,
}

interface SeverityProps {
  number: SeverityNumber;
  text?: string;
}

export class Severity extends ValueObject<SeverityProps> {
  private constructor(props: SeverityProps) {
    super(props);
  }

  get number(): SeverityNumber {
    return this.props.number;
  }

  get text(): string {
    return this.props.text || this.getDefaultText();
  }

  get isError(): boolean {
    return this.props.number >= SeverityNumber.ERROR;
  }

  get isWarning(): boolean {
    return (
      this.props.number >= SeverityNumber.WARN &&
      this.props.number < SeverityNumber.ERROR
    );
  }

  private getDefaultText(): string {
    if (this.props.number <= 4) return 'TRACE';
    if (this.props.number <= 8) return 'DEBUG';
    if (this.props.number <= 12) return 'INFO';
    if (this.props.number <= 16) return 'WARN';
    if (this.props.number <= 20) return 'ERROR';
    return 'FATAL';
  }

  static create(number: number, text?: string): Severity {
    if (number < 1 || number > 24) {
      throw new Error('Severity number must be between 1 and 24');
    }
    return new Severity({ number: number as SeverityNumber, text });
  }

  static fromText(text: string): Severity {
    const textUpper = text.toUpperCase();
    const mapping: Record<string, SeverityNumber> = {
      TRACE: SeverityNumber.TRACE,
      DEBUG: SeverityNumber.DEBUG,
      INFO: SeverityNumber.INFO,
      WARN: SeverityNumber.WARN,
      WARNING: SeverityNumber.WARN,
      ERROR: SeverityNumber.ERROR,
      FATAL: SeverityNumber.FATAL,
      CRITICAL: SeverityNumber.FATAL,
    };

    const number = mapping[textUpper] || SeverityNumber.INFO;
    return new Severity({ number, text });
  }

  static info(): Severity {
    return new Severity({ number: SeverityNumber.INFO });
  }

  static error(): Severity {
    return new Severity({ number: SeverityNumber.ERROR });
  }

  static warn(): Severity {
    return new Severity({ number: SeverityNumber.WARN });
  }

  static debug(): Severity {
    return new Severity({ number: SeverityNumber.DEBUG });
  }

  toString(): string {
    return this.text;
  }
}
