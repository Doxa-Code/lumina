import { AggregateRoot } from '../../shared/AggregateRoot.js';

export interface OrganizationProps {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Organization extends AggregateRoot<string> {
  private _name: string;
  private readonly _slug: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: OrganizationProps) {
    super(props.id);
    this._name = props.name;
    this._slug = props.slug;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get name(): string {
    return this._name;
  }

  get slug(): string {
    return this._slug;
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

  static create(props: { name: string; slug?: string }): Organization {
    const now = new Date();
    const slug =
      props.slug || Organization.generateSlug(props.name);

    return new Organization({
      id: crypto.randomUUID(),
      name: props.name.trim(),
      slug,
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

  static reconstitute(props: OrganizationProps): Organization {
    return new Organization(props);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      name: this._name,
      slug: this._slug,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
