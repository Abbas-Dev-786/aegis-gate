"use client";

import { useState } from "react";

interface ComplianceStatusProps {
  walletAddress: string;
}

interface ComplianceData {
  wallet: string;
  isCompliant: boolean;
  isAccredited: boolean;
  verifiedAt: string | null;
  expiresAt: string | null;
  verifier: string;
}

export function ComplianceStatus({ walletAddress }: ComplianceStatusProps) {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checkStatus = async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/contract/compliance?wallet=${encodeURIComponent(walletAddress)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError("Could not read compliance status from chain.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        5. Check On-Chain Compliance Status
      </label>
      <button
        onClick={checkStatus}
        disabled={!walletAddress || loading}
        className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 transition-colors"
      >
        {loading ? "Checking…" : "Check Compliance Status"}
      </button>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {data && (
        <div className="mt-4 p-4 rounded-lg border border-gray-600 bg-gray-750">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{data.isCompliant ? "✅" : "❌"}</span>
            <span
              className={`text-lg font-bold ${
                data.isCompliant ? "text-green-400" : "text-red-400"
              }`}
            >
              {data.isCompliant ? "Accredited" : "Not Accredited"}
            </span>
          </div>

          {data.verifiedAt && (
            <div className="space-y-1 text-sm text-gray-300">
              <p>
                <span className="text-gray-500">Verified:</span>{" "}
                {new Date(data.verifiedAt).toLocaleString()}
              </p>
              <p>
                <span className="text-gray-500">Expires:</span>{" "}
                {data.expiresAt
                  ? new Date(data.expiresAt).toLocaleString()
                  : "N/A"}
              </p>
              <p className="truncate">
                <span className="text-gray-500">Verifier:</span>{" "}
                <span className="font-mono text-xs">{data.verifier}</span>
              </p>
            </div>
          )}

          {!data.verifiedAt && !data.isCompliant && (
            <p className="text-sm text-gray-400">
              This wallet has not been verified yet. Complete the verification
              steps above and submit to the CRE Enclave.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
