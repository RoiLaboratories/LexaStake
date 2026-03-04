// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SwapReferralRewards
 * @dev Simple contract for sending 2% BNB rewards to swap referrers
 * @notice Receives BNB and sends rewards directly to referrers
 */
contract SwapReferralRewards is Ownable, ReentrancyGuard {
    
    // ==================== STATE VARIABLES ====================
    
    /// @dev Track total distributed
    uint256 public totalDistributed;
    
    /// @dev Track per-referrer totals
    mapping(address referrer => uint256) public totalEarned;
    
    // ==================== EVENTS ====================
    
    event BNBReceived(
        address indexed sender,
        uint256 amount,
        uint256 timestamp
    );
    
    event RewardSent(
        address indexed referrer,
        address indexed swapper,
        uint256 amount,
        string txHash,
        uint256 timestamp
    );
    
    event AdminWithdrawal(
        address indexed admin,
        uint256 amount,
        uint256 timestamp
    );
    
    // ==================== CONSTRUCTOR ====================
    
    constructor() Ownable(msg.sender) {}
    
    // ==================== RECEIVE FUNCTION ====================
    
    /**
     * @notice Receive BNB for referral rewards
     */
    receive() external payable {
        emit BNBReceived(msg.sender, msg.value, block.timestamp);
    }
    
    // ==================== REWARD FUNCTION ====================
    
    /**
     * @notice Send 2% reward to referrer directly
     * @param _referrer Address to receive the reward
     * @param _swapper Address of the user who performed the swap
     * @param _amount Amount of BNB to send (2% of swap input)
     * @param _txHash Original swap transaction hash
     */
    function sendReward(
        address _referrer,
        address _swapper,
        uint256 _amount,
        string memory _txHash
    ) 
        external 
        onlyOwner 
        nonReentrant
    {
        require(_referrer != address(0), "Invalid referrer address");
        require(_swapper != address(0), "Invalid swapper address");
        require(_amount > 0, "Amount must be greater than zero");
        require(_referrer != _swapper, "Referrer cannot be swapper");
        require(address(this).balance >= _amount, "Insufficient balance");
        
        // Update tracking
        totalDistributed += _amount;
        totalEarned[_referrer] += _amount;
        
        // Send BNB
        (bool success, ) = payable(_referrer).call{value: _amount}("");
        require(success, "Transfer failed");
        
        emit RewardSent(_referrer, _swapper, _amount, _txHash, block.timestamp);
    }
    
    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @notice Withdraw BNB from contract
     * @param _amount Amount to withdraw
     */
    function withdraw(uint256 _amount) 
        external 
        onlyOwner 
        nonReentrant
    {
        require(_amount > 0, "Amount must be greater than zero");
        require(address(this).balance >= _amount, "Insufficient balance");
        
        (bool success, ) = payable(owner()).call{value: _amount}("");
        require(success, "Withdrawal failed");
        
        emit AdminWithdrawal(owner(), _amount, block.timestamp);
    }
    
    /**
     * @notice Withdraw all BNB from contract
     */
    function withdrawAll() 
        external 
        onlyOwner 
        nonReentrant
    {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
        
        emit AdminWithdrawal(owner(), balance, block.timestamp);
    }
    
    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @notice Get contract balance
     */
    function getBalance() 
        external 
        view 
        returns (uint256) 
    {
        return address(this).balance;
    }
    
    /**
     * @notice Get total earned by referrer
     */
    function getReferrerEarnings(address _referrer) 
        external 
        view 
        returns (uint256) 
    {
        return totalEarned[_referrer];
    }
    
    /**
     * @notice Get contract statistics
     */
    function getStats() 
        external 
        view 
        returns (
            uint256 balance,
            uint256 totalDistributedAmount,
            address contractOwner
        ) 
    {
        return (
            address(this).balance,
            totalDistributed,
            owner()
        );
    }
}
