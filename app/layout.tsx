import "./globals.css";

export const metadata = {
  title: "KABI Kitchen Plan CAD MVP",
  description: "Kitchen intake to AutoLISP and AutoCAD drawing MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
