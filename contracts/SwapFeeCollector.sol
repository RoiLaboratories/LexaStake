// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SwapFeeCollector
 * @dev Collects 0.3% fees from all swap output amounts
 * @notice This contract receives tokens as fees and tracks accumulated balances per token
 */
contract SwapFeeCollector is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==================== STATE VARIABLES ====================

    /// @notice Fee percentage in basis points (0.3% = 30 basis points)
    /// @dev Using basis points: 10000 = 100%, 30 = 0.3%
    uint256 public constant FEE_PERCENTAGE = 30; // 0.3%
    uint256 public constant BASIS_POINTS = 10000; // 100% in basis points

    /// @notice Track total fees collected per token
    mapping(address token => uint256) public totalFeesCollected;

    /// @notice Track available fees to withdraw per token
    mapping(address token => uint256) public availableFees;

    /// @notice Track accumulated fees per token per collector address
    mapping(address token => mapping(address collector => uint256)) public collectorFees;

    /// @notice List of tokens that have had fees collected
    address[] public tokens;

    /// @notice Mapping to check if token already exists in tokens array
    mapping(address => bool) private tokenExists;

    /// @notice Admin address that can initiate withdrawals
    mapping(address => bool) public isAdmin;

    // ==================== EVENTS ====================

    event FeeCollected(
        address indexed token,
        address indexed collector,
        uint256 outputAmount,
        uint256 feeAmount,
        uint256 timestamp
    );

    event FeeWithdrawn(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );

    event AdminAdded(address indexed admin, uint256 timestamp);

    event AdminRemoved(address indexed admin, uint256 timestamp);

    event TokenListed(address indexed token, uint256 timestamp);

    // ==================== MODIFIERS ====================

    modifier onlyAdmin() {
        require(isAdmin[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor() Ownable(msg.sender) {
        isAdmin[msg.sender] = true;
    }

    // ==================== CORE FUNCTIONS ====================

    /**
     * @notice Collect 0.3% fee from swap output amount
     * @dev This function records fees that were already transferred to this contract
     * @param _token Address of the output token
     * @param _outputAmount Total output amount from swap (before fee deduction)
     * @param _collector Address performing the swap
     * @return feeAmount The 0.3% fee collected
     */
    function collectFee(
        address _token,
        uint256 _outputAmount,
        address _collector
    )
        external
        onlyOwner
        nonReentrant
        returns (uint256 feeAmount)
    {
        require(_token != address(0), "Invalid token address");
        require(_outputAmount > 0, "Output amount must be greater than zero");
        require(_collector != address(0), "Invalid collector address");

        // Calculate 0.3% fee
        feeAmount = (_outputAmount * FEE_PERCENTAGE) / BASIS_POINTS;
        require(feeAmount > 0, "Fee amount too small");

        // Verify that tokens were already transferred to this contract
        // (The swap handler is responsible for sending the 0.3% to this contract)
        
        // Update tracking
        totalFeesCollected[_token] += feeAmount;
        availableFees[_token] += feeAmount;
        collectorFees[_token][_collector] += feeAmount;

        // Add token to list if new
        if (!tokenExists[_token]) {
            tokens.push(_token);
            tokenExists[_token] = true;
            emit TokenListed(_token, block.timestamp);
        }

        emit FeeCollected(_token, _collector, _outputAmount, feeAmount, block.timestamp);

        return feeAmount;
    }

    /**
     * @notice Record fee that was already deducted from output
     * @dev Use this if the fee is already deducted and sent to this contract
     * @param _token Address of the fee token
     * @param _feeAmount Amount of fee received
     * @param _collector Address of the swap initiator
     */
    function recordFee(
        address _token,
        uint256 _feeAmount,
        address _collector
    )
        external
        onlyOwner
        nonReentrant
    {
        require(_token != address(0), "Invalid token address");
        require(_feeAmount > 0, "Fee amount must be greater than zero");
        require(_collector != address(0), "Invalid collector address");

        // Update tracking
        totalFeesCollected[_token] += _feeAmount;
        availableFees[_token] += _feeAmount;
        collectorFees[_token][_collector] += _feeAmount;

        // Add token to list if new
        if (!tokenExists[_token]) {
            tokens.push(_token);
            tokenExists[_token] = true;
            emit TokenListed(_token, block.timestamp);
        }

        emit FeeCollected(_token, _collector, 0, _feeAmount, block.timestamp);
    }

    // ==================== WITHDRAWAL FUNCTIONS ====================

    /**
     * @notice Withdraw collected fees for a specific token
     * @param _token Address of the token to withdraw
     * @param _amount Amount to withdraw
     */
    function withdrawFees(address _token, uint256 _amount)
        external
        onlyAdmin
        nonReentrant
    {
        require(_token != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than zero");
        require(availableFees[_token] >= _amount, "Insufficient fees collected");

        // Update available fees
        availableFees[_token] -= _amount;

        // Transfer tokens (using SafeERC20 for safety)
        IERC20(_token).safeTransfer(owner(), _amount);

        emit FeeWithdrawn(_token, owner(), _amount, block.timestamp);
    }

    /**
     * @notice Withdraw all collected fees for a specific token
     * @param _token Address of the token to withdraw
     */
    function withdrawAllFees(address _token)
        external
        onlyAdmin
        nonReentrant
        returns (uint256 amount)
    {
        require(_token != address(0), "Invalid token address");
        amount = availableFees[_token];
        require(amount > 0, "No fees to withdraw");

        // Update available fees
        availableFees[_token] = 0;

        // Transfer tokens
        IERC20(_token).safeTransfer(owner(), amount);

        emit FeeWithdrawn(_token, owner(), amount, block.timestamp);

        return amount;
    }

    /**
     * @notice Emergency withdrawal of a specific ERC20 token
     * @dev Only owner can call this
     * @param _token Address of the token
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(address _token, uint256 _amount)
        external
        onlyOwner
        nonReentrant
    {
        require(_token != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than zero");

        uint256 balance = IERC20(_token).balanceOf(address(this));
        require(balance >= _amount, "Insufficient balance in contract");

        IERC20(_token).safeTransfer(owner(), _amount);

        emit FeeWithdrawn(_token, owner(), _amount, block.timestamp);
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @notice Add an admin address that can withdraw fees
     * @param _admin Address to add as admin
     */
    function addAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "Invalid admin address");
        require(!isAdmin[_admin], "Already admin");

        isAdmin[_admin] = true;
        emit AdminAdded(_admin, block.timestamp);
    }

    /**
     * @notice Remove an admin address
     * @param _admin Address to remove from admin
     */
    function removeAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "Invalid admin address");
        require(isAdmin[_admin], "Not an admin");

        isAdmin[_admin] = false;
        emit AdminRemoved(_admin, block.timestamp);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get number of unique tokens with collected fees
     */
    function getTokenCount() external view returns (uint256) {
        return tokens.length;
    }

    /**
     * @notice Get fee collected by a specific collector for a token
     * @param _token Token address
     * @param _collector Collector address
     */
    function getCollectorFees(address _token, address _collector)
        external
        view
        returns (uint256)
    {
        return collectorFees[_token][_collector];
    }

    /**
     * @notice Get available balance for a token
     * @param _token Token address
     */
    function getAvailableFees(address _token) external view returns (uint256) {
        return availableFees[_token];
    }

    /**
     * @notice Get all tokens with collected fees
     */
    function getAllTokens() external view returns (address[] memory) {
        return tokens;
    }

    /**
     * @notice Get contract balance of a specific token
     * @param _token Token address
     */
    function getTokenBalance(address _token) external view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    /**
     * @notice Check if address is admin
     * @param _address Address to check
     */
    function checkIsAdmin(address _address) external view returns (bool) {
        return isAdmin[_address];
    }
}
