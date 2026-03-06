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
  worldIdMerkleRoot: z.string(), // <-- NEW
  worldIdVerificationLevel: z.string(), // <-- NEW
});
type VerificationPayload = z.infer<typeof VerificationPayloadSchema>;

const http = new HTTPCapability();
const trigger = http.trigger({});

async function initWorkflow(config: any) {
  return [
    handler(trigger, async (runtime: Runtime<any>, payload: HTTPPayload) => {
      const data = decodeJson(payload.input) as VerificationPayload;
      const confHttp = new ConfidentialHTTPClient();

      // FIX 1 & 2: Use .result() to build the computation graph.
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
            merkle_root: data.worldIdMerkleRoot, // <-- NEW
            verification_level: data.worldIdVerificationLevel, // <-- NEW (e.g., "orb" or "device")
            action: "aegisgate-verification",
            // For security, bind the proof to the wallet address
            signal_hash: data.walletAddress,
            max_age: 3600,
          }),
        },
      });
      const worldIdRes = worldIdReq.result(); // Extracts the HTTPResponse reference

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
            access_token: data.plaidPublicToken,
          }),
        },
        vaultDonSecrets: [
          { key: "PLAID_CLIENT_ID", owner: "" },
          { key: "PLAID_SECRET", owner: "" },
        ],
      });
      const plaidRes = plaidReq.result(); // Extracts the HTTPResponse reference

      const worldIdData = decodeJson(worldIdRes.body) as any;
      const plaidData = decodeJson(plaidRes.body) as any;

      runtime.log("Plaid Raw Response: " + plaidRes.body);

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

      if (isHuman && isAccredited) {
        // Encode the payload for the smart contract
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

        // FIX 3: Pass an object instead of a raw hex string to satisfy ReportRequest
        const secureReportReq = runtime.report({ report: callData } as any);

        // FIX 4: Call .result() on the report request to extract the Report object
        const writeReq = evmClient.writeReport(runtime, {
          receiver: "YOUR_AEGISGATE_CONTRACT_ADDRESS", // <-- Insert your Remix contract address here
          report: secureReportReq.result(),
        });

        // Ensure the write request completes in the execution graph
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
