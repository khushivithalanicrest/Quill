import { Pinecone } from "@pinecone-database/pinecone";

export const pincone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});
