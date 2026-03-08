import { NextRequest, NextResponse } from "next/server";
import { getContract } from "@/app/lib/contractConfig";

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json(
        { error: "Missing 'wallet' query parameter" },
        { status: 400 },
      );
    }

    const contract = getContract();

    const isCompliant = await contract.isCompliant(wallet);
    const record = await contract.getComplianceRecord(wallet);

    // record is a tuple: [isAccredited, verificationProof, verifiedAt, expiresAt, verifier]
    const verifiedAt = Number(record.verifiedAt);
    const expiresAt = Number(record.expiresAt);

    return NextResponse.json({
      wallet,
      isCompliant,
      isAccredited: record.isAccredited,
      verifiedAt:
        verifiedAt > 0 ? new Date(verifiedAt * 1000).toISOString() : null,
      expiresAt:
        expiresAt > 0 ? new Date(expiresAt * 1000).toISOString() : null,
      verifier: record.verifier,
    });
  } catch (error) {
    console.error("Error reading compliance status:", error);
    return NextResponse.json(
      { error: "Failed to read compliance status from chain" },
      { status: 500 },
    );
  }
}
