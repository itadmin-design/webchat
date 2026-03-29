"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";
import { MagicLinkForm } from "@/components/auth/MagicLinkForm";
import { ApplicationForm } from "@/components/auth/ApplicationForm";
import Image from "next/image";
import { useUtmCapture } from "@/hooks/useUtmParams";
import { IntroPopup } from "@/components/chat/IntroPopup";

export default function HomePage() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const searchParams = useSearchParams();
  useUtmCapture();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState(
    initialTab === "login" || initialTab === "apply" ? initialTab : "magic-link"
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <IntroPopup />
      {/* Left section: logo + headline */}
      <div className="lg:w-1/2 bg-gradient-to-br from-black/5 to-muted/50 flex flex-col px-10 lg:px-16 py-10 lg:py-0">
        {/* Logo */}
        <div className="lg:pt-10">
          <Image src="/icons/logo.svg" alt="Logo" width={120} height={38} priority />
        </div>

        {/* Headline */}
        <div className="flex-1 flex flex-col justify-center py-12 lg:py-0">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1] flex flex-wrap">
            {["Добро", "пожаловать"].map((word, wi, words) => {
              const charOffset = words.slice(0, wi).reduce((sum, w) => sum + w.length + 1, 0);
              return (
                <span key={wi} className="inline-flex">
                  {word.split("").map((char, ci) => (
                    <motion.span
                      key={ci}
                      className="inline-block"
                      initial={{
                        opacity: 0,
                        y: -40,
                        filter: "blur(12px)",
                        scale: 0.9,
                        rotateX: 45,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        scale: 1,
                        rotateX: 0,
                      }}
                      transition={{
                        duration: 0.6,
                        delay: (charOffset + ci) * 0.05,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      {char}
                    </motion.span>
                  ))}
                  {wi < words.length - 1 && <span>&nbsp;</span>}
                </span>
              );
            })}
          </h1>
          <motion.p
            className="text-muted-foreground text-lg mt-6 max-w-md"
            initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              duration: 0.7,
              delay: "Добро пожаловать".length * 0.05 + 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            Прямая связь с нашей командой.
          </motion.p>
        </div>

        {/* Footer (desktop only) */}
        <div className="hidden lg:block pb-6 text-xs text-muted-foreground">
        BENEFITSAR. 2026
        </div>
      </div>

      {/* Right section: auth card */}
      <div className="lg:w-1/2 bg-background flex items-center justify-center px-6 py-16 lg:py-0">
        <div className="w-full max-w-md">
          <Card className="rounded-2xl border-1 shadow-none">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <CardHeader className="pb-0">
                <TabsList className="w-full grid grid-cols-[1fr_1fr_auto] h-10">
                  {/* Tab labels */}
                  <TabsTrigger value="magic-link" className="text-xs sm:text-sm">По ссылке</TabsTrigger>
                  <TabsTrigger value="login" className="text-xs sm:text-sm">С паролем</TabsTrigger>
                  <TabsTrigger value="apply" className="text-xs sm:text-sm px-[10px]">Стать клиентом</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="pt-3">
                {/* Magic link tab */}
                <TabsContent value="magic-link" className="mt-0">
                  <div className="mb-5">
                    <CardTitle className="text-xl">Вход по email</CardTitle>
                    <CardDescription className="mt-1">
                      Мы отправим вам одноразовую ссылку для входа.
                    </CardDescription>
                  </div>
                  <MagicLinkForm />
                </TabsContent>

                {/* Login tab */}
                <TabsContent value="login" className="mt-0">
                  <div className="mb-5">
                    <CardTitle className="text-xl">Вход</CardTitle>
                    <CardDescription className="mt-1">
                      Войдите с помощью email и пароля
                    </CardDescription>
                  </div>
                  <LoginForm />
                </TabsContent>

                {/* Application tab */}
                <TabsContent value="apply" className="mt-0">
                  <div className="mb-5">
                    <CardTitle className="text-xl">Стать клиентом</CardTitle>
                    <CardDescription className="mt-1">
                      Заполните заявку, чтобы стать клиентом.
                    </CardDescription>
                  </div>
                  <ApplicationForm />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          {/* Link to application form */}
          <p className="text-center text-sm text-muted-foreground mt-4">
            Нет аккаунта?{" "}
            <button
              type="button"
              onClick={() => setTab("apply")}
              className="text-primary hover:underline font-medium"
            >
              Стать клиентом
            </button>
          </p>
        </div>
      </div>

      {/* Footer (mobile only) */}
      <div className="lg:hidden py-6 text-center text-xs text-muted-foreground">
      BENEFITSAR. 2026
      </div>
    </div>
  );
}
