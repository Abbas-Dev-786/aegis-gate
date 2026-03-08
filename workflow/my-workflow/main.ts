import { AegisGate } from "./contracts/abi";
import {
  Runner,
  handler,
  HTTPCapability,
  ConfidentialHTTPClient,
  EVMClient,
  decodeJson,
  getNetwork,
  encodeCallMsg,
  bytesToHex,
  hexToBase64,
  LATEST_BLOCK_NUMBER,
  type Runtime,
  type HTTPPayload,
} from "@chainlink/cre-sdk";
import {
  encodeFunctionData,
  decodeFunctionResult,
  encodeAbiParameters,
  parseAbiParameters,
  zeroAddress,
} from "viem";
import { z } from "zod";

// ============================================================
// Configuration Schema (follows official CRE evms[] pattern)
// ============================================================

const EvmConfigSchema = z.object({
  aegisGateAddress: z.string(),
  chainName: z.string(),
  gasLimit: z.string(),
});
type EvmConfig = z.infer<typeof EvmConfigSchema>;

const ConfigSchema = z.object({
  evms: z.array(EvmConfigSchema),
});
type Config = z.infer<typeof ConfigSchema>;

// ============================================================
// Payload Schema (from the frontend)
// ============================================================

const VerificationPayloadSchema = z.object({
  walletAddress: z.string(),
  plaidPublicToken: z.string(),
  worldIdFullResponse: z.any(), // The exact unaltered response from IDKit
});
type VerificationPayload = z.infer<typeof VerificationPayloadSchema>;

// ============================================================
// Capability & Trigger
// ============================================================

const http = new HTTPCapability();
const trigger = http.trigger({});

// ============================================================
// Secret Names
// ============================================================

const WORLD_APP_RP_ID_NAME = "WORLD_APP_RP_ID";
const PLAID_CLIENT_ID_NAME = "PLAID_CLIENT_ID";
const PLAID_SECRET_NAME = "PLAID_SECRET";

// ============================================================
// Step 1: Verify World ID (Confidential HTTP → World ID API)
// ============================================================

function verifyWorldId(
  runtime: Runtime<Config>,
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
      bodyString: JSON.stringify(data.worldIdFullResponse),
    },
  });
  const worldIdRes = worldIdReq.result();
  const worldIdData = decodeJson(worldIdRes.body) as any;

  runtime.log(
    `World ID verification status: ${worldIdRes.statusCode}, success: ${worldIdData?.success}`,
  );

  return worldIdRes.statusCode === 200 && worldIdData.success === true;
}

// ============================================================
// Step 2: Exchange Plaid public token (Confidential HTTP → Plaid)
// ============================================================

function exchangePlaidToken(
  runtime: Runtime<Config>,
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

  if (!plaidExchangeData.access_token) {
    throw new Error("Plaid token exchange failed — no access_token returned.");
  }

  runtime.log("Plaid token exchange successful.");
  return plaidExchangeData.access_token;
}

// ============================================================
// Step 3: Read minBalanceThreshold from on-chain contract
// ============================================================

function readMinBalanceThreshold(
  runtime: Runtime<Config>,
  evmClient: EVMClient,
  evmConfig: EvmConfig,
): bigint {
  const callData = encodeFunctionData({
    abi: AegisGate,
    functionName: "minBalanceThreshold",
  });

  const contractCall = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: evmConfig.aegisGateAddress as `0x${string}`,
        data: callData,
      }),
      blockNumber: LATEST_BLOCK_NUMBER,
    })
    .result();

  const threshold = decodeFunctionResult({
    abi: AegisGate,
    functionName: "minBalanceThreshold",
    data: bytesToHex(contractCall.data),
  }) as bigint;

  runtime.log(`On-chain minBalanceThreshold: ${threshold}`);
  return threshold;
}

// ============================================================
// Step 4: Verify Plaid balance against on-chain threshold
// ============================================================

function verifyPlaidBalance(
  runtime: Runtime<Config>,
  confHttp: ConfidentialHTTPClient,
  accessToken: string,
  minThresholdCents: bigint,
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

  runtime.log("Plaid balance response received.");

  // Sum available balances across all accounts
  let totalBalanceDollars = 0;
  if (plaidData?.accounts) {
    totalBalanceDollars = plaidData.accounts.reduce(
      (acc: number, curr: any) => acc + (curr.balances.available ?? 0),
      0,
    );
  }

  // Convert Plaid balance (dollars) to cents for comparison with on-chain threshold
  const totalBalanceCents = BigInt(Math.floor(totalBalanceDollars * 100));
  const isAccredited = totalBalanceCents >= minThresholdCents;

  runtime.log(
    `Balance check: $${totalBalanceDollars} (${totalBalanceCents} cents) vs threshold ${minThresholdCents} cents → ${isAccredited ? "PASS" : "FAIL"}`,
  );

  return isAccredited;
}

// ============================================================
// Step 5: Extract nullifier hash from IDKit response
// ============================================================

function extractNullifierHash(data: VerificationPayload): string {
  // IDKitRequestWidget format: responses[].nullifier (actual field name from IDKit)
  const fromResponsesNullifier =
    data.worldIdFullResponse?.responses?.[0]?.nullifier;
  // Some IDKit versions may use nullifier_hash
  const fromResponsesHash =
    data.worldIdFullResponse?.responses?.[0]?.nullifier_hash;
  // Standard IDKit format: top-level nullifier_hash
  const fromTopLevel = data.worldIdFullResponse?.nullifier_hash;

  const nullifier = fromResponsesNullifier || fromResponsesHash || fromTopLevel;
  if (!nullifier || nullifier === "0x0") {
    throw new Error("Could not extract nullifier_hash from World ID response.");
  }

  return nullifier;
}

// ============================================================
// Step 6: Write compliance attestation on-chain
// ============================================================

function updateComplianceOnChain(
  runtime: Runtime<Config>,
  evmClient: EVMClient,
  evmConfig: EvmConfig,
  data: VerificationPayload,
): string {
  const nullifier = extractNullifierHash(data);

  // Build a non-empty verification proof with attestation context.
  // The contract requires verificationProof.length > 0.
  const attestationData = new TextEncoder().encode(
    JSON.stringify({
      wallet: data.walletAddress,
      nullifier,
      timestamp: Math.floor(Date.now() / 1000),
      checks: ["world_id_verified", "plaid_balance_verified"],
    }),
  );
  const verificationProof = bytesToHex(attestationData);

  const innerPayload = encodeAbiParameters(
    parseAbiParameters(
      "uint256 nullifierHash, address wallet, bool isAccredited, bytes verificationProof, uint256 expirationTime",
    ),
    [
      BigInt(nullifier),
      data.walletAddress as `0x${string}`,
      true,
      verificationProof as `0x${string}`,
      BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60),
    ],
  );

  const reportData = encodeFunctionData({
    abi: AegisGate,
    functionName: "onReport",
    args: [innerPayload as `0x${string}`],
  });

  runtime.log(
    `Writing compliance report for wallet ${data.walletAddress}, nullifier ${nullifier.slice(0, 14)}…`,
  );

  // Step 1: Generate a signed report using the consensus capability
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  // Step 2: Submit the signed report to the AegisGate contract
  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: evmConfig.aegisGateAddress as `0x${string}`,
      report: reportResponse,
      gasConfig: {
        gasLimit: evmConfig.gasLimit,
      },
    })
    .result();

  const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
  runtime.log(`Write report transaction succeeded: ${txHash}`);
  runtime.log(`View transaction at https://sepolia.etherscan.io/tx/${txHash}`);

  return txHash;
}

// ============================================================
// Workflow Entrypoint
// ============================================================

async function initWorkflow(config: Config) {
  return [
    handler(
      trigger,
      (
        runtime: Runtime<Config>,
        payload: HTTPPayload,
      ): { status: string; user?: string; txHash?: string } => {
        const data = decodeJson(payload.input) as VerificationPayload;
        const confHttp = new ConfidentialHTTPClient();

        // Get the first EVM configuration from the list
        const evmConfig = runtime.config.evms[0];

        // Convert chain name to chain selector
        const network = getNetwork({
          chainFamily: "evm",
          chainSelectorName: evmConfig.chainName,
        });
        if (!network) {
          throw new Error(`Unknown chain name: ${evmConfig.chainName}`);
        }

        const evmClient = new EVMClient(network.chainSelector.selector);

        runtime.log("=== AegisGate Compliance Verification Started ===");
        runtime.log(`Wallet: ${data.walletAddress}`);

        // Step 1: Verify unique personhood via World ID
        runtime.log("[1/4] Verifying World ID...");
        const isHuman = verifyWorldId(runtime, confHttp, data);
        if (!isHuman) {
          runtime.log("FAILED: World ID verification did not pass.");
          return { status: "Failed - World ID Verification Failed" };
        }
        runtime.log("[1/4] World ID verified ✓");

        // Step 2: Exchange Plaid token for access token
        runtime.log("[2/4] Exchanging Plaid token...");
        const accessToken = exchangePlaidToken(
          runtime,
          confHttp,
          data.plaidPublicToken,
        );
        runtime.log("[2/4] Plaid token exchanged ✓");

        // Step 3: Read the minimum balance threshold from the contract
        runtime.log("[3/4] Reading on-chain threshold & verifying balance...");
        const minThreshold = readMinBalanceThreshold(
          runtime,
          evmClient,
          evmConfig,
        );

        // Verify financial standing against on-chain threshold
        const isAccredited = verifyPlaidBalance(
          runtime,
          confHttp,
          accessToken,
          minThreshold,
        );
        if (!isAccredited) {
          runtime.log("FAILED: Balance does not meet accreditation threshold.");
          return { status: "Failed - Insufficient Balance" };
        }
        runtime.log("[3/4] Balance verification passed ✓");

        // Step 4: Write compliance attestation on-chain
        runtime.log("[4/4] Writing compliance on-chain...");
        const txHash = updateComplianceOnChain(
          runtime,
          evmClient,
          evmConfig,
          data,
        );
        runtime.log("[4/4] Compliance updated on-chain ✓");

        runtime.log("=== AegisGate Compliance Verification Complete ===");

        return {
          status: "Success - Compliance Verified",
          user: data.walletAddress,
          txHash,
        };
      },
    ),
  ];
}

export async function main() {
  const runner = await Runner.newRunner<Config>({
    configSchema: ConfigSchema,
  });
  runner.run(initWorkflow);
}
