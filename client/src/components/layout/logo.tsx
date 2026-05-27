import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  collapsed?: boolean;
  className?: string;
  showSubtitle?: boolean;
  variant?: "default" | "360" | "stats";
}

const CircuitLeaf = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22c-5-5-8-10-8-15A6.5 6.5 0 0 1 12 2a6.5 6.5 0 0 1 8 5c0 5-3 10-8 15z" />
    <path d="M12 2v20" />
    <circle cx="8" cy="9" r="1" />
    <path d="M12 11 8 9" />
    <circle cx="8" cy="14" r="1" />
    <path d="M12 16 8 14" />
    <circle cx="8" cy="18" r="1" />
    <path d="M12 20 8 18" />
    <circle cx="16" cy="9" r="1" />
    <path d="M12 11 16 9" />
    <circle cx="16" cy="14" r="1" />
    <path d="M12 16 16 14" />
    <circle cx="16" cy="18" r="1" />
    <path d="M12 20 16 18" />
  </svg>
);

export default function Logo({
  size = "md",
  collapsed = false,
  className,
  showSubtitle = true,
  variant = "default", // We'll ignore the variant since the user wants EXACTLY this logo everywhere
}: LogoProps) {
  // If collapsed (e.g. sidebar collapsed), return a compact version
  if (collapsed) {
    return (
      <div className={cn("flex items-center justify-center select-none font-sans font-bold", className)}>
        <span className="text-lg text-white leading-none flex items-center">
          A<CircuitLeaf className="w-[1.2em] h-[1.2em] text-[#00e5ff] mx-0.5" /><span className="text-[#00e5ff]">IA<sup className="text-[8px] font-normal align-super text-white/90">TM</sup></span>
        </span>
      </div>
    );
  }

  // Size mapping
  const sizeClasses = {
    xs: {
      container: "gap-0",
      text: "text-sm font-sans font-bold leading-none tracking-tight",
      icon: "w-[1.2em] h-[1.2em] mx-[0.1em]",
      ia: "text-[6px]",
      ia360: "text-[6px] -top-1",
      subtitle: "hidden",
    },
    sm: {
      container: "gap-0.5",
      text: "text-xl font-sans font-bold leading-none tracking-tight",
      icon: "w-[1.2em] h-[1.2em] mx-[0.1em]",
      ia: "text-[9px] -top-1",
      ia360: "text-[9px] -top-1",
      subtitle: "text-[9px] font-sans font-medium tracking-[0.08em] mt-0.5",
    },
    md: {
      container: "gap-0.5",
      text: "text-3xl font-sans font-bold leading-none tracking-tight",
      icon: "w-[1.2em] h-[1.2em] mx-[0.1em]",
      ia: "text-[12px] -top-2",
      ia360: "text-[12px] -top-2",
      subtitle: "text-[10px] font-sans font-medium tracking-[0.1em] mt-0.5",
    },
    lg: {
      container: "gap-1",
      text: "text-5xl font-sans font-bold leading-none tracking-tight",
      icon: "w-[1.2em] h-[1.2em] mx-[0.1em]",
      ia: "text-[16px] -top-3",
      ia360: "text-[16px] -top-3",
      subtitle: "text-[12px] font-sans font-medium tracking-[0.12em] mt-1",
    },
    xl: {
      container: "gap-2.5 text-center items-center justify-center",
      text: "text-6xl md:text-[5rem] lg:text-[6.5rem] font-sans font-bold leading-none tracking-tight flex items-center justify-center",
      icon: "w-[1.2em] h-[1.2em] mx-[0.1em] -mt-1 md:-mt-2",
      ia: "text-[20px] md:text-[24px] lg:text-[32px] -top-6 md:-top-8 lg:-top-10",
      ia360: "text-[20px] md:text-[24px] lg:text-[32px] -top-6 md:-top-8 lg:-top-10",
      subtitle: "text-sm md:text-base lg:text-lg font-sans font-medium tracking-[0.16em] mt-1.5 md:mt-2",
    },
  };

  const config = sizeClasses[size];

  return (
    <div className={cn("flex flex-col select-none items-center justify-center", config.container, className)}>
      <span className={cn("text-white flex items-center", config.text)}>
        Ambient
        <CircuitLeaf className={cn("text-[#00e5ff]", config.icon)} />
        <span className="text-[#00e5ff]">
          IA
          <sup className={cn("font-normal text-white/95 relative", config.ia)}>
            TM
          </sup>
        </span>
      </span>
    </div>
  );
}
