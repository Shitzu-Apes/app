export async function POST(e) {
  // get the transaction hash and image file from the request body

  // convert from ReadableStream to Blob
  // const blob = await e.request.blob();

  // console.log("[/api/create/+server.ts] blob:", blob);

  // const file = new File([blob], "image.png");
  // const data = new FormData();
  // data.append("file", file);

  const form = await e.request.formData();

  // const buffer = await blob.arrayBuffer();

  console.log("[/api/create/+server.ts] form:", form);

  const imageFile = form.get("imageFile") as File;

  console.log("[/api/create/+server.ts] imageFile:", imageFile, imageFile.type);

  const pinataForm = new FormData();
  pinataForm.append("file", imageFile);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}`,
    },
    body: pinataForm,
  });

  const json = await res.json();
  console.log("[/api/create/+server.ts] json:", json);

  return new Response(JSON.stringify({}), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
