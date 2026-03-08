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
import { ComplianceStatus } from "./components/ComplianceStatus";

// Step indicator component
function StepIndicator({
  steps,
  currentStep,
}: {
  steps: { label: string; done: boolean }[];
  currentStep: number;
}) {
  return (
    <div className="flex items-center justify-between mb-8 px-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          {/* Circle */}
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                step.done
                  ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
                  : i === currentStep
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 animate-pulse"
                    : "bg-gray-700 text-gray-400"
              }`}
            >
              {step.done ? "✓" : i + 1}
            </div>
            <span
              className={`text-xs mt-1.5 text-center whitespace-nowrap ${
                step.done
                  ? "text-green-400"
                  : i === currentStep
                    ? "text-blue-300"
                    : "text-gray-500"
              }`}
            >
              {step.label}
            </span>
          </div>
          {/* Connector line */}
          {i < steps.length - 1 && (
            <div className="flex-1 mx-2 mt-[-18px]">
              <div
                className={`h-0.5 transition-all duration-500 ${
                  step.done ? "bg-green-500" : "bg-gray-700"
                }`}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AegisGateFrontend() {
  const [walletAddress, setWalletAddress] = useState("");
  const [worldIdData, setWorldIdData] =
    useState<WorldIdVerificationData | null>(null);

  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [isWorldIdOpen, setIsWorldIdOpen] = useState(false);

  const [plaidToken, setPlaidToken] = useState("");
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  // States for the popup modal
  const [showPopup, setShowPopup] = useState(false);
  const [simulationPayload, setSimulationPayload] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // ==========================================
  // Stepper logic
  // ==========================================
  const steps = [
    { label: "Wallet", done: !!walletAddress },
    { label: "World ID", done: !!worldIdData },
    { label: "Bank", done: !!plaidToken },
    { label: "Submit", done: submitted },
    { label: "Status", done: false },
  ];
  const currentStep = steps.findIndex((s) => !s.done);

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

    const payload = {
      walletAddress: walletAddress,
      worldIdFullResponse: worldIdData,
      plaidPublicToken: plaidToken,
    };

    setSimulationPayload(JSON.stringify(payload, null, 2));
    setShowPopup(true);
    setSubmitted(true);
    setStatus("Payload generated. Please copy and run in terminal.");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-6 md:p-10 font-sans">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-lg font-bold shadow-lg shadow-purple-500/20">
            A
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            AegisGate
          </h1>
        </div>
        <p className="text-gray-400">
          Confidential Compliance &amp; Private Payouts
        </p>
      </div>

      <div className="bg-gray-800 p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-lg border border-gray-700/50">
        {/* Step Indicator */}
        <StepIndicator steps={steps} currentStep={currentStep} />

        <div className="flex flex-col gap-6">
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

          {/* Divider */}
          <div className="border-t border-gray-700" />

          {/* Compliance Status */}
          <ComplianceStatus walletAddress={walletAddress} />

          {/* Status Output */}
          {status && (
            <div className="mt-2 p-4 bg-gray-700/50 rounded-lg text-sm break-words border border-gray-600/50">
              <strong className="text-gray-300">Status:</strong>{" "}
              <span className="text-gray-200">{status}</span>
            </div>
          )}
        </div>
      </div>

      {/* Admin link */}
      <a
        href="/admin"
        className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        Admin Dashboard →
      </a>

      {showPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700">
            <h2 className="text-2xl font-bold mb-4">CRE Simulation Payload</h2>
            <p className="text-gray-400 mb-4">
              Copy this JSON payload and paste it when prompted by the
              Simulator, or use it with your CLI.
            </p>
            <pre className="bg-gray-900 p-4 rounded-lg text-sm text-green-400 overflow-auto max-h-96 whitespace-pre-wrap border border-gray-700">
              {simulationPayload}
            </pre>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(simulationPayload);
                  setStatus("Payload copied to clipboard.");
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setShowPopup(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
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
