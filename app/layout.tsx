// app/layout.tsx
import "./globals.css";
import { ReactNode } from "react";
import ClientLayout from "./ClientLayout";

export const metadata = {
  title: "Dolní Lhota v pohybu",
  description: "Běžecká výzva Dolní Lhota"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="cs">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
