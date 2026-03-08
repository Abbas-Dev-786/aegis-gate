"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  AEGISGATE_ABI,
  AEGISGATE_CONTRACT_ADDRESS as CONTRACT_ADDRESS,
} from "@/app/lib/contractConfig";

interface WhitelistEntry {
  nullifierHash: string;
  wallet: string;
  isAccredited: boolean;
  timestamp: string;
}

interface WhitelistData {
  admin: string;
  minBalanceThreshold: number;
  totalWhitelisted: number;
  whitelist: WhitelistEntry[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<WhitelistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Threshold form
  const [newThreshold, setNewThreshold] = useState("");
  const [txStatus, setTxStatus] = useState("");

  const fetchWhitelist = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contract/whitelist");
      if (!res.ok) throw new Error("Failed to fetch");
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError("Failed to load whitelist from chain.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWhitelist();
  }, []);

  const updateThreshold = async () => {
    setTxStatus("Connecting wallet…");
    try {
      if (typeof window === "undefined" || !(window as any).ethereum) {
        setTxStatus("⚠️ MetaMask not found. Please install MetaMask.");
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        AEGISGATE_ABI,
        signer,
      );

      setTxStatus("Submitting transaction…");
      const tx = await contract.setMinBalanceThreshold(BigInt(newThreshold));
      setTxStatus(
        `Tx sent: ${tx.hash.slice(0, 14)}… Waiting for confirmation…`,
      );
      await tx.wait();
      setTxStatus("✅ Threshold updated successfully!");
      setNewThreshold("");
      fetchWhitelist(); // Refresh data
    } catch (err: any) {
      console.error(err);
      setTxStatus(
        `❌ Error: ${err?.reason || err?.message || "Transaction failed"}`,
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold">
              A
            </div>
            <div>
              <h1 className="text-xl font-bold">AegisGate Admin</h1>
              <p className="text-xs text-gray-500">Compliance Dashboard</p>
            </div>
          </div>
          <a
            href="/"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← Back to User Portal
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Contract Info */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="text-purple-400">⬡</span> Contract Info
          </h2>
          {loading ? (
            <p className="text-gray-400 text-sm animate-pulse">
              Loading on-chain data…
            </p>
          ) : error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : data ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-900 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Contract Address
                </p>
                <p className="font-mono text-sm text-blue-300 truncate">
                  {CONTRACT_ADDRESS}
                </p>
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Admin
                </p>
                <p className="font-mono text-sm text-green-300 truncate">
                  {data.admin}
                </p>
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Total Whitelisted
                </p>
                <p className="text-2xl font-bold text-purple-300">
                  {data.totalWhitelisted}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        {/* Threshold Management */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="text-green-400">⚙</span> Compliance Rules
          </h2>
          <div className="flex flex-col md:flex-row gap-4 items-start">
            <div className="bg-gray-900 rounded-lg p-4 flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Current MIN_ACCREDITED_BALANCE
              </p>
              <p className="text-2xl font-bold text-yellow-300">
                {data
                  ? `$${(data.minBalanceThreshold / 100).toLocaleString()}`
                  : "…"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                (stored in cents: {data?.minBalanceThreshold ?? "…"})
              </p>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                Update Threshold (requires MetaMask)
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  placeholder="New threshold in cents"
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button
                  onClick={updateThreshold}
                  disabled={!newThreshold}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded text-sm disabled:opacity-50 transition-colors"
                >
                  Update
                </button>
              </div>
              {txStatus && (
                <p className="mt-2 text-xs text-gray-300">{txStatus}</p>
              )}
            </div>
          </div>
        </section>

        {/* Whitelist Table */}
        <section className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-blue-400">🛡</span> Whitelisted Nullifiers
            </h2>
            <button
              onClick={fetchWhitelist}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm animate-pulse">Loading…</p>
          ) : !data || data.whitelist.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-3xl mb-2">∅</p>
              <p>No whitelisted users yet.</p>
              <p className="text-xs mt-1">
                Users will appear here after completing verification.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
                    <th className="text-left py-3 px-2">#</th>
                    <th className="text-left py-3 px-2">Nullifier Hash</th>
                    <th className="text-left py-3 px-2">Wallet</th>
                    <th className="text-left py-3 px-2">Status</th>
                    <th className="text-left py-3 px-2">Verified At</th>
                  </tr>
                </thead>
                <tbody>
                  {data.whitelist.map((entry, i) => (
                    <tr
                      key={entry.nullifierHash}
                      className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="py-3 px-2 text-gray-500">{i + 1}</td>
                      <td className="py-3 px-2 font-mono text-xs text-blue-300 truncate max-w-[200px]">
                        {entry.nullifierHash}
                      </td>
                      <td className="py-3 px-2 font-mono text-xs text-gray-300 truncate max-w-[200px]">
                        {entry.wallet}
                      </td>
                      <td className="py-3 px-2">
                        {entry.isAccredited ? (
                          <span className="inline-flex items-center gap-1 text-green-400 text-xs font-medium bg-green-400/10 px-2 py-1 rounded-full">
                            ✓ Accredited
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium bg-red-400/10 px-2 py-1 rounded-full">
                            ✗ Denied
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-xs text-gray-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
