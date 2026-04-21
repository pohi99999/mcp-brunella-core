import type { Metadata } from "next";
import "./globals.css";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";

export const metadata: Metadata = {
  title: "Igényfelmérő Ügynök Chat",
  description: "AI Asszisztens üzleti igényfelméréshez",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const showDevConsole =
    process.env.NEXT_PUBLIC_COPILOTKIT_DEV_CONSOLE === "true" ||
    process.env.NODE_ENV !== "production";

  return (
    <html lang="hu">
      <body className="antialiased font-sans">
        <CopilotKit runtimeUrl="/api/copilotkit" showDevConsole={showDevConsole}>
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
