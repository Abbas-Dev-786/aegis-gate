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
  plaidPublicToken: z.string(),
  worldIdMerkleRoot: z.string(),
  worldIdVerificationLevel: z.string(),
});
type VerificationPayload = z.infer<typeof VerificationPayloadSchema>;

const http = new HTTPCapability();
const trigger = http.trigger({});

async function initWorkflow(config: any) {
  return [
    handler(trigger, async (runtime: Runtime<any>, payload: HTTPPayload) => {
      const data = decodeJson(payload.input) as VerificationPayload;
      const confHttp = new ConfidentialHTTPClient();

      // 1. World ID Verification inside TEE
      const worldIdReq = confHttp.sendRequest(runtime, {
        request: {
          url: "https://developer.world.org/api/v2/verify/{app_id}",
          method: "POST",
          multiHeaders: {
            "Content-Type": { values: ["application/json"] },
          },
          bodyString: JSON.stringify({
            nullifier_hash: data.worldIdNullifier,
            proof: data.worldIdProof,
            merkle_root: data.worldIdMerkleRoot,
            verification_level: data.worldIdVerificationLevel,
            action: "aegisgate-verification",
            signal_hash: data.walletAddress,
            max_age: 3600,
          }),
        },
      });
      const worldIdRes = worldIdReq.result();

      // 2. Plaid: Exchange Public Token for Access Token inside TEE
      const plaidExchangeReq = confHttp.sendRequest(runtime, {
        request: {
          url: "https://sandbox.plaid.com/item/public_token/exchange",
          method: "POST",
          multiHeaders: {
            "Content-Type": { values: ["application/json"] },
          },
          bodyString: JSON.stringify({
            client_id: "{{.PLAID_CLIENT_ID}}",
            secret: "{{.PLAID_SECRET}}",
            public_token: data.plaidPublicToken, // Send the raw public token from the frontend
          }),
        },
        vaultDonSecrets: [
          { key: "PLAID_CLIENT_ID", owner: "" },
          { key: "PLAID_SECRET", owner: "" },
        ],
      });
      const plaidExchangeRes = plaidExchangeReq.result();
      const plaidExchangeData = decodeJson(plaidExchangeRes.body) as any;
      const accessToken = plaidExchangeData.access_token;

      // 3. Plaid: Fetch the Bank Balance using the newly minted Access Token
      const plaidReq = confHttp.sendRequest(runtime, {
        request: {
          url: "https://sandbox.plaid.com/accounts/balance/get",
          method: "POST",
          multiHeaders: {
            "Content-Type": { values: ["application/json"] },
          },
          bodyString: JSON.stringify({
            client_id: "{{.PLAID_CLIENT_ID}}",
            secret: "{{.PLAID_SECRET}}",
            access_token: accessToken, // Securely use the minted access token
          }),
        },
        vaultDonSecrets: [
          { key: "PLAID_CLIENT_ID", owner: "" },
          { key: "PLAID_SECRET", owner: "" },
        ],
      });
      const plaidRes = plaidReq.result();

      const worldIdData = decodeJson(worldIdRes.body) as any;
      const plaidData = decodeJson(plaidRes.body) as any;

      runtime.log("Plaid Balance Response Received.");

      let totalBalance = 0;
      if (plaidData && plaidData.accounts) {
        totalBalance = plaidData.accounts.reduce(
          (acc: number, curr: any) => acc + curr.balances.available,
          0,
        );
      }

      const isHuman =
        worldIdRes.statusCode === 200 && worldIdData.success === true;
      const isAccredited = totalBalance >= 200000;

      // 4. On-Chain Action if Compliant
      if (isHuman && isAccredited) {
        const callData = encodeFunctionData({
          abi: AegisGate,
          functionName: "updateCompliance",
          args: [
            data.walletAddress as `0x${string}`,
            data.worldIdNullifier as `0x${string}`,
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
          receiver: "YOUR_AEGISGATE_CONTRACT_ADDRESS", // <-- Don't forget to replace this!
          report: secureReportReq.result(),
        });

        writeReq.result();

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
