import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"EJC Talentos",description:"Base de talentos para formação das equipes do EJC.",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
