import { Dispatch, SetStateAction } from "react";
import { IDKitRequestWidget, RpContext, deviceLegacy } from "@worldcoin/idkit";

export interface WorldIdVerificationData {
  proof: string[]; // Updated for v4 compatibility
  nullifier_hash: string;
  merkle_root: string;
  verification_level: string;
}

interface WorldIdVerificationProps {
  rpContext: RpContext | null;
  worldIdData: WorldIdVerificationData | null;
  walletAddress: string;
  isWorldIdOpen: boolean;
  setIsWorldIdOpen: Dispatch<SetStateAction<boolean>>;
  handleWorldIdSuccess: (result: any) => void;
}

export function WorldIdVerification({
  rpContext,
  worldIdData,
  walletAddress,
  isWorldIdOpen,
  setIsWorldIdOpen,
  handleWorldIdSuccess,
}: WorldIdVerificationProps) {
  const verifyProof = async (result: any) => {
    const response = await fetch("/api/world-id/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(result),
    });
    if (!response.ok) {
      throw new Error("Verification failed on the backend");
    }
  };
  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        2. Prove You Are Human
      </label>
      {rpContext ? (
        <>
          <IDKitRequestWidget
            app_id={process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}`}
            action="aegisgate-verification"
            action_description="Verify your humanity for AegisGate"
            rp_context={rpContext}
            preset={deviceLegacy({ signal: "local-election-1" })}
            allow_legacy_proofs={true}
            handleVerify={verifyProof} // Triggers verification
            onSuccess={handleWorldIdSuccess}
            onError={(error) => console.log(error)}
            open={isWorldIdOpen}
            onOpenChange={setIsWorldIdOpen}
          />
          <button
            onClick={() => setIsWorldIdOpen(true)}
            disabled={!walletAddress}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {worldIdData ? "Humanity Verified ✓" : "Verify with World ID"}
          </button>
        </>
      ) : (
        <p className="text-sm text-gray-400">
          Loading secure World ID context...
        </p>
      )}
    </div>
  );
}
