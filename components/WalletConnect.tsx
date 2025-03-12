import { useState, useEffect } from 'react';
import { connectWallet, listenToWalletEvents, listenToNetworkEvents } from '../lib/web3/metamask';

interface WalletConnectProps {
    onConnect: (account: string) => void;
}

const WalletConnect = ({ onConnect }: WalletConnectProps) => {
    const [walletInfo, setWalletInfo] = useState<{
        address?: string;
        balance?: string;
        error?: string;
    }>({});
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnect = async () => {
        if (!window.ethereum) {
            alert('Please install MetaMask!');
            return;
        }

        try {
            setIsConnecting(true);
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts.length > 0) {
                onConnect(accounts[0]);
                setWalletInfo({
                    address: accounts[0],
                    balance: accounts[0]
                });
            }
        } catch (error) {
            console.error('Error connecting to MetaMask:', error);
            alert('Error connecting to MetaMask. Please try again.');
        } finally {
            setIsConnecting(false);
        }
    };

    useEffect(() => {
        // Hesap değişikliklerini dinle
        listenToWalletEvents((accounts) => {
            if (accounts.length > 0) {
                setWalletInfo(prev => ({ ...prev, address: accounts[0] }));
            } else {
                setWalletInfo({});
            }
        });

        // Ağ değişikliklerini dinle
        listenToNetworkEvents(() => {
            // Ağ değiştiğinde sayfayı yenile
            window.location.reload();
        });
    }, []);

    return (
        <>
          
                <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="w-full bg-green-800 border-2 border-green-500 hover:bg-green-500 text-white font-bold text-1xl tracking-wider py-3 px-4 rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed font-[Poppins]">
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
        
            {walletInfo.error && (
                <p className="text-red-500 mt-2">{walletInfo.error}</p>
            )}
        </>
    );
};

export default WalletConnect;   