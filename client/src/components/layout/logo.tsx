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
      <div className={cn("flex items-center justify-center select-none font-sans", className)}>
        <span className="font-light text-base text-white tracking-tight">
          A<span className="text-primary font-bold">IA<sup className="text-[7px] font-normal align-super text-white/80">TM</sup></span>
        </span>
      </div>
    );
  }

  // Size mapping
  const sizeClasses = {
    xs: {
      container: "gap-0",
      text: "text-xs tracking-wide leading-none font-light",
      ia: "text-[7px]",
      subtitle: "hidden",
    },
    sm: {
      container: "gap-0.5",
      text: "text-base tracking-wide leading-none font-light",
      ia: "text-[8px]",
      subtitle: "text-[7px] tracking-[0.05em] font-condensed font-semibold",
    },
    md: {
      container: "gap-0.5",
      text: "text-lg tracking-wide leading-none font-light",
      ia: "text-[9px]",
      subtitle: "text-[8px] tracking-[0.1em] font-condensed font-semibold",
    },
    lg: {
      container: "gap-1",
      text: "text-3xl tracking-wide leading-none font-light",
      ia: "text-[12px]",
      subtitle: "text-[10px] tracking-[0.15em] font-condensed font-semibold",
    },
    xl: {
      container: "gap-3 text-center items-center justify-center",
      text: "text-7xl xl:text-[6.8rem] tracking-wide leading-none font-light",
      ia: "text-[24px] xl:text-[28px]",
      subtitle: "text-[12px] xl:text-[13px] tracking-[0.2em] font-condensed font-semibold",
    },
  };

  const config = sizeClasses[size];

  return (
    <div className={cn("flex flex-col select-none font-sans", config.container, className)}>
      <span className={cn("text-white", config.text)}>
        Ambient
        <span className="text-primary font-bold">
          IA
          <sup className={cn("font-normal align-super text-white/90", config.ia)}>
            TM
          </sup>
        </span>
      </span>
      {showSubtitle && config.subtitle !== "hidden" && (
        <span className={cn("text-primary uppercase", config.subtitle)}>
          Gestão Ambiental Inteligente
        </span>
      )}
    </div>
  );
}
