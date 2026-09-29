import { Sha256 } from "@aws-crypto/sha256-browser";

//reference_hash: the base64-encoded sha256 hash of the JSON file contained in the reference field. This is to guard against off-chain tampering.
export async function calculateReferenceHash(
  reference: string,
): Promise<string> {
  const hash = new Sha256();

  hash.update(reference);
  const digest = await hash.digest();
  return btoa(String.fromCharCode(...digest));
}
