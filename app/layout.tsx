// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "Dolní Lhota v pohybu",
  description: "Běžecká výzva Dolní Lhota"
};

export default function RootLayout({ children }) {
  return (
    <html lang="cs">
      <body>
        {children}
      </body>
    </html>
  );
}