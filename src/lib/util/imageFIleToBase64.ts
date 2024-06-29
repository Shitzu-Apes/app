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
