// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title AegisGate
 * @dev Privacy-Preserving Compliance & Private Payouts Smart Contract
 * 
 * This contract maintains a whitelist of compliant users verified through
 * Chainlink's Confidential Compute (TEE) without exposing their personal
 * or financial data on-chain.
 * 
 * Key Features:
 * - World ID nullifier mapping for anonymous identity
 * - Compliance status tracking without raw data exposure
 * - Institutional DeFi access control
 * - Proof verification for TEE attestations
 * - onReport() for Chainlink CRE Forwarder integration
 */

interface IWorldID {
    function verifyProof(
        uint256 root,
        uint256 groupId,
        uint256 signalHash,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external view;
}

contract AegisGate {
    // ============ State Variables ============

    /// @dev World ID contract reference
    IWorldID public worldIdContract;

    /// @dev Admin address
    address public admin;

    /// @dev Minimum balance threshold (in cents, e.g., 100000 = $1000)
    uint256 public minBalanceThreshold = 100000;

    /// @dev Chainlink CRE Forwarder address (calls onReport after writeReport)
    address public forwarder;

    /// @dev Mapping of World ID nullifier hash to compliance status
    mapping(uint256 => ComplianceRecord) public complianceRecords;

    /// @dev Mapping of nullifier hash to wallet address
    mapping(uint256 => address) public nullifierToWallet;

    /// @dev Mapping of wallet address to nullifier hash
    mapping(address => uint256) public walletToNullifier;

    /// @dev Approved DeFi protocols that can check compliance
    mapping(address => bool) public approvedProtocols;

    /// @dev Events
    event ComplianceVerified(
        uint256 indexed nullifierHash,
        address indexed wallet,
        bool isAccredited,
        bytes verificationProof,
        uint256 timestamp
    );

    event ComplianceRevoked(
        uint256 indexed nullifierHash,
        address indexed wallet,
        uint256 timestamp
    );

    event ProtocolApproved(address indexed protocol);
    event ProtocolRevoked(address indexed protocol);
    event ThresholdUpdated(uint256 newThreshold);
    event ForwarderUpdated(address indexed newForwarder);

    // ============ Data Structures ============

    struct ComplianceRecord {
        bool isAccredited;
        bytes verificationProof;
        uint256 verifiedAt;
        uint256 expiresAt;
        address verifier; // Address that submitted the verification
    }

    // ============ Modifiers ============

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    modifier onlyForwarder() {
        require(msg.sender == forwarder, "Only CRE Forwarder can call onReport");
        _;
    }

    modifier onlyApprovedProtocol() {
        require(
            approvedProtocols[msg.sender],
            "Only approved protocols can call this function"
        );
        _;
    }

    // ============ Constructor ============

    constructor(address _worldIdContract, address _forwarder) {
        admin = msg.sender;
        worldIdContract = IWorldID(_worldIdContract);
        forwarder = _forwarder;
    }

    // ============ Core Functions ============

    /**
     * @notice Receives and processes signed reports from Chainlink CRE (via Forwarder).
     * @dev The Forwarder calls this after verifying the signed report from the CRE DON.
     *      The report is ABI-encoded as:
     *        (uint256 nullifierHash, address wallet, bool isAccredited, bytes verificationProof, uint256 expirationTime)
     * @param report ABI-encoded compliance data from the CRE workflow
     */
    function onReport(bytes calldata report) external onlyForwarder {
        (
            uint256 nullifierHash,
            address wallet,
            bool isAccredited,
            bytes memory verificationProof,
            uint256 expirationTime
        ) = abi.decode(report, (uint256, address, bool, bytes, uint256));

        _updateCompliance(nullifierHash, wallet, isAccredited, verificationProof, expirationTime);
    }

    /**
     * @dev Update compliance status for a user (admin-only, for manual overrides)
     * 
     * @param nullifierHash World ID nullifier hash
     * @param wallet User's wallet address
     * @param isAccredited Whether the user meets compliance criteria
     * @param verificationProof Proof from the TEE
     * @param expirationTime When the verification expires
     */
    function updateCompliance(
        uint256 nullifierHash,
        address wallet,
        bool isAccredited,
        bytes calldata verificationProof,
        uint256 expirationTime
    ) external onlyAdmin {
        _updateCompliance(nullifierHash, wallet, isAccredited, verificationProof, expirationTime);
    }

    /**
     * @dev Internal logic to store compliance data after verification.
     */
    function _updateCompliance(
        uint256 nullifierHash,
        address wallet,
        bool isAccredited,
        bytes memory verificationProof,
        uint256 expirationTime
    ) internal {
        require(wallet != address(0), "Invalid wallet address");
        require(verificationProof.length > 0, "Proof cannot be empty");
        
        // Prevent one human from verifying multiple wallets
        require(
            nullifierToWallet[nullifierHash] == address(0) || nullifierToWallet[nullifierHash] == wallet,
            "AegisGate: World ID already linked to another wallet"
        );

        // Store compliance record
        complianceRecords[nullifierHash] = ComplianceRecord({
            isAccredited: isAccredited,
            verificationProof: verificationProof,
            verifiedAt: block.timestamp,
            expiresAt: expirationTime,
            verifier: msg.sender
        });

        // Create bidirectional mapping
        nullifierToWallet[nullifierHash] = wallet;
        walletToNullifier[wallet] = nullifierHash;

        emit ComplianceVerified(
            nullifierHash,
            wallet,
            isAccredited,
            verificationProof,
            block.timestamp
        );
    }

    /**
     * @dev Check if a wallet is compliant
     */
    function isCompliant(address wallet) external view returns (bool) {
        uint256 nullifierHash = walletToNullifier[wallet];
        if (nullifierHash == 0) return false;

        ComplianceRecord memory record = complianceRecords[nullifierHash];
        return record.isAccredited && block.timestamp < record.expiresAt;
    }

    /**
     * @dev Check if a nullifier hash is compliant
     */
    function isCompliantByNullifier(uint256 nullifierHash)
        external
        view
        returns (bool)
    {
        ComplianceRecord memory record = complianceRecords[nullifierHash];
        return record.isAccredited && block.timestamp < record.expiresAt;
    }

    /**
     * @dev Get compliance details for a wallet
     */
    function getComplianceRecord(address wallet)
        external
        view
        returns (ComplianceRecord memory)
    {
        uint256 nullifierHash = walletToNullifier[wallet];
        return complianceRecords[nullifierHash];
    }

    /**
     * @dev Revoke compliance status
     */
    function revokeCompliance(uint256 nullifierHash) external onlyAdmin {
        address wallet = nullifierToWallet[nullifierHash];
        require(wallet != address(0), "Nullifier not found");

        delete complianceRecords[nullifierHash];
        delete nullifierToWallet[nullifierHash];
        delete walletToNullifier[wallet];

        emit ComplianceRevoked(nullifierHash, wallet, block.timestamp);
    }

    // ============ Admin Functions ============

    /**
     * @dev Update the Chainlink CRE Forwarder address
     */
    function setForwarder(address _forwarder) external onlyAdmin {
        require(_forwarder != address(0), "Invalid forwarder");
        forwarder = _forwarder;
        emit ForwarderUpdated(_forwarder);
    }

    /**
     * @dev Update minimum balance threshold
     * @param newThreshold New threshold in cents
     */
    function setMinBalanceThreshold(uint256 newThreshold) external onlyAdmin {
        minBalanceThreshold = newThreshold;
        emit ThresholdUpdated(newThreshold);
    }

    /**
     * @dev Approve a DeFi protocol to check compliance
     */
    function approveProtocol(address protocol) external onlyAdmin {
        require(protocol != address(0), "Invalid protocol address");
        approvedProtocols[protocol] = true;
        emit ProtocolApproved(protocol);
    }

    /**
     * @dev Revoke protocol approval
     */
    function revokeProtocol(address protocol) external onlyAdmin {
        approvedProtocols[protocol] = false;
        emit ProtocolRevoked(protocol);
    }

    /**
     * @dev Transfer admin rights
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin address");
        admin = newAdmin;
    }

    // ============ Protocol Functions ============

    /**
     * @dev Check if a user is compliant (called by approved protocols)
     */
    function checkCompliance(address wallet)
        external
        view
        onlyApprovedProtocol
        returns (bool)
    {
        uint256 nullifierHash = walletToNullifier[wallet];
        if (nullifierHash == 0) return false;

        ComplianceRecord memory record = complianceRecords[nullifierHash];
        return record.isAccredited && block.timestamp < record.expiresAt;
    }

    /**
     * @dev Get wallet address from nullifier hash
     */
    function getWalletFromNullifier(uint256 nullifierHash)
        external
        view
        returns (address)
    {
        return nullifierToWallet[nullifierHash];
    }
}
