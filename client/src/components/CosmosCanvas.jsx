import React, { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';

const CosmosCanvas = ({ currentUser, otherUsers, onMove, proximityRadius, socketId }) => {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const playersRef = useRef(new Map()); // id -> { container, glow }
  const keysRef = useRef(new Set()); 

  const updateMovement = useCallback(() => {
    if (!currentUser) return;
    let dx = 0;
    let dy = 0;
    const speed = 5;

    if (keysRef.current.has('w') || keysRef.current.has('arrowup')) dy -= speed;
    if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) dy += speed;
    if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) dx -= speed;
    if (keysRef.current.has('d') || keysRef.current.has('arrowright')) dx += speed;

    let nextX = currentUser.x + dx;
    let nextY = currentUser.y + dy;

    // --- Boundary Collision ---
    nextX = Math.max(20, Math.min(window.innerWidth - 20, nextX));
    nextY = Math.max(20, Math.min(window.innerHeight - 20, nextY));

    // --- Internal User-to-User Collision ---
    // Only check other users to avoid self-collision (NaN)
    otherUsers.forEach(u2 => {
      const dxDist = nextX - u2.x;
      const dyDist = nextY - u2.y;
      const dist = Math.sqrt(dxDist * dxDist + dyDist * dyDist);
      const minDist = 42; 
      
      if (dist < minDist && dist > 0.1) {
        const angle = Math.atan2(dyDist, dxDist);
        const overlap = minDist - dist;
        nextX += Math.cos(angle) * (overlap / 2);
        nextY += Math.sin(angle) * (overlap / 2);
      }
    });

    // Update only if changed
    if (nextX !== currentUser.x || nextY !== currentUser.y) {
      onMove(nextX, nextY);
    }
  }, [currentUser, otherUsers, onMove]);

  useEffect(() => {
    const handleKeyDown = (e) => keysRef.current.add(e.key.toLowerCase());
    const handleKeyUp = (e) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const initPixi = async () => {
      if (appRef.current) return;
      const app = new PIXI.Application();
      await app.init({ background: '#020617', resizeTo: window, antialias: true });
      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      // Parallax Stars
      const layers = [
        { count: 120, size: 1.2, alpha: 0.3, speed: 0.1 },
        { count: 80, size: 2.2, alpha: 0.5, speed: 0.2 },
        { count: 40, size: 3.5, alpha: 0.7, speed: 0.4 },
      ];

      layers.forEach(l => {
        const g = new PIXI.Graphics();
        for (let i = 0; i < l.count; i++) {
          g.circle(Math.random() * window.innerWidth, Math.random() * window.innerHeight, Math.random() * l.size).fill({ color: 0xffffff, alpha: l.alpha });
        }
        app.stage.addChild(g);
        app.ticker.add(() => {
          g.y += l.speed;
          if (g.y > window.innerHeight) g.y = -window.innerHeight;
        });
      });

      app.ticker.add(updateMovement);
    };
    initPixi();
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [updateMovement]);

  useEffect(() => {
    if (!appRef.current) return;
    const items = [{ ...currentUser, id: 'me' }, ...otherUsers];
    const ids = new Set(items.map(u => u.id));

    playersRef.current.forEach((obj, id) => {
      if (!ids.has(id)) {
        appRef.current.stage.removeChild(obj.container);
        playersRef.current.delete(id);
      }
    });

    items.forEach(u => {
      let p = playersRef.current.get(u.id);
      if (!p) {
        const container = new PIXI.Container();
        const glow = new PIXI.Graphics().circle(0, 0, 35).fill({ color: u.color, alpha: 0.2 });
        const body = new PIXI.Graphics().circle(0, 0, 20).fill(u.color);
        const inner = new PIXI.Graphics().circle(0, 0, 15).fill({ color: 0xffffff, alpha: 0.2 });
        const text = new PIXI.Text({ text: u.id === 'me' ? `${u.username} (You)` : u.username, style: { fill: '#ffffff', fontSize: 13, fontWeight: 'bold' } });
        text.anchor.set(0.5, 2.5);
        container.addChild(glow, body, inner, text);
        appRef.current.stage.addChild(container);
        p = { container, glow };
        playersRef.current.set(u.id, p);
      }
      if (Number.isFinite(u.x) && Number.isFinite(u.y)) {
        // Smoothing
        p.container.x += (u.x - p.container.x) * 0.3;
        p.container.y += (u.y - p.container.y) * 0.3;
      }
      p.glow.alpha = 0.2 + Math.sin(Date.now() / 300) * 0.1;
    });
  }, [currentUser, otherUsers]);

  return <div ref={containerRef} className="w-full h-full overflow-hidden" />;
};

export default CosmosCanvas;
