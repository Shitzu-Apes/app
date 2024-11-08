import * as avif from "@jsquash/avif";
import * as jpeg from "@jsquash/jpeg";
import * as jxl from "@jsquash/jxl";
import * as png from "@jsquash/png";
import resize from "@jsquash/resize";
import * as webp from "@jsquash/webp";

export async function imageUrlToBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return blobToBase64(blob);
}

export function imageFileToBase64(imageFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result !== "string") {
        return reject();
      }
      resolve(e.target.result);
    };
    reader.readAsDataURL(imageFile);
  });
}

const UploadResizeWidth = 96;
const UploadResizeHeight = 96;

export async function imageFileToIcon(imageFile: File): Promise<string> {
  let base64Image = await imageFileToBase64(imageFile);
  if (imageFile.type === "image/gif") {
    base64Image = await base64ToPng(base64Image);
  }
  try {
    const icon = await base64ToIcon(base64Image);
    console.log("imageFileToIcon", icon);
    return icon;
  } catch (e) {
    console.error(e);
    return await base64ToPng(base64Image);
  }
}

export function base64ToPng(base64Image: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = base64Image;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const aspect = image.naturalWidth / image.naturalHeight;
      const width = Math.round(UploadResizeWidth * Math.max(1, aspect));
      const height = Math.round(UploadResizeHeight * Math.max(1, 1 / aspect));
      canvas.width = UploadResizeWidth;
      canvas.height = UploadResizeHeight;
      const ctx = canvas.getContext("2d")!;

      // Scale and draw the source image to the canvas
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, UploadResizeWidth, UploadResizeHeight);
      ctx.drawImage(
        image,
        (UploadResizeWidth - width) / 2,
        (UploadResizeHeight - height) / 2,
        width,
        height,
      );

      // Convert the canvas to a data URL in PNG format
      const options = [
        canvas.toDataURL("image/jpeg", 0.92),
        canvas.toDataURL("image/png"),
      ];
      options.sort((a, b) => a.length - b.length);
      resolve(canvas.toDataURL("image/png"));
    };

    image.onerror = reject;
  });
}

export async function base64ToIcon(base64Image: string): Promise<string> {
  const response = await fetch(base64Image);
  const arrayBuffer = await response.arrayBuffer();

  let sourceType: "avif" | "jpeg" | "jxl" | "png" | "webp";
  if (base64Image.includes("image/png")) {
    sourceType = "png";
  } else if (base64Image.includes("image/jpeg")) {
    sourceType = "jpeg";
  } else if (base64Image.includes("image/webp")) {
    sourceType = "webp";
  } else if (base64Image.includes("image/avif")) {
    sourceType = "avif";
  } else if (base64Image.includes("image/jxl")) {
    sourceType = "jxl";
  } else {
    throw new Error("Unsupported image format");
  }

  const decodedImage = await decode(sourceType, new Uint8Array(arrayBuffer));

  const resizedImage = await resize(decodedImage, {
    width: UploadResizeWidth,
    height: UploadResizeHeight,
    fitMethod: "contain",
  });

  const encodedImage = await encode("webp", resizedImage);

  const blob = new Blob([encodedImage], { type: "image/png" });
  const base64 = (await blobToBase64(blob)) as string;

  return base64;
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
