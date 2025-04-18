import { Send } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { useContext, useRef } from "react";
import { ChatContext } from "./ChatContext";

interface ChatInputProps {
  isDisabled?: boolean;
}

const ChatInput = ({ isDisabled }: ChatInputProps) => {
  const { addMessage, handleInputChange, isLoading, message } =
    useContext(ChatContext);

  const textarealRef = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="absolute bottom-0 left-0 w-full">
      <div className="relative flex h-full flex-1 items-stretch md:flex-col">
        <div className="relative flex flex-col w-full flex-grow p-4">
          <div className="relative">
            <Textarea
              rows={1}
              ref={textarealRef}
              onChange={handleInputChange}
              value={message}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addMessage();

                  textarealRef.current?.focus();
                }
              }}
              placeholder="Enter your question..."
              className="resize-none pr-12 text-base py-3 scrollbar-thumb-blue scrollbar-thumb-rounded scrollbar-track-blue-lighter scrollbar-w-2 scrolling-touch"
            />
            <Button
              disabled={isLoading || isDisabled}
              onClick={() => {
                addMessage();

                textarealRef.current?.focus();
              }}
              className="absolute bottom-1.5 right-[8px]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
