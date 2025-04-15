import { trpc } from "@/app/_trpc/client";
import { INFINITE_QUERY_LIMIT } from "@/config/infinite-query";
import { useMutation } from "@tanstack/react-query";
import { createContext, ReactNode, useRef, useState } from "react";

type StreamResponse = {
  addMessage: () => void;
  message: string;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
};
export const ChatContext = createContext<StreamResponse>({
  addMessage: () => {},
  message: "",
  handleInputChange: () => {},
  isLoading: false,
});

interface Props {
  fileId: string;
  children: ReactNode;
}
export const ChatContextProvider = ({ fileId, children }: Props) => {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  //optimistic updates
  const utils = trpc.useUtils();

  const backupMessage = useRef("");

  const { mutate: sendMessage } = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      const response = await fetch("/api/message", {
        method: "POST",
        body: JSON.stringify({
          fileId,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      return response.body;
    },
    onMutate: async ({ message }) => {
      backupMessage.current = message;
      setMessage("");

      //step: 1 - cancle outgoing upadtes so don't overwrite
      await utils.getFileMessages.cancel();

      //step 2 - snapshot the value we previously have
      const previousMessages = utils.getFileMessages.getInfiniteData();

      //step 3 - add new message right away as we send it
      utils.getFileMessages.setInfiniteData(
        { fileId, limit: INFINITE_QUERY_LIMIT },
        (old) => {
          if (!old) {
            return {
              pages: [],
              pageParams: [],
            };
          }
          const newPages = [...old.pages];

          const latestPage = newPages[0]!;

          latestPage.messages = [
            {
              createdAt: new Date().toISOString(),
              id: crypto.randomUUID(),
              text: message,
              isUserMessage: true,
            },
            ...latestPage.messages,
          ];

          newPages[0] = latestPage;

          return {
            ...old,
            pages: newPages,
          };
        }
      );
      setIsLoading(true);

      return {
        previousMessages:
          previousMessages?.pages.flatMap((page) => page.messages) ?? [],
      };
    },
    onError: (_, __, context) => {
      setMessage(backupMessage.current);
      utils.getFileMessages.setData(
        { fileId },
        { messages: context?.previousMessages ?? [] }
      );
    },
    onSettled: async () => {
      setIsLoading(false);

      await utils.getFileMessages.invalidate({ fileId });
    },
    // onSuccess: async (stream) => {
    //   console.log(stream, " stream");
    //   setIsLoading(false);

    //   if (!stream) {
    //     return toast.error("There was a problem sending this message");
    //   }

    //   const reader = stream.getReader();
    //   const decoder = new TextDecoder();
    //   let done = false;

    //   //accumulated response
    //   let accResponse = "";

    //   while (!done) {
    //     const { value, done: doneReading } = await reader.read();
    //     done = doneReading;
    //     const chunkValue = decoder.decode(value);

    //     accResponse += chunkValue;

    //     // append chunk to the actual message
    //     utils.getFileMessages.setInfiniteData(
    //       { fileId, limit: INFINITE_QUERY_LIMIT },
    //       (old) => {
    //         console.log(old, "swdeswfe");
    //         if (!old) return { pages: [], pageParams: [] };

    //         let isAiResponseCreate = old.pages.some((page) =>
    //           page.messages.some((message) => message.id === "ai-response")
    //         );

    //         let updatedPages = old.pages.map((page) => {
    //           if (page === old.pages[0]) {
    //             let updatedMessage;

    //             if (!isAiResponseCreate) {
    //               updatedMessage = [
    //                 {
    //                   createdAt: new Date().toISOString(),
    //                   id: "ai-response",
    //                   text: accResponse,
    //                   isUserMessage: false,
    //                 },
    //                 ...page.messages,
    //               ];
    //             } else {
    //               updatedMessage = page.messages.map((message) => {
    //                 if (message.id === "ai-response") {
    //                   return {
    //                     ...message,
    //                     text: accResponse,
    //                   };
    //                 }
    //                 return message;
    //               });
    //             }
    //             return {
    //               ...page,
    //               messages: updatedMessage,
    //             };
    //           }
    //           return page;
    //         });
    //         return {
    //           ...old,
    //           pages: updatedPages,
    //         };
    //       }
    //     );
    //   }
    // },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const addMessage = () => sendMessage({ message });

  return (
    <ChatContext.Provider
      value={{ addMessage, message, handleInputChange, isLoading }}
    >
      {children}
    </ChatContext.Provider>
  );
};
