export default function GlobeFallback() {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="relative w-64 h-64">
        {/* Static globe representation */}
        <div
          className="w-full h-full rounded-full"
          style={{
            background:
              "radial-gradient(circle at 35% 35%, #1a3a5c 0%, #0a1628 60%, #050a14 100%)",
            boxShadow:
              "0 0 60px rgba(143, 211, 255, 0.15), inset 0 0 60px rgba(0,0,0,0.5)",
          }}
        />
        {/* Glow ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: "1px solid rgba(143, 211, 255, 0.2)",
            boxShadow: "0 0 30px rgba(143, 211, 255, 0.1)",
          }}
        />
        <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-text-secondary whitespace-nowrap">
          3D Globe requires WebGL
        </p>
      </div>
    </div>
  );
}
