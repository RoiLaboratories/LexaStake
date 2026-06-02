// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPancakeRouterV2 {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable;

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

/**
 * @title SwapExecutor
 * @notice Executes PancakeSwap swaps, receives the output first, sends 99.7% to
 * users, and keeps 0.3% as withdrawable fees for the treasury.
 */
contract SwapExecutor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant FEE_BASIS_POINTS = 30;
    uint256 public constant BASIS_POINTS = 10_000;
    address public constant NATIVE_TOKEN = address(0);

    IPancakeRouterV2 public immutable router;
    address public immutable wbnb;
    address public treasury;

    mapping(address token => uint256) public totalFeesCollected;
    mapping(address token => uint256) public availableFees;
    mapping(address admin => bool) public isAdmin;
    mapping(address token => bool) private listedFeeToken;
    address[] private feeTokens;

    event SwapExecuted(
        address indexed user,
        address indexed inputToken,
        address indexed outputToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 userAmount,
        uint256 feeAmount
    );

    event FeeWithdrawn(
        address indexed token,
        address indexed treasury,
        uint256 amount
    );

    event TreasuryUpdated(address indexed treasury);
    event AdminUpdated(address indexed admin, bool enabled);

    modifier onlyAdmin() {
        require(isAdmin[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(address _router, address _wbnb, address _treasury) Ownable(msg.sender) {
        require(_router != address(0), "Invalid router");
        require(_wbnb != address(0), "Invalid WBNB");
        require(_treasury != address(0), "Invalid treasury");

        router = IPancakeRouterV2(_router);
        wbnb = _wbnb;
        treasury = _treasury;
        isAdmin[msg.sender] = true;
    }

    receive() external payable {}

    function executeSwapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address recipient,
        uint256 deadline
    )
        external
        payable
        nonReentrant
        returns (uint256 outputAmount, uint256 userAmount, uint256 feeAmount)
    {
        require(msg.value > 0, "No BNB sent");
        require(recipient != address(0), "Invalid recipient");
        require(path.length >= 2, "Invalid path");
        require(path[0] == wbnb, "Path must start with WBNB");

        address outputToken = path[path.length - 1];
        uint256 balanceBefore = IERC20(outputToken).balanceOf(address(this));

        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: msg.value}(
            amountOutMin,
            path,
            address(this),
            deadline
        );

        outputAmount = IERC20(outputToken).balanceOf(address(this)) - balanceBefore;
        (userAmount, feeAmount) = _splitTokenOutput(outputToken, outputAmount, recipient);

        emit SwapExecuted(
            msg.sender,
            NATIVE_TOKEN,
            outputToken,
            msg.value,
            outputAmount,
            userAmount,
            feeAmount
        );
    }

    function executeSwapExactTokensForETH(
        address inputToken,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address recipient,
        uint256 deadline
    )
        external
        nonReentrant
        returns (uint256 outputAmount, uint256 userAmount, uint256 feeAmount)
    {
        require(inputToken != address(0), "Invalid input token");
        require(amountIn > 0, "Invalid input amount");
        require(recipient != address(0), "Invalid recipient");
        require(path.length >= 2, "Invalid path");
        require(path[0] == inputToken, "Path input mismatch");
        require(path[path.length - 1] == wbnb, "Path must end with WBNB");

        uint256 actualInput = _pullAndApproveInput(inputToken, amountIn);
        uint256 balanceBefore = address(this).balance;

        router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            actualInput,
            amountOutMin,
            path,
            address(this),
            deadline
        );

        outputAmount = address(this).balance - balanceBefore;
        (userAmount, feeAmount) = _splitNativeOutput(outputAmount, recipient);

        emit SwapExecuted(
            msg.sender,
            inputToken,
            NATIVE_TOKEN,
            actualInput,
            outputAmount,
            userAmount,
            feeAmount
        );
    }

    function executeSwapExactTokensForTokens(
        address inputToken,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address recipient,
        uint256 deadline
    )
        external
        nonReentrant
        returns (uint256 outputAmount, uint256 userAmount, uint256 feeAmount)
    {
        require(inputToken != address(0), "Invalid input token");
        require(amountIn > 0, "Invalid input amount");
        require(recipient != address(0), "Invalid recipient");
        require(path.length >= 2, "Invalid path");
        require(path[0] == inputToken, "Path input mismatch");

        address outputToken = path[path.length - 1];
        require(outputToken != wbnb, "Use token to BNB");

        uint256 actualInput = _pullAndApproveInput(inputToken, amountIn);
        uint256 balanceBefore = IERC20(outputToken).balanceOf(address(this));

        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            actualInput,
            amountOutMin,
            path,
            address(this),
            deadline
        );

        outputAmount = IERC20(outputToken).balanceOf(address(this)) - balanceBefore;
        (userAmount, feeAmount) = _splitTokenOutput(outputToken, outputAmount, recipient);

        emit SwapExecuted(
            msg.sender,
            inputToken,
            outputToken,
            actualInput,
            outputAmount,
            userAmount,
            feeAmount
        );
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setAdmin(address admin, bool enabled) external onlyOwner {
        require(admin != address(0), "Invalid admin");
        isAdmin[admin] = enabled;
        emit AdminUpdated(admin, enabled);
    }

    function withdrawTokenFees(address token, uint256 amount)
        external
        onlyAdmin
        nonReentrant
    {
        require(token != address(0), "Use native withdraw");
        require(amount > 0, "Invalid amount");
        require(availableFees[token] >= amount, "Insufficient fees");

        availableFees[token] -= amount;
        IERC20(token).safeTransfer(treasury, amount);

        emit FeeWithdrawn(token, treasury, amount);
    }

    function withdrawAllTokenFees(address token)
        external
        onlyAdmin
        nonReentrant
        returns (uint256 amount)
    {
        require(token != address(0), "Use native withdraw");
        amount = availableFees[token];
        require(amount > 0, "No fees");

        availableFees[token] = 0;
        IERC20(token).safeTransfer(treasury, amount);

        emit FeeWithdrawn(token, treasury, amount);
    }

    function withdrawNativeFees(uint256 amount)
        external
        onlyAdmin
        nonReentrant
    {
        require(amount > 0, "Invalid amount");
        require(availableFees[NATIVE_TOKEN] >= amount, "Insufficient fees");

        availableFees[NATIVE_TOKEN] -= amount;
        _sendNative(treasury, amount);

        emit FeeWithdrawn(NATIVE_TOKEN, treasury, amount);
    }

    function withdrawAllNativeFees()
        external
        onlyAdmin
        nonReentrant
        returns (uint256 amount)
    {
        amount = availableFees[NATIVE_TOKEN];
        require(amount > 0, "No fees");

        availableFees[NATIVE_TOKEN] = 0;
        _sendNative(treasury, amount);

        emit FeeWithdrawn(NATIVE_TOKEN, treasury, amount);
    }

    function getFeeTokenCount() external view returns (uint256) {
        return feeTokens.length;
    }

    function getFeeTokens() external view returns (address[] memory) {
        return feeTokens;
    }

    function _pullAndApproveInput(address inputToken, uint256 amountIn)
        private
        returns (uint256 actualInput)
    {
        uint256 balanceBefore = IERC20(inputToken).balanceOf(address(this));
        IERC20(inputToken).safeTransferFrom(msg.sender, address(this), amountIn);
        actualInput = IERC20(inputToken).balanceOf(address(this)) - balanceBefore;
        require(actualInput > 0, "No input received");

        IERC20(inputToken).forceApprove(address(router), actualInput);
    }

    function _splitTokenOutput(
        address outputToken,
        uint256 outputAmount,
        address recipient
    ) private returns (uint256 userAmount, uint256 feeAmount) {
        require(outputAmount > 0, "No output received");

        feeAmount = _calculateFee(outputAmount);
        userAmount = outputAmount - feeAmount;

        _recordFee(outputToken, feeAmount);
        IERC20(outputToken).safeTransfer(recipient, userAmount);
    }

    function _splitNativeOutput(uint256 outputAmount, address recipient)
        private
        returns (uint256 userAmount, uint256 feeAmount)
    {
        require(outputAmount > 0, "No output received");

        feeAmount = _calculateFee(outputAmount);
        userAmount = outputAmount - feeAmount;

        _recordFee(NATIVE_TOKEN, feeAmount);
        _sendNative(recipient, userAmount);
    }

    function _recordFee(address token, uint256 feeAmount) private {
        if (feeAmount == 0) {
            return;
        }

        totalFeesCollected[token] += feeAmount;
        availableFees[token] += feeAmount;

        if (!listedFeeToken[token]) {
            listedFeeToken[token] = true;
            feeTokens.push(token);
        }
    }

    function _calculateFee(uint256 outputAmount) private pure returns (uint256) {
        return (outputAmount * FEE_BASIS_POINTS) / BASIS_POINTS;
    }

    function _sendNative(address recipient, uint256 amount) private {
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "Native transfer failed");
    }
}
