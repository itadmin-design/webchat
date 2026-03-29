"use client";

import { MessageData } from "@/types";
import { X, ImageIcon, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReplyPreviewProps {
  message: MessageData;
  onCancel: () => void;
}

export function ReplyPreview({ message, onCancel }: ReplyPreviewProps) {
  const previewText =
    message.messageType === "image"
      ? "Фото"
      : message.messageType === "file"
        ? message.attachment?.filename || "Файл"
        : message.content.substring(0, 100);

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted border-l-2 border-primary">
      {(message.messageType === "image" || message.messageType === "file") && (
        <div className="w-6 h-6 rounded flex items-center justify-center bg-primary/10 shrink-0">
          {message.messageType === "image" ? (
            <ImageIcon className="h-3 w-3 text-primary" />
          ) : (
            <FileIcon className="h-3 w-3 text-primary" />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary truncate">
          {message.senderName || "Unknown"}
        </p>
        <p className="text-xs text-muted-foreground truncate">{previewText}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 shrink-0"
        onClick={onCancel}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
