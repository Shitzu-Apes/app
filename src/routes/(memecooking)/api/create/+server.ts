import Pinata from "$lib/server/pinata";

export async function POST(e) {
  const form = await e.request.formData();
  const imageFile = form.get("imageFile") as File;
  const referenceContent = form.get("reference") as string;

  const { IpfsHash: imageCID } = await Pinata.pinFileToIPFS(imageFile);

  const reference = { ...JSON.parse(referenceContent), image: imageCID };
  const { IpfsHash: referenceCID } = await Pinata.pinJSONToIPFS(reference);

  return new Response(
    JSON.stringify({
      imageCID,
      referenceCID,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
