import Pinata from "$lib/server/pinata";

export async function uploadToIPFS({
  imageFile,
  imageCID,
  referenceContent,
}: {
  imageFile: File | null;
  imageCID: string | null;
  referenceContent: string;
}) {
  console.log("[uploadToIPFS]: Starting upload with params:", {
    imageFile,
    imageCID,
    referenceContent,
  });

  // ensure that at least one of the imageCID or imageFile is provided
  if (!imageCID && !imageFile) {
    console.log("[uploadToIPFS]: No image source provided");
    throw new Error("At least one of imageCID or imageFile is required");
  }

  if (!imageCID && imageFile) {
    console.log("[uploadToIPFS]: Uploading image file to IPFS");
    const { IpfsHash } = await Pinata.pinFileToIPFS(imageFile);
    imageCID = IpfsHash;
    console.log("[uploadToIPFS]: Image uploaded with CID:", imageCID);
  }

  console.log("[uploadToIPFS]: Creating reference with image CID:", imageCID);
  const reference = { ...JSON.parse(referenceContent), image: imageCID };
  console.log("[uploadToIPFS]: Uploading reference to IPFS:", reference);
  const { IpfsHash: referenceCID } = await Pinata.pinJSONToIPFS(reference);
  console.log("[uploadToIPFS]: Reference uploaded with CID:", referenceCID);

  console.log("[uploadToIPFS]: Upload complete", { imageCID, referenceCID });
  return {
    imageCID,
    referenceCID,
  };
}
