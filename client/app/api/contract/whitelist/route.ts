import { NextResponse } from "next/server";
import {
  getContract,
  getProvider,
  AEGISGATE_CONTRACT_ADDRESS,
  AEGISGATE_ABI,
} from "@/app/lib/contractConfig";
import { ethers } from "ethers";

export async function GET() {
  try {
    const provider = getProvider();
    const contract = getContract();

    // Read current threshold and admin
    const minBalanceThreshold = await contract.minBalanceThreshold();
    const admin = await contract.admin();

    // Query ComplianceVerified events to build the whitelist
    const iface = new ethers.Interface(AEGISGATE_ABI);
    const eventTopic = iface.getEvent("ComplianceVerified")!.topicHash;

    // Get logs from the last ~100k blocks (roughly the contract lifetime)
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10_000);

    const logs = await provider.getLogs({
      address: AEGISGATE_CONTRACT_ADDRESS,
      topics: [eventTopic],
      fromBlock,
      toBlock: "latest",
    });

    // Parse events and deduplicate by nullifierHash (keep latest)
    const recordsByNullifier = new Map<
      string,
      {
        nullifierHash: string;
        wallet: string;
        isAccredited: boolean;
        timestamp: string;
      }
    >();

    for (const log of logs) {
      const parsed = iface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (!parsed) continue;

      const nullifierHash = parsed.args.nullifierHash.toString();
      const wallet = parsed.args.wallet;
      const isAccredited = parsed.args.isAccredited;
      const timestamp = Number(parsed.args.timestamp);

      recordsByNullifier.set(nullifierHash, {
        nullifierHash,
        wallet,
        isAccredited,
        timestamp: new Date(timestamp * 1000).toISOString(),
      });
    }

    // Also check revocations
    const revokeEvent = iface.getEvent("ComplianceRevoked");
    if (revokeEvent) {
      const revokeTopic = revokeEvent.topicHash;
      const revokeLogs = await provider.getLogs({
        address: AEGISGATE_CONTRACT_ADDRESS,
        topics: [revokeTopic],
        fromBlock,
        toBlock: "latest",
      });

      for (const log of revokeLogs) {
        const parsed = iface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (!parsed) continue;
        const nullifierHash = parsed.args.nullifierHash.toString();
        recordsByNullifier.delete(nullifierHash);
      }
    }

    const whitelist = Array.from(recordsByNullifier.values());

    return NextResponse.json({
      admin,
      minBalanceThreshold: Number(minBalanceThreshold),
      totalWhitelisted: whitelist.length,
      whitelist,
    });
  } catch (error) {
    console.error("Error fetching whitelist:", error);
    return NextResponse.json(
      { error: "Failed to fetch whitelist from chain" },
      { status: 500 },
    );
  }
}
