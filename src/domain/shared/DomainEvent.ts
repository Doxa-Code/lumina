export interface DomainEvent {
  readonly occurredAt: Date;
  readonly eventType: string;
}

export abstract class BaseDomainEvent implements DomainEvent {
  readonly occurredAt: Date;
  abstract readonly eventType: string;

  constructor() {
    this.occurredAt = new Date();
  }
}
