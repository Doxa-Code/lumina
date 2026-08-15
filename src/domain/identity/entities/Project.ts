import { AggregateRoot } from '../../shared/AggregateRoot.js';

export enum Environment {
  PRODUCTION = 'production',
  STAGING = 'staging',
  DEVELOPMENT = 'development',
}

export interface ProjectProps {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  environment: Environment;
  retentionDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Project extends AggregateRoot<string> {
  private _name: string;
  private readonly _slug: string;
  private readonly _organizationId: string;
  private _environment: Environment;
  private _retentionDays: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ProjectProps) {
    super(props.id);
    this._organizationId = props.organizationId;
    this._name = props.name;
    this._slug = props.slug;
    this._environment = props.environment;
    this._retentionDays = props.retentionDays;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get organizationId(): string {
    return this._organizationId;
  }

  get name(): string {
    return this._name;
  }

  get slug(): string {
    return this._slug;
  }

  get environment(): Environment {
    return this._environment;
  }

  get retentionDays(): number {
    return this._retentionDays;
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

  updateEnvironment(environment: Environment): void {
    this._environment = environment;
    this._updatedAt = new Date();
  }

  updateRetentionDays(days: number): void {
    if (days < 1 || days > 365) {
      throw new Error('Retention days must be between 1 and 365');
    }
    this._retentionDays = days;
    this._updatedAt = new Date();
  }

  static create(props: {
    organizationId: string;
    name: string;
    slug?: string;
    environment?: Environment;
    retentionDays?: number;
  }): Project {
    const now = new Date();
    const slug = props.slug || Project.generateSlug(props.name);

    return new Project({
      id: crypto.randomUUID(),
      organizationId: props.organizationId,
      name: props.name.trim(),
      slug,
      environment: props.environment || Environment.PRODUCTION,
      retentionDays: props.retentionDays || 30,
      createdAt: now,
      updatedAt: now,
    });
  }

  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  static reconstitute(props: ProjectProps): Project {
    return new Project(props);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      organizationId: this._organizationId,
      name: this._name,
      slug: this._slug,
      environment: this._environment,
      retentionDays: this._retentionDays,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
