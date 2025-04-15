import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { PineconeStore } from "@langchain/pinecone";
import { pincone } from "@/lib/pinecone";

const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({
    pdf: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const { getUser } = getKindeServerSession();
      const user = await getUser();

      if (!user || !user.id) throw new Error("unauthorized");
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const createdFile = await db.file.create({
        data: {
          key: file.key,
          name: file.name,
          userId: metadata.userId,
          url: file.ufsUrl,
          uploadStatus: "PROCESSING",
        },
      });
      try {
        const response = await fetch(file.ufsUrl);
        const blob = await response.blob();
        const loader = new PDFLoader(blob);

        const pageLevelDocs = await loader.load();

        // const pagesAmt = pageLevelDocs.length;

        //vectorize and index entire document

        const pineconeIndex = pincone.Index("quill");

        const embeddings = new HuggingFaceTransformersEmbeddings({
          model: "BAAI/bge-large-en-v1.5",
        });

        await PineconeStore.fromDocuments(pageLevelDocs, embeddings, {
          pineconeIndex,
          namespace: createdFile.id,
        });

        await db.file.update({
          data: {
            uploadStatus: "SUCCESS",
          },
          where: {
            id: createdFile.id,
          },
        });
      } catch (err) {
        console.log(
          "sfsfsgdgdg",
          err,
          "---------------------------------er-------------------"
        );
        await db.file.update({
          data: {
            uploadStatus: "FAILED",
          },
          where: {
            id: createdFile.id,
          },
        });
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
