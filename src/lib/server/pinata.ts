import { PINATA_JWT } from "$env/static/private";

export default abstract class Pinata {
  static async pinFileToIPFS(file: File): Promise<{
    IpfsHash: string;
    PinSize: number;
    Timestamp: string;
  }> {
    const pinataForm = new FormData();
    pinataForm.append("file", file);
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: pinataForm,
    });

    const json = await res.json();
    if (
      json.error &&
      json.error.details &&
      typeof json.error.details === "string"
    ) {
      throw new Error(json.error.details);
    }
    return json;
  }

  static async pinJSONToIPFS(json: Record<string, unknown>): Promise<{
    IpfsHash: string;
    PinSize: number;
    Timestamp: string;
  }> {
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify(json),
    });

    const jsonRes = await res.json();
    if (
      jsonRes.error &&
      jsonRes.error.details &&
      typeof jsonRes.error.details === "string"
    ) {
      throw new Error(jsonRes.error.details);
    }
    return jsonRes;
  }
}
