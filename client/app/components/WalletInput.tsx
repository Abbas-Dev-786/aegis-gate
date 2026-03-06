import { Dispatch, SetStateAction } from "react";

interface WalletInputProps {
  walletAddress: string;
  setWalletAddress: Dispatch<SetStateAction<string>>;
}

export function WalletInput({
  walletAddress,
  setWalletAddress,
}: WalletInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        1. Enter Wallet Address
      </label>
      <input
        type="text"
        className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
        placeholder="0x..."
        value={walletAddress}
        onChange={(e) => setWalletAddress(e.target.value)}
      />
    </div>
  );
}
