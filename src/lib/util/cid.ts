import { CID } from "multiformats/cid";
import * as json from "multiformats/codecs/json";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";

async function calculateFileCID(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const hash = await sha256.digest(bytes);
  const cid = CID.create(1, raw.code, hash);
  return cid.toString();
}

//reference_hash: the base64-encoded sha256 hash of the JSON file contained in the reference field. This is to guard against off-chain tampering.
export async function calculateReferenceHash(
  reference: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(reference);
  const hash = await sha256.digest(bytes);

  const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hash.bytes)));
  return hashBase64;
}

async function calculateJsonCID(jsonData: object): Promise<[string, string]> {
  const bytes = json.encode(jsonData);
  const hash = await sha256.digest(bytes);

  const cid = CID.create(1, json.code, hash);

  // Convert from Digest<18, number> to base64 string on the client
  const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hash.bytes)));
  return [hashBase64, cid.toString()];
}

export async function getReferenceCid({
  imageFile,
  description,
  twitterLink,
  telegramLink,
  website,
}: {
  imageFile: File;
  description: string;
  twitterLink: string;
  telegramLink: string;
  website: string;
}): Promise<[string, string]> {
  const image = await calculateFileCID(imageFile);

  const data = {
    image,
    description,
    twitterLink,
    telegramLink,
    website,
  };

  console.log("[getReferenceCid]: data", data);

  return await calculateJsonCID(data);
}
