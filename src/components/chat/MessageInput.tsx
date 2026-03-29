"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, X, Loader2, ImageIcon, FileIcon } from "lucide-react";
import { useSocket } from "@/components/providers/SocketProvider";
import { toast } from "sonner";
import { MessageData } from "@/types";
import { ReplyPreview } from "./ReplyPreview";

const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const MAX_SIZE = 80 * 1024 * 1024; // 80MB

interface MessageInputProps {
  onSend: (data: {
    content: string;
    messageType?: "text" | "file" | "image";
    attachment?: {
      url: string;
      filename: string;
      mimeType: string;
      size: number;
    };
    replyToMessageId?: string;
  }) => void;
  conversationId: string;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  replyingTo?: MessageData | null;
  onCancelReply?: () => void;
}

export function MessageInput({ onSend, onTypingStart, onTypingStop, replyingTo, onCancelReply }: MessageInputProps) {
  const { isConnected } = useSocket();
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTyping = useCallback(() => {
    onTypingStart?.();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop?.();
    }, 2000);
  }, [onTypingStart, onTypingStop]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      // File type not allowed
      toast.error("Тип файла не поддерживается. Допустимые: PDF, TXT, PNG, JPG, DOC, DOCX, XLS, XLSX");
      return;
    }

    if (file.size > MAX_SIZE) {
      // File too large
      toast.error("Файл слишком большой. Максимальный размер — 80 МБ.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка загрузки"); // Upload failed
      }

      const data = await res.json();
      setPendingFile(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить файл"); // Failed to upload file
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = () => {
    const text = message.trim();
    if (!text && !pendingFile) return;

    if (pendingFile) {
      const isImage = pendingFile.mimeType.startsWith("image/");
      onSend({
        content: text,
        messageType: isImage ? "image" : "file",
        attachment: pendingFile,
        replyToMessageId: replyingTo?._id,
      });
      setPendingFile(null);
    } else {
      onSend({ content: text, messageType: "text", replyToMessageId: replyingTo?._id });
    }

    setMessage("");
    onCancelReply?.();
    onTypingStop?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isImage = pendingFile?.mimeType.startsWith("image/");

  return (
    <div className="border-t bg-background px-4 py-3 shrink-0">
      {/* Reply preview */}
      {replyingTo && (
        <div className="mb-2">
          <ReplyPreview message={replyingTo} onCancel={() => onCancelReply?.()} />
        </div>
      )}

      {/* Pending file preview */}
      {pendingFile && (
        <div className="mb-2 flex items-center gap-2 p-2 rounded-lg bg-muted">
          <div className="w-8 h-8 rounded flex items-center justify-center bg-primary/10">
            {isImage ? (
              <ImageIcon className="h-4 w-4 text-primary" />
            ) : (
              <FileIcon className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{pendingFile.filename}</p>
            <p className="text-[10px] text-muted-foreground">
              {(pendingFile.size / 1024).toFixed(0)} КБ
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setPendingFile(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.txt,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
          onChange={handleFileSelect}
        />

        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !isConnected}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>

        <Textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            handleTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? "Введите сообщение..." : "Подключение..."} // Type a message... / Connecting...
          disabled={!isConnected}
          rows={1}
          className="min-h-[36px] max-h-[120px] resize-none text-sm py-2"
        />

        <Button
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
          onClick={handleSend}
          disabled={(!message.trim() && !pendingFile) || !isConnected}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
