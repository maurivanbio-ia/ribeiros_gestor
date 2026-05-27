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
  variant = "default",
}: LogoProps) {
  // If collapsed (e.g. sidebar collapsed), return a compact version
  if (collapsed) {
    const compactText = {
      default: (
        <div className="flex items-center">
          A<CircuitLeaf className="w-[1.2em] h-[1.2em] text-[#00e5ff] mx-0.5" /><span className="text-[#00e5ff]">IA<sup className="text-[8px] font-normal align-super text-white/90">TM</sup></span>
        </div>
      ),
      "360": (
        <div className="flex items-center">
          A<CircuitLeaf className="w-[1.2em] h-[1.2em] text-[#00e5ff] mx-0.5" /><span className="text-[#00e5ff]">IA</span> 360<sup className="text-[#00e5ff]">°</sup>
        </div>
      ),
      stats: (
        <div className="flex items-center">
          A<CircuitLeaf className="w-[1.2em] h-[1.2em] text-[#00e5ff] mx-0.5" /><span className="text-[#00e5ff]">IA</span> S
        </div>
      ),
    }[variant];

    return (
      <div className={cn("flex items-center justify-center select-none font-sans font-bold", className)}>
        <span className="text-lg text-white leading-none flex items-center">
          {compactText}
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
      text: "text-6xl md:text-[5rem] lg:text-[6rem] font-sans font-bold leading-none tracking-tight flex items-center",
      icon: "w-[1.2em] h-[1.2em] mx-[0.1em] -mt-2",
      ia: "text-[20px] md:text-[24px] lg:text-[28px] -top-6 md:-top-8 lg:-top-10",
      ia360: "text-[20px] md:text-[24px] lg:text-[28px] -top-6 md:-top-8 lg:-top-10",
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
        <span className={cn("text-white flex items-center", config.text)}>
          Ambient
          <CircuitLeaf className={cn("text-[#00e5ff]", config.icon)} />
          <span className="text-[#00e5ff]">IA</span> 
          <span className="text-white ml-1.5 font-condensed">360</span>
          <span className="text-white font-sans align-super inline-block text-[0.6em] leading-none ml-0.5 -mt-2">
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
        <span className={cn("text-white flex items-center", config.text)}>
          Ambient
          <CircuitLeaf className={cn("text-[#00e5ff]", config.icon)} />
          <span className="text-[#00e5ff]">IA</span> 
          <span className="text-white ml-1.5 font-condensed">Stats</span>
          <sup className={cn("font-normal text-white/95 relative", config.ia)}>
            TM
          </sup>
        </span>
      );
    }

    // Default variant
    return (
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
    );
  };

  return (
    <div className={cn("flex flex-col select-none", config.container, className)}>
      {renderLogoText()}
      {showSubtitle && tagline && config.subtitle !== "hidden" && (
        <span className={cn("text-[#00e5ff] whitespace-nowrap", config.subtitle)}>
          {tagline}
        </span>
      )}
    </div>
  );
}
