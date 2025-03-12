import { ethers } from 'ethers';

interface Window {
    ethereum: any;
}

export const connectWallet = async () => {
    try {
        if (!window.ethereum) {
            throw new Error('MetaMask yüklü değil! Lütfen MetaMask\'ı yükleyin.');
        }

        // MetaMask provider'ını al
        const provider = new ethers.providers.Web3Provider(window.ethereum);

        // Cüzdan bağlantı izni iste
        await window.ethereum.request({ method: 'eth_requestAccounts' });

        // Hesap bilgilerini al
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        const balance = await provider.getBalance(address);
        const balanceInEth = ethers.utils.formatEther(balance);

        return {
            success: true,
            address,
            balance: balanceInEth,
            provider,
            signer
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        };
    }
};

// Cüzdan bağlantısını dinle
export const listenToWalletEvents = (callback: (accounts: string[]) => void) => {
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', callback);
    }
};

// Ağ değişikliğini dinle
export const listenToNetworkEvents = (callback: (chainId: string) => void) => {
    if (window.ethereum) {
        window.ethereum.on('chainChanged', callback);
    }
}; 