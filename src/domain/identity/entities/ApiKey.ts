import { Entity } from '../../shared/Entity.js';
import { nanoid } from 'nanoid';

export type ApiKeyPermission = 'ingest' | 'read' | 'admin';

export interface ApiKeyProps {
  id: string;
  projectId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  permissions: ApiKeyPermission[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  createdBy?: string;
}

export class ApiKey extends Entity<string> {
  private readonly _projectId: string;
  private _name: string;
  private readonly _keyHash: string;
  private readonly _keyPrefix: string;
  private _permissions: ApiKeyPermission[];
  private _lastUsedAt?: Date;
  private readonly _expiresAt?: Date;
  private readonly _createdAt: Date;
  private readonly _createdBy?: string;

  private constructor(props: ApiKeyProps) {
    super(props.id);
    this._projectId = props.projectId;
    this._name = props.name;
    this._keyHash = props.keyHash;
    this._keyPrefix = props.keyPrefix;
    this._permissions = props.permissions;
    this._lastUsedAt = props.lastUsedAt;
    this._expiresAt = props.expiresAt;
    this._createdAt = props.createdAt;
    this._createdBy = props.createdBy;
  }

  get projectId(): string {
    return this._projectId;
  }

  get name(): string {
    return this._name;
  }

  get keyHash(): string {
    return this._keyHash;
  }

  get keyPrefix(): string {
    return this._keyPrefix;
  }

  get permissions(): ApiKeyPermission[] {
    return [...this._permissions];
  }

  get lastUsedAt(): Date | undefined {
    return this._lastUsedAt;
  }

  get expiresAt(): Date | undefined {
    return this._expiresAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get createdBy(): string | undefined {
    return this._createdBy;
  }

  get isExpired(): boolean {
    if (!this._expiresAt) return false;
    return new Date() > this._expiresAt;
  }

  hasPermission(permission: ApiKeyPermission): boolean {
    if (this._permissions.includes('admin')) return true;
    return this._permissions.includes(permission);
  }

  canIngest(): boolean {
    return this.hasPermission('ingest');
  }

  canRead(): boolean {
    return this.hasPermission('read');
  }

  isAdmin(): boolean {
    return this.hasPermission('admin');
  }

  markUsed(): void {
    this._lastUsedAt = new Date();
  }

  updateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Name cannot be empty');
    }
    this._name = name.trim();
  }

  updatePermissions(permissions: ApiKeyPermission[]): void {
    this._permissions = [...permissions];
  }

  static generateKey(): { key: string; prefix: string } {
    const key = `obs_${nanoid(32)}`;
    const prefix = key.substring(0, 10);
    return { key, prefix };
  }

  static create(props: {
    projectId: string;
    name: string;
    keyHash: string;
    keyPrefix: string;
    permissions?: ApiKeyPermission[];
    expiresAt?: Date;
    createdBy?: string;
  }): ApiKey {
    return new ApiKey({
      id: crypto.randomUUID(),
      projectId: props.projectId,
      name: props.name.trim(),
      keyHash: props.keyHash,
      keyPrefix: props.keyPrefix,
      permissions: props.permissions || ['ingest'],
      expiresAt: props.expiresAt,
      createdAt: new Date(),
      createdBy: props.createdBy,
    });
  }

  static reconstitute(props: ApiKeyProps): ApiKey {
    return new ApiKey(props);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      projectId: this._projectId,
      name: this._name,
      keyPrefix: this._keyPrefix,
      permissions: this._permissions,
      lastUsedAt: this._lastUsedAt?.toISOString(),
      expiresAt: this._expiresAt?.toISOString(),
      createdAt: this._createdAt.toISOString(),
      createdBy: this._createdBy,
    };
  }
}
