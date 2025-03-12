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
      console.log('İşlem kuyruğa ekleniyor:', account);
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
        console.error('API yanıtı JSON olarak parse edilemedi:', e);
        throw new Error('Invalid API response format');
      }

      if (!response.ok) {
        console.error('API Hatası:', {
          status: response.status,
          statusText: response.statusText,
          data: errorData
        });
        throw new Error(`Failed to add transaction to queue: ${errorData.error || 'Unknown error'}`);
      }

      console.log('İşlem başarıyla kuyruğa eklendi:', errorData);
      return errorData;
    } catch (error) {
      console.error('İşlem kuyruğa eklenirken hata:', error);
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
      console.log('Token ödül işlemi kuyruğa ekleniyor:', { account, coinCount });
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
        console.error('API yanıtı JSON olarak parse edilemedi:', e);
        throw new Error('Invalid API response format');
      }

      if (!response.ok) {
        console.error('API Hatası:', {
          status: response.status,
          statusText: response.statusText,
          data: errorData
        });
        throw new Error(`Failed to add token reward to queue: ${errorData.error || 'Unknown error'}`);
      }

      console.log('Token ödül işlemi başarıyla kuyruğa eklendi:', errorData);
      return errorData;
    } catch (error) {
      console.error('Token ödül işlemi kuyruğa eklenirken hata:', error);
      throw error;
    }
  }

  /**
   * Get the current status of the relayer pool
   */
  public async getStatus() {
    try {
      console.log('Relayer durumu kontrol ediliyor...');
      const response = await fetch('/api/relayer');
      
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        console.error('API yanıtı JSON olarak parse edilemedi:', e);
        throw new Error('Invalid API response format');
      }

      if (!response.ok) {
        console.error('API Durum Hatası:', {
          status: response.status,
          statusText: response.statusText,
          data: errorData
        });
        throw new Error(`Failed to get relayer status: ${errorData.error || 'Unknown error'}`);
      }
      
      console.log('Relayer durumu:', errorData);
      return errorData;
    } catch (error) {
      console.error('Relayer durumu alınırken hata:', error);
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
    console.error('Boss hasar kaydı başarısız:', error);
    throw error;
  }
};

export const collectToken = async (coinCount: number, account: string) => {
  try {
    return await relayerService.addTokenRewardToQueue(coinCount, account);
  } catch (error) {
    console.error('Token toplama başarısız:', error);
    throw error;
  }
}; 