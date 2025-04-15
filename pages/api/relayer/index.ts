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
  // Debug logging disabled in production
}

// Relayer havuzunu başlat
async function initializeRelayers() {
  try {
    // RPC bağlantısını kontrol et
    try {
      const network = await provider.getNetwork();
    } catch (error) {
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
    } catch (error) {
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
            continue;
          }

          relayers[key] = {
            nonce,
            isProcessing: false
          };

          loadedRelayerCount++;
        } catch (error) {
          continue;
        }
      }
    }

    if (loadedRelayerCount === 0) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

// İşlem kuyruğunu işle
async function processQueue() {
  if (isProcessingQueue || txQueue.length === 0) {
    return;
  }

  if (Object.keys(relayers).length === 0) {
    const initialized = await initializeRelayers();
    if (!initialized) {
      return;
    }
  }

  isProcessingQueue = true;

  try {
    while (txQueue.length > 0) {
      const keys = Object.keys(relayers);
      if (keys.length === 0) {
        throw new Error('No active relayers');
      }

      const selectedRelayerKey = keys[currentIndex];
      const selectedRelayer = relayers[selectedRelayerKey];
      const wallet = new ethers.Wallet(selectedRelayerKey, provider);

      if (!selectedRelayer || selectedRelayer.isProcessing) {
        currentIndex = (currentIndex + 1) % keys.length;
        continue;
      }

      try {
        selectedRelayer.isProcessing = true;
        const tx = txQueue[0];

        const gasPrice = await provider.getGasPrice();
        const boostedGasPrice = gasPrice.mul(12).div(10);

        const currentNonce = await wallet.getTransactionCount();
        if (currentNonce !== selectedRelayer.nonce) {
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
          txParams.gasLimit = estimatedGas.mul(12).div(10).toNumber();
          
          txResponse = await gameContract.bossHit(tx.account, txParams);
          const receipt = await txResponse.wait(1);
        } else if (tx.type === 'rewardToken' && tx.coinCount !== undefined) {
          const estimatedGas = await gameContract.estimateGas.rewardToken(tx.account, tx.coinCount, txParams);
          txParams.gasLimit = estimatedGas.mul(12).div(10).toNumber();
          
          txResponse = await gameContract.rewardToken(tx.account, tx.coinCount, txParams);
          const receipt = await txResponse.wait(1);
        }

        selectedRelayer.nonce++;
        txQueue.shift();

      } catch (error: unknown) {
        const err = error as ErrorWithDetails;
        if (err.code === 'NONCE_EXPIRED' || err.code === 'REPLACEMENT_UNDERPRICED') {
          const newNonce = await wallet.getTransactionCount();
          selectedRelayer.nonce = newNonce;
        } else if (err.code === 'INSUFFICIENT_FUNDS') {
          delete relayers[selectedRelayerKey];
          if (Object.keys(relayers).length === 0) {
            throw new Error('All relayers exhausted');
          }
        } else {
          const failedTx = txQueue.shift();
          if (failedTx) {
            txQueue.push(failedTx);
          }
        }
      } finally {
        selectedRelayer.isProcessing = false;
      }

      currentIndex = (currentIndex + 1) % keys.length;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    // Handle error silently
  } finally {
    isProcessingQueue = false;
  }
}

// API endpoint handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Access-Control-Allow-Origin,X-HTTP-Method-Override,Content-Type,Authorization,Accept');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method === 'POST') {
      const { type, account, coinCount } = req.body;

      try {
        const network = await provider.getNetwork();
      } catch (error: unknown) {
        const err = error as ErrorWithDetails;
        return res.status(500).json({
          success: false,
          error: 'RPC connection failed',
          details: err.message
        });
      }

      if (!type || !account) {
        return res.status(400).json({ 
          success: false,
          error: 'Transaction type and account address are required' 
        });
      }

      if (type === 'rewardToken' && coinCount === undefined) {
        return res.status(400).json({ 
          success: false,
          error: 'Coin count is required for reward token transactions' 
        });
      }

      if (Object.keys(relayers).length === 0) {
        const initialized = await initializeRelayers();
        if (!initialized) {
          return res.status(500).json({ 
            success: false,
            error: 'Failed to initialize relayer pool' 
          });
        }
      }

      const relayerStatus = Object.entries(relayers).map(([key, info]) => {
        const wallet = new ethers.Wallet(key, provider);
        return {
          address: wallet.address,
          nonce: info.nonce,
          isProcessing: info.isProcessing
        };
      });

      try {
        const wallet = new ethers.Wallet(Object.keys(relayers)[0], provider);
        const gameContract = new ethers.Contract(
          process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS!,
          gameContractABI,
          wallet
        );
        const owner = await gameContract.owner();
      } catch (error: unknown) {
        const err = error as ErrorWithDetails;
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

      txQueue.push(txRequest);

      try {
        await processQueue();
      } catch (error: unknown) {
        // Handle error silently
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

      return res.status(200).json(queueInfo);
    }

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
      return res.status(200).json(status);
    }

    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });

  } catch (error: unknown) {
    const err = error as ErrorWithDetails;
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
} 