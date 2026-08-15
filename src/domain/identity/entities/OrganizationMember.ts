import { Entity } from '../../shared/Entity.js';
import { Role } from '../value-objects/Role.js';

export interface OrganizationMemberProps {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  createdAt: Date;
}

export class OrganizationMember extends Entity<string> {
  private readonly _organizationId: string;
  private readonly _userId: string;
  private _role: Role;
  private readonly _createdAt: Date;

  private constructor(props: OrganizationMemberProps) {
    super(props.id);
    this._organizationId = props.organizationId;
    this._userId = props.userId;
    this._role = props.role;
    this._createdAt = props.createdAt;
  }

  get organizationId(): string {
    return this._organizationId;
  }

  get userId(): string {
    return this._userId;
  }

  get role(): Role {
    return this._role;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  updateRole(role: Role): void {
    this._role = role;
  }

  static create(props: {
    organizationId: string;
    userId: string;
    role: Role;
  }): OrganizationMember {
    return new OrganizationMember({
      id: crypto.randomUUID(),
      organizationId: props.organizationId,
      userId: props.userId,
      role: props.role,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: OrganizationMemberProps): OrganizationMember {
    return new OrganizationMember(props);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      organizationId: this._organizationId,
      userId: this._userId,
      role: this._role.value,
      createdAt: this._createdAt.toISOString(),
    };
  }
}
