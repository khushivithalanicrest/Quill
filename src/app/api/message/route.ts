import { db } from "@/db";
import { pincone } from "@/lib/pinecone";
import { SendMessageValidator } from "@/lib/SendMessageValidator";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { PineconeStore } from "@langchain/pinecone";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  //endpoint for asking a questions to a pdf file

  const body = await req.json();

  const { getUser } = getKindeServerSession();
  const user = await getUser();

  const { id: userId } = user;

  if (!userId) return new Response("Unathorized", { status: 401 });

  const { fileId, message } = SendMessageValidator.parse(body);

  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId,
    },
  });

  if (!file) return new Response("Not found", { status: 404 });

  await db.message.create({
    data: {
      text: message,
      isUserMessage: true,
      userId,
      fileId,
    },
  });

  //1. vectorize message

  const embeddings = new HuggingFaceTransformersEmbeddings({
    model: "BAAI/bge-large-en-v1.5",
  });

  const pineconeIndex = pincone.Index("quill");

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    namespace: file.id,
  });

  const results = await vectorStore.similaritySearch(message, 4);

  const prevMessages = await db.message.findMany({
    where: {
      fileId,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 6,
  });

  const formattedPrevMessages = prevMessages.map((msg) => ({
    role: msg.isUserMessage ? "user" : "assistant",
    content: msg.text,
  }));

  // Construct context & prompt
  const conversation = formattedPrevMessages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const contextText = results.map((r) => r.pageContent).join("\n\n");

  const prompt = `Use the following pieces of context (or previous conversation if needed) to answer the user's question in markdown format. If you don't know the answer, just say that you don't know — don't make anything up.
  
  ----------------
  
  PREVIOUS CONVERSATION:
  ${conversation}
  
  ----------------
  
  CONTEXT:
  ${contextText}
  
  USER INPUT: ${message}
  
  Answer:`;

  // Send to Hugging Face model (like Mistral)
  // const prompts =
  //   "Answer the following question: What is the capital of France?";
  const response = await fetch(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          temperature: 0.7,
          max_new_tokens: 300,
          return_full_text: false,
        },
      }),
    }
  );

  const data = await response.json();
  console.log(data, "dadadadadada");

  const generatedText =
    data?.[0]?.generated_text ?? "Sorry, I couldn't generate a response.";

  // Save it to the DB
  await db.message.create({
    data: {
      text: generatedText,
      isUserMessage: false,
      userId,
      fileId,
    },
  });

  // Return it to frontend (non-streaming)
  return Response.json({ answer: generatedText });
};
