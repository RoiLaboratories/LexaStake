import * as fs from "fs";
import * as path from "path";

// Hardhat injects these globals when running scripts with `hardhat run`.
// This matches the existing deploy scripts in this repository.
interface HardhatSigner {
  getAddress(): Promise<string>;
}

interface HardhatNetwork {
  name: string;
  chainId: bigint | number;
}

interface DeploymentTransaction {
  wait(): Promise<unknown>;
}

interface DeployedContract {
  deploymentTransaction(): DeploymentTransaction | null;
  getAddress(): Promise<string>;
}

interface ContractFactory {
  deploy(...args: string[]): Promise<DeployedContract>;
}

interface HardhatEthers {
  provider: {
    getNetwork(): Promise<HardhatNetwork>;
    getBlockNumber(): Promise<number>;
  };
  getSigners(): Promise<HardhatSigner[]>;
  getAddress(address: string): string;
  getContractFactory(name: string): Promise<ContractFactory>;
}

declare const ethers: HardhatEthers;
declare const run: (
  taskName: string,
  taskArgs?: Record<string, unknown>,
) => Promise<unknown>;

const DEFAULT_PANCAKESWAP_ROUTER_V2_ADDRESS =
  "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const DEFAULT_WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

function upsertEnvValue(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  const prefix = content && !content.endsWith("\n") ? `${content}\n` : content;
  return `${prefix}${line}\n`;
}

function requireAddress(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`${name} is required`);
  }

  return ethers.getAddress(value.trim());
}

async function main() {
  console.log("Deploying SwapExecutor Contract...\n");

  const network = await ethers.provider.getNetwork();
  const chainId =
    typeof network.chainId === "bigint"
      ? network.chainId
      : BigInt(network.chainId);
  const shouldVerify =
    chainId === BigInt(56) || chainId === BigInt(97);
  const shouldPersistDeployment = chainId !== BigInt(31337);
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  const routerAddress = ethers.getAddress(
    process.env.PANCAKESWAP_ROUTER_V2_ADDRESS ||
      DEFAULT_PANCAKESWAP_ROUTER_V2_ADDRESS,
  );
  const wbnbAddress = ethers.getAddress(
    process.env.WBNB_ADDRESS || DEFAULT_WBNB_ADDRESS,
  );
  const treasuryAddress = requireAddress(
    process.env.TREASURY_WALLET_ADDRESS || process.env.TREASURY_ADDRESS,
    "TREASURY_WALLET_ADDRESS",
  );

  console.log("Deployment Configuration:");
  console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`   Deployer: ${signerAddress}`);
  console.log(`   Router:   ${routerAddress}`);
  console.log(`   WBNB:     ${wbnbAddress}`);
  console.log(`   Treasury: ${treasuryAddress}`);
  console.log("");

  const SwapExecutor = await ethers.getContractFactory("SwapExecutor");
  const swapExecutor = await SwapExecutor.deploy(
    routerAddress,
    wbnbAddress,
    treasuryAddress,
  );

  const deploymentTx = swapExecutor.deploymentTransaction();
  if (deploymentTx) {
    await deploymentTx.wait();
  }

  const contractAddress = await swapExecutor.getAddress();

  console.log("SwapExecutor deployed successfully!\n");
  console.log("Contract Address:", contractAddress);
  console.log("");

  if (shouldVerify) {
    try {
      console.log("Waiting for block explorer indexing before verification...");
      await new Promise((resolve) => setTimeout(resolve, 30000));

      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: [routerAddress, wbnbAddress, treasuryAddress],
        contract: "contracts/SwapExecutor.sol:SwapExecutor",
      });

      console.log("Contract verified successfully!\n");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Already Verified")) {
        console.log("Contract already verified on block explorer\n");
      } else {
        console.warn("Verification failed. You can verify manually later.");
        console.warn("Error:", error instanceof Error ? error.message : String(error));
        console.log("");
        console.log("Manual verification command:");
        console.log(
          `npx hardhat verify --network ${network.name} "${contractAddress}" "${routerAddress}" "${wbnbAddress}" "${treasuryAddress}"`,
        );
        console.log("");
      }
    }
  } else {
    console.log(`Skipping block explorer verification for ${network.name}.\n`);
  }

  if (!shouldPersistDeployment) {
    console.log("Skipping .env.local and deployment file updates for local Hardhat network.");
    console.log("Ready for real output-fee collection.\n");
    return;
  }

  const envPath = path.join(process.cwd(), ".env.local");
  let envContent = "";

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  }

  envContent = upsertEnvValue(
    envContent,
    "SWAP_EXECUTOR_CONTRACT_ADDRESS",
    contractAddress,
  );
  envContent = upsertEnvValue(
    envContent,
    "NEXT_PUBLIC_SWAP_EXECUTOR_ADDRESS",
    contractAddress,
  );

  fs.writeFileSync(envPath, envContent);
  console.log("Updated .env.local with SwapExecutor address");
  console.log(`   SWAP_EXECUTOR_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`   NEXT_PUBLIC_SWAP_EXECUTOR_ADDRESS=${contractAddress}\n`);

  const deploymentInfo = {
    name: "SwapExecutor",
    address: contractAddress,
    network: network.name,
    chainId: chainId.toString(),
    deployer: signerAddress,
    router: routerAddress,
    wbnb: wbnbAddress,
    treasury: treasuryAddress,
    deployedAt: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
  };

  const deploymentPath = path.join(
    process.cwd(),
    "deployments",
    `SwapExecutor-${chainId}.json`,
  );
  const deploymentsDir = path.dirname(deploymentPath);

  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info saved to: deployments/SwapExecutor-${chainId}.json`);
  console.log("Ready for real output-fee collection.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:");
    console.error(error);
    process.exit(1);
  });
