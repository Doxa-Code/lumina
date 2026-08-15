import { ValueObject } from '../../shared/ValueObject.js';

export type AttributeValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[];

export type AttributeMap = Record<string, AttributeValue>;

interface AttributesProps {
  values: AttributeMap;
}

export class Attributes extends ValueObject<AttributesProps> {
  private constructor(props: AttributesProps) {
    super(props);
  }

  get values(): AttributeMap {
    return { ...this.props.values };
  }

  get(key: string): AttributeValue | undefined {
    return this.props.values[key];
  }

  has(key: string): boolean {
    return key in this.props.values;
  }

  keys(): string[] {
    return Object.keys(this.props.values);
  }

  entries(): [string, AttributeValue][] {
    return Object.entries(this.props.values);
  }

  size(): number {
    return Object.keys(this.props.values).length;
  }

  static create(values: AttributeMap = {}): Attributes {
    return new Attributes({ values: { ...values } });
  }

  static empty(): Attributes {
    return new Attributes({ values: {} });
  }

  static fromOTLP(attributes: Array<{ key: string; value: OTLPValue }>): Attributes {
    const values: AttributeMap = {};

    for (const attr of attributes) {
      values[attr.key] = extractOTLPValue(attr.value);
    }

    return new Attributes({ values });
  }

  merge(other: Attributes): Attributes {
    return new Attributes({
      values: { ...this.props.values, ...other.props.values },
    });
  }

  toJSON(): AttributeMap {
    return this.values;
  }
}

interface OTLPValue {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values: OTLPValue[] };
  kvlistValue?: { values: Array<{ key: string; value: OTLPValue }> };
}

function extractOTLPValue(value: OTLPValue): AttributeValue {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.intValue !== undefined) return Number(value.intValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.arrayValue) {
    return value.arrayValue.values.map((v) => extractOTLPValue(v)) as
      | string[]
      | number[]
      | boolean[];
  }
  return String(value);
}
