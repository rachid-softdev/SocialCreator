"use client";

import { useEffect, useState } from "react";

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrollProgress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, scrollProgress)));
    };

    // passive: true improves scroll performance
    window.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();

    return () => window.removeEventListener("scroll", updateProgress);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-primary via-primary-active to-gradient-mint origin-left"
        style={{
          // Utiliser transform au lieu de width pour éviter le reflow
          // transform fonctionne sur le GPU, sans recalcul de layout
          transform: `scaleX(${progress / 100})`,
          willChange: "transform",
        }}
      />
    </div>
  );
}
