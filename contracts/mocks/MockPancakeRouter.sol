// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockPancakeRouter {
    using SafeERC20 for IERC20;

    uint256 public tokenOutMultiplier = 100;
    uint256 public nativeOutDivisor = 2;
    uint256 public tokenToTokenMultiplier = 2;

    receive() external payable {}

    function setRates(
        uint256 _tokenOutMultiplier,
        uint256 _nativeOutDivisor,
        uint256 _tokenToTokenMultiplier
    ) external {
        tokenOutMultiplier = _tokenOutMultiplier;
        nativeOutDivisor = _nativeOutDivisor;
        tokenToTokenMultiplier = _tokenToTokenMultiplier;
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external payable {
        address outputToken = path[path.length - 1];
        uint256 outputAmount = msg.value * tokenOutMultiplier;
        require(outputAmount >= amountOutMin, "Insufficient output");
        IERC20(outputToken).safeTransfer(to, outputAmount);
    }

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external {
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 outputAmount = amountIn / nativeOutDivisor;
        require(outputAmount >= amountOutMin, "Insufficient output");
        (bool success, ) = payable(to).call{value: outputAmount}("");
        require(success, "Native transfer failed");
    }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external {
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        address outputToken = path[path.length - 1];
        uint256 outputAmount = amountIn * tokenToTokenMultiplier;
        require(outputAmount >= amountOutMin, "Insufficient output");
        IERC20(outputToken).safeTransfer(to, outputAmount);
    }
}
