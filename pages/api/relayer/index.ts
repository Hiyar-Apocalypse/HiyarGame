import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';
import { gameContractABI } from '@/contracts/gameContractABI';

interface RelayerInfo {
  nonce: number;
  isProcessing: boolean;
}

interface TransactionRequest {
  type: 'bossHit' | 'rewardToken';
  account: string;
  coinCount?: number;
  timestamp: number;
}

interface ErrorWithDetails extends Error {
  code?: string;
  reason?: string;
  method?: string;
  transaction?: any;
  receipt?: any;
  message: string;
}

interface ContractEvent {
  event: string;
  args: any[];
}

// Relayer havuzu
const relayers: { [key: string]: RelayerInfo } = {};
let currentIndex = 0;
let isProcessingQueue = false;
const txQueue: TransactionRequest[] = [];

// İşlem sayaçları
let bossHitTxCount = 0;
let rewardTokenTxCount = 0;
let totalTxCount = 0;

// RPC provider'ı oluştur
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

function logDebug(...args: any[]) {
  console.log('[DEBUG]', new Date().toISOString(), ...args);
}

// Relayer havuzunu başlat
async function initializeRelayers() {
  try {
    logDebug('Relayer havuzu başlatılıyor...');
    
    // RPC bağlantısını kontrol et
    try {
      const network = await provider.getNetwork();
      logDebug('RPC Bağlantısı başarılı:', {
        name: network.name,
        chainId: network.chainId
      });
    } catch (error) {
      console.error('[KRITIK HATA] RPC bağlantısı başarısız:', error);
      return false;
    }

    // Game contract'ı kontrol et
    try {
      const tempWallet = new ethers.Wallet(process.env.NEXT_PUBLIC_RELAYER_KEY_1!, provider);
      const gameContract = new ethers.Contract(
        process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS!,
        gameContractABI,
        tempWallet
      );
      const owner = await gameContract.owner();
      logDebug('Game contract kontrolü başarılı:', {
        address: gameContract.address,
        owner: owner
      });
    } catch (error) {
      console.error('[KRITIK HATA] Game contract kontrolü başarısız:', error);
      return false;
    }

    let loadedRelayerCount = 0;
    for (let i = 1; i <= 50; i++) {
      const key = process.env[`NEXT_PUBLIC_RELAYER_KEY_${i}`];
      if (key) {
        try {
          const wallet = new ethers.Wallet(key, provider);
          const address = wallet.address;
          const nonce = await wallet.getTransactionCount();
          const balance = await provider.getBalance(address);
          
          if (balance.eq(0)) {
            logDebug(`Relayer ${i} bakiyesi sıfır, atlanıyor:`, address);
            continue;
          }

          relayers[key] = {
            nonce,
            isProcessing: false
          };

          loadedRelayerCount++;
          logDebug(`Relayer ${i} yüklendi:`, {
            address,
            nonce,
            balance: ethers.utils.formatEther(balance)
          });
        } catch (error) {
          console.error(`[HATA] Relayer ${i} yüklenemedi:`, error);
          continue;
        }
      }
    }

    if (loadedRelayerCount === 0) {
      console.error('[KRITIK HATA] Hiç relayer yüklenemedi');
      return false;
    }

    logDebug(`${loadedRelayerCount} relayer başarıyla yüklendi`);
    return true;
  } catch (error) {
    console.error("[KRITIK HATA] Relayer havuzu başlatılırken beklenmeyen hata:", error);
    return false;
  }
}

// İşlem kuyruğunu işle
async function processQueue() {
  if (isProcessingQueue || txQueue.length === 0) {
    logDebug('Kuyruk işleme atlandı:', {
      isProcessing: isProcessingQueue,
      queueLength: txQueue.length
    });
    return;
  }

  if (Object.keys(relayers).length === 0) {
    logDebug('Relayer havuzu boş, yeniden başlatılıyor...');
    const initialized = await initializeRelayers();
    if (!initialized) {
      console.error('[KRITIK HATA] Relayer havuzu başlatılamadı, kuyruk işleme durduruldu');
      return;
    }
  }

  isProcessingQueue = true;
  logDebug('Kuyruk işleme başladı:', {
    queueLength: txQueue.length,
    relayerCount: Object.keys(relayers).length
  });

  try {
    while (txQueue.length > 0) {
      const keys = Object.keys(relayers);
      if (keys.length === 0) {
        throw new Error('Aktif relayer kalmadı');
      }

      const selectedRelayerKey = keys[currentIndex];
      const selectedRelayer = relayers[selectedRelayerKey];
      const wallet = new ethers.Wallet(selectedRelayerKey, provider);

      logDebug('Seçilen Relayer:', {
        address: wallet.address,
        index: currentIndex,
        nonce: selectedRelayer.nonce
      });

      if (!selectedRelayer || selectedRelayer.isProcessing) {
        currentIndex = (currentIndex + 1) % keys.length;
        continue;
      }

      try {
        selectedRelayer.isProcessing = true;
        const tx = txQueue[0];

        // Gas fiyatını kontrol et ve artır
        const gasPrice = await provider.getGasPrice();
        const boostedGasPrice = gasPrice.mul(12).div(10); // %20 artış

        // Nonce kontrolü
        const currentNonce = await wallet.getTransactionCount();
        if (currentNonce !== selectedRelayer.nonce) {
          logDebug('Nonce güncelleniyor:', {
            stored: selectedRelayer.nonce,
            current: currentNonce
          });
          selectedRelayer.nonce = currentNonce;
        }

        const txParams = {
          gasLimit: 300000,
          gasPrice: boostedGasPrice,
          nonce: selectedRelayer.nonce
        };

        const gameContract = new ethers.Contract(
          process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS!,
          gameContractABI,
          wallet
        );

        let txResponse;
        if (tx.type === 'bossHit') {
          const estimatedGas = await gameContract.estimateGas.bossHit(tx.account, txParams);
          txParams.gasLimit = estimatedGas.mul(12).div(10).toNumber(); // %20 buffer
          
          txResponse = await gameContract.bossHit(tx.account, txParams);
          logDebug('Boss hit transaction gönderildi:', txResponse.hash);
          
          const receipt = await txResponse.wait(1);
          logDebug('Boss hit transaction onaylandı:', {
            hash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString()
          });
        } else if (tx.type === 'rewardToken' && tx.coinCount !== undefined) {
          const estimatedGas = await gameContract.estimateGas.rewardToken(tx.account, tx.coinCount, txParams);
          txParams.gasLimit = estimatedGas.mul(12).div(10).toNumber(); // %20 buffer
          
          txResponse = await gameContract.rewardToken(tx.account, tx.coinCount, txParams);
          logDebug('Token ödül transaction gönderildi:', txResponse.hash);
          
          const receipt = await txResponse.wait(1);
          logDebug('Token ödül transaction onaylandı:', {
            hash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString()
          });
        }

        selectedRelayer.nonce++;
        txQueue.shift();

      } catch (error: unknown) {
        const err = error as ErrorWithDetails;
        console.error('[HATA] Transaction işleme hatası:', {
          error: err.message,
          code: err.code,
          reason: err.reason
        });

        if (err.code === 'NONCE_EXPIRED' || err.code === 'REPLACEMENT_UNDERPRICED') {
          const newNonce = await wallet.getTransactionCount();
          selectedRelayer.nonce = newNonce;
          logDebug('Nonce güncellendi:', newNonce);
        } else if (err.code === 'INSUFFICIENT_FUNDS') {
          // Relayer'ı havuzdan çıkar
          delete relayers[selectedRelayerKey];
          logDebug('Yetersiz bakiye, relayer kaldırıldı:', wallet.address);
          
          if (Object.keys(relayers).length === 0) {
            throw new Error('Tüm relayerlar tükendi');
          }
        } else {
          // Diğer hatalarda işlemi tekrar kuyruğa ekle
          const failedTx = txQueue.shift();
          if (failedTx) {
            txQueue.push(failedTx);
            logDebug('Başarısız işlem tekrar kuyruğa eklendi');
          }
        }
      } finally {
        selectedRelayer.isProcessing = false;
      }

      currentIndex = (currentIndex + 1) % keys.length;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('[KRITIK HATA] Kuyruk işleme hatası:', error);
  } finally {
    isProcessingQueue = false;
    logDebug('Kuyruk işleme tamamlandı');
  }
}

// API endpoint handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Access-Control-Allow-Origin,X-HTTP-Method-Override,Content-Type,Authorization,Accept');

    // OPTIONS request handling
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // POST isteği ile işlem kuyruğuna ekle
    if (req.method === 'POST') {
      logDebug('POST isteği alındı:', req.body);
      const { type, account, coinCount } = req.body;

      // RPC bağlantısını kontrol et
      try {
        const network = await provider.getNetwork();
        logDebug('RPC Bağlantısı:', {
          name: network.name,
          chainId: network.chainId,
          ensAddress: network.ensAddress
        });
      } catch (error: unknown) {
        const err = error as ErrorWithDetails;
        console.error('[ERROR] RPC bağlantı hatası:', err);
        return res.status(500).json({
          success: false,
          error: 'RPC connection failed',
          details: err.message
        });
      }

      if (!type || !account) {
        logDebug('Eksik parametreler:', { type, account, coinCount });
        return res.status(400).json({ 
          success: false,
          error: 'Transaction type and account address are required' 
        });
      }

      if (type === 'rewardToken' && coinCount === undefined) {
        logDebug('Reward token için coin count eksik');
        return res.status(400).json({ 
          success: false,
          error: 'Coin count is required for reward token transactions' 
        });
      }

      // İlk istek ise relayer havuzunu başlat
      if (Object.keys(relayers).length === 0) {
        logDebug('Relayer havuzu boş, başlatılıyor...');
        const initialized = await initializeRelayers();
        if (!initialized) {
          return res.status(500).json({ 
            success: false,
            error: 'Failed to initialize relayer pool' 
          });
        }
      }

      // Relayer havuzunun durumunu kontrol et
      const relayerStatus = Object.entries(relayers).map(([key, info]) => {
        const wallet = new ethers.Wallet(key, provider);
        return {
          address: wallet.address,
          nonce: info.nonce,
          isProcessing: info.isProcessing
        };
      });
      logDebug('Relayer havuzu durumu:', relayerStatus);

      // Game contract'ı kontrol et
      try {
        const wallet = new ethers.Wallet(Object.keys(relayers)[0], provider);
        const gameContract = new ethers.Contract(
          process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS!,
          gameContractABI,
          wallet
        );
        const owner = await gameContract.owner();
        logDebug('Game contract durumu:', {
          address: gameContract.address,
          owner: owner
        });
      } catch (error: unknown) {
        const err = error as ErrorWithDetails;
        console.error('[ERROR] Game contract kontrol hatası:', err);
        return res.status(500).json({
          success: false,
          error: 'Game contract check failed',
          details: err.message
        });
      }

      const txRequest: TransactionRequest = {
        type,
        account,
        timestamp: Date.now()
      };

      if (type === 'rewardToken') {
        txRequest.coinCount = coinCount;
      }

      logDebug('İşlem kuyruğa ekleniyor:', txRequest);
      txQueue.push(txRequest);

      // Kuyruk işleme başlat
      try {
        await processQueue().catch((error: unknown) => {
          const err = error as ErrorWithDetails;
          console.error('[ERROR] Kuyruk işlenirken hata:', err);
          throw err;
        });
      } catch (error: unknown) {
        logDebug('Kuyruk işleme hatası yakalandı, devam ediliyor...');
      }

      const queueInfo = {
        success: true,
        message: 'Transaction added to queue',
        queueLength: txQueue.length,
        queueStatus: {
          isProcessing: isProcessingQueue,
          currentRelayerIndex: currentIndex,
          totalRelayers: Object.keys(relayers).length,
          currentQueueItems: txQueue.map(item => ({
            type: item.type,
            account: item.account,
            timestamp: item.timestamp
          }))
        }
      };

      logDebug('API yanıtı:', queueInfo);
      return res.status(200).json(queueInfo);
    }

    // GET isteği ile havuz durumunu kontrol et
    if (req.method === 'GET') {
      const status = {
        success: true,
        data: {
          relayerCount: Object.keys(relayers).length,
          queueLength: txQueue.length,
          isProcessing: isProcessingQueue,
          bossHitTransactions: bossHitTxCount,
          rewardTokenTransactions: rewardTokenTxCount,
          totalTransactions: totalTxCount,
          currentRelayerIndex: currentIndex,
          relayers: Object.entries(relayers).map(([key, info]) => ({
            address: new ethers.Wallet(key, provider).address,
            nonce: info.nonce,
            isProcessing: info.isProcessing
          })),
          currentQueue: txQueue
        }
      };
      logDebug('GET yanıtı:', status);
      return res.status(200).json(status);
    }

    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });

  } catch (error: unknown) {
    const err = error as ErrorWithDetails;
    console.error('[ERROR] API handler error:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
} 