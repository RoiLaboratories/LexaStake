import { ethers } from "ethers";

// PancakeSwap UniversalRouter ABI - execute function with deadline parameter
export const UNIVERSAL_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "bytes", name: "commands", type: "bytes" },
      { internalType: "bytes[]", name: "inputs", type: "bytes[]" },
      { internalType: "uint256", name: "deadline", type: "uint256" }
    ],
    name: "execute",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  }
];

// UniversalRouter command constants
export const V2_SWAP_EXACT_IN = 0x00;

/**
 * Encode a V2_SWAP_EXACT_IN command for UniversalRouter
 * Command 0x00: V2_SWAP_EXACT_IN
 * Parameters: (amountIn, amountOutMin, path[], recipient, payerIsUser)
 */
export function encodeV2SwapExactIn(
  amountIn: string,
  amountOutMin: string,
  path: string[],
  recipient: string,
  payerIsUser: boolean = true
): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  return abiCoder.encode(
    ["uint256", "uint256", "address[]", "address", "bool"],
    [amountIn, amountOutMin, path, recipient, payerIsUser]
  );
}
