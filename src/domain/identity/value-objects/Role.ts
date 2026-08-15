import { ValueObject } from '../../shared/ValueObject.js';

export enum RoleType {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

interface RoleProps {
  value: RoleType;
}

export class Role extends ValueObject<RoleProps> {
  private constructor(props: RoleProps) {
    super(props);
  }

  get value(): RoleType {
    return this.props.value;
  }

  get canManageMembers(): boolean {
    return [RoleType.OWNER, RoleType.ADMIN].includes(this.props.value);
  }

  get canManageProject(): boolean {
    return [RoleType.OWNER, RoleType.ADMIN].includes(this.props.value);
  }

  get canCreateApiKeys(): boolean {
    return [RoleType.OWNER, RoleType.ADMIN, RoleType.MEMBER].includes(
      this.props.value
    );
  }

  get canDeleteOrganization(): boolean {
    return this.props.value === RoleType.OWNER;
  }

  get canViewData(): boolean {
    return true;
  }

  get canWriteData(): boolean {
    return this.props.value !== RoleType.VIEWER;
  }

  static create(role: string): Role {
    const upperRole = role.toUpperCase();
    if (!Object.values(RoleType).includes(upperRole as RoleType)) {
      throw new Error(`Invalid role: ${role}`);
    }
    return new Role({ value: upperRole as RoleType });
  }

  static owner(): Role {
    return new Role({ value: RoleType.OWNER });
  }

  static admin(): Role {
    return new Role({ value: RoleType.ADMIN });
  }

  static member(): Role {
    return new Role({ value: RoleType.MEMBER });
  }

  static viewer(): Role {
    return new Role({ value: RoleType.VIEWER });
  }

  toString(): string {
    return this.props.value;
  }
}
