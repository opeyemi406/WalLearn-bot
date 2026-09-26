import { walrus } from "../src/walrus/client.js";

async function main() {
  const signRequest = (walrus as any).signRequest.bind(walrus);
  const path = "/api/remember/caa9b82e-b3b8-45a6-a75b-29c33fa21b5a";
  const headers = await signRequest("GET", path, "");
  const res = await fetch(`https://relayer.memory.walrus.xyz${path}`, {
    method: "GET",
    headers,
  });
  console.log("Status:", res.status);
  console.log("Body:", await res.json());
}

main().catch(console.error);
