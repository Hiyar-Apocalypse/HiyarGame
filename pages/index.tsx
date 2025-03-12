import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import WalletConnect from "../components/WalletConnect";
import Social from "@/components/social";
import { ethers } from "ethers";
import { swapContractABI } from "../contracts/swapContractABI";
import toast, { Toaster } from 'react-hot-toast';
import PixiSprite from "@/components/PixiSprite";
import Link from 'next/link';
import SwapComponent from "@/components/SwapComponent";
export default function Home() {
  const router = useRouter();
  const [theme, setTheme] = useState("light");
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [showGame, setShowGame] = useState(false);

  useEffect(() => {
    // Sayfa yüklendiğinde mevcut temayı kontrol et
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
    setIsClient(true);

    // MetaMask hesap değişikliklerini dinle
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount(null);
          setShowGame(false); // Cüzdan bağlantısı koptuğunda oyunu kapat
        }
      });
    }
  }, []);

  function handleThemeChange(newTheme: string) {
    setTheme(newTheme);
  }

  const handleStartGame = () => {
    if (!account) {
      toast.error('Please connect your wallet first!', {
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      });
      return;
    }
    setShowGame(true);
  };

 

  if (showGame) {
    return <PixiSprite 
      isGamePage={true} 
      account={account} 
      env={{
        NEXT_PUBLIC_GAME_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS || '',
        NEXT_PUBLIC_BILL_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_BILL_TOKEN_ADDRESS || ''
      }} 
    />;
  }

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen relative`}>
      <Toaster position="top-center" />
      {/* Arka plan resmi */}
      <Image
        src="/index_background.png"
        alt="Background"
        fill
        className="object-cover z-0"
        priority
      />
      
      {/* Overlay katmanı */}
      <div className={`absolute inset-0 z-1 ${theme === "light" ? "bg-black/10" : "bg-black/50"} transition-colors duration-500`} />
      <div className="flex flex-col items-center gap-8 mb-50 relative z-10">
        <Link href="https://x.com/HiyarApocalypse" target="_blank">
          <Image 
            src="/LOGO.png"
            alt="Logo"
            width={500}
            
            height={500}
            priority
            className="z-500"
          />
        </Link>

        {/* Card içeriği */}
        <div className={`relative z-10 p-8 rounded-xl transition-colors duration-300 w-full max-w-md`}> 
          <div className="flex flex-col items-center space-y-3 ">
            <div className="w-full max-w-xs">
              <WalletConnect onConnect={setAccount} />
            </div>
            
            {/* Start Game Butonu */}
            <div className="w-full max-w-xs">
              <button 
                onClick={handleStartGame}
                disabled={!account || loading}
                className="w-full bg-green-800 hover:bg-green-500 text-white font-bold text-1xl tracking-wider py-3 px-4 rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed font-[Poppins] border-2 border-green-500"
              >
                Start Game
              </button>
            </div>
            
            {/* Swap Butonu */}
            <div className="w-full max-w-xs">
              <SwapComponent />
            </div>
          </div>
        </div>

        {/* Social medya ikonları */}
        <Social />
              
      </div>
    </div>
  );
}
