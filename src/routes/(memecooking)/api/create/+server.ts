export async function POST(e) {
  const form = await e.request.formData();

  const imageFile = form.get("imageFile") as File;

  const pinataForm = new FormData();
  pinataForm.append("file", imageFile);
  form.append("pinataOptions", '{\n  "cidVersion": 1\n}');
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}`,
    },
    body: pinataForm,
  });

  const json = await res.json();
  const { IpfsHash: imageCID } = json;

  const referenceContent = form.get("reference") as string;

  const reference = { ...JSON.parse(referenceContent), image: imageCID };

  const uploadReference = await fetch(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}`,
      },
      body: JSON.stringify(reference),
    },
  );

  const { IpfsHash: referenceCID } = await uploadReference.json();

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
