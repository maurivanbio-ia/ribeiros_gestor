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
}: LogoProps) {
  // Configurações de tamanho da imagem com base no tamanho solicitado
  const sizeClasses = {
    xs: "h-4",
    sm: "h-6",
    md: "h-8",
    lg: "h-12",
    xl: "h-20 md:h-24 lg:h-32",
  };
  
  // Quando colapsado no menu lateral
  const collapsedClasses = "h-8 w-8 object-cover object-left";
  
  return (
    <div className={cn("flex flex-col items-center justify-center select-none", className)}>
       <img 
         src="/logo.png" 
         alt="AmbientIA" 
         className={cn(
           "transition-all duration-300", 
           collapsed ? collapsedClasses : `object-contain ${sizeClasses[size]}`
         )} 
       />
    </div>
  );
}
