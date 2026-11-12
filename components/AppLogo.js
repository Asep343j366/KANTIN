"use client";
import { useAppLogo } from "@/lib/storeLogo";

// <img> logo aplikasi global (sama untuk semua site).
export default function AppLogo({ className = "h-full w-full object-contain", alt = "Logo", ...rest }) {
  const src = useAppLogo();
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} {...rest} />;
}
