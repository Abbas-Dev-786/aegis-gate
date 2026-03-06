import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const rpId = process.env.WORLD_RP_ID;
    if (!rpId) {
      console.error("WORLD_RP_ID is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const verifyResponse = await fetch(
      `https://developer.world.org/api/v4/verify/${rpId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await verifyResponse.json();

    if (verifyResponse.ok) {
      return NextResponse.json(result);
    } else {
      console.error("World ID verification failed:", result);
      return NextResponse.json(result, { status: verifyResponse.status });
    }
  } catch (error) {
    console.error("Error verifying World ID proof:", error);
    return NextResponse.json(
      { error: "Failed to verify World ID proof" },
      { status: 500 },
    );
  }
}
