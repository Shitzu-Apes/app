export class FixedNumber {
  public get decimals(): number {
    return this._decimals;
  }

  private set decimals(val: number) {
    this._decimals = val;
  }

  private value: bigint;

  private defaultFormatOptions: Intl.NumberFormatOptions;

  constructor(
    value: string | bigint | null | undefined,
    private _decimals: number = 0,
  ) {
    if (typeof value === "string") {
      this.value = BigInt(value);
    } else if (typeof value === "bigint") {
      this.value = value;
    } else {
      this.value = BigInt(0);
    }
    this.defaultFormatOptions = {
      maximumSignificantDigits: 6,
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(this._decimals, 20),
      roundingPriority: "lessPrecision",
    };
  }

  public clone(): FixedNumber {
    return new FixedNumber(this.value, this.decimals);
  }

  public add(input: FixedNumber): FixedNumber {
    const decimalDiff = this.decimals - input.decimals;
    let value: bigint;
    if (decimalDiff > 0) {
      value = input.value * BigInt(10) ** BigInt(decimalDiff);
    } else if (decimalDiff < 0) {
      value = input.value / BigInt(10) ** BigInt(-decimalDiff);
    } else {
      value = input.value;
    }
    const res = this.clone();
    res.value += value;
    return res;
  }

  public sub(input: FixedNumber): FixedNumber {
    const decimalDiff = this.decimals - input.decimals;
    let value: bigint;
    if (decimalDiff > 0) {
      value = input.value * BigInt(10) ** BigInt(decimalDiff);
    } else if (decimalDiff < 0) {
      value = input.value / BigInt(10) ** BigInt(-decimalDiff);
    } else {
      value = input.value;
    }
    const res = this.clone();
    res.value -= value;
    return res;
  }

  public mul(input: FixedNumber): FixedNumber {
    const res = this.clone();
    res.value *= input.value;
    res.value /= BigInt(10) ** BigInt(input.decimals);
    return res;
  }

  public div(input: FixedNumber): FixedNumber {
    const decimalDiff = this.decimals - input.decimals;
    let divisor: bigint;
    if (decimalDiff > 0) {
      divisor = input.value * BigInt(10) ** BigInt(decimalDiff);
    } else if (decimalDiff < 0) {
      divisor = input.value / BigInt(10) ** BigInt(-decimalDiff);
    } else {
      divisor = input.value;
    }
    const res = this.clone();
    res.value *= BigInt(10) ** BigInt(this.decimals);
    res.value /= divisor;
    return res;
  }

  public format(options?: Intl.NumberFormatOptions | undefined): string {
    return new Intl.NumberFormat(
      "en-US",
      Object.assign({}, this.defaultFormatOptions, options ?? {}),
      // TODO types seem to be wrong
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ).format(this.formatNumber() as any);
  }

  private formatNumber(): string {
    const isNegative = this.value < 0;
    let value = this.value.toString();
    if (isNegative) {
      value = value.substring(1);
    }
    const commaPos = value.length - this.decimals;
    if (commaPos >= 0) {
      value = value.slice(0, commaPos) + "." + value.slice(commaPos);
    } else {
      value = "." + "0".repeat(-commaPos) + value;
    }
    value = value.replace(/0+$/, "").replace(/^0+/, "");
    if (value === ".") {
      value = "0";
    } else if (value.startsWith(".")) {
      value = "0" + value;
    } else if (value.endsWith(".")) {
      value = value.slice(0, -1);
    }
    return (isNegative ? "-" : "") + value;
  }

  public toNumber(): number {
    return Number(this.value) / 10 ** this.decimals;
  }

  public toString(): string {
    const value = this.value.toString().padStart(this.decimals, "0");
    const sliceStart = value.slice(0, value.length - this.decimals);
    return `${sliceStart ? sliceStart : "0"}.${value.slice(-this.decimals)}`
      .replace(/0+$/, "")
      .replace(/\.+$/, "");
  }

  public toBigInt(): bigint {
    return this.value;
  }

  public toU128(): string {
    return this.value.toString();
  }

  public valueOf(): bigint {
    return this.value;
  }
}
