"use client";

import { useState, useEffect } from "react";
import { RpContext } from "@worldcoin/idkit";
import { usePlaidLink } from "react-plaid-link";

import { WalletInput } from "./components/WalletInput";
import {
  WorldIdVerification,
  WorldIdVerificationData,
} from "./components/WorldIdVerification";
import { BankVerification } from "./components/BankVerification";
import { SubmitEnclave } from "./components/SubmitEnclave";

export default function AegisGateFrontend() {
  const [walletAddress, setWalletAddress] = useState("");
  const [worldIdData, setWorldIdData] =
    useState<WorldIdVerificationData | null>(null);

  // Use the specific type exported by @worldcoin/idkit for RpContext
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [isWorldIdOpen, setIsWorldIdOpen] = useState(false);

  const [plaidToken, setPlaidToken] = useState("");
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  // ==========================================
  // 1. World ID Integration (Strict Context Fetch)
  // ==========================================
  useEffect(() => {
    const fetchSecureContext = async () => {
      try {
        const response = await fetch("/api/world-id/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "aegisgate-verification" }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch secure context");
        }

        const context = await response.json();
        setRpContext(context);
      } catch (err) {
        setStatus("Error loading World ID secure context.");
      }
    };

    fetchSecureContext();
  }, []);

  const handleWorldIdSuccess = (result: any) => {
    setWorldIdData({
      proof: result.proof,
      nullifier_hash: result.nullifier_hash,
      merkle_root: result.merkle_root,
      verification_level: result.verification_level,
    });
    setStatus("World ID Verified! Human confirmed.");
  };

  // ==========================================
  // 2. Plaid Link Integration
  // ==========================================
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        const response = await fetch("/api/plaid/create_link_token", {
          method: "POST",
        });
        if (!response.ok) {
          throw new Error("Failed to fetch Plaid link token");
        }
        const data = await response.json();
        setPlaidLinkToken(data.link_token);
      } catch (err) {
        setStatus("Error loading Plaid link token.");
      }
    };

    fetchLinkToken();
  }, []);

  const { open: openPlaid, ready: isPlaidReady } = usePlaidLink({
    token: plaidLinkToken!,
    onSuccess: async (public_token) => {
      setStatus("Exchanging Plaid public token...");
      try {
        const response = await fetch("/api/plaid/set_access_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token }),
        });

        if (!response.ok) {
          throw new Error("Failed to exchange Plaid public token");
        }

        const data = await response.json();

        // We set the public token to the overall application state
        // to pass along to the smart contract or CRE enclave. Your enclave
        // will use this public_token to complete its own secure exchange.
        setPlaidToken(public_token);
        setStatus("Bank Verified! Plaid connected successfully.");
      } catch (error) {
        console.error("Error exchanging Plaid token:", error);
        setStatus("Error completing Plaid bank verification.");
      }
    },
  });

  // ==========================================
  // 3. Submit to Chainlink CRE Enclave
  // ==========================================
  const submitToCRE = async () => {
    setStatus("Submitting to AegisGate CRE Enclave...");

    if (!worldIdData) return;

    // This payload perfectly matches the V2 World ID curl requirements in your CRE workflow
    const payload = {
      walletAddress: walletAddress,
      worldIdProof: worldIdData.proof,
      worldIdNullifier: worldIdData.nullifier_hash,
      worldIdMerkleRoot: worldIdData.merkle_root,
      worldIdVerificationLevel: worldIdData.verification_level,
      plaidPublicToken: plaidToken,
    };

    try {
      // Replace with your actual CRE HTTP Trigger URL
      const response = await fetch("YOUR_CRE_WORKFLOW_HTTP_URL", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus(
          `Success! Transaction Mined. CRE Enclave Response: ${JSON.stringify(result)}`,
        );
      } else {
        setStatus(
          `Verification Failed by CRE Enclave: ${JSON.stringify(result)}`,
        );
      }
    } catch (error) {
      console.error(error);
      setStatus("Error connecting to CRE Workflow.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-10 font-sans">
      <h1 className="text-4xl font-bold mb-2">AegisGate</h1>
      <p className="text-gray-400 mb-10">
        Confidential Compliance & Private Payouts
      </p>

      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md flex flex-col gap-6">
        <WalletInput
          walletAddress={walletAddress}
          setWalletAddress={setWalletAddress}
        />

        <WorldIdVerification
          rpContext={rpContext}
          worldIdData={worldIdData}
          walletAddress={walletAddress}
          isWorldIdOpen={isWorldIdOpen}
          setIsWorldIdOpen={setIsWorldIdOpen}
          handleWorldIdSuccess={handleWorldIdSuccess}
        />

        <BankVerification
          openPlaid={openPlaid}
          isPlaidReady={isPlaidReady}
          worldIdData={worldIdData}
          plaidToken={plaidToken}
        />

        <SubmitEnclave submitToCRE={submitToCRE} plaidToken={plaidToken} />

        {/* Status Output */}
        {status && (
          <div className="mt-4 p-4 bg-gray-700 rounded text-sm break-words">
            <strong>Status:</strong> {status}
          </div>
        )}
      </div>
    </div>
  );
}
