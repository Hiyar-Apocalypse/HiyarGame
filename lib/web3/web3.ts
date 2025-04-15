/**
 * Client-side service for interacting with the relayer API
 */
class RelayerService {
  private static instance: RelayerService;

  private constructor() {}

  public static getInstance(): RelayerService {
    if (!RelayerService.instance) {
      RelayerService.instance = new RelayerService();
    }
    return RelayerService.instance;
  }

  /**
   * Add a transaction to the relayer queue
   * @param account The account address to process the transaction for
   */
  public async addToQueue(account: string) {
    try {
      const response = await fetch('/api/relayer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'bossHit', account }),
      });

      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        throw new Error('Invalid API response format');
      }

      if (!response.ok) {
        throw new Error(`Failed to add transaction to queue: ${errorData.error || 'Unknown error'}`);
      }

      return errorData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add a token reward transaction to the relayer queue
   * @param coinCount The number of coins to reward
   * @param account The account address to reward tokens to
   */
  public async addTokenRewardToQueue(coinCount: number, account: string) {
    try {
      const response = await fetch('/api/relayer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'rewardToken', account, coinCount }),
      });

      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        throw new Error('Invalid API response format');
      }

      if (!response.ok) {
        throw new Error(`Failed to add token reward to queue: ${errorData.error || 'Unknown error'}`);
      }

      return errorData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get the current status of the relayer pool
   */
  public async getStatus() {
    try {
      const response = await fetch('/api/relayer');
      
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        throw new Error('Invalid API response format');
      }

      if (!response.ok) {
        throw new Error(`Failed to get relayer status: ${errorData.error || 'Unknown error'}`);
      }
      
      return errorData;
    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance
export const relayerService = RelayerService.getInstance();

// Export functions for external use
export const recordBossDamage = async (damage: number, account: string) => {
  try {
    return await relayerService.addToQueue(account);
  } catch (error) {
    console.error('Boss damage record failed:', error);
    throw error;
  }
};

export const collectToken = async (coinCount: number, account: string) => {
  try {
    return await relayerService.addTokenRewardToQueue(coinCount, account);
  } catch (error) {
    console.error('Token collection failed:', error);
    throw error;
  }
}; 