import React, { useEffect, useRef } from "react";

interface AuroraProps {
  colorStops: string[];
  blend: number;
  amplitude: number;
  speed: number;
}

export default function Aurora({ colorStops, blend, amplitude, speed }: AuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    let t = 0;

    const rgbColors = colorStops.map((hex) => {
      const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      const c = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(c);
      return result
        ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
        : [0, 0, 0];
    });

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      
      const lines = 10;
      for (let i = 0; i < lines; i++) {
        ctx.beginPath();
        const baseOffset = (i * w) / lines;
        const colorIdx = i % rgbColors.length;
        const c = rgbColors[colorIdx];
        ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${blend})`;

        for (let x = 0; x < w; x += 10) {
          const y = h / 2 + Math.sin(x / 100 + t + i) * (amplitude * 100);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.fill();
        ctx.closePath();
      }

      t += speed * 0.05;
      requestAnimationFrame(draw);
    };

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);
    const animId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
    };
  }, [colorStops, blend, amplitude, speed]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}
