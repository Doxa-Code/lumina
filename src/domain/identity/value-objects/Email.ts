import { ValueObject } from '../../shared/ValueObject.js';

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(email: string): Email {
    const normalized = email.trim().toLowerCase();

    if (!Email.isValid(normalized)) {
      throw new Error('Invalid email format');
    }

    return new Email({ value: normalized });
  }

  static isValid(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  toString(): string {
    return this.props.value;
  }
}
