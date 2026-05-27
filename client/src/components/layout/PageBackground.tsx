import { ReactNode } from "react";

interface PageBackgroundProps {
  children: ReactNode;
  backgroundImage: string;
  overlayOpacity?: number;
}

export default function PageBackground({ 
  children, 
  backgroundImage,
  overlayOpacity = 0.7 
}: PageBackgroundProps) {
  return (
    <div className="min-h-screen relative">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          zIndex: 0,
        }}
      >
        <div 
          className="absolute inset-0 bg-gradient-to-br from-[#06100E] via-[#06100E]/92 to-[#102B24]/50 backdrop-blur-[2px]"
          style={{ opacity: overlayOpacity }}
        />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
