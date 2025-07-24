// app/layout.tsx
import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Dolní Lhota v pohybu",
  description: "Běžecká výzva Dolní Lhota"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="cs">
      <body>
        {children}
      </body>
    </html>
  );
}
