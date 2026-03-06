import { NextRequest, NextResponse } from "next/server";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  CountryCode,
  Products,
} from "plaid";

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
    const request = {
      user: {
        // This should correspond to a unique id for the current user.
        client_user_id: "user-id-from-aegis-gate",
      },
      client_name: "Aegis Gate",
      products: [Products.Auth],
      country_codes: [CountryCode.Us],
      language: "en",
    };

    const response = await plaidClient.linkTokenCreate(request);

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error("Error creating Plaid link token:", error);
    return NextResponse.json(
      { error: "Failed to create Plaid link token" },
      { status: 500 },
    );
  }
}
