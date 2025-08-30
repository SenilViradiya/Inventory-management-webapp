import "dotenv/config";
import { BlobServiceClient } from "@azure/storage-blob";
import fs from "fs";

const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;

async function run() {
  if (!connStr) {
    throw new Error("❌ Missing AZURE_STORAGE_CONNECTION_STRING");
  }
  const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
  const containerClient = blobServiceClient.getContainerClient("inventoryfiles");

  const blockBlobClient = containerClient.getBlockBlobClient("test.png");
  await blockBlobClient.uploadFile("./image.png");

  console.log("✅ Uploaded successfully");
}

run().catch(console.error);