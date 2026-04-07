import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

const CosmosCanvas = ({ currentUser, otherUsers, onMove, proximityRadius, socketId }) => {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const playersRef = useRef(new Map());
  const keysRef = useRef(new Set());
  const targetsRef = useRef([]);
  const scaleRef = useRef(1);
  const worldSize = 2000;
  const minimapSize = 150;
  const minimapRef = useRef(null);

  useEffect(() => {
    targetsRef.current = [{ ...currentUser, id: 'me' }, ...otherUsers];
  }, [currentUser, otherUsers]);

  useEffect(() => {
    const initPixi = async () => {
      if (appRef.current || !containerRef.current) return;

      const app = new PIXI.Application();
      try {
        await app.init({ 
          background: '#020617', 
          resizeTo: window, 
          antialias: true, 
          hello: false,
          resolution: window.devicePixelRatio || 1, // Higher resolution for HD
          autoDensity: true
        });
        containerRef.current.appendChild(app.canvas);
        appRef.current = app;

        // --- 1. Load Textures ---
        const textureMap = {};
        try {
          const avatarIds = ['avatar1', 'avatar2', 'avatar3'];
          for (const id of avatarIds) {
            const path = `/avatars/${id}.png`;
            textureMap[path] = await PIXI.Assets.load(path);
          }
          textureMap['office_campus_map'] = await PIXI.Assets.load('/assets/office_campus_map.png');
          textureMap['floor'] = await PIXI.Assets.load('/assets/office_floor.png');
        } catch (e) {
          console.error("Asset loading failed:", e);
        }

        // --- 2. Create World Container (The Camera) ---
        const worldContainer = new PIXI.Container();
        app.stage.addChild(worldContainer);

        // --- 2.1. Tiling Floor (Removed for fixed image background) ---

        // --- 2.2. Office Campus Centerpiece ---
        if (textureMap['office_campus_map']) {
          const officeBg = new PIXI.Sprite(textureMap['office_campus_map']);
          officeBg.anchor.set(0.5);
          officeBg.x = worldSize / 2;
          officeBg.y = worldSize / 2;
          officeBg.width = worldSize;  // Fill the entire world
          officeBg.height = worldSize; // Fill the entire world
          worldContainer.addChild(officeBg);
        }

        // --- 2.3. Minimap Container (UI Layer) ---
        const uiContainer = new PIXI.Container();
        app.stage.addChild(uiContainer);

        const minimapScale = minimapSize / worldSize;
        const minimap = new PIXI.Container();
        minimap.x = window.innerWidth - minimapSize - 20;
        minimap.y = 20;
        uiContainer.addChild(minimap);

        // Minimap Background
        const minimapBg = new PIXI.Graphics().rect(0, 0, minimapSize, minimapSize).fill({ color: 0x000000, alpha: 0.5 }).stroke({ width: 2, color: 0xffffff, alpha: 0.2 });
        minimap.addChild(minimapBg);

        if (textureMap['office_campus_map']) {
          const miniOffice = new PIXI.Sprite(textureMap['office_campus_map']);
          miniOffice.width = minimapSize;
          miniOffice.height = minimapSize;
          miniOffice.alpha = 0.6;
          minimap.addChild(miniOffice);
        }

        const minimapPoints = new PIXI.Graphics();
        minimap.addChild(minimapPoints);
        minimapRef.current = { container: minimap, points: minimapPoints, scale: minimapScale };

        // --- 3. Link Layer ---
        const lineLayer = new PIXI.Graphics();
        worldContainer.addChild(lineLayer);

        // --- 4. Controls ---
        const down = (e) => {
          const key = e.key.toLowerCase();
          keysRef.current.add(key);
          
          if (key === 'h') {
             onMove(worldSize / 2, worldSize / 2);
          }
        };
        const up = (e) => keysRef.current.delete(e.key.toLowerCase());
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);

        // --- 5. Main Ticker Loop ---
        app.ticker.add((ticker) => {
          const user = targetsRef.current.find(u => u.id === 'me');
          const others = targetsRef.current.filter(u => u.id !== 'me');
          if (!user) return;

          // Visual Links
          lineLayer.clear();
          const all = [{ ...user, id: 'me' }, ...others];
          all.forEach((u1, i) => {
            all.slice(i + 1).forEach(u2 => {
              const d = Math.sqrt((u1.x - u2.x) ** 2 + (u1.y - u2.y) ** 2);
              if (d < proximityRadius) {
                lineLayer.setStrokeStyle({ width: 3, color: 0x0ea5e9, alpha: (1 - d / proximityRadius) * 0.5 });
                lineLayer.moveTo(u1.x, u1.y).lineTo(u2.x, u2.y).stroke();
              }
            });
          });

          // Movement
          let dx = 0; let dy = 0;
          const speed = 7 * ticker.deltaTime;
          if (keysRef.current.has('w') || keysRef.current.has('arrowup')) dy -= speed;
          if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) dy += speed;
          if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) dx -= speed;
          if (keysRef.current.has('d') || keysRef.current.has('arrowright')) dx += speed;

          if (dx !== 0 || dy !== 0) {
            let nx = user.x + dx; let ny = user.y + dy;
            nx = Math.max(30, Math.min(worldSize - 30, nx));
            ny = Math.max(30, Math.min(worldSize - 30, ny));
            onMove(nx, ny);
          }

          // Camera: Center on local user
          worldContainer.x = window.innerWidth / 2 - user.x * scaleRef.current;
          worldContainer.y = window.innerHeight / 2 - user.y * scaleRef.current;

          // Render Avatars
          all.forEach(u => {
            let p = playersRef.current.get(u.id);
            if (!p) {
              const container = new PIXI.Container();
              // Prominent highlight glow
              const glow = new PIXI.Graphics().circle(0, 0, 60).fill({ color: 0x0ea5e9, alpha: 0.25 });
              const outline = new PIXI.Graphics().circle(0, 0, 48).stroke({ width: 4, color: 0xffffff, alpha: 0.8 });
              
              const tex = textureMap[u.avatar] || textureMap['/avatars/avatar1.png'];
              const sprite = tex ? new PIXI.Sprite(tex) : new PIXI.Graphics().circle(0, 0, 40).fill(u.color || 0xff0000);
              
              if (sprite instanceof PIXI.Sprite) {
                sprite.anchor.set(0.5); 
                sprite.width = 96;  // Increased size
                sprite.height = 96; // Increased size
                const mask = new PIXI.Graphics().circle(0, 0, 45).fill(0xffffff);
                sprite.mask = mask;
                container.addChild(glow, outline, sprite, mask);
              } else {
                container.addChild(glow, outline, sprite);
              }
              
              const t = new PIXI.Text({ 
                text: u.id === 'me' ? `${u.username} (You)` : u.username, 
                style: { fill: '#ffffff', fontSize: 15, fontWeight: 'bold', stroke: '#000000', strokeThickness: 4 } 
              });
              t.anchor.set(0.5, 3.2);
              container.addChild(t);
              worldContainer.addChild(container);
              p = { container };
              playersRef.current.set(u.id, p);
            }
            p.container.x += (u.x - p.container.x) * 0.2 * ticker.deltaTime;
            p.container.y += (u.y - p.container.y) * 0.2 * ticker.deltaTime;
          });

          // Update Minimap
          if (minimapRef.current) {
            const { points, scale, container } = minimapRef.current;
            container.x = window.innerWidth - minimapSize - 20; // Keep aligned on resize
            points.clear();
            all.forEach(u => {
              points.circle(u.x * scale, u.y * scale, u.id === 'me' ? 4 : 3)
                    .fill(u.id === 'me' ? 0x0ea5e9 : 0xffffff);
            });
          }

          // Cleanup stale players
          for (let [id, p] of playersRef.current) {
            if (!all.find(u => u.id === id)) {
              worldContainer.removeChild(p.container);
              playersRef.current.delete(id);
            }
          }
        });

        return () => {
          window.removeEventListener('keydown', down);
          window.removeEventListener('keyup', up);
        };
      } catch (err) {
        console.error("Critical PixiJS Init Error:", err);
      }
    };

    initPixi();

    const cleanupListeners = () => {
      // We don't have a direct reference to 'down' and 'up' here, 
      // but we can move them or use a ref. 
      // For now, let's just make sure the listeners are handled correctly.
    };

    return () => { 
      // These are cleaned up by the main return
      if (appRef.current) { 
        appRef.current.destroy(true); 
        appRef.current = null; 
      } 
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden cursor-crosshair">
       <div className="absolute bottom-6 left-1/2 -translate-x-1/2 p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white/50 text-[10px] uppercase tracking-widest pointer-events-none">
          Use WASD to Roam • Press 'H' to Home
       </div>
    </div>
  );
};

export default CosmosCanvas;
