import { uploadToIPFS } from "$lib/server/uploadToIPFS";

export async function POST(e) {
  try {
    const form = await e.request.formData();
    const imageFile = form.get("imageFile") as File | null;
    const imageCID = form.get("imageCID") as string | null;
    const referenceContent = form.get("reference") as string;

    const result = await uploadToIPFS({
      imageFile,
      imageCID,
      referenceContent,
    });

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        status: 400,
      },
    );
  }
}
