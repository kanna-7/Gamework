import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

const CosmosCanvas = ({ currentUser, otherUsers, onMove, socketId }) => {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const playersRef = useRef(new Map());
  const keysRef = useRef(new Set());
  const targetsRef = useRef([]);

  // --- Beach Environment ---
  // We can add beach obstacles like shells or surfboards later if needed.
  const obstacles = [
    { x: 200, y: 200, r: 30, type: 'shell' },
    { x: 800, y: 150, r: 40, type: 'umbrella' },
    { x: 500, y: 600, r: 50, type: 'ball' },
  ];

  useEffect(() => {
    targetsRef.current = [{ ...currentUser, id: 'me' }, ...otherUsers];
  }, [currentUser, otherUsers]);

  useEffect(() => {
    const initPixi = async () => {
      if (appRef.current || !containerRef.current) return;

      const app = new PIXI.Application();
      try {
        await app.init({ background: '#f5e6ca', resizeTo: window, antialias: true, hello: false });
        containerRef.current.appendChild(app.canvas);
        appRef.current = app;

        // --- 1. Load Textures with Error Handling ---
        let parkTexture;
        const textureMap = {};

        try {
          const avatarIds = ['avatar1', 'avatar2', 'avatar3'];
          for (const id of avatarIds) {
            textureMap[`/avatars/${id}.png`] = await PIXI.Assets.load(`/avatars/${id}.png`);
          }
          parkTexture = await PIXI.Assets.load('/assets/beach_bg.png');
        } catch (e) {
          console.error("Asset loading partially failed, using fallback:", e);
        }

        // --- 2. Beach Background ---
        if (parkTexture) {
          const beachBg = new PIXI.Sprite(parkTexture);
          // Scale to cover screen
          const scale = Math.max(window.innerWidth / beachBg.width, window.innerHeight / beachBg.height);
          beachBg.scale.set(scale);
          beachBg.anchor.set(0.5);
          beachBg.x = window.innerWidth / 2;
          beachBg.y = window.innerHeight / 2;
          
          app.stage.addChildAt(beachBg, 0);

          // Subtle parallax/follow logic
          app.ticker.add(() => {
            const user = targetsRef.current.find(u => u.id === 'me');
            if (user) {
              // Move background slightly opposite to player for depth
              beachBg.x = (window.innerWidth / 2) - (user.x - window.innerWidth/2) * 0.1;
              beachBg.y = (window.innerHeight / 2) - (user.y - window.innerHeight/2) * 0.1;
            }
          });
        }

        // --- 3. Link Layer ---
        const lineLayer = new PIXI.Graphics();
        app.stage.addChild(lineLayer);

        const down = (e) => keysRef.current.add(e.key.toLowerCase());
        const up = (e) => keysRef.current.delete(e.key.toLowerCase());
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);

        // --- 4. Main Ticker Loop ---
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
              if (d < 160) {
                lineLayer.setStrokeStyle({ width: 3, color: 0x0ea5e9, alpha: (1 - d / 160) * 0.5 });
                lineLayer.moveTo(u1.x, u1.y).lineTo(u2.x, u2.y).stroke();
              }
            });
          });

          // Movement & Collision
          let dx = 0; let dy = 0;
          const speed = 5.5 * ticker.deltaTime;
          if (keysRef.current.has('w') || keysRef.current.has('arrowup')) dy -= speed;
          if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) dy += speed;
          if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) dx -= speed;
          if (keysRef.current.has('d') || keysRef.current.has('arrowright')) dx += speed;

          if (dx !== 0 || dy !== 0) {
            let nx = user.x + dx; let ny = user.y + dy;
            obstacles.forEach(obs => {
              if (obs.r) {
                const dist = Math.sqrt((nx - obs.x) ** 2 + (ny - obs.y) ** 2);
                if (dist < obs.r) {
                  const ang = Math.atan2(ny - obs.y, nx - obs.x);
                  nx = obs.x + Math.cos(ang) * obs.r;
                  ny = obs.y + Math.sin(ang) * obs.r;
                }
              }
            });
            nx = Math.max(30, Math.min(window.innerWidth - 30, nx));
            ny = Math.max(30, Math.min(window.innerHeight - 30, ny));
            onMove(nx, ny);
          }

          // Render Avatars
          all.forEach(u => {
            let p = playersRef.current.get(u.id);
            if (!p) {
              const container = new PIXI.Container();
              const glow = new PIXI.Graphics().circle(0, 0, 45).fill({ color: 0x0ea5e9, alpha: 0.15 });
              const tex = textureMap[u.avatar] || textureMap['/avatars/avatar1.png'];
              const sprite = tex ? new PIXI.Sprite(tex) : new PIXI.Graphics().circle(0, 0, 30).fill(u.color || 0xff0000);
              if (sprite instanceof PIXI.Sprite) {
                sprite.anchor.set(0.5); sprite.width = 64; sprite.height = 64;
                const mask = new PIXI.Graphics().circle(0, 0, 30).fill(0xffffff);
                sprite.mask = mask;
                container.addChild(glow, sprite, mask);
              } else {
                container.addChild(glow, sprite);
              }
              const t = new PIXI.Text({ text: u.id === 'me' ? `${u.username} (You)` : u.username, style: { fill: '#334155', fontSize: 13, fontWeight: 'bold' } });
              t.anchor.set(0.5, 3.2);
              container.addChild(t);
              app.stage.addChild(container);
              p = { container, glow };
              playersRef.current.set(u.id, p);
            }
            p.container.x += (u.x - p.container.x) * 0.2 * ticker.deltaTime;
            p.container.y += (u.y - p.container.y) * 0.2 * ticker.deltaTime;
          });
        });

        return () => {
          window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
        };
      } catch (err) {
        console.error("Critical PixiJS Init Error:", err);
      }
    };

    initPixi();
    return () => { if (appRef.current) { appRef.current.destroy(true); appRef.current = null; } };
  }, []);

  return <div ref={containerRef} className="w-full h-full overflow-hidden" />;
};

export default CosmosCanvas;
