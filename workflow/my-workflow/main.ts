import { AegisGate } from "./contracts/abi";
import {
  Runner,
  handler,
  HTTPCapability,
  ConfidentialHTTPClient,
  EVMClient,
  decodeJson,
  getNetwork,
  prepareReportRequest,
  type Runtime,
  type HTTPPayload,
} from "@chainlink/cre-sdk";
import { encodeFunctionData } from "viem";
import { z } from "zod";

const VerificationPayloadSchema = z.object({
  walletAddress: z.string(),
  plaidPublicToken: z.string(),
  worldIdFullResponse: z.any(), // The exact unaltered response from IDKit
});
type VerificationPayload = z.infer<typeof VerificationPayloadSchema>;

const http = new HTTPCapability();
const trigger = http.trigger({});

const WORLD_APP_RP_ID_NAME = "WORLD_APP_RP_ID";
const PLAID_CLIENT_ID_NAME = "PLAID_CLIENT_ID";
const PLAID_SECRET_NAME = "PLAID_SECRET";

function verifyWorldId(
  runtime: Runtime<any>,
  confHttp: ConfidentialHTTPClient,
  data: VerificationPayload,
): boolean {
  const worldIdRpId = runtime.getSecret({ id: WORLD_APP_RP_ID_NAME }).result();

  const worldIdReq = confHttp.sendRequest(runtime, {
    request: {
      url: `https://developer.world.org/api/v4/verify/${worldIdRpId.value}`,
      method: "POST",
      multiHeaders: {
        "Content-Type": { values: ["application/json"] },
      },
      // Pass the EXACT JSON payload the IDKit widget created!
      bodyString: JSON.stringify(data.worldIdFullResponse),
    },
  });
  const worldIdRes = worldIdReq.result();
  const worldIdData = decodeJson(worldIdRes.body) as any;

  console.log("World ID Response:", JSON.stringify(worldIdData));

  return worldIdRes.statusCode === 200 && worldIdData.success === true;
}

function exchangePlaidToken(
  runtime: Runtime<any>,
  confHttp: ConfidentialHTTPClient,
  publicToken: string,
): string {
  const plaidClientId = runtime
    .getSecret({ id: PLAID_CLIENT_ID_NAME })
    .result();
  const plaidSecret = runtime.getSecret({ id: PLAID_SECRET_NAME }).result();

  const plaidExchangeReq = confHttp.sendRequest(runtime, {
    request: {
      url: "https://sandbox.plaid.com/item/public_token/exchange",
      method: "POST",
      multiHeaders: {
        "Content-Type": { values: ["application/json"] },
      },
      bodyString: JSON.stringify({
        client_id: plaidClientId.value,
        secret: plaidSecret.value,
        public_token: publicToken,
      }),
    },
  });
  const plaidExchangeRes = plaidExchangeReq.result();
  const plaidExchangeData = decodeJson(plaidExchangeRes.body) as any;
  return plaidExchangeData.access_token;
}

function verifyPlaidBalance(
  runtime: Runtime<any>,
  confHttp: ConfidentialHTTPClient,
  accessToken: string,
): boolean {
  const plaidClientId = runtime
    .getSecret({ id: PLAID_CLIENT_ID_NAME })
    .result();
  const plaidSecret = runtime.getSecret({ id: PLAID_SECRET_NAME }).result();

  const plaidReq = confHttp.sendRequest(runtime, {
    request: {
      url: "https://sandbox.plaid.com/accounts/balance/get",
      method: "POST",
      multiHeaders: {
        "Content-Type": { values: ["application/json"] },
      },
      bodyString: JSON.stringify({
        client_id: plaidClientId.value,
        secret: plaidSecret.value,
        access_token: accessToken,
      }),
    },
  });
  const plaidRes = plaidReq.result();
  const plaidData = decodeJson(plaidRes.body) as any;

  console.log("Plaid Balance Response Received.", JSON.stringify(plaidData));
  runtime.log("Plaid Balance Response Received.");

  let totalBalance = 0;
  if (plaidData && plaidData.accounts) {
    totalBalance = plaidData.accounts.reduce(
      (acc: number, curr: any) => acc + curr.balances.available,
      0,
    );
  }

  return totalBalance >= 2000;
}

function updateComplianceOnChain(
  runtime: Runtime<any>,
  data: VerificationPayload,
) {
  // Grab the nullifier deeply from the unaltered IDKit payload
  const nullifier =
    data.worldIdFullResponse?.responses?.[0]?.nullifier || "0x0";

  const callData = encodeFunctionData({
    abi: AegisGate,
    functionName: "updateCompliance",
    args: [
      BigInt(nullifier), // uint256 nullifierHash
      data.walletAddress as `0x${string}`, // address wallet
      true, // bool isAccredited
      "0x", // bytes verificationProof (empty for now, or use TEE report later)
      BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60), // uint256 expirationTime
    ],
  });

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: "ethereum-testnet-sepolia",
    isTestnet: true,
  });
  if (!network) throw new Error("Network not found");

  const evmClient = new EVMClient(network.chainSelector.selector);

  const secureReportReq = runtime.report(prepareReportRequest(callData));

  const writeReq = evmClient.writeReport(runtime, {
    receiver: "0x73C68bc2635Aa369Ccb31B7a354866Ba9CA1bAbD",
    report: secureReportReq.result(),
  });

  writeReq.result();
}

async function initWorkflow(config: any) {
  return [
    handler(trigger, async (runtime: Runtime<any>, payload: HTTPPayload) => {
      const data = decodeJson(payload.input) as VerificationPayload;
      const confHttp = new ConfidentialHTTPClient();

      const isHuman = verifyWorldId(runtime, confHttp, data);
      const accessToken = exchangePlaidToken(
        runtime,
        confHttp,
        data.plaidPublicToken,
      );
      const isAccredited = verifyPlaidBalance(runtime, confHttp, accessToken);

      if (isHuman && isAccredited) {
        updateComplianceOnChain(runtime, data);

        return {
          status: "Success - Transaction Mined",
          user: data.walletAddress,
        };
      }

      return { status: "Failed - Compliance Criteria Not Met" };
    }),
  ];
}

export async function main() {
  const runner = await Runner.newRunner({ configSchema: z.object({}) });
  runner.run(initWorkflow);
}
