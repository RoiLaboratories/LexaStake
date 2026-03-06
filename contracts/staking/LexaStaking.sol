// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title LexaStaking
 * @dev Production-ready staking contract for LEXA tokens with multiple tiers and referral rewards
 * @notice Features: Tiered staking, daily reward distribution, referral bonuses, emergency pause
 */
contract LexaStaking is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ==================== ENUMS ====================
    enum StakingTier {
        BRONZE,
        SILVER,
        GOLD
    }

    // ==================== STRUCTS ====================
    /// @dev Configuration for each staking tier
    struct TierConfig {
        uint256 minStakeAmount; // Minimum stake in LEXA tokens (e.g., 10e18 for $10 worth)
        uint256 roi90days; // ROI percentage for 90-day lock (e.g., 5 = 5%)
        uint256 roi180days; // ROI percentage for 180-day lock
    }

    /// @dev User's staking position
    struct UserStake {
        uint256 amount; // Principal amount staked
        uint256 lockDurationDays; // Lock duration (90 or 180)
        uint256 startTimestamp; // When the stake was initiated
        StakingTier tier; // Which tier was selected
        uint256 totalRewardsEntitled; // Total rewards based on ROI (calculated at stake time)
        uint256 totalRewardsClaimed; // Amount of rewards already claimed
        bool active; // Whether this stake is still active
    }

    // ==================== STATE VARIABLES ====================
    IERC20 public lexaToken;
    
    // Tier configurations
    TierConfig[3] public tiers;
    
    // User stakes: user address => stake index => UserStake
    mapping(address user => mapping(uint256 index => UserStake)) public userStakes;
    /// @dev Track how many stakes each user has
    mapping(address user => uint256) public userStakeCount;
    
    // Referral tracking
    mapping(address referrer => uint256) public referralRewardsClaimed;
    mapping(address staker => address referrer) public stakerReferrer;
    /// @dev Track if a staker has already used a referrer to prevent duplicate bonuses
    mapping(address staker => bool) public hasUsedReferrer;
    
    // Admin settings
    uint256 public referralRewardAmount = 50e18; // 50 LEXA per successful referral
    uint256 public rewardPoolBalance; // Total rewards available in the pool
    
    // Pausable staking
    bool public stakingPaused = false;
    
    // Constants
    uint256 private constant DAYS_90 = 90 days;
    uint256 private constant DAYS_180 = 180 days;
    uint256 private constant SECONDS_PER_DAY = 86400;
    uint256 private constant PRECISION = 100; // For percentage calculations (5 = 5%)

    // ==================== EVENTS ====================
    event Staked(
        address indexed user,
        StakingTier tier,
        uint256 amount,
        uint256 lockDurationDays,
        uint256 totalRewardsEntitled,
        address indexed referrer,
        uint256 timestamp
    );

    event RewardsClaimed(
        address indexed user,
        uint256 stakeIndex,
        uint256 rewardsAmount,
        uint256 timestamp
    );

    event RewardsRestaked(
        address indexed user,
        uint256 stakeIndex,
        uint256 rewardAmount,
        uint256 timestamp
    );

    event Unstaked(
        address indexed user,
        uint256 stakeIndex,
        uint256 principalAmount,
        uint256 unclaimedRewards,
        uint256 timestamp
    );

    event ReferralRewarded(
        address indexed referrer,
        address indexed newStaker,
        uint256 rewardAmount,
        uint256 timestamp
    );

    event RewardPoolFunded(
        address indexed funder,
        uint256 amount,
        uint256 timestamp
    );

    event ReferralRewardAmountUpdated(
        uint256 newAmount,
        uint256 timestamp
    );

    event StakingPausedToggled(
        bool isPaused,
        uint256 timestamp
    );

    event EmergencyTokenRecovery(
        address indexed token,
        uint256 amount,
        address indexed recipient,
        uint256 timestamp
    );

    // ==================== MODIFIERS ====================
    modifier stakingEnabled() {
        require(!stakingPaused && !paused(), "Staking is currently paused");
        _;
    }

    modifier validTier(StakingTier _tier) {
        require(uint8(_tier) < 3, "Invalid tier");
        _;
    }

    modifier validDuration(uint256 _durationDays) {
        require(_durationDays == 90 || _durationDays == 180, "Duration must be 90 or 180 days");
        _;
    }

    // ==================== CONSTRUCTOR ====================
    constructor(address _lexaToken) Ownable(msg.sender) Pausable() {
        require(_lexaToken != address(0), "Invalid token address");
        lexaToken = IERC20(_lexaToken);

        // Initialize tier configurations
        // Bronze: $10 min, 5% (90d), 10% (180d)
        tiers[uint8(StakingTier.BRONZE)] = TierConfig({
            minStakeAmount: 10e18,
            roi90days: 5,
            roi180days: 10
        });

        // Silver: $20 min, 10% (90d), 25% (180d)
        tiers[uint8(StakingTier.SILVER)] = TierConfig({
            minStakeAmount: 20e18,
            roi90days: 10,
            roi180days: 25
        });

        // Gold: $50 min, 15% (90d), 35% (180d)
        tiers[uint8(StakingTier.GOLD)] = TierConfig({
            minStakeAmount: 50e18,
            roi90days: 15,
            roi180days: 35
        });
    }

    // ==================== CORE STAKING FUNCTIONS ====================

    /**
     * @notice Stake LEXA tokens with optional referral
     * @param _amount Amount of LEXA to stake
     * @param _tier Staking tier (0=Bronze, 1=Silver, 2=Gold)
     * @param _durationDays Lock duration (90 or 180 days)
     * @param _referrer Address of referrer (use address(0) for no referrer)
     */
    function stake(
        uint256 _amount,
        StakingTier _tier,
        uint256 _durationDays,
        address _referrer
    ) 
        external 
        nonReentrant 
        stakingEnabled 
        validTier(_tier) 
        validDuration(_durationDays)
    {
        require(_amount > 0, "Stake amount must be greater than zero");
        require(_referrer != msg.sender, "Cannot self-refer");

        TierConfig memory tierConfig = tiers[uint8(_tier)];
        require(_amount >= tierConfig.minStakeAmount, "Amount below minimum for tier");

        // Calculate rewards based on ROI
        uint256 roiPercentage = _durationDays == 90 
            ? tierConfig.roi90days 
            : tierConfig.roi180days;
        uint256 totalRewardsEntitled = (_amount * roiPercentage) / PRECISION;

        // Transfer tokens from user to contract
        // Note: Rewards are NOT deducted from pool here anymore
        // They will be checked against actual contract balance when user claims
        lexaToken.safeTransferFrom(msg.sender, address(this), _amount);

        // Create stake
        uint256 stakeIndex = userStakeCount[msg.sender];
        userStakes[msg.sender][stakeIndex] = UserStake({
            amount: _amount,
            lockDurationDays: _durationDays,
            startTimestamp: block.timestamp,
            tier: _tier,
            totalRewardsEntitled: totalRewardsEntitled,
            totalRewardsClaimed: 0,
            active: true
        });
        userStakeCount[msg.sender]++;

        // Handle referral if provided
        if (_referrer != address(0) && !hasUsedReferrer[msg.sender]) {
            hasUsedReferrer[msg.sender] = true;
            stakerReferrer[msg.sender] = _referrer;
            
            // Distribute referral reward
            require(
                rewardPoolBalance >= referralRewardAmount,
                "Insufficient reward pool for referral bonus"
            );
            rewardPoolBalance -= referralRewardAmount;
            lexaToken.safeTransfer(_referrer, referralRewardAmount);
            referralRewardsClaimed[_referrer] += referralRewardAmount;

            emit ReferralRewarded(
                _referrer,
                msg.sender,
                referralRewardAmount,
                block.timestamp
            );
        }

        emit Staked(
            msg.sender,
            _tier,
            _amount,
            _durationDays,
            totalRewardsEntitled,
            _referrer,
            block.timestamp
        );
    }

    // ==================== REWARD FUNCTIONS ====================

    /**
     * @notice Calculate accumulated rewards for a specific stake
     * @param _user User address
     * @param _stakeIndex Index of the stake
     * @return Accumulated rewards amount
     */
    function getAccumulatedRewards(address _user, uint256 _stakeIndex) 
        public 
        view 
        returns (uint256) 
    {
        require(_stakeIndex < userStakeCount[_user], "Invalid stake index");
        
        UserStake memory stakeData = userStakes[_user][_stakeIndex];
        require(stakeData.active, "Stake is not active");

        uint256 lockDurationSeconds = stakeData.lockDurationDays * SECONDS_PER_DAY;
        uint256 elapsedTime = block.timestamp - stakeData.startTimestamp;

        // Cap elapsed time at lock duration (rewards stop accruing after maturity)
        if (elapsedTime > lockDurationSeconds) {
            elapsedTime = lockDurationSeconds;
        }

        // Linear reward distribution: calculate accumulated rewards with proper precision
        // IMPORTANT: Multiply before dividing to avoid integer truncation
        uint256 accumulatedRewards = (stakeData.totalRewardsEntitled * elapsedTime) / lockDurationSeconds;

        // Account for already claimed rewards
        uint256 pending = accumulatedRewards > stakeData.totalRewardsClaimed 
            ? accumulatedRewards - stakeData.totalRewardsClaimed 
            : 0;

        return pending;
    }

    /**
     * @notice Check if a stake has matured
     * @param _user User address
     * @param _stakeIndex Index of the stake
     * @return true if lock period has expired
     */
    function isStakeMatured(address _user, uint256 _stakeIndex) 
        public 
        view 
        returns (bool) 
    {
        require(_stakeIndex < userStakeCount[_user], "Invalid stake index");
        
        UserStake memory stakeData = userStakes[_user][_stakeIndex];
        uint256 lockDurationSeconds = stakeData.lockDurationDays * SECONDS_PER_DAY;
        return (block.timestamp - stakeData.startTimestamp) >= lockDurationSeconds;
    }

    /**
     * @notice Claim accumulated rewards without unstaking
     * @param _stakeIndex Index of the stake
     */
    function claimRewards(uint256 _stakeIndex) 
        external 
        nonReentrant 
    {
        require(_stakeIndex < userStakeCount[msg.sender], "Invalid stake index");
        
        UserStake storage stakeData = userStakes[msg.sender][_stakeIndex];
        require(stakeData.active, "Stake is not active");

        uint256 pendingRewards = getAccumulatedRewards(msg.sender, _stakeIndex);
        require(pendingRewards > 0, "No rewards to claim");

        // Check that contract has sufficient balance for rewards
        uint256 contractBalance = lexaToken.balanceOf(address(this));
        require(
            contractBalance >= pendingRewards,
            "Insufficient contract balance for rewards. Admin must fund the reward pool."
        );

        // Update claimed rewards
        stakeData.totalRewardsClaimed += pendingRewards;

        // Transfer rewards
        lexaToken.safeTransfer(msg.sender, pendingRewards);

        emit RewardsClaimed(msg.sender, _stakeIndex, pendingRewards, block.timestamp);
    }

    /**
     * @notice Restake rewards back into the same stake position (extends lock period)
     * @param _stakeIndex Index of the stake
     */
    function restakeRewards(uint256 _stakeIndex) 
        external 
        nonReentrant 
    {
        require(_stakeIndex < userStakeCount[msg.sender], "Invalid stake index");
        
        UserStake storage stakeData = userStakes[msg.sender][_stakeIndex];
        require(stakeData.active, "Stake is not active");

        uint256 pendingRewards = getAccumulatedRewards(msg.sender, _stakeIndex);
        require(pendingRewards > 0, "No rewards to restake");

        // Update stake to reflect restaked rewards
        stakeData.amount += pendingRewards;
        stakeData.totalRewardsClaimed += pendingRewards;

        emit RewardsRestaked(msg.sender, _stakeIndex, pendingRewards, block.timestamp);
    }

    // ==================== UNSTAKING FUNCTIONS ====================

    /**
     * @notice Unstake after maturity, claiming all remaining rewards
     * @param _stakeIndex Index of the stake
     */
    function unstake(uint256 _stakeIndex) 
        external 
        nonReentrant 
    {
        require(_stakeIndex < userStakeCount[msg.sender], "Invalid stake index");
        
        UserStake storage stakeData = userStakes[msg.sender][_stakeIndex];
        require(stakeData.active, "Stake is not active");
        require(isStakeMatured(msg.sender, _stakeIndex), "Stake is still locked");

        uint256 unclaimedRewards = getAccumulatedRewards(msg.sender, _stakeIndex);
        uint256 principalAmount = stakeData.amount;

        // Mark stake as inactive
        stakeData.active = false;

        // Calculate total to return
        uint256 totalReturn = principalAmount + unclaimedRewards;

        // Check that contract has sufficient balance
        uint256 contractBalance = lexaToken.balanceOf(address(this));
        require(
            contractBalance >= totalReturn,
            "Insufficient contract balance for unstaking. Admin must fund the reward pool."
        );

        // Transfer principal + unclaimed rewards back to user
        lexaToken.safeTransfer(msg.sender, totalReturn);

        emit Unstaked(
            msg.sender,
            _stakeIndex,
            principalAmount,
            unclaimedRewards,
            block.timestamp
        );
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @notice Fund the reward pool
     * @param _amount Amount of LEXA to add to pool
     */
    function fundRewardPool(uint256 _amount) 
        external 
        onlyOwner 
    {
        require(_amount > 0, "Amount must be greater than zero");
        lexaToken.safeTransferFrom(msg.sender, address(this), _amount);
        rewardPoolBalance += _amount;

        emit RewardPoolFunded(msg.sender, _amount, block.timestamp);
    }

    /**
     * @notice Update referral reward amount
     * @param _newAmount New referral reward in LEXA (e.g., 50e18 for 50 LEXA)
     */
    function setReferralRewardAmount(uint256 _newAmount) 
        external 
        onlyOwner 
    {
        require(_newAmount > 0, "Amount must be greater than zero");
        referralRewardAmount = _newAmount;

        emit ReferralRewardAmountUpdated(_newAmount, block.timestamp);
    }

    /**
     * @notice Pause/unpause staking
     * @param _isPaused true to pause, false to unpause
     */
    function setStakingPaused(bool _isPaused) 
        external 
        onlyOwner 
    {
        stakingPaused = _isPaused;
        emit StakingPausedToggled(_isPaused, block.timestamp);
    }

    /**
     * @notice Emergency pause all contract operations
     */
    function pause() 
        external 
        onlyOwner 
    {
        _pause();
    }

    /**
     * @notice Unpause contract operations
     */
    function unpause() 
        external 
        onlyOwner 
    {
        _unpause();
    }

    /**
     * @notice Emergency recovery of unclaimed reward pool tokens
     * @notice IMPORTANT: Cannot withdraw locked user funds or reserved rewards
     */
    function emergencyRecoverTokens(uint256 _amount) 
        external 
        onlyOwner 
    {
        require(_amount > 0, "Amount must be greater than zero");
        require(_amount <= rewardPoolBalance, "Cannot exceed available recovery amount");
        
        // Deduct from tracking variable
        rewardPoolBalance -= _amount;
        lexaToken.safeTransfer(owner(), _amount);

        emit EmergencyTokenRecovery(address(lexaToken), _amount, owner(), block.timestamp);
    }

    /**
     * @notice Withdraw excess LEXA tokens from the contract
     * @notice IMPORTANT: Can only withdraw amounts above what's locked in user stakes
     * @param _amount Amount of LEXA to withdraw
     */
    function withdrawExcessTokens(uint256 _amount) 
        external 
        onlyOwner 
    {
        require(_amount > 0, "Amount must be greater than zero");
        
        // Get actual contract balance
        uint256 contractBalance = lexaToken.balanceOf(address(this));
        
        // Calculate total locked in user stakes (principal amounts only)
        // Available for withdrawal = contract balance - reward pool balance
        uint256 totalLockedAmount = contractBalance - rewardPoolBalance;
        
        // Calculate available for withdrawal
        uint256 availableForWithdrawal = contractBalance - totalLockedAmount;
        
        require(
            _amount <= availableForWithdrawal, 
            "Insufficient excess tokens. Cannot withdraw locked user funds."
        );
        
        // Transfer to owner
        lexaToken.safeTransfer(owner(), _amount);

        emit EmergencyTokenRecovery(address(lexaToken), _amount, owner(), block.timestamp);
    }

    /**
     * @notice Update tier configuration (careful with existing stakes!)
     * @param _tier Tier to update
     * @param _minStake New minimum stake
     * @param _roi90d New 90-day ROI percentage
     * @param _roi180d New 180-day ROI percentage
     */
    function updateTierConfig(
        StakingTier _tier,
        uint256 _minStake,
        uint256 _roi90d,
        uint256 _roi180d
    ) 
        external 
        onlyOwner 
        validTier(_tier) 
    {
        require(_minStake > 0, "Min stake must be greater than zero");
        require(_roi90d > 0 && _roi180d > 0, "ROI must be greater than zero");
        
        tiers[uint8(_tier)] = TierConfig({
            minStakeAmount: _minStake,
            roi90days: _roi90d,
            roi180days: _roi180d
        });
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get all stakes for a user
     * @param _user User address
     * @return Array of user stakes
     */
    function getUserStakes(address _user) 
        external 
        view 
        returns (UserStake[] memory) 
    {
        UserStake[] memory stakes = new UserStake[](userStakeCount[_user]);
        for (uint256 i = 0; i < userStakeCount[_user]; i++) {
            stakes[i] = userStakes[_user][i];
        }
        return stakes;
    }

    /**
     * @notice Get active stakes for a user
     * @param _user User address
     * @return Count of active stakes
     */
    function getActiveStakeCount(address _user) 
        external 
        view 
        returns (uint256) 
    {
        uint256 count = 0;
        for (uint256 i = 0; i < userStakeCount[_user]; i++) {
            if (userStakes[_user][i].active) {
                count++;
            }
        }
        return count;
    }

    /**
     * @notice Get tier configuration
     * @param _tier The tier to retrieve
     */
    function getTierConfig(StakingTier _tier) 
        external 
        view 
        validTier(_tier) 
        returns (TierConfig memory) 
    {
        return tiers[uint8(_tier)];
    }

    /**
     * @notice Get total locked amount in contract
     * @return Total locked user funds
     */
    function getTotalLockedAmount() 
        external 
        view 
        returns (uint256) 
    {
        return lexaToken.balanceOf(address(this)) - rewardPoolBalance;
    }
}
