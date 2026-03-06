import { NextRequest, NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// Initialize the Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function POST(req: NextRequest) {
  try {
    const { public_token } = await req.json();

    if (!public_token) {
      return NextResponse.json(
        { error: "Missing 'public_token' in request body" },
        { status: 400 },
      );
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    console.log("Successfully exchanged public_token for access_token.");
    console.log("Access Token:", accessToken);
    console.log("Item ID:", itemId);

    // In a real application, you would save the accessToken and itemId in your database
    // securely associated with the user, and never expose the accessToken to the frontend.
    // Since this is a demo/sandbox, we'll return a success message.

    return NextResponse.json({ success: true, item_id: itemId });
  } catch (error) {
    console.error("Error exchanging Plaid public token:", error);
    return NextResponse.json(
      { error: "Failed to exchange Plaid public token" },
      { status: 500 },
    );
  }
}
