import {
  LAMPORTS_PER_SOL,
  type Connection,
  type PublicKey,
} from "@solana/web3.js";

/** Native SOL balance in lamports, or 0 for an account that does not exist. */
export async function getSolBalance(
  connection: Connection,
  owner: PublicKey,
): Promise<bigint> {
  const lamports = await connection.getBalance(owner, undefined);
  return BigInt(lamports);
}

export function toSol(lamports: bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

export function fromSol(sol: number): bigint {
  return BigInt(Math.round(sol * LAMPORTS_PER_SOL));
}
