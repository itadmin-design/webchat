"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const COOKIE_NAME = "intro_popup_seen";

function hasCookie(): boolean {
  return document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE_NAME}=`));
}

function setCookie() {
  // Expires in 1 year
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=1; path=/; expires=${expires}`;
}

export function IntroPopup() {
  const [open, setOpen] = useState(() => !hasCookie());

  const handleClose = () => {
    setCookie();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent showCloseButton={true} className="max-w-[520px]">
        <DialogHeader>
          <div className="text-3xl">💬</div>
          <DialogTitle className="text-2xl font-bold">
            Безопасный чат для консультаций
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-[15px] leading-relaxed">
            Вы перешли в наш официальный защищённый чат с высоким уровнем
            шифрования.
            <br /><br />
            Он создан для безопасного общения с консультантами и полностью
            заменяет Telegram в текущих условиях.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-1.5 text-[15px]">
          <li>— получить консультацию</li>
          <li>— задать любые вопросы</li>
          <li>— оформить услугу</li>
        </ul>

        <div className="rounded-xl border bg-muted/50 p-3.5 text-sm">
          Интерфейс и логика работы аналогичны Telegram — вам будет привычно и
          понятно.
        </div>

        <p className="text-muted-foreground text-[15px]">
          Если вы здесь впервые, нажмите «Далее» и заполните форму «стать
          клиентом».
        </p>

        <DialogFooter className="flex-row gap-2.5 sm:flex-row">
          <Button className="flex-1" onClick={handleClose}>
            Далее
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
