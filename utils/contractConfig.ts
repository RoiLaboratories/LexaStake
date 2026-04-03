import { ethers } from 'ethers';

const DEFAULT_BSC_RPC_URL = 'https://bsc-dataseed1.binance.org:443';

const RPC_ENV_NAMES = [
  'RPC_URL',
  'NEXT_PUBLIC_RPC_URL',
  'NEXT_PUBLIC_BSC_RPC_URL',
  'BSC_MAINNET_RPC_URL',
] as const;

const OWNER_PRIVATE_KEY_ENV_NAMES = [
  'REFERRAL_DISTRIBUTOR_PRIVATE_KEY',
  'CONTRACT_OWNER_PRIVATE_KEY',
  'PRIVATE_KEY',
] as const;

const FEE_COLLECTOR_PRIVATE_KEY_ENV_NAMES = [
  'FEE_COLLECTOR_OWNER_PRIVATE_KEY',
  'CONTRACT_OWNER_PRIVATE_KEY',
  'REFERRAL_DISTRIBUTOR_PRIVATE_KEY',
  'PRIVATE_KEY',
] as const;

const SWAP_REWARDS_ADDRESS_ENV_NAMES = [
  'SWAP_REWARDS_CONTRACT_ADDRESS',
  'NEXT_PUBLIC_SWAP_REWARDS_CONTRACT',
] as const;

const FEE_COLLECTOR_ADDRESS_ENV_NAMES = [
  'FEE_COLLECTOR_CONTRACT_ADDRESS',
  'NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS',
] as const;

type ResolvedSignerContractConfig =
  | {
      ok: true;
      contractAddress: string;
      privateKey: string;
      rpcUrl: string;
    }
  | {
      ok: false;
      error: string;
    };

type ResolvedReadOnlyContractConfig =
  | {
      ok: true;
      contractAddress: string;
      rpcUrl: string;
    }
  | {
      ok: false;
      error: string;
    };

function getFirstDefinedEnv(
  envNames: readonly string[],
): { value?: string; key?: string } {
  for (const envName of envNames) {
    const value = process.env[envName]?.trim();
    if (value) {
      return { value, key: envName };
    }
  }

  return {};
}

function formatEnvNames(envNames: readonly string[]): string {
  return envNames.join(', ');
}

function normalizePrivateKey(privateKey: string): string {
  return privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
}

function resolveRpcUrl(): string {
  return getFirstDefinedEnv(RPC_ENV_NAMES).value || DEFAULT_BSC_RPC_URL;
}

function resolveContractAddress(
  label: string,
  envNames: readonly string[],
): { ok: true; contractAddress: string } | { ok: false; error: string } {
  const { value: contractAddress, key } = getFirstDefinedEnv(envNames);

  if (!contractAddress) {
    return {
      ok: false,
      error: `${label} not configured. Set one of: ${formatEnvNames(envNames)}.`,
    };
  }

  if (!ethers.isAddress(contractAddress)) {
    return {
      ok: false,
      error: `${label} not configured. ${key} is not a valid address.`,
    };
  }

  return {
    ok: true,
    contractAddress,
  };
}

function resolveOwnerPrivateKey():
  | { ok: true; privateKey: string }
  | { ok: false; error: string } {
  const { value: rawPrivateKey, key } = getFirstDefinedEnv(
    OWNER_PRIVATE_KEY_ENV_NAMES,
  );

  if (!rawPrivateKey) {
    return {
      ok: false,
      error: `Owner private key not configured. Set one of: ${formatEnvNames(
        OWNER_PRIVATE_KEY_ENV_NAMES,
      )}.`,
    };
  }

  const privateKey = normalizePrivateKey(rawPrivateKey);

  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return {
      ok: false,
      error: `${key} must be a 32-byte hex private key.`,
    };
  }

  return {
    ok: true,
    privateKey,
  };
}

function resolveFeeCollectorOwnerPrivateKey():
  | { ok: true; privateKey: string }
  | { ok: false; error: string } {
  const { value: rawPrivateKey, key } = getFirstDefinedEnv(
    FEE_COLLECTOR_PRIVATE_KEY_ENV_NAMES,
  );

  if (!rawPrivateKey) {
    return {
      ok: false,
      error: `Fee Collector owner private key not configured. Set one of: ${formatEnvNames(
        FEE_COLLECTOR_PRIVATE_KEY_ENV_NAMES,
      )}.`,
    };
  }

  const privateKey = normalizePrivateKey(rawPrivateKey);

  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return {
      ok: false,
      error: `${key} must be a 32-byte hex private key.`,
    };
  }

  return {
    ok: true,
    privateKey,
  };
}

function resolveReadOnlyContractConfig(
  label: string,
  envNames: readonly string[],
): ResolvedReadOnlyContractConfig {
  const contract = resolveContractAddress(label, envNames);
  if (!contract.ok) {
    return contract;
  }

  return {
    ok: true,
    contractAddress: contract.contractAddress,
    rpcUrl: resolveRpcUrl(),
  };
}

function resolveSignerContractConfig(
  label: string,
  envNames: readonly string[],
): ResolvedSignerContractConfig {
  const contract = resolveContractAddress(label, envNames);
  if (!contract.ok) {
    return contract;
  }

  const ownerPrivateKey = resolveOwnerPrivateKey();
  if (!ownerPrivateKey.ok) {
    return ownerPrivateKey;
  }

  return {
    ok: true,
    contractAddress: contract.contractAddress,
    privateKey: ownerPrivateKey.privateKey,
    rpcUrl: resolveRpcUrl(),
  };
}

function resolveFeeCollectorSignerContractConfig(): ResolvedSignerContractConfig {
  const contract = resolveContractAddress(
    'Fee collector contract',
    FEE_COLLECTOR_ADDRESS_ENV_NAMES,
  );
  if (!contract.ok) {
    return contract;
  }

  const ownerPrivateKey = resolveFeeCollectorOwnerPrivateKey();
  if (!ownerPrivateKey.ok) {
    return ownerPrivateKey;
  }

  return {
    ok: true,
    contractAddress: contract.contractAddress,
    privateKey: ownerPrivateKey.privateKey,
    rpcUrl: resolveRpcUrl(),
  };
}

export function getSwapRewardsReadConfig(): ResolvedReadOnlyContractConfig {
  return resolveReadOnlyContractConfig(
    'Swap rewards contract',
    SWAP_REWARDS_ADDRESS_ENV_NAMES,
  );
}

export function getSwapRewardsSignerConfig(): ResolvedSignerContractConfig {
  return resolveSignerContractConfig(
    'Swap rewards contract',
    SWAP_REWARDS_ADDRESS_ENV_NAMES,
  );
}

export function getFeeCollectorSignerConfig(): ResolvedSignerContractConfig {
  return resolveFeeCollectorSignerContractConfig();
}
