import { WorldIdVerificationData } from "./WorldIdVerification";

interface BankVerificationProps {
  openPlaid: Function;
  isPlaidReady: boolean;
  worldIdData: WorldIdVerificationData | null;
  plaidToken: string;
}

export function BankVerification({
  openPlaid,
  isPlaidReady,
  worldIdData,
  plaidToken,
}: BankVerificationProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        3. Verify Bank Standing
      </label>
      <button
        onClick={() => openPlaid()}
        // disabled={!worldIdData || !isPlaidReady}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
      >
        {plaidToken ? "Bank Verified ✓" : "Connect Bank via Plaid"}
      </button>
    </div>
  );
}
