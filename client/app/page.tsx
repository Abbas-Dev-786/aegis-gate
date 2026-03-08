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

  // States for the popup modal
  const [showPopup, setShowPopup] = useState(false);
  const [simulationPayload, setSimulationPayload] = useState("");

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

  const handleWorldIdSuccess = (response: any) => {
    // Save the entire exact raw response to pass to Simulation!
    setWorldIdData(response);
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
  // 3. Generate Payload & Show Popup
  // ==========================================
  const submitToCRE = async () => {
    setStatus("Generating Payload for CRE Simulator...");

    if (!worldIdData) {
      setStatus("Please complete World ID verification first.");
      return;
    }

    // worldIdData is now the EXACT unaltered IDKit Response
    const payload = {
      walletAddress: walletAddress,
      worldIdFullResponse: worldIdData,
      plaidPublicToken: plaidToken,
    };

    setSimulationPayload(JSON.stringify(payload, null, 2));
    setShowPopup(true);
    setStatus("Payload generated. Please copy and run in terminal.");
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

      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl">
            <h2 className="text-2xl font-bold mb-4">CRE Simulation Payload</h2>
            <p className="text-gray-400 mb-4">
              Copy this JSON payload and paste it when prompted by the
              Simulator, or use it with your CLI.
            </p>
            <pre className="bg-gray-900 p-4 rounded text-sm text-green-400 overflow-auto max-h-96 whitespace-pre-wrap">
              {simulationPayload}
            </pre>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(simulationPayload);
                  setStatus("Payload copied to clipboard.");
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setShowPopup(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
