import { AegisGate } from "./contracts/abi";
import {
  Runner,
  handler,
  HTTPCapability,
  ConfidentialHTTPClient,
  EVMClient,
  decodeJson,
  getNetwork,
  type Runtime,
  type HTTPPayload,
} from "@chainlink/cre-sdk";
import { encodeFunctionData } from "viem";
import { z } from "zod";

const VerificationPayloadSchema = z.object({
  walletAddress: z.string(),
  worldIdProof: z.string(),
  worldIdNullifier: z.string(),
  worldIdNonce: z.string(),
  plaidPublicToken: z.string(),
  worldIdMerkleRoot: z.string(),
  worldIdVerificationLevel: z.string(),
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
      bodyString: JSON.stringify({
        protocol_version: "3.0",
        nonce: data.worldIdNonce, // Mapped securely from the payload
        action: "aegisgate-verification",
        responses: [
          {
            identifier: data.worldIdVerificationLevel, // e.g. "orb" or "device"
            merkle_root: data.worldIdMerkleRoot,
            nullifier: data.worldIdNullifier,
            proof: data.worldIdProof,
          },
        ],
      }),
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

  return totalBalance >= 200000;
}

function updateComplianceOnChain(
  runtime: Runtime<any>,
  data: VerificationPayload,
) {
  const callData = encodeFunctionData({
    abi: AegisGate,
    functionName: "updateCompliance",
    args: [
      data.walletAddress as `0x${string}`,
      data.worldIdNullifier as `0x${string}`,
      Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    ],
  });

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: "ethereum-testnet-sepolia",
    isTestnet: true,
  });
  if (!network) throw new Error("Network not found");

  const evmClient = new EVMClient(network.chainSelector.selector);

  const secureReportReq = runtime.report({ report: callData } as any);

  const writeReq = evmClient.writeReport(runtime, {
    receiver: "YOUR_AEGISGATE_CONTRACT_ADDRESS",
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
