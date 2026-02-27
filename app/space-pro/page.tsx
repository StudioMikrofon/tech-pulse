import SpaceProDashboard from "./SpaceProDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Space Pro — Live Telemetry",
  description: "Real-time space telemetry dashboard. Solar activity, asteroid tracking, ISS position, deep space network status, and more.",
};

export default function SpaceProPage() {
  return <SpaceProDashboard />;
}
