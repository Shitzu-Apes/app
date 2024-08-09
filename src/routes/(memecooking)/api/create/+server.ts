import Pinata from "$lib/server/pinata";

export async function POST(e) {
  const form = await e.request.formData();
  const imageFile = form.get("imageFile") as File | null;
  let imageCID = form.get("imageCID") as string | null;
  const referenceContent = form.get("reference") as string;

  // ensure that at least one of the imageCID or imageFile is provided
  if (!imageCID && !imageFile) {
    return new Response(
      JSON.stringify({
        error: "At least one of imageCID or imageFile is required",
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  if (!imageCID && imageFile) {
    const { IpfsHash } = await Pinata.pinFileToIPFS(imageFile);
    imageCID = IpfsHash;
  }

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
