"use client";
import { useEffect } from "react";
import * as PIXI from "pixi.js";

interface GroundProps {
  app: PIXI.Application;
}

/**
 * Ground component that renders a red rectangle at the bottom of the screen
 * @param app - PIXI.Application instance
 */
const Ground = ({ app }: GroundProps) => {
  useEffect(() => {
    const ground = new PIXI.Graphics();
    ground.beginFill(0xff0000);
    ground.drawRect(0, app.screen.height - 50, app.screen.width, 50);
    ground.endFill();

    app.stage.addChild(ground);

    return () => {
      app.stage.removeChild(ground);
      ground.destroy();
    };
  }, [app]);

  return null;
};

export default Ground; 