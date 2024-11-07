import { json } from "@sveltejs/kit";
import { z } from "zod";

import {
  VITE_MEME_COOKING_CONTRACT_ID,
  ENDPOINT_SECRET,
} from "$env/static/private";
import { createMemeToken } from "$lib/server/createMemeToken.js";
import { uploadToIPFS } from "$lib/server/uploadToIPFS.js";
import { calculateReferenceHash } from "$lib/util/cid.js";

const CONTRACT_ID = VITE_MEME_COOKING_CONTRACT_ID;

const teamAllocationSchema = z.object({
  allocationBps: z.number(),
  vestingDurationMs: z.number(),
  cliffDurationMs: z.number(),
});

const referenceSchema = z.object({
  description: z.string(),
  twitterLink: z.string().optional().default(""),
  telegramLink: z.string().optional().default(""),
  website: z.string().optional().default(""),
  image: z.string().optional(),
});

const createTokenSchema = z.object({
  name: z.string().min(1),
  symbol: z.string().min(1),
  decimals: z.number().int().min(0),
  durationMs: z.string(),
  totalSupply: z.string(),
  icon: z.string(),
  softCap: z.string(),
  hardCap: z.string().optional(),
  teamAllocation: teamAllocationSchema.optional(),
  reference: referenceSchema.optional(),
});

async function validateAuthHeader(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing authorization header");
  }

  const token = authHeader.split(" ")[1];
  console.log("Token:", token, ENDPOINT_SECRET);
  if (token !== ENDPOINT_SECRET) {
    throw new Error("Invalid authorization token");
  }
}

async function parseAndValidateFormData(formData: FormData) {
  const rawData = {
    name: formData.get("name"),
    symbol: formData.get("symbol"),
    decimals: parseInt(formData.get("decimals") as string),
    durationMs: formData.get("durationMs"),
    totalSupply: formData.get("totalSupply"),
    icon: formData.get("icon"),
    softCap: formData.get("softCap"),
    hardCap: formData.get("hardCap") || undefined,
    teamAllocation: formData.get("teamAllocation")
      ? JSON.parse(formData.get("teamAllocation") as string)
      : undefined,
    reference: formData.get("reference")
      ? JSON.parse(formData.get("reference") as string)
      : {
          description: "",
          twitterLink: "",
          telegramLink: "",
          website: "",
        },
  };

  return createTokenSchema.parse(rawData);
}

export async function POST({ request }) {
  try {
    await validateAuthHeader(request);
    const formData = await request.formData();
    const validatedData = await parseAndValidateFormData(formData);

    const compressedImage = await fetch("https://image.meme.cooking", {
      method: "POST",
      body: JSON.stringify({
        image: validatedData.icon,
      }),
    }).then((res) => res.text());
    const imageFile = compressedImage
      ? await (async () => {
          const base64Data = compressedImage;
          const byteString = atob(base64Data.split(",")[1]);
          const mimeType = base64Data.split(",")[0].split(":")[1].split(";")[0];

          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }

          return new File([ab], "icon", { type: mimeType });
        })()
      : null;

    const { referenceCID, imageCID } = await uploadToIPFS({
      imageFile,
      imageCID: null,
      referenceContent: JSON.stringify({
        ...validatedData.reference,
        image: "",
      }),
    });

    const referenceHash = await calculateReferenceHash(
      JSON.stringify({
        ...validatedData.reference,
        image: imageCID,
      }),
    );

    // Resize icon to 96x96
    const icon = await fetch("https://image.meme.cooking", {
      method: "POST",
      body: JSON.stringify({
        image: validatedData.icon,
        width: 96,
        height: 96,
      }),
    }).then((res) => res.text());

    const result = await createMemeToken(CONTRACT_ID, {
      ...validatedData,
      icon,
      referenceCID,
      referenceHash,
    });

    return json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Error creating token:", error);
    if (error instanceof z.ZodError) {
      return json({ success: false, error: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("authorization")) {
      return json({ success: false, error: error.message }, { status: 401 });
    }
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
