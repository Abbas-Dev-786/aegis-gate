import { NextRequest, NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit-server";

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (!action) {
      return NextResponse.json(
        { error: "Missing 'action' in request body" },
        { status: 400 },
      );
    }

    const signingKey = process.env.RP_SIGNING_KEY;
    if (!signingKey) {
      console.error("RP_SIGNING_KEY is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const rpId = process.env.WORLD_RP_ID;
    if (!rpId) {
      console.error("WORLD_RP_ID is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const { sig, nonce, createdAt, expiresAt } = await signRequest(
      action,
      signingKey,
    );

    return NextResponse.json({
      rp_id: rpId,
      signature: sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("Error generating RP signature:", error);
    return NextResponse.json(
      { error: "Failed to generate RP signature" },
      { status: 500 },
    );
  }
}
