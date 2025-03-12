import { useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";

declare global {
  interface Window {
    ethereum: any;
  }
}

const MONAD_CHAIN_ID = 10143; // Monad Mainnet
const MONAD_CHAIN_HEX = `0x${MONAD_CHAIN_ID.toString(16)}`; // Hex formatı

// Swap kontratı için ABI
const swapContractABI = [
  "function swapTokens(uint256 amount) external returns (bool)"
];

async function checkAndSwitchNetwork(): Promise<boolean> {
  try {
    if (!window.ethereum) {
      toast.error("MetaMask is not installed!");
      return false;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const network = await provider.getNetwork();

    if (network.chainId !== MONAD_CHAIN_ID) {
      const userResponse = window.confirm(
        "You need to be connected to the Monad network for this operation. Do you want to change the network?"
      );

      if (userResponse) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: MONAD_CHAIN_HEX }],
          });
          toast.success("Network changed successfully!");
          return true;
        } catch (error) {
          toast.error("Network switching failed. Please manually switch to Monad network.");
          return false;
        }
      } else {
        toast.error("The transaction was cancelled. Please switch to Monad network.");
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Ağ kontrolü sırasında hata:", error);
    toast.error("An error occurred during network check!");
    return false;
  }
}

export default function SwapComponent() {
  const [loading, setLoading] = useState(false);

  async function handleSwap() {
    setLoading(true);
    
    try {
      const isCorrectNetwork = await checkAndSwitchNetwork();
      if (!isCorrectNetwork) {
        setLoading(false);
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // BILL Token kontratını oluştur
      const billTokenContract = new ethers.Contract(
        process.env.NEXT_PUBLIC_BILL_TOKEN_ADDRESS!,
        ["function approve(address spender, uint256 amount) public returns (bool)"],
        signer
      );

      // Swap kontratını oluştur
      const swapContract = new ethers.Contract(
        process.env.NEXT_PUBLIC_SWAP_CONTRACT_ADDRESS!,
        swapContractABI,
        signer
      );

      // Tam olarak 1000 BILL token gönder
      const billAmount = ethers.utils.parseEther("1000");

      toast.loading("Token approval awaited...");
      // Önce approval işlemi
      const approveTx = await billTokenContract.approve(
        process.env.NEXT_PUBLIC_SWAP_CONTRACT_ADDRESS,
        billAmount,
        {
          gasLimit: 100000 // Manuel gaz limiti
        }
      );
      await approveTx.wait();
      toast.success("Token approval received!");

      toast.loading("Swap transaction is being performed...");
      // Swap işlemi
      const swapTx = await swapContract.swapTokens(billAmount, {
        gasLimit: 200000 // Manuel gaz limiti
      });
      await swapTx.wait();
      
      toast.success("Token swap successful!");
    } catch (error: any) {
      console.error("Swap operation failed:", error);
      if (error.reason) {
        toast.error(`Operation failed: ${error.reason}`);
      } else if (error.message) {
        toast.error(`Operation failed: ${error.message}`);
      } else {
        toast.error("An unexpected error occurred!");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleSwap}
        disabled={loading}
        className="w-full bg-green-800 hover:bg-green-500 text-white font-bold text-1xl tracking-wider py-3 px-4 rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed font-[Poppins] border-2 border-green-500"
      >
        {loading ? "Transaction in Progress..." : "Token Swap"}
      </button>
    </>
  );
} 