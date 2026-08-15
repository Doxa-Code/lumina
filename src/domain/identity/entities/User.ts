import { AggregateRoot } from '../../shared/AggregateRoot.js';
import { Email } from '../value-objects/Email.js';

export interface UserProps {
  id: string;
  email: Email;
  passwordHash: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends AggregateRoot<string> {
  private _email: Email;
  private _passwordHash: string;
  private _name: string;
  private _avatarUrl?: string;
  private _emailVerified: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: UserProps) {
    super(props.id);
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._name = props.name;
    this._avatarUrl = props.avatarUrl;
    this._emailVerified = props.emailVerified;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get email(): Email {
    return this._email;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get name(): string {
    return this._name;
  }

  get avatarUrl(): string | undefined {
    return this._avatarUrl;
  }

  get emailVerified(): boolean {
    return this._emailVerified;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  updateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Name cannot be empty');
    }
    this._name = name.trim();
    this._updatedAt = new Date();
  }

  updateAvatar(avatarUrl: string | undefined): void {
    this._avatarUrl = avatarUrl;
    this._updatedAt = new Date();
  }

  updatePassword(passwordHash: string): void {
    this._passwordHash = passwordHash;
    this._updatedAt = new Date();
  }

  verifyEmail(): void {
    this._emailVerified = true;
    this._updatedAt = new Date();
  }

  static create(props: {
    email: string;
    passwordHash: string;
    name: string;
    avatarUrl?: string;
  }): User {
    const now = new Date();
    return new User({
      id: crypto.randomUUID(),
      email: Email.create(props.email),
      passwordHash: props.passwordHash,
      name: props.name.trim(),
      avatarUrl: props.avatarUrl,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      email: this._email.value,
      name: this._name,
      avatarUrl: this._avatarUrl,
      emailVerified: this._emailVerified,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
