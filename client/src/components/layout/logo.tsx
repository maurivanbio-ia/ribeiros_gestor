import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  collapsed?: boolean;
  className?: string;
  showSubtitle?: boolean;
}

export default function Logo({
  size = "md",
  collapsed = false,
  className,
  showSubtitle = true,
}: LogoProps) {
  // If collapsed (e.g. sidebar collapsed), return a compact version
  if (collapsed) {
    return (
      <div className={cn("flex items-center justify-center select-none font-condensed font-bold", className)}>
        <span className="text-lg text-white leading-none">
          A<span className="text-primary">IA<sup className="text-[8px] font-normal align-super text-white/90">TM</sup></span>
        </span>
      </div>
    );
  }

  // Size mapping
  const sizeClasses = {
    xs: {
      container: "gap-0",
      text: "text-sm font-condensed font-bold leading-none tracking-wide",
      ia: "text-[6px]",
      subtitle: "hidden",
    },
    sm: {
      container: "gap-0.5",
      text: "text-xl font-condensed font-bold leading-none tracking-wide",
      ia: "text-[9px] -top-1",
      subtitle: "text-[9px] font-sans font-medium tracking-[0.08em] mt-0.5",
    },
    md: {
      container: "gap-0.5",
      text: "text-2xl font-condensed font-bold leading-none tracking-wide",
      ia: "text-[10px] -top-1.5",
      subtitle: "text-[10px] font-sans font-medium tracking-[0.1em] mt-0.5",
    },
    lg: {
      container: "gap-1",
      text: "text-4xl font-condensed font-bold leading-none tracking-wide",
      ia: "text-[14px] -top-2",
      subtitle: "text-[12px] font-sans font-medium tracking-[0.12em] mt-1",
    },
    xl: {
      container: "gap-2.5 text-center items-center justify-center",
      text: "text-7xl md:text-[5.5rem] lg:text-[6.5rem] font-condensed font-bold leading-none tracking-wide",
      ia: "text-[24px] md:text-[28px] lg:text-[32px] -top-8 md:-top-10 lg:-top-12",
      subtitle: "text-sm md:text-base lg:text-lg font-sans font-medium tracking-[0.16em] mt-1.5",
    },
  };

  const config = sizeClasses[size];

  return (
    <div className={cn("flex flex-col select-none", config.container, className)}>
      <span className={cn("text-white relative", config.text)}>
        Ambient
        <span className="text-primary">
          IA
          <sup className={cn("font-normal text-white/95 relative", config.ia)}>
            TM
          </sup>
        </span>
      </span>
      {showSubtitle && config.subtitle !== "hidden" && (
        <span className={cn("text-primary whitespace-nowrap", config.subtitle)}>
          Inteligência Ambiental
        </span>
      )}
    </div>
  );
}
