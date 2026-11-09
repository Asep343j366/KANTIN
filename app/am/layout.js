import AmGuard from "@/components/AmGuard";
import { getBrandServer } from "@/lib/brandServer";

export async function generateMetadata() {
  const { name } = await getBrandServer();
  return {
    title: `${name} Area Manager`,
    description: "Dashboard controlling Area Manager: pantau seluruh store under-nya.",
  };
}

export const viewport = {
  themeColor: "#0F4575",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function AmLayout({ children }) {
  return <AmGuard>{children}</AmGuard>;
}
