export async function GET(e) {
  // Receive CID and return image
  const { cid } = e.params;
  const image = await getImageFromIPFS(cid);
  return new Response(image);
}

function getImageFromIPFS(cid: string) {
  return fetch(`${import.meta.env.VITE_IPFS_GATEWAY}/${cid}`).then((res) =>
    res.blob(),
  );
}
