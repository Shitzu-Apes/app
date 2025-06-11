export interface ValidatorData {
  inx: number;
  account_id: string;
  weight_basis_points: number;
  staked: string;
  unstaked: string;
  unstaked_requested_epoch_height: string;
  last_asked_rewards_epoch_height: string;
  busy_lock: boolean;
  extraData: {
    epoch: number;
    oldBalance: string;
    newBalance: string;
    rewards: string;
    unstaked: string;
    apy: number;
    fee: number;
    totalStake: string;
    monitoredBalance: string;
  };
  lastPerformanceCalculation: {
    name: string;
    slashed: boolean;
    stake: string;
    uptime: number;
    fee: number;
    points: number;
    bp: number;
    lastApy: number;
    apy: number;
  };
  assignByPerformancePercentage: number;
  votes: number;
}

export abstract class MetaPool {
  private static readonly API_URL =
    "https://www.metapool.app/api/stakevote/validators/";

  public static async getValidatorAPY(
    validatorId: string,
  ): Promise<number | null> {
    try {
      const response = await fetch(this.API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const validators: ValidatorData[] = await response.json();
      const validator = validators.find((v) => v.account_id === validatorId);

      if (!validator) {
        console.warn(`Validator ${validatorId} not found in MetaPool API`);
        return null;
      }

      return validator.lastPerformanceCalculation.apy;
    } catch (error) {
      console.error("Error fetching validator APY from MetaPool:", error);
      return null;
    }
  }

  public static async getValidatorData(
    validatorId: string,
  ): Promise<ValidatorData | null> {
    try {
      const response = await fetch(this.API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const validators: ValidatorData[] = await response.json();
      const validator = validators.find((v) => v.account_id === validatorId);

      return validator || null;
    } catch (error) {
      console.error("Error fetching validator data from MetaPool:", error);
      return null;
    }
  }
}
