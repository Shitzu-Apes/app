const JWT = import.meta.env.VITE_PINATA_JWT;

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
        Authorization: `Bearer ${JWT}`,
      },
      body: pinataForm,
    });

    const json = await res.json();
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
        Authorization: `Bearer ${JWT}`,
      },
      body: JSON.stringify(json),
    });

    const jsonRes = await res.json();
    return jsonRes;
  }
}
