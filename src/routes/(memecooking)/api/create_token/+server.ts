// eslint-disable-next-line import/order
import fetch from "node-fetch";
if (globalThis.fetch === undefined) {
  // @ts-expect-error fetch is not defined in the browser
  globalThis.fetch = fetch;
}
import * as avif from "@jsquash/avif";
import * as jpeg from "@jsquash/jpeg";
import * as jxl from "@jsquash/jxl";
import * as png from "@jsquash/png";
import resize from "@jsquash/resize";
import * as webp from "@jsquash/webp";
import { json } from "@sveltejs/kit";
import { z } from "zod";

import {
  VITE_NETWORK_ID,
  VITE_NODE_URL,
  VITE_MEME_COOKING_CONTRACT_ID,
  PRIVATE_KEY,
  ENDPOINT_SECRET,
  ACCOUNT_ID,
} from "$env/static/private";
// import { createMemeToken } from "$lib/server/createMemeToken.js";
// import { uploadToIPFS } from "$lib/server/uploadToIPFS.js";
// import { calculateReferenceHash } from "$lib/util/cid.js";

const UploadResizeWidth = 96;
const UploadResizeHeight = 96;
const NETWORK_ID = VITE_NETWORK_ID;
const NODE_URL = VITE_NODE_URL;
const WALLET_PRIVATE_KEY = PRIVATE_KEY;
const CONTRACT_ID = VITE_MEME_COOKING_CONTRACT_ID;

console.log({
  NETWORK_ID,
  NODE_URL,
  WALLET_PRIVATE_KEY,
  CONTRACT_ID,
  ENDPOINT_SECRET,
  ACCOUNT_ID,
});

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
async function resizeIconWithSharp(base64Icon: string): Promise<string> {
  // Remove data URL prefix to get raw base64
  const base64Data = base64Icon.replace(/^data:image\/\w+;base64,/, "");

  const imageBuffer = Buffer.from(base64Data, "base64");

  console.log("imageBuffer", base64Icon.slice(0, 100));
  let sourceType: "avif" | "jpeg" | "jxl" | "png" | "webp";
  if (base64Icon.includes("image/png")) {
    sourceType = "png";
  } else if (base64Icon.includes("image/jpeg")) {
    sourceType = "jpeg";
  } else if (base64Icon.includes("image/webp")) {
    sourceType = "webp";
  } else if (base64Icon.includes("image/avif")) {
    sourceType = "avif";
  } else if (base64Icon.includes("image/jxl")) {
    sourceType = "jxl";
  } else {
    throw new Error("Unsupported image format");
  }

  const decodedImage = await decode(sourceType, new Uint8Array(imageBuffer));

  const resizedImage = await resize(decodedImage, {
    width: UploadResizeWidth,
    height: UploadResizeHeight,
  });

  const encodedImage = await encode("webp", resizedImage);

  const blob = new Blob([encodedImage], { type: "image/png" });
  const base64 = (await blobToBase64(blob)) as string;

  return base64;
}

export async function POST({ request }) {
  try {
    await validateAuthHeader(request);
    const formData = await request.formData();
    const validatedData = await parseAndValidateFormData(formData);

    // Resize icon to 96x96 using sharp
    const resizedIcon = validatedData.icon
      ? await resizeIconWithSharp(validatedData.icon)
      : null;

    const imageFile = resizedIcon
      ? await (async () => {
          const base64Data = resizedIcon;
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

    console.log("imageFile", imageFile);
    const result = null;
    console.log("result", result);

    // const { referenceCID, imageCID } = await uploadToIPFS({
    //   imageFile,
    //   imageCID: null,
    //   referenceContent: JSON.stringify({
    //     ...validatedData.reference,
    //     image: "",
    //   }),
    // });

    // const referenceHash = await calculateReferenceHash(
    //   JSON.stringify({
    //     ...validatedData.reference,
    //     image: imageCID,
    //   }),
    // );

    // const result = await createMemeToken(CONTRACT_ID, {
    //   ...validatedData,
    //   icon: resizedIcon || validatedData.icon,
    //   referenceCID,
    //   referenceHash,
    // });

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

async function decode(
  sourceType: "avif" | "jpeg" | "jxl" | "png" | "webp",
  fileBuffer: Uint8Array,
) {
  let result;
  switch (sourceType) {
    case "avif":
      result = await avif.decode(fileBuffer);
      break;
    case "jpeg":
      result = await jpeg.decode(fileBuffer);
      break;
    case "jxl":
      result = await jxl.decode(fileBuffer);
      break;
    case "png":
      result = await png.decode(fileBuffer);
      break;
    case "webp":
      result = await webp.decode(fileBuffer);
      break;
    default:
      throw new Error(`Unknown source type: ${sourceType}`);
  }
  return result;
}

async function encode(
  outputType: "avif" | "jpeg" | "jxl" | "png" | "webp",
  imageData: ImageData,
) {
  let result;
  switch (outputType) {
    case "avif":
      result = await avif.encode(imageData);
      break;
    case "jpeg":
      result = await jpeg.encode(imageData);
      break;
    case "jxl":
      result = await jxl.encode(imageData);
      break;
    case "png":
      result = await png.encode(imageData);
      break;
    case "webp":
      result = await webp.encode(imageData, {
        quality: 0.85,
      });
      break;
    default:
      throw new Error(`Unknown output type: ${outputType}`);
  }
  return result;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(blob);
  });
}
