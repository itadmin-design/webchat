"use client";

import { useState, useRef, useCallback } from "react";
import { MessageData } from "@/types";
import { format } from "date-fns";
import { FileIcon, Download, Check, CheckCheck, Reply, Copy } from "lucide-react";
import { motion, useAnimation, PanInfo } from "framer-motion";
import Image from "next/image";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface MessageBubbleProps {
  message: MessageData;
  isOwn: boolean;
  onReply?: (message: MessageData) => void;
  onScrollToMessage?: (messageId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const SWIPE_THRESHOLD = 60;

export function MessageBubble({ message, isOwn, onReply, onScrollToMessage }: MessageBubbleProps) {
  const time = format(new Date(message.createdAt), "HH:mm");
  const isRead = isOwn
    ? message.readByAdmin && message.readByUser
    : true;
  const isMobile = useIsMobile();
  const controls = useAnimation();
  const [showReplyIcon, setShowReplyIcon] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
      onReply?.(message);
    }
    controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
    setShowReplyIcon(false);
  };

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setShowReplyIcon(Math.abs(info.offset.x) > 20);
  };

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pointerStart.current = null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isMobile) return;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      setMenuOpen(true);
      longPressTimer.current = null;
    }, 700);
  }, [isMobile]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearLongPress();
    }
  }, [clearLongPress]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isMobile) {
      e.preventDefault();
      setMenuOpen(true);
    }
  }, [isMobile]);

  const handleCopy = useCallback(() => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      toast.success("Скопировано");
    }
  }, [message.content]);

  return (
    <>
    {/* Backdrop blur overlay when menu is open */}
    {menuOpen && (
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs"
        onClick={() => setMenuOpen(false)}
      />
    )}
    <div
      id={`msg-${message._id}`}
      className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-1 transition-colors duration-500 ${menuOpen ? "relative z-50" : ""}`}
    >
      {/* Swipe reply icon indicator */}
      {showReplyIcon && (
        <div className={`absolute top-1/2 -translate-y-1/2 ${isOwn ? "left-2" : "right-2"} text-muted-foreground pointer-events-none`}>
          <Reply className="h-4 w-4" />
        </div>
      )}

      <div className="flex items-center gap-1 group max-w-[75%]">
      {/* Hover reply button — before bubble for own messages */}
      {isOwn && onReply && (
        <button
          onClick={() => onReply(message)}
          className="opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground p-1 rounded-full cursor-pointer shrink-0"
        >
          <Reply className="h-4 w-4" />
        </button>
      )}

      <DropdownMenu open={menuOpen} onOpenChange={(open) => { if (!open) setMenuOpen(false); }}>
      <DropdownMenuTrigger asChild>
      <motion.div
        drag={isMobile ? "x" : false}
        dragConstraints={{ left: isOwn ? -100 : 0, right: isOwn ? 0 : 100 }}
        dragElastic={0.3}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="w-full"
        style={{ touchAction: isMobile ? "pan-y" : undefined }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onContextMenu={handleContextMenu}
      >
        {/* Sender name for received messages */}
        {!isOwn && message.senderName && (
          <p className="text-[11px] text-muted-foreground mb-0.5 ml-3">
            {message.senderName}
          </p>
        )}

        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md"
          }`}
        >
          {/* Reply preview (quoted message) */}
          {message.replyTo && (
            <button
              onClick={() => onScrollToMessage?.(message.replyTo!.messageId)}
              className={`block w-full text-left mb-2 rounded-lg px-3 py-1.5 border-l-2 cursor-pointer ${
                isOwn
                  ? "bg-primary-foreground/10 border-primary-foreground/40"
                  : "bg-background/60 border-primary/40"
              }`}
            >
              <p className={`text-[11px] font-medium ${isOwn ? "text-primary-foreground/80" : "text-primary"}`}>
                {message.replyTo.senderName}
              </p>
              <p className={`text-xs truncate ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                {message.replyTo.messageType === "image"
                  ? "Фото"
                  : message.replyTo.messageType === "file"
                    ? message.replyTo.attachmentFilename || "Файл"
                    : message.replyTo.content}
              </p>
            </button>
          )}

          {/* Image attachment */}
          {message.messageType === "image" && message.attachment && (
            <div className="mb-2 -mx-2 -mt-1">
              <a href={message.attachment.url} target="_blank" rel="noopener noreferrer">
                <Image
                  src={message.attachment.url}
                  alt={message.attachment.filename}
                  width={320}
                  height={240}
                  className="rounded-lg max-w-full h-auto object-cover"
                  unoptimized
                />
              </a>
            </div>
          )}

          {/* File attachment */}
          {message.messageType === "file" && message.attachment && (
            <a
              href={message.attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 p-2 rounded-lg mb-2 transition-colors ${
                isOwn
                  ? "bg-primary-foreground/10 hover:bg-primary-foreground/20"
                  : "bg-background hover:bg-background/80"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isOwn ? "bg-primary-foreground/20" : "bg-primary/10"
                }`}
              >
                <FileIcon className={`h-5 w-5 ${isOwn ? "text-primary-foreground" : "text-primary"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{message.attachment.filename}</p>
                <p className={`text-xs ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {formatFileSize(message.attachment.size)}
                </p>
              </div>
              <Download className={`h-4 w-4 shrink-0 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`} />
            </a>
          )}

          {/* Text content */}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </p>
          )}

          {/* Time and read status */}
          <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            <span className={`text-[10px] ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
              {time}
            </span>
            {isOwn && (
              isRead ? (
                <CheckCheck className={`h-3 w-3 ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`} />
              ) : (
                <Check className={`h-3 w-3 ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`} />
              )
            )}
          </div>
        </div>
      </motion.div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align={isOwn ? "end" : "start"}>
        {message.content && (
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Копировать
          </DropdownMenuItem>
        )}
        {onReply && (
          <DropdownMenuItem onClick={() => onReply(message)}>
            <Reply className="h-4 w-4 mr-2" />
            Ответить
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
      </DropdownMenu>

      {/* Hover reply button — after bubble for received messages */}
      {!isOwn && onReply && (
        <button
          onClick={() => onReply(message)}
          className="opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground p-1 rounded-full cursor-pointer shrink-0"
        >
          <Reply className="h-4 w-4 cursor-pointer" />
        </button>
      )}
      </div>
    </div>
    </>
  );
}
