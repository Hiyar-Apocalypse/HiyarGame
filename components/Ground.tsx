"use client";
import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";

interface GroundProps {
  app: PIXI.Application;
}

const Ground = ({ app }: GroundProps) => {
  const groundRef = useRef<PIXI.Graphics | null>(null);

  useEffect(() => {
    if (!app?.stage || !app?.screen) return;

    try {
      // Zemin oluştur
      const ground = new PIXI.Graphics();
      ground.beginFill(0xff0000); // Kırmızı renk
      ground.drawRect(0, app.screen.height - 50, app.screen.width, 50);
      ground.endFill();

      // Zemini sahneye ekle
      app.stage.addChild(ground);
      groundRef.current = ground;

      return () => {
        if (groundRef.current && app?.stage) {
          app.stage.removeChild(groundRef.current);
          groundRef.current.destroy();
          groundRef.current = null;
        }
      };
    } catch (error) {
      console.error("Ground oluşturma hatası:", error);
    }
  }, [app]);

  return null;
};

export default Ground; 