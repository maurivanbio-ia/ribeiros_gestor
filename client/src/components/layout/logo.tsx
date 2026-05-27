import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  collapsed?: boolean;
  className?: string;
  showSubtitle?: boolean;
  variant?: "default" | "360" | "stats";
}

export default function Logo({
  size = "md",
  collapsed = false,
  className,
  showSubtitle = true,
  variant = "default",
}: LogoProps) {
  // If collapsed (e.g. sidebar collapsed), return a compact version
  if (collapsed) {
    const compactText = {
      default: (
        <>
          A<span className="text-primary">IA<sup className="text-[8px] font-normal align-super text-white/90">TM</sup></span>
        </>
      ),
      "360": (
        <>
          A<span className="text-primary">IA</span> 360<sup className="text-primary">°</sup>
        </>
      ),
      stats: (
        <>
          A<span className="text-primary">IA</span> S
        </>
      ),
    }[variant];

    return (
      <div className={cn("flex items-center justify-center select-none font-condensed font-bold", className)}>
        <span className="text-lg text-white leading-none">
          {compactText}
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
      ia360: "text-[6px] -top-1",
      subtitle: "hidden",
    },
    sm: {
      container: "gap-0.5",
      text: "text-xl font-condensed font-bold leading-none tracking-wide",
      ia: "text-[9px] -top-1",
      ia360: "text-[9px] -top-1",
      subtitle: "text-[9px] font-sans font-medium tracking-[0.08em] mt-0.5",
    },
    md: {
      container: "gap-0.5",
      text: "text-2xl font-condensed font-bold leading-none tracking-wide",
      ia: "text-[10px] -top-1.5",
      ia360: "text-[10px] -top-1.5",
      subtitle: "text-[10px] font-sans font-medium tracking-[0.1em] mt-0.5",
    },
    lg: {
      container: "gap-1",
      text: "text-4xl font-condensed font-bold leading-none tracking-wide",
      ia: "text-[14px] -top-2",
      ia360: "text-[14px] -top-2",
      subtitle: "text-[12px] font-sans font-medium tracking-[0.12em] mt-1",
    },
    xl: {
      container: "gap-2.5 text-center items-center justify-center",
      text: "text-7xl md:text-[5.5rem] lg:text-[6.5rem] font-condensed font-bold leading-none tracking-wide",
      ia: "text-[24px] md:text-[28px] lg:text-[32px] -top-8 md:-top-10 lg:-top-12",
      ia360: "text-[24px] md:text-[28px] lg:text-[32px] -top-8 md:-top-10 lg:-top-12",
      subtitle: "text-sm md:text-base lg:text-lg font-sans font-medium tracking-[0.16em] mt-1.5",
    },
  };

  const config = sizeClasses[size];

  // Tagline selection based on variant
  const getTagline = () => {
    if (variant === "360") return "Gestão Ambiental Inteligente";
    if (variant === "stats") return ""; // stats does not have a tagline in the image
    return "Inteligência Ambiental";
  };

  const tagline = getTagline();

  // Logo rendering based on variant
  const renderLogoText = () => {
    if (variant === "360") {
      return (
        <span className={cn("text-white relative", config.text)}>
          Ambient
          <span className="text-primary">IA</span> 360
          <span className="text-primary font-sans align-super inline-block text-[0.6em] leading-none ml-0.5 -mt-2">
            °
          </span>
          <sup className={cn("font-normal text-white/95 relative", config.ia360)}>
            TM
          </sup>
        </span>
      );
    }

    if (variant === "stats") {
      return (
        <span className={cn("text-white relative", config.text)}>
          Ambient
          <span className="text-primary">IA</span> Stats
          <sup className={cn("font-normal text-white/95 relative", config.ia)}>
            TM
          </sup>
        </span>
      );
    }

    // Default variant
    return (
      <span className={cn("text-white relative", config.text)}>
        Ambient
        <span className="text-primary">
          IA
          <sup className={cn("font-normal text-white/95 relative", config.ia)}>
            TM
          </sup>
        </span>
      </span>
    );
  };

  return (
    <div className={cn("flex flex-col select-none", config.container, className)}>
      {renderLogoText()}
      {showSubtitle && tagline && config.subtitle !== "hidden" && (
        <span className={cn("text-primary whitespace-nowrap", config.subtitle)}>
          {tagline}
        </span>
      )}
    </div>
  );
}
