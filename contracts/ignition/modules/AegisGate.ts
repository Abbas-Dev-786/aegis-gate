import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AegisGate", (m) => {
  // The Sepolia CRE testnet Forwarder address (seen as `to` in CRE writeReport transactions)
  const forwarderAddress = m.getParameter(
    "forwarderAddress",
    "0x15fc6ae953e024d975e77382eeec56a9101f9f88",
  );

  // World ID Router address on Ethereum Sepolia (from official World ID v3 docs)
  const worldIdAddress = m.getParameter(
    "worldIdAddress",
    "0x469449f251692e0779667583026b5a1e99512157",
  );

  const aegisGate = m.contract("AegisGate", [worldIdAddress, forwarderAddress]);

  return { aegisGate };
});
