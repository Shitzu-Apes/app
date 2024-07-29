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

const UploadResizeWidth = 64;
const UploadResizeHeight = 64;

export async function imageFileToIcon(imageFile: File): Promise<string> {
  const base64Image = await imageFileToBase64(imageFile);
  return base64ToIcon(base64Image);
}

export function base64ToIcon(base64Image: string): Promise<string> {
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
