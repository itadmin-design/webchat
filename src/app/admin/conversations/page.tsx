import { MessageSquare } from "lucide-react";

export default function ConversationsPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Выберите диалог</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Выберите диалог из списка, чтобы начать общение
        </p>
      </div>
    </div>
  );
}
