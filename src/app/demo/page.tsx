import type { Metadata } from "next";
import { DemoWorkspace } from "./DemoWorkspace";
import "./demo.css";
export const metadata: Metadata = {
  title: "Affiliate workspace · Sample demo",
  description:
    "Try order deduplication, permissions, and reviewed AI proposals with fictional data.",
};
export default function DemoPage() {
  return <DemoWorkspace />;
}
