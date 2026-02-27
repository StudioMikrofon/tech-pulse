"use client";

import dynamic from "next/dynamic";

const SpaceProDrawer = dynamic(() => import("./SpaceProDrawer"), { ssr: false });

export default function SpaceProSidebar() {
  return (
    <aside className="hidden lg:block fixed top-16 right-0 bottom-0 w-[320px] z-40 overflow-y-auto">
      <SpaceProDrawer open={true} onClose={() => {}} persistent />
    </aside>
  );
}
