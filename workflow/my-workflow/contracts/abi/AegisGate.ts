export const AegisGate = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_worldIdContract",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "nullifierHash",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "wallet",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "ComplianceRevoked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "nullifierHash",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "wallet",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "isAccredited",
        type: "bool",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "verificationProof",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "ComplianceVerified",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "protocol",
        type: "address",
      },
    ],
    name: "ProtocolApproved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "protocol",
        type: "address",
      },
    ],
    name: "ProtocolRevoked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "newThreshold",
        type: "uint256",
      },
    ],
    name: "ThresholdUpdated",
    type: "event",
  },
  {
    inputs: [],
    name: "admin",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "protocol",
        type: "address",
      },
    ],
    name: "approveProtocol",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "approvedProtocols",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "wallet",
        type: "address",
      },
    ],
    name: "checkCompliance",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "complianceRecords",
    outputs: [
      {
        internalType: "bool",
        name: "isAccredited",
        type: "bool",
      },
      {
        internalType: "bytes",
        name: "verificationProof",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "verifiedAt",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "expiresAt",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "verifier",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "wallet",
        type: "address",
      },
    ],
    name: "getComplianceRecord",
    outputs: [
      {
        components: [
          {
            internalType: "bool",
            name: "isAccredited",
            type: "bool",
          },
          {
            internalType: "bytes",
            name: "verificationProof",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "verifiedAt",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "expiresAt",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "verifier",
            type: "address",
          },
        ],
        internalType: "struct AegisGate.ComplianceRecord",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "nullifierHash",
        type: "uint256",
      },
    ],
    name: "getWalletFromNullifier",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "wallet",
        type: "address",
      },
    ],
    name: "isCompliant",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "nullifierHash",
        type: "uint256",
      },
    ],
    name: "isCompliantByNullifier",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "minBalanceThreshold",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "nullifierToWallet",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "nullifierHash",
        type: "uint256",
      },
    ],
    name: "revokeCompliance",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "protocol",
        type: "address",
      },
    ],
    name: "revokeProtocol",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "newThreshold",
        type: "uint256",
      },
    ],
    name: "setMinBalanceThreshold",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newAdmin",
        type: "address",
      },
    ],
    name: "transferAdmin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "nullifierHash",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "wallet",
        type: "address",
      },
      {
        internalType: "bool",
        name: "isAccredited",
        type: "bool",
      },
      {
        internalType: "bytes",
        name: "verificationProof",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "expirationTime",
        type: "uint256",
      },
    ],
    name: "updateCompliance",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "walletToNullifier",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "worldIdContract",
    outputs: [
      {
        internalType: "contract IWorldID",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];
