"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import LoginModal from "./LoginModal";
import { getSocket } from "@/lib/socket";

interface Solution {
  id: string;
  dbId?: number;
  userId?: number;
  userName?: string;
  text: string;
}

interface Worry {
  id: string;
  dbId?: number;
  userId?: number;
  userName?: string;
  text: string;
  x: number;
  y: number;
  solutions: Solution[];
  size: number;
  floatPhase: number;
  floatSpeed: number;
  floatAmplitudeX: number;
  floatAmplitudeY: number;
}

interface User {
  id: number;
  email: string;
  name: string;
}

// Particle for the background canvas
interface BgParticle {
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  size: number;
  color: string; // each particle gets a warm/cool star color
  lineColor: string;
}

// Liquid glass overlay component
function LiquidGlassOverlay({ borderRadius = "10px", opacity = 1 }: { borderRadius?: string; opacity?: number }) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        style={{
          borderRadius,
          opacity,
          boxShadow:
            "0 0 8px rgba(0,0,0,0.03), 0 2px 6px rgba(0,0,0,0.08), inset 3px 3px 0.5px -3.5px rgba(255,255,255,0.09), inset -3px -3px 0.5px -3.5px rgba(255,255,255,0.85), inset 1px 1px 1px -0.5px rgba(255,255,255,0.6), inset -1px -1px 1px -0.5px rgba(255,255,255,0.6), inset 0 0 6px 6px rgba(255,255,255,0.12), inset 0 0 2px 2px rgba(255,255,255,0.06), 0 0 12px rgba(0,0,0,0.15)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        style={{
          borderRadius,
          opacity,
          backdropFilter: 'url("#liquid-glass-filter")',
        }}
      />
    </>
  );
}

// SVG filter for liquid glass distortion effect
function LiquidGlassFilter() {
  return (
    <svg className="hidden" aria-hidden="true">
      <defs>
        <filter
          id="liquid-glass-filter"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.05"
            numOctaves="1"
            seed="1"
            result="turbulence"
          />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            scale="70"
            xChannelSelector="R"
            yChannelSelector="B"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

// No initial worries - loaded from API

// Resolve overlapping worries by pushing them apart
function resolveOverlapsStatic(allWorries: Worry[]): Worry[] {
  const result = allWorries.map((w) => ({ ...w }));
  const padding = 40;
  for (let iter = 0; iter < 10; iter++) {
    let moved = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const footA = getWorryFootprintStatic(a);
        const footB = getWorryFootprintStatic(b);
        const minDist = footA + footB + padding;
        if (dist < minDist) {
          const overlap = minDist - dist;
          const pushX = (dx / dist) * overlap * 0.5;
          const pushY = (dy / dist) * overlap * 0.5;
          result[i] = { ...result[i], x: result[i].x - pushX, y: result[i].y - pushY };
          result[j] = { ...result[j], x: result[j].x + pushX, y: result[j].y + pushY };
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return result;
}

// Pure function versions for use in callbacks (no dependency on component scope)
function getSolutionRadiusStatic(worry: Worry) {
  const count = worry.solutions.length;
  const solNodeSize = 60;
  const minSpacing = solNodeSize * 2 + 30;
  const radiusFromSpacing = (count * minSpacing) / (2 * Math.PI);
  const baseRadius = worry.size + 90;
  return Math.max(baseRadius, radiusFromSpacing);
}

function getWorryFootprintStatic(worry: Worry) {
  if (worry.solutions.length === 0) return worry.size + 20;
  return getSolutionRadiusStatic(worry) + 70;
}

export default function WorryUniverse({ user }: { user: User | null }) {
  const [worries, setWorries] = useState<Worry[]>([]);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedWorry, setSelectedWorry] = useState<string | null>(null);
  const [newWorryText, setNewWorryText] = useState("");
  const [newSolutionText, setNewSolutionText] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [scale, setScale] = useState(1);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMyWorriesModal, setShowMyWorriesModal] = useState(false);
  const [showMyAdviceModal, setShowMyAdviceModal] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(user);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // PacMan eating animation state
  const [pacmanAnim, setPacmanAnim] = useState<{
    worryId: string;
    dbId: number;
    targetScreenX: number;
    targetScreenY: number;
    worrySize: number;
  } | null>(null);

  // Load worries from API on mount
  useEffect(() => {
    fetch("/api/worries")
      .then((res) => res.json())
      .then((data) => {
        if (data.worries) {
          setWorries(resolveOverlapsStatic(data.worries));
        }
      })
      .catch(() => { });
  }, []);

  // Socket.io real-time connection
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on("worry:created", (worry: Worry) => {
      setWorries((prev) => resolveOverlapsStatic([...prev, worry]));
    });

    socket.on("solution:created", (data: { worryId: string; solution: Solution }) => {
      setWorries((prev) => {
        const updated = prev.map((w) =>
          w.id === data.worryId
            ? { ...w, solutions: [...w.solutions, data.solution] }
            : w
        );
        return resolveOverlapsStatic(updated);
      });
    });

    socket.on("pacman:eating", (data: { worryId: string; dbId: number }) => {
      // Find the worry and trigger pacman animation for remote viewers
      setWorries((prev) => {
        const worry = prev.find((w) => w.id === data.worryId);
        if (worry) {
          // Use center of screen as fallback position for remote viewers
          const screenX = window.innerWidth / 2;
          const screenY = window.innerHeight / 2;
          setPacmanAnim({
            worryId: worry.id,
            dbId: data.dbId,
            targetScreenX: screenX,
            targetScreenY: screenY,
            worrySize: worry.size,
          });
        }
        return prev;
      });
    });

    socket.on("worry:deleted", (data: { worryId: string }) => {
      setWorries((prev) => prev.filter((w) => w.id !== data.worryId));
      setSelectedWorry((prev) => (prev === data.worryId ? null : prev));
    });

    return () => {
      socket.off("worry:created");
      socket.off("solution:created");
      socket.off("pacman:eating");
      socket.off("worry:deleted");
    };
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasDragged = useRef(false);
  const mouseRef = useRef<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });
  const timeRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<BgParticle[]>([]);
  const cursorTrailRef = useRef<{ x: number; y: number; age: number }[]>([]);

  // Floating positions calculated per frame
  const [floatOffsets, setFloatOffsets] = useState<
    Record<string, { x: number; y: number }>
  >({});

  // Keep offset/scale in refs so the canvas animation loop can read them
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // Background particle system (canvas) - particles live in world space
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // World space size for particles - large enough to feel infinite
    const WORLD_SIZE = 20000;
    const WORLD_HALF = WORLD_SIZE / 2;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    // Star-like color palette: warm yellows, cool whites, faint blues
    const starColors = [
      { fill: "rgba(255, 255, 240, 0.7)", line: "255, 255, 240" },  // warm white
      { fill: "rgba(255, 245, 200, 0.65)", line: "255, 245, 200" }, // soft yellow
      { fill: "rgba(255, 235, 170, 0.6)", line: "255, 235, 170" },  // golden
      { fill: "rgba(240, 240, 255, 0.6)", line: "240, 240, 255" },  // cool blue-white
      { fill: "rgba(255, 255, 255, 0.65)", line: "255, 255, 255" }, // pure white
      { fill: "rgba(255, 230, 180, 0.55)", line: "255, 230, 180" }, // amber
    ];

    function initParticles() {
      particlesRef.current = [];
      const count = 10000;
      for (let i = 0; i < count; i++) {
        const c = starColors[Math.floor(Math.random() * starColors.length)];
        particlesRef.current.push({
          x: (Math.random() - 0.5) * WORLD_SIZE,
          y: (Math.random() - 0.5) * WORLD_SIZE,
          directionX: (Math.random() - 0.5) * 0.4,
          directionY: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 1.5 + 0.5,
          color: c.fill,
          lineColor: c.line,
        });
      }
    }

    function drawParticles() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const ox = offsetRef.current.x;
      const oy = offsetRef.current.y;
      const sc = scaleRef.current;

      const mouse = mouseRef.current;
      const mouseRadius = 180;
      const particles = particlesRef.current;

      // Convert mouse to world coordinates for repulsion
      let mouseWorldX: number | null = null;
      let mouseWorldY: number | null = null;
      if (mouse.x !== null && mouse.y !== null) {
        mouseWorldX = (mouse.x - ox) / sc;
        mouseWorldY = (mouse.y - oy) / sc;
      }

      // Visible bounds in world space (with margin for connections)
      const margin = 150 / sc;
      const visLeft = -ox / sc - margin;
      const visTop = -oy / sc - margin;
      const visRight = (canvas.width - ox) / sc + margin;
      const visBottom = (canvas.height - oy) / sc + margin;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Wrap around world edges
        if (p.x > WORLD_HALF) p.x -= WORLD_SIZE;
        if (p.x < -WORLD_HALF) p.x += WORLD_SIZE;
        if (p.y > WORLD_HALF) p.y -= WORLD_SIZE;
        if (p.y < -WORLD_HALF) p.y += WORLD_SIZE;

        // Mouse repulsion in world space
        if (mouseWorldX !== null && mouseWorldY !== null) {
          const dx = mouseWorldX - p.x;
          const dy = mouseWorldY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const worldMouseRadius = mouseRadius / sc;
          if (dist < worldMouseRadius) {
            const force = (worldMouseRadius - dist) / worldMouseRadius;
            p.x -= (dx / dist) * force * 3;
            p.y -= (dy / dist) * force * 3;
          }
        }

        p.x += p.directionX;
        p.y += p.directionY;

        // Skip drawing if not visible
        if (p.x < visLeft || p.x > visRight || p.y < visTop || p.y > visBottom) continue;

        // World to screen
        const sx = p.x * sc + ox;
        const sy = p.y * sc + oy;

        ctx.beginPath();
        ctx.arc(sx, sy, p.size * sc, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      // Connect nearby particles (only visible ones)
      const maxDist = 120;
      const maxDistWorld = maxDist / sc;
      for (let a = 0; a < particles.length; a++) {
        const pa = particles[a];
        if (pa.x < visLeft || pa.x > visRight || pa.y < visTop || pa.y > visBottom) continue;
        for (let b = a + 1; b < particles.length; b++) {
          const pb = particles[b];
          const dx = pa.x - pb.x;
          const dy = pa.y - pb.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDistWorld * maxDistWorld) {
            const dist = Math.sqrt(distSq);
            const opacity = (1 - dist / maxDistWorld) * 0.35;

            let isNearMouse = false;
            if (mouseWorldX !== null && mouseWorldY !== null) {
              const dxm = pa.x - mouseWorldX;
              const dym = pa.y - mouseWorldY;
              if (Math.sqrt(dxm * dxm + dym * dym) < (mouseRadius / sc)) {
                isNearMouse = true;
              }
            }

            const sax = pa.x * sc + ox;
            const say = pa.y * sc + oy;
            const sbx = pb.x * sc + ox;
            const sby = pb.y * sc + oy;

            ctx.strokeStyle = isNearMouse
              ? `rgba(255, 255, 240, ${opacity * 1.8})`
              : `rgba(${pa.lineColor}, ${opacity})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(sax, say);
            ctx.lineTo(sbx, sby);
            ctx.stroke();
          }
        }
      }
    }

    function drawCursorTrail() {
      if (!ctx) return;
      const trail = cursorTrailRef.current;

      // Age all trail points
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].age += 1;
        if (trail[i].age > 40) {
          trail.splice(i, 1);
        }
      }

      // Draw trail glow circles (newest = brightest)
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        const life = 1 - p.age / 40;
        const size = 12 * life + 2;

        // Outer glow
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3);
        grad.addColorStop(0, `rgba(255, 235, 170, ${0.25 * life})`);
        grad.addColorStop(0.4, `rgba(255, 220, 120, ${0.1 * life})`);
        grad.addColorStop(1, "rgba(255, 220, 120, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 245, 200, ${0.6 * life})`;
        ctx.fill();
      }

      // Draw bright glow at current mouse position
      const mouse = mouseRef.current;
      if (mouse.x !== null && mouse.y !== null) {
        const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 40);
        grad.addColorStop(0, "rgba(255, 240, 180, 0.3)");
        grad.addColorStop(0.3, "rgba(255, 225, 140, 0.12)");
        grad.addColorStop(1, "rgba(255, 220, 120, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 40, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const animate = () => {
      drawParticles();
      drawCursorTrail();
      animFrameRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    initParticles();
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Floating animation loop for worry nodes
  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      timeRef.current += 1;
      const t = timeRef.current;
      const newOffsets: Record<string, { x: number; y: number }> = {};
      worries.forEach((w) => {
        const phase = w.floatPhase;
        const speed = w.floatSpeed;
        newOffsets[w.id] = {
          x: Math.sin(t * speed + phase) * w.floatAmplitudeX,
          y:
            Math.cos(t * speed * 1.3 + phase * 0.7) * w.floatAmplitudeY +
            Math.sin(t * speed * 0.7 + phase * 1.5) * (w.floatAmplitudeY * 0.5),
        };
        // Each solution also gets its own gentle float
        w.solutions.forEach((sol, si) => {
          const sp = phase + si * 1.7 + 0.5;
          const ss = speed * 0.8;
          newOffsets[sol.id] = {
            x: Math.sin(t * ss + sp) * 6,
            y: Math.cos(t * ss * 1.2 + sp * 0.8) * 5,
          };
        });
      });
      setFloatOffsets(newOffsets);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      running = false;
    };
  }, [worries]);

  // Global mouse tracking for canvas + cursor trail
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      // Add trail point
      cursorTrailRef.current.push({ x: e.clientX, y: e.clientY, age: 0 });
      if (cursorTrailRef.current.length > 50) {
        cursorTrailRef.current.shift();
      }
    };
    const handleOut = () => {
      mouseRef.current = { x: null, y: null };
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseout", handleOut);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseout", handleOut);
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (
        (e.target as HTMLElement).closest(
          ".worry-node, .solution-node, .add-form, .solution-panel"
        )
      )
        return;
      setDragging(true);
      hasDragged.current = false;
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    },
    [offset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      hasDragged.current = true;
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [dragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((prev) => Math.max(0.3, Math.min(2, prev - e.deltaY * 0.001)));
  }, []);

  // Find a position that doesn't overlap with existing worries (including their solution orbits)
  const findNonOverlappingPos = useCallback(
    (existingWorries: Worry[], centerX: number, centerY: number, newSize: number) => {
      const newFootprint = newSize + 100; // new worry's own footprint (base, no solutions yet)
      const maxAttempts = 60;
      let bestX = centerX;
      let bestY = centerY;
      let bestOverlap = Infinity;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const angle = attempt * 2.4; // golden angle
        const radius = 60 + attempt * 35;
        const candidateX = centerX + Math.cos(angle) * radius;
        const candidateY = centerY + Math.sin(angle) * radius;

        // Find worst overlap with any existing worry's footprint
        let worstOverlap = -Infinity;
        for (const w of existingWorries) {
          const dx = candidateX - w.x;
          const dy = candidateY - w.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const existingFootprint = getWorryFootprintStatic(w);
          // Overlap = how much they intrude into each other (negative = no overlap)
          const overlap = (newFootprint + existingFootprint) - dist;
          worstOverlap = Math.max(worstOverlap, overlap);
        }

        // No overlap with anything
        if (worstOverlap <= 0) {
          return { x: candidateX, y: candidateY };
        }

        // Track least-overlapping position
        if (worstOverlap < bestOverlap) {
          bestOverlap = worstOverlap;
          bestX = candidateX;
          bestY = candidateY;
        }
      }

      return { x: bestX, y: bestY };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [worries]
  );

  const addWorry = useCallback(async () => {
    if (!newWorryText.trim() || !currentUser) return;
    const viewCenterX = (window.innerWidth / 2 - offset.x) / scale;
    const viewCenterY = (window.innerHeight / 2 - offset.y) / scale;
    const newSize = 75 + Math.random() * 30;
    const pos = findNonOverlappingPos(worries, viewCenterX, viewCenterY, newSize);
    const floatPhase = Math.random() * Math.PI * 2;
    const floatSpeed = 0.005 + Math.random() * 0.005;
    const floatAmplitudeX = 8 + Math.random() * 10;
    const floatAmplitudeY = 6 + Math.random() * 10;

    try {
      const res = await fetch("/api/worries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newWorryText.trim(),
          x: pos.x,
          y: pos.y,
          size: newSize,
          floatPhase,
          floatSpeed,
          floatAmplitudeX,
          floatAmplitudeY,
        }),
      });
      const data = await res.json();
      if (res.ok && data.worry) {
        setWorries((prev) => [...prev, data.worry]);
        socketRef.current?.emit("worry:created", data.worry);
      }
    } catch { /* ignore */ }
    setNewWorryText("");
    setShowAddForm(false);
  }, [newWorryText, offset, scale, findNonOverlappingPos, worries, currentUser]);

  // Push overlapping worries apart from a source worry
  const resolveOverlaps = useCallback((allWorries: Worry[]): Worry[] => {
    return resolveOverlapsStatic(allWorries);
  }, []);

  const addSolution = useCallback(
    async (worryId: string) => {
      if (!newSolutionText.trim() || !currentUser) return;
      const worry = worries.find((w) => w.id === worryId);
      if (!worry?.dbId) return;

      try {
        const res = await fetch(`/api/worries/${worry.dbId}/solutions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: newSolutionText.trim() }),
        });
        const data = await res.json();
        if (res.ok && data.solution) {
          setWorries((prev) => {
            const updated = prev.map((w) =>
              w.id === worryId
                ? { ...w, solutions: [...w.solutions, data.solution] }
                : w
            );
            return resolveOverlaps(updated);
          });
          socketRef.current?.emit("solution:created", { worryId, solution: data.solution });
        }
      } catch { /* ignore */ }
      setNewSolutionText("");
    },
    [newSolutionText, resolveOverlaps, worries, currentUser]
  );

  // Navigate viewport to center on a specific worry
  const navigateToWorry = useCallback((worry: Worry) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    setOffset({
      x: centerX - worry.x * scale,
      y: centerY - worry.y * scale,
    });
  }, [scale]);

  // Navigate to worry that contains a specific solution
  const navigateToSolution = useCallback((solutionId: string) => {
    const worry = worries.find((w) => w.solutions.some((s) => s.id === solutionId));
    if (worry) {
      navigateToWorry(worry);
      setSelectedWorry(worry.id);
    }
  }, [worries, navigateToWorry]);

  const handleBackgroundClick = useCallback(() => {
    if (!hasDragged.current) {
      setSelectedWorry(null);
      setShowUserMenu(false);
    }
  }, []);

  // Trigger PacMan eating animation for resolving a worry
  const handleResolveWorry = useCallback((worry: Worry) => {
    // Calculate the worry's screen position
    const pos = { x: worry.x, y: worry.y };
    const fo = floatOffsets[worry.id] || { x: 0, y: 0 };
    const screenX = (pos.x + fo.x) * scale + offset.x;
    const screenY = (pos.y + fo.y) * scale + offset.y;

    setShowMyWorriesModal(false);
    setPacmanAnim({
      worryId: worry.id,
      dbId: worry.dbId!,
      targetScreenX: screenX,
      targetScreenY: screenY,
      worrySize: worry.size * scale,
    });
    socketRef.current?.emit("pacman:eating", { worryId: worry.id, dbId: worry.dbId });
  }, [floatOffsets, scale, offset]);

  // Get floating position for a worry
  const getFloatPos = (worry: Worry) => {
    const fo = floatOffsets[worry.id] || { x: 0, y: 0 };
    return { x: worry.x + fo.x, y: worry.y + fo.y };
  };

  const getSolutionRadius = getSolutionRadiusStatic;
  const getWorryFootprint = getWorryFootprintStatic;

  // Calculate solution positions around a worry
  const getSolutionPos = (
    worry: Worry,
    sol: Solution,
    solIndex: number,
    totalSolutions: number
  ) => {
    const angle =
      (solIndex / Math.max(totalSolutions, 1)) * Math.PI * 2 - Math.PI / 2;
    const radius = getSolutionRadius(worry);
    const wPos = getFloatPos(worry);
    const solFloat = floatOffsets[sol.id] || { x: 0, y: 0 };
    return {
      x: wPos.x + Math.cos(angle) * radius + solFloat.x,
      y: wPos.y + Math.sin(angle) * radius + solFloat.y,
    };
  };

  return (
    <div
      ref={containerRef}
      className="w-screen h-screen overflow-hidden relative select-none"
      style={{ cursor: dragging ? "grabbing" : "grab" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onClick={handleBackgroundClick}
    >
      {/* Particle background canvas */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{ zIndex: 0 }}
      />

      {/* Universe content layer */}
      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          zIndex: 1,
        }}
      >
        {/* SVG for dotted connection lines */}
        <svg
          style={{
            position: "absolute",
            top: -4000,
            left: -4000,
            width: 8000,
            height: 8000,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {/* Worry-to-solution connections */}
          {worries
            .filter((w) => w.solutions.length > 0)
            .map((w) => {
              const wPos = getFloatPos(w);
              return w.solutions.map((sol, si) => {
                const sPos = getSolutionPos(w, sol, si, w.solutions.length);
                return (
                  <line
                    key={`conn-${sol.id}`}
                    x1={wPos.x + 4000}
                    y1={wPos.y + 4000}
                    x2={sPos.x + 4000}
                    y2={sPos.y + 4000}
                    stroke="rgba(255, 235, 170, 0.45)"
                    strokeWidth={1.2}
                    strokeDasharray="5 7"
                  />
                );
              });
            })}
        </svg>

        {/* Worry Nodes */}
        {worries.map((worry) => {
          const pos = getFloatPos(worry);
          const isSelected = selectedWorry === worry.id;
          return (
            <div key={worry.id}>
              {/* The worry node with orbiting dots */}
              <div
                className="worry-node absolute"
                style={{
                  left: pos.x,
                  top: pos.y,
                  zIndex: isSelected ? 10 : 2,
                }}
              >
                {/* Orbiting white dots around the worry */}
                <WorryDots
                  size={worry.size}
                  isSelected={isSelected}
                  worryId={worry.id}
                />

                {/* Worry text (centered) */}
                <div
                  className="absolute flex items-center justify-center text-center"
                  style={{
                    width: worry.size * 2,
                    height: worry.size * 2,
                    marginLeft: -worry.size,
                    marginTop: -worry.size,
                    cursor: "pointer",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedWorry(isSelected ? null : worry.id);
                    setNewSolutionText("");
                  }}
                >
                  <span
                    className="text-sm font-light leading-relaxed whitespace-pre-line"
                    style={{
                      color: "rgba(255, 255, 255, 0.9)",
                      textShadow: "0 0 20px rgba(255, 255, 255, 0.3)",
                      maxWidth: worry.size * 1.4,
                    }}
                  >
                    {worry.text.length <= 15
                      ? worry.text
                      : worry.text.slice(0, 15) + "..."}
                  </span>
                </div>

                {/* Solution count badge removed - solutions always visible */}
              </div>

              {/* Solution nodes (always visible) */}
              {worry.solutions.map((sol, si) => {
                const sPos = getSolutionPos(
                  worry,
                  sol,
                  si,
                  worry.solutions.length
                );
                return (
                  <div
                    key={sol.id}
                    className="solution-node absolute"
                    style={{
                      left: sPos.x,
                      top: sPos.y,
                      zIndex: 5,
                    }}
                  >
                    <SolutionDots size={55} />
                    <div
                      className="absolute flex items-center justify-center text-center"
                      style={{
                        width: 120,
                        height: 120,
                        marginLeft: -60,
                        marginTop: -60,
                        cursor: "pointer",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWorry(worry.id);
                        setNewSolutionText("");
                      }}
                    >
                      <span
                        className="text-xs leading-relaxed whitespace-pre-line"
                        style={{
                          color: "rgba(255, 255, 255, 0.85)",
                          textShadow:
                            "0 0 15px rgba(255, 255, 255, 0.2)",
                          maxWidth: 100,
                        }}
                      >
                        {sol.text.length <= 15
                          ? sol.text
                          : sol.text.slice(0, 15) + "..."}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Solution panel - chat style modal */}
      {selectedWorry && (() => {
        const selectedW = worries.find((w) => w.id === selectedWorry);
        return (
          <div
            className="solution-panel fixed flex flex-col overflow-clip"
            style={{
              width: 353,
              maxWidth: "85vw",
              background: "rgba(37, 37, 37, 0.15)",
              borderRadius: 20,
              zIndex: 50,
              top: 100,
              right: 37,
              bottom: 37,
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <LiquidGlassOverlay borderRadius="20px" opacity={0.4} />
            {/* Header - worry info */}
            <div
              className="flex-shrink-0 flex flex-col gap-[10px] justify-center"
              style={{
                minHeight: 114,
                padding: "28px 26px 28px 15px",
              }}
            >
              <div className="flex items-center gap-[10px]">
                <svg className="shrink-0" width="17" height="17" viewBox="0 0 22 22" fill="none">
                  <circle cx="11" cy="11" r="10" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                  <circle cx="11" cy="8" r="2.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                  <path d="M6 18c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-[16px] font-semibold text-white tracking-[-0.48px]">
                  {selectedW?.userName ?? "익명"}
                </span>
                <span className="text-[16px] font-semibold text-white tracking-[-0.48px]">
                  님의 고민
                </span>
              </div>
              <p className="text-[20px] font-semibold text-white tracking-[-0.6px] whitespace-pre-wrap">
                {selectedW?.text}
              </p>
            </div>

            {/* Solutions list - chat bubbles */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ minHeight: 0, padding: "0 15px" }}
            >
              <div className="flex flex-col gap-[19px]">
                {selectedW?.solutions.map((sol) => {
                  const isMine = currentUser && sol.userId === currentUser.id;
                  return (
                    <div
                      key={sol.id}
                      className="flex"
                      style={{
                        justifyContent: isMine ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        className="text-[16px] font-semibold text-white tracking-[-0.48px]"
                        style={{
                          background: isMine ? "#6b5c2d" : "#2d2d2d",
                          padding: "16px 20px",
                          borderTopLeftRadius: 10,
                          borderTopRightRadius: 10,
                          borderBottomRightRadius: isMine ? 0 : 10,
                          borderBottomLeftRadius: isMine ? 10 : 0,
                          maxWidth: "90%",
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {sol.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Input bar - pinned to bottom */}
            <div
              className="flex-shrink-0 flex items-end justify-between overflow-clip"
              style={{
                margin: "0 15px 23px 15px",
                background: "#2d2d2d",
                borderRadius: 10,
                boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
                minHeight: 42,
                padding: "10px 15px",
              }}
            >
              <textarea
                className="flex-1 bg-transparent text-[12px] font-semibold text-white tracking-[-0.36px] outline-none placeholder:text-[#838383] resize-none"
                placeholder="해결책을 작성해주세요"
                value={newSolutionText}
                onChange={(e) => {
                  if (!currentUser) return;
                  setNewSolutionText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onFocus={() => {
                  if (!currentUser) setShowLoginModal(true);
                }}
                onKeyDown={(e) => {
                  if (!currentUser) { e.preventDefault(); return; }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    addSolution(selectedWorry);
                  }
                }}
                rows={1}
                style={{ height: 22, maxHeight: 120 }}
              />
              <button
                className="shrink-0 flex items-center justify-center cursor-pointer transition-all duration-200 hover:brightness-125"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 50,
                  background: "#6b5c2d",
                  border: "none",
                  marginLeft: 8,
                  padding: 2,
                }}
                onClick={() => currentUser ? addSolution(selectedWorry) : setShowLoginModal(true)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 10V2M6 2L2 6M6 2L10 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Add worry button */}
      {!showAddForm && (
        <div
          className="add-form fixed bottom-8 left-1/2 -translate-x-1/2"
          style={{ zIndex: 50 }}
        >
          <button
            className="relative flex items-center justify-center whitespace-nowrap font-bold text-xl text-white tracking-[0.35px] transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden"
            style={{
              background: "rgba(107, 92, 45, 0.15)",
              borderRadius: "10px",
              padding: "28px 45px",
              border: "1px solid rgba(255, 235, 170, 0.08)",
              backdropFilter: "blur(16px)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(107, 92, 45, 0.35)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(107, 92, 45, 0.15)")}
            onClick={() => currentUser ? setShowAddForm(true) : setShowLoginModal(true)}
          >
            <LiquidGlassOverlay borderRadius="10px" opacity={0.4} />
            <span className="relative z-10">+ 고민 작성하기</span>
          </button>
        </div>
      )}

      {/* Add worry form */}
      {showAddForm && (
        <div
          className="add-form fixed bottom-8 left-1/2 -translate-x-1/2 overflow-hidden"
          style={{
            width: 400,
            maxWidth: "90vw",
            background: "rgba(37, 37, 37, 0.15)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            backdropFilter: "blur(16px)",
            borderRadius: 20,
            padding: "32px 28px",
            zIndex: 50,
          }}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <LiquidGlassOverlay borderRadius="20px" opacity={0.4} />
          <p
            className="relative z-10 text-[16px] font-semibold text-white tracking-[-0.48px] mb-6"
          >
            우주에 고민 띄우기
          </p>
          <textarea
            className="relative z-10 w-full rounded-[10px] px-5 py-4 text-[14px] font-medium text-white resize-none outline-none placeholder:text-[#838383]"
            style={{
              background: "rgba(45, 45, 45, 0.5)",
              border: "none",
            }}
            rows={5}
            placeholder="어떤 고민이 있나요?"
            value={newWorryText}
            onChange={(e) => setNewWorryText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addWorry();
              }
            }}
            autoFocus
          />
          <div className="relative z-10 flex gap-3 pt-6">
            <button
              className="relative flex-3 py-[14px] rounded-[10px] text-[14px] font-semibold text-white overflow-hidden cursor-pointer transition-all duration-200 hover:brightness-125"
              style={{
                background: "rgba(107, 92, 45, 0.3)",
                border: "none",
              }}
              onClick={addWorry}
            >
              띄우기
            </button>
            <button
              className="relative flex-1 py-4 rounded-[10px] text-[16px] font-semibold cursor-pointer transition-all duration-200 hover:brightness-125"
              style={{
                background: "rgba(45, 45, 45, 0.5)",
                border: "none",
                color: "rgba(255, 255, 255, 0.5)",
              }}
              onClick={() => {
                setShowAddForm(false);
                setNewWorryText("");
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Top-left: 고민우주 logo + title */}
      <div
        className="fixed flex items-center gap-3"
        style={{ top: 37, left: 37, zIndex: 40 }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          {/* Glow behind planet */}
          <circle cx="20" cy="20" r="12" fill="rgba(255, 235, 170, 0.08)" />
          {/* Planet body */}
          <circle cx="20" cy="20" r="8.5" fill="rgba(255, 235, 170, 0.35)" stroke="rgba(255, 235, 170, 0.9)" strokeWidth="1.5" />
          {/* Planet surface band */}
          <path d="M12 21 Q20 17.5 28 21" stroke="rgba(255, 235, 170, 0.5)" strokeWidth="1" fill="none" />
          {/* Orbit ring */}
          <ellipse cx="20" cy="20" rx="18" ry="7" stroke="rgba(255, 235, 170, 0.6)" strokeWidth="1.2" strokeDasharray="3.5 2.5" transform="rotate(-20 20 20)" />
          {/* Thought bubble - 고민 상징 */}
          <circle cx="31" cy="8" r="4.5" fill="rgba(255, 235, 170, 0.3)" stroke="rgba(255, 235, 170, 0.85)" strokeWidth="1.2" />
          <circle cx="26.5" cy="13" r="2.2" fill="rgba(255, 235, 170, 0.25)" stroke="rgba(255, 235, 170, 0.65)" strokeWidth="1" />
          <circle cx="24" cy="15.5" r="1.1" fill="rgba(255, 235, 170, 0.6)" />
          {/* Orbiting star */}
          <circle cx="4" cy="15" r="1.8" fill="rgba(255, 235, 170, 0.85)" />
          {/* Tiny sparkle */}
          <circle cx="9" cy="33" r="1.2" fill="rgba(255, 235, 170, 0.55)" />
        </svg>
        <span className="font-bold text-[32px] text-white tracking-[0.3px]">고민우주</span>
      </div>

      {/* Top-center: description text */}
      <div
        className="fixed left-1/2 -translate-x-1/2 text-[12px] tracking-[0.3px] whitespace-nowrap"
        style={{
          top: 37,
          color: "rgba(255, 255, 255, 0.35)",
          zIndex: 40,
        }}
      >
        고민우주를 탐험하며 다양한 고민들을 둘러보고 고민에 대한 조언을 해보세요.
      </div>

      {/* Bottom-left: user nickname box with popup menu */}
      {currentUser ? (
        <div
          className="fixed"
          style={{ left: 37, bottom: 37, zIndex: 50 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Popup menu buttons - animate up from nickname box */}
          <div
            className="flex flex-col gap-2 overflow-hidden"
            style={{
              marginBottom: 8,
              maxHeight: showUserMenu ? 200 : 0,
              opacity: showUserMenu ? 1 : 0,
              transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease",
            }}
          >
            {[
              { label: "설정", onClick: () => { setShowSettingsModal(true); setShowUserMenu(false); } },
              { label: "내 고민", onClick: () => { setShowMyWorriesModal(true); setShowUserMenu(false); } },
              { label: "작성한 조언", onClick: () => { setShowMyAdviceModal(true); setShowUserMenu(false); } },
            ].map((item) => (
              <button
                key={item.label}
                className="relative w-full text-left overflow-hidden cursor-pointer transition-all duration-200 hover:brightness-125"
                style={{
                  width: 248,
                  background: "rgba(37, 37, 37, 0.15)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 10,
                  padding: "14px 25px",
                  color: "rgba(255, 255, 255, 0.85)",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "-0.42px",
                }}
                onClick={item.onClick}
              >
                <LiquidGlassOverlay borderRadius="10px" opacity={0.4} />
                <span className="relative z-10">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Nickname box */}
          <div
            className="flex items-center gap-3 overflow-hidden cursor-pointer transition-all duration-200 hover:brightness-110"
            style={{
              width: 248,
              height: 75,
              background: "rgba(37, 37, 37, 0.15)",
              borderRadius: "10px",
              padding: "0 25px",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
            onClick={() => setShowUserMenu((prev) => !prev)}
          >
            <LiquidGlassOverlay borderRadius="10px" opacity={0.4} />
            <svg className="relative z-10 shrink-0" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="10" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <circle cx="11" cy="8" r="2.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <path d="M6 18c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="relative z-10 text-[16px] font-semibold text-white tracking-[-0.48px] text-left flex-1">
              {currentUser.name}
            </span>
          </div>
        </div>
      ) : (
        <div
          className="fixed flex items-center gap-3 overflow-hidden cursor-pointer transition-all duration-200 hover:brightness-110"
          style={{
            left: 37,
            bottom: 37,
            width: 248,
            height: 75,
            background: "rgba(37, 37, 37, 0.15)",
            borderRadius: "10px",
            padding: "0 25px",
            zIndex: 50,
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
          onClick={(e) => { e.stopPropagation(); setShowLoginModal(true); }}
        >
          <LiquidGlassOverlay borderRadius="10px" opacity={0.4} />
          <svg className="relative z-10 shrink-0" width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="10" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <circle cx="11" cy="8" r="2.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <path d="M6 18c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="relative z-10 text-[16px] font-semibold tracking-[-0.48px]" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
            로그인 해주세요
          </span>
        </div>
      )}

      {/* 설정 (Settings) Modal */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 100, background: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => { setShowSettingsModal(false); setEditingNickname(false); }}
        >
          <div
            className="relative overflow-hidden flex flex-col gap-8"
            style={{
              width: 460,
              maxWidth: "90vw",
              background: "rgba(37, 37, 37, 0.15)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: 16,
              padding: "48px 44px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <LiquidGlassOverlay borderRadius="16px" opacity={0.4} />
            <p className="relative z-10 text-[22px] font-bold text-white tracking-[-0.6px]">
              설정
            </p>

            {/* Nickname change */}
            <div className="relative z-10 flex flex-col gap-4">
              <span className="text-[13px] text-[#838383] font-medium tracking-[-0.2px]">닉네임</span>
              {editingNickname ? (
                <div className="flex gap-3">
                  <input
                    className="flex-1 rounded-[12px] text-[14px] font-medium text-white outline-none placeholder:text-[#838383]"
                    style={{ background: "rgba(45, 45, 45, 0.5)", border: "none", padding: "16px 20px" }}
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    placeholder="새 닉네임"
                    maxLength={20}
                    autoFocus
                  />
                  <button
                    className="shrink-0 rounded-[12px] text-[13px] font-semibold text-white cursor-pointer transition-all duration-200 hover:brightness-125"
                    style={{ background: "rgba(107, 92, 45, 0.3)", border: "none", padding: "16px 20px" }}
                    onClick={async () => {
                      if (!newNickname.trim()) return;
                      try {
                        const res = await fetch("/api/auth/update-name", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: newNickname.trim() }),
                        });
                        if (res.ok) {
                          setCurrentUser((prev) => prev ? { ...prev, name: newNickname.trim() } : prev);
                          setEditingNickname(false);
                        }
                      } catch { /* ignore */ }
                    }}
                  >
                    저장
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-[12px]" style={{ background: "rgba(45, 45, 45, 0.3)", padding: "16px 20px" }}>
                  <span className="text-[15px] font-semibold text-white">{currentUser?.name}</span>
                  <button
                    className="text-[13px] font-medium cursor-pointer transition-all duration-200 hover:brightness-125"
                    style={{ color: "rgba(255, 235, 170, 0.8)", background: "none", border: "none" }}
                    onClick={() => { setNewNickname(currentUser?.name ?? ""); setEditingNickname(true); }}
                  >
                    변경
                  </button>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="relative z-10" style={{ height: 1, background: "rgba(255, 255, 255, 0.06)" }} />

            {/* Logout */}
            <button
              className="relative z-10 w-full text-left text-[15px] font-semibold text-white cursor-pointer transition-all duration-200 hover:brightness-125 py-2"
              style={{ background: "none", border: "none" }}
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
            >
              로그아웃
            </button>

            {/* Divider */}
            <div className="relative z-10" style={{ height: 1, background: "rgba(255, 255, 255, 0.06)" }} />

            {/* Delete account */}
            <button
              className="relative z-10 w-full text-left text-[15px] font-semibold cursor-pointer transition-all duration-200 hover:brightness-125 py-2"
              style={{ color: "rgba(255, 100, 100, 0.8)", background: "none", border: "none" }}
              onClick={async () => {
                if (!confirm("정말 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.")) return;
                try {
                  const res = await fetch("/api/auth/delete-account", { method: "POST" });
                  if (res.ok) {
                    window.location.href = "/login";
                  }
                } catch { /* ignore */ }
              }}
            >
              회원탈퇴
            </button>
          </div>
        </div>
      )}

      {/* 내 고민 (My Worries) Modal */}
      {showMyWorriesModal && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 100, background: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setShowMyWorriesModal(false)}
        >
          <div
            className="relative overflow-hidden flex flex-col"
            style={{
              width: 520,
              maxWidth: "90vw",
              maxHeight: "70vh",
              background: "rgba(37, 37, 37, 0.15)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: 16,
              padding: "48px 44px 40px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <LiquidGlassOverlay borderRadius="16px" opacity={0.4} />
            <p className="relative z-10 text-[22px] font-bold text-white tracking-[-0.6px] mb-8">
              내 고민
            </p>

            <div className="relative z-10 flex-1 overflow-y-auto pb-4" style={{ minHeight: 0 }}>
              {worries.filter((w) => w.userId === currentUser?.id).length === 0 ? (
                <p className="text-[14px] text-[#838383] py-12 text-center">작성한 고민이 없습니다</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {worries
                    .filter((w) => w.userId === currentUser?.id)
                    .map((worry) => (
                      <div
                        key={worry.id}
                        className="flex items-center gap-4"
                      >
                        <button
                          className="flex-1 text-left rounded-[12px] cursor-pointer transition-all duration-200 hover:brightness-125"
                          style={{
                            background: "rgba(45, 45, 45, 0.5)",
                            border: "none",
                            color: "white",
                            fontSize: 15,
                            fontWeight: 600,
                            lineHeight: "1.6",
                            padding: "20px 24px",
                          }}
                          onClick={() => {
                            navigateToWorry(worry);
                            setSelectedWorry(worry.id);
                            setShowMyWorriesModal(false);
                          }}
                        >
                          <span className="whitespace-pre-wrap">{worry.text}</span>
                        </button>
                        <button
                          className="shrink-0 rounded-[10px] text-[13px] font-bold cursor-pointer transition-all duration-200 hover:brightness-125"
                          style={{
                            background: "rgba(182, 178, 163, 0.35)",
                            border: "none",
                            color: "rgba(247, 228, 169, 0.95)",
                            whiteSpace: "nowrap",
                            padding: "18px 20px",
                          }}
                          onClick={() => {
                            handleResolveWorry(worry);
                          }}
                        >
                          고민해결
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 작성한 조언 (My Advice) Modal */}
      {showMyAdviceModal && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 100, background: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setShowMyAdviceModal(false)}
        >
          <div
            className="relative overflow-hidden flex flex-col"
            style={{
              width: 520,
              maxWidth: "90vw",
              maxHeight: "70vh",
              background: "rgba(37, 37, 37, 0.15)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: 16,
              padding: "48px 44px 40px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <LiquidGlassOverlay borderRadius="16px" opacity={0.4} />
            <p className="relative z-10 text-[22px] font-bold text-white tracking-[-0.6px] mb-8">
              작성한 조언
            </p>

            <div className="relative z-10 flex-1 overflow-y-auto pb-4" style={{ minHeight: 0 }}>
              {(() => {
                const mySolutions: { worry: Worry; solution: Solution }[] = [];
                worries.forEach((w) => {
                  w.solutions.forEach((s) => {
                    if (s.userId === currentUser?.id) {
                      mySolutions.push({ worry: w, solution: s });
                    }
                  });
                });
                if (mySolutions.length === 0) {
                  return <p className="text-[14px] text-[#838383] py-12 text-center">작성한 조언이 없습니다</p>;
                }
                return (
                  <div className="flex flex-col gap-4">
                    {mySolutions.map(({ worry, solution }) => (
                      <button
                        key={solution.id}
                        className="w-full text-left rounded-[12px] cursor-pointer transition-all duration-200 hover:brightness-125"
                        style={{
                          background: "rgba(45, 45, 45, 0.5)",
                          border: "none",
                          padding: "20px 24px",
                        }}
                        onClick={() => {
                          navigateToSolution(solution.id);
                          setShowMyAdviceModal(false);
                        }}
                      >
                        <p className="text-[15px] font-semibold text-white leading-relaxed whitespace-pre-wrap">{solution.text}</p>
                        <p className="text-[12px] mt-4" style={{ color: "rgba(255, 235, 170, 0.6)" }}>
                          &quot;{worry.text.length > 30 ? worry.text.slice(0, 30) + "..." : worry.text}&quot; 에 대한 조언
                        </p>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* PacMan Eating Animation Overlay */}
      {pacmanAnim && (
        <PacManOverlay
          targetX={pacmanAnim.targetScreenX}
          targetY={pacmanAnim.targetScreenY}
          worrySize={pacmanAnim.worrySize}
          onEaten={async () => {
            // Delete from API and remove from state immediately when eaten
            try {
              await fetch(`/api/worries/${pacmanAnim.dbId}`, { method: "DELETE" });
            } catch { /* ignore */ }
            setWorries((prev) => prev.filter((w) => w.id !== pacmanAnim.worryId));
            if (selectedWorry === pacmanAnim.worryId) {
              setSelectedWorry(null);
            }
            socketRef.current?.emit("worry:deleted", { worryId: pacmanAnim.worryId });
          }}
          onFinished={() => setPacmanAnim(null)}
        />
      )}

      {/* Global SVG filter for liquid glass effect */}
      <LiquidGlassFilter />

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSuccess={(user) => {
            setCurrentUser(user);
            setShowLoginModal(false);
          }}
        />
      )}
    </div>
  );
}

// Orbiting white dots component for worry nodes
function WorryDots({
  size,
  isSelected,
  worryId,
}: {
  size: number;
  isSelected: boolean;
  worryId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const timeRef = useRef(Math.random() * 1000);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dotCount = 28;
    const dots = Array.from({ length: dotCount }, (_, i) => ({
      angle: (i / dotCount) * Math.PI * 2,
      radius: size * 0.85 + Math.random() * 15 - 7,
      speed: (0.003 + Math.random() * 0.004) * (Math.random() > 0.5 ? 1 : -1),
      dotSize: Math.random() * 1.8 + 0.6,
      wobbleAmp: Math.random() * 8 + 3,
      wobbleSpeed: Math.random() * 0.02 + 0.01,
      phase: Math.random() * Math.PI * 2,
    }));

    // Radial light rays
    const rayCount = 12;
    const rays = Array.from({ length: rayCount }, (_, i) => ({
      angle: (i / rayCount) * Math.PI * 2 + Math.random() * 0.3,
      length: size * 0.6 + Math.random() * size * 0.5,
      width: 0.02 + Math.random() * 0.03,
      speed: (0.001 + Math.random() * 0.002) * (Math.random() > 0.5 ? 1 : -1),
      pulseSpeed: 0.008 + Math.random() * 0.012,
      pulsePhase: Math.random() * Math.PI * 2,
      baseOpacity: 0.06 + Math.random() * 0.06,
    }));

    const draw = () => {
      timeRef.current += 1;
      const t = timeRef.current;
      const dim = size * 3.2;
      canvas.width = dim;
      canvas.height = dim;
      const cx = dim / 2;
      const cy = dim / 2;

      ctx.clearRect(0, 0, dim, dim);

      // Radial light rays emanating from center
      for (const ray of rays) {
        ray.angle += ray.speed;
        const pulse = 0.5 + 0.5 * Math.sin(t * ray.pulseSpeed + ray.pulsePhase);
        const opacity = ray.baseOpacity * (0.4 + pulse * 0.6);
        const len = ray.length * (0.8 + pulse * 0.3);

        const grad = ctx.createLinearGradient(
          cx, cy,
          cx + Math.cos(ray.angle) * len,
          cy + Math.sin(ray.angle) * len
        );
        const color = isSelected ? "255, 230, 150" : "255, 235, 170";
        grad.addColorStop(0, `rgba(${color}, ${opacity * 1.5})`);
        grad.addColorStop(0.3, `rgba(${color}, ${opacity})`);
        grad.addColorStop(1, `rgba(${color}, 0)`);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ray.angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(len, -ray.width * len);
        ctx.lineTo(len, ray.width * len);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.restore();

        // Re-create gradient after restore for proper coordinates
        const gx = cx + Math.cos(ray.angle) * len;
        const gy = cy + Math.sin(ray.angle) * len;
        const grad2 = ctx.createLinearGradient(cx, cy, gx, gy);
        grad2.addColorStop(0, `rgba(${color}, ${opacity * 1.5})`);
        grad2.addColorStop(0.3, `rgba(${color}, ${opacity})`);
        grad2.addColorStop(1, `rgba(${color}, 0)`);

        // Draw ray as a thin triangle
        const perpX = -Math.sin(ray.angle) * ray.width * len;
        const perpY = Math.cos(ray.angle) * ray.width * len;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(gx + perpX, gy + perpY);
        ctx.lineTo(gx - perpX, gy - perpY);
        ctx.closePath();
        ctx.fillStyle = grad2;
        ctx.fill();
      }

      // Soft glow in center
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.9);
      grad.addColorStop(0, isSelected ? "rgba(255, 235, 160, 0.15)" : "rgba(255, 240, 180, 0.07)");
      grad.addColorStop(0.5, isSelected ? "rgba(255, 235, 160, 0.05)" : "rgba(255, 240, 180, 0.02)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.9, 0, Math.PI * 2);
      ctx.fill();

      // Draw orbiting dots in warm yellow tones
      for (const dot of dots) {
        dot.angle += dot.speed;
        const wobble = Math.sin(t * dot.wobbleSpeed + dot.phase) * dot.wobbleAmp;
        const r = dot.radius + wobble;
        const x = cx + Math.cos(dot.angle) * r;
        const y = cy + Math.sin(dot.angle) * r;

        ctx.beginPath();
        ctx.arc(x, y, dot.dotSize, 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? "rgba(255, 230, 150, 0.9)"
          : "rgba(255, 235, 170, 0.6)";
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [size, isSelected, worryId]);

  const dim = size * 3.2;
  return (
    <canvas
      ref={canvasRef}
      className="absolute pointer-events-none"
      style={{
        width: dim,
        height: dim,
        marginLeft: -dim / 2,
        marginTop: -dim / 2,
      }}
    />
  );
}

// PacMan overlay animation: enters from right, eats the worry, exits top-left
function PacManOverlay({
  targetX,
  targetY,
  worrySize,
  onEaten,
  onFinished,
}: {
  targetX: number;
  targetY: number;
  worrySize: number;
  onEaten: () => void;
  onFinished: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  // Store callbacks in refs to avoid re-triggering the effect on every render
  const onEatenRef = useRef(onEaten);
  onEatenRef.current = onEaten;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  // Snapshot the target values on mount so re-renders don't reset them
  const targetRef = useRef({ targetX, targetY, worrySize });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { targetX: tx, targetY: ty, worrySize: ws } = targetRef.current;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pacSize = Math.max(ws * 1.3, 50);

    // Phase 1: Enter from right edge → worry position (0 → 0.4)
    // Phase 2: Eat the worry with chomping (0.4 → 0.7)
    // Phase 3: Exit to top-left corner (0.7 → 1.0)
    const startX = canvas.width + pacSize;
    const startY = ty;
    const exitX = -pacSize * 2;
    const exitY = -pacSize * 2;

    const totalDuration = 4200; // longer for leisurely pace
    const startTime = performance.now();

    const particles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }[] = [];
    let particlesSpawned = false;
    let worryEaten = false;
    let completed = false;

    // Wobble parameters for bouncy "뽈뽈뽈" movement
    const wobbleFreqX = 0.008; // horizontal wobble speed
    const wobbleFreqY = 0.012; // vertical bounce speed (faster = more bouncy)
    const wobbleAmpX = 6;
    const wobbleAmpY = 10;
    const squishFreq = 0.014; // body squish frequency

    const draw = (now: number) => {
      if (completed) return;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let pacX: number, pacY: number;
      let mouthOpen: number; // half-opening of mouth in radians
      let facingAngle: number; // direction the mouth points toward
      let currentPacSize = pacSize;
      let squishX = 1, squishY = 1; // body squash & stretch

      if (progress < 0.45) {
        // Phase 1: approach from right — slow, bouncy entrance
        const t = progress / 0.45;
        const ease = 1 - Math.pow(1 - t, 2); // gentler ease-out
        const baseX = startX + (tx - startX) * ease;
        const baseY = startY + (ty - startY) * ease;
        // 뽈뽈뽈 wobble
        pacX = baseX + Math.sin(elapsed * wobbleFreqX) * wobbleAmpX;
        pacY = baseY + Math.abs(Math.sin(elapsed * wobbleFreqY)) * -wobbleAmpY; // bouncing up
        facingAngle = Math.PI; // facing left
        mouthOpen = 0.25 + Math.sin(elapsed * 0.015) * 0.2;
        // Squish: stretch vertically when going up, squash when landing
        const bounce = Math.sin(elapsed * wobbleFreqY);
        squishX = 1 + bounce * 0.08;
        squishY = 1 - bounce * 0.08;
      } else if (progress < 0.65) {
        // Phase 2: eating
        const t = (progress - 0.45) / 0.2;
        pacX = tx;
        pacY = ty;
        facingAngle = Math.PI;
        mouthOpen = 0.35 + Math.sin(elapsed * 0.025) * 0.3;
        currentPacSize = pacSize * (1 + t * 0.25);
        // Excited wobble while eating
        squishX = 1 + Math.sin(elapsed * 0.03) * 0.06;
        squishY = 1 - Math.sin(elapsed * 0.03) * 0.06;

        if (!particlesSpawned && t > 0.3) {
          particlesSpawned = true;
          for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 3;
            particles.push({
              x: tx, y: ty,
              vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
              life: 0, maxLife: 40 + Math.random() * 30,
              size: 2 + Math.random() * 4,
            });
          }
        }

        if (!worryEaten && t > 0.5) {
          worryEaten = true;
          onEatenRef.current();
        }
      } else {
        // Phase 3: exit top-left — slow, bouncy departure
        const t = (progress - 0.65) / 0.35;
        const ease = t * t * t; // slow start, accelerate out
        const baseX = tx + (exitX - tx) * ease;
        const baseY = ty + (exitY - ty) * ease;
        // 뽈뽈뽈 wobble while leaving
        const wobbleStrength = 1 - t * 0.7; // fade wobble as it exits
        pacX = baseX + Math.sin(elapsed * wobbleFreqX * 1.2) * wobbleAmpX * wobbleStrength;
        pacY = baseY + Math.abs(Math.sin(elapsed * wobbleFreqY * 1.2)) * -wobbleAmpY * wobbleStrength;
        facingAngle = Math.atan2(exitY - ty, exitX - tx);
        mouthOpen = 0.2 + Math.sin(elapsed * 0.02) * 0.15;
        currentPacSize = pacSize * 1.25 * (1 - ease * 0.3);
        const bounce = Math.sin(elapsed * squishFreq * 1.2);
        squishX = 1 + bounce * 0.06 * wobbleStrength;
        squishY = 1 - bounce * 0.06 * wobbleStrength;
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.97; p.vy *= 0.97;
        p.life++;
        const alpha = 1 - p.life / p.maxLife;
        if (alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 235, 170, ${alpha * 0.8})`;
        ctx.fill();
      }

      // Worry ghost fading during eat phase
      if (!worryEaten) {
        let worryAlpha = 1;
        if (progress >= 0.45 && progress < 0.65) {
          worryAlpha = Math.max(0, 1 - ((progress - 0.45) / 0.2) * 2);
        }
        if (worryAlpha > 0) {
          ctx.beginPath();
          ctx.arc(tx, ty, ws * 0.5, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, ws * 0.5);
          grad.addColorStop(0, `rgba(255, 240, 180, ${0.15 * worryAlpha})`);
          grad.addColorStop(1, `rgba(255, 235, 170, ${0.05 * worryAlpha})`);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }

      // PacMan body — squash & stretch applied via scale transform
      const r = currentPacSize / 2;
      ctx.save();
      ctx.translate(pacX, pacY);
      ctx.scale(squishX, squishY);
      ctx.shadowColor = "rgba(255, 235, 100, 0.6)";
      ctx.shadowBlur = 25;

      // Arc with mouth pointing at facingAngle
      ctx.beginPath();
      ctx.arc(0, 0, r, facingAngle + mouthOpen, facingAngle - mouthOpen + Math.PI * 2);
      ctx.lineTo(0, 0);
      ctx.closePath();

      const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      bodyGrad.addColorStop(0, "rgba(255, 240, 100, 1)");
      bodyGrad.addColorStop(0.7, "rgba(255, 210, 50, 1)");
      bodyGrad.addColorStop(1, "rgba(230, 180, 30, 0.9)");
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();

      // Eye — always above the PacMan center, slightly toward mouth direction
      const eyeX = pacX + Math.cos(facingAngle) * r * 0.1;
      const eyeY = pacY - r * 0.35;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, r * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = "#1a1a2e";
      ctx.fill();
      // Eye glint
      ctx.beginPath();
      ctx.arc(eyeX + r * 0.04, eyeY - r * 0.04, r * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fill();

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(draw);
      } else {
        completed = true;
        onFinishedRef.current();
      }
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      completed = true;
      cancelAnimationFrame(frameRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount — values are captured via refs

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 200 }}
    />
  );
}

// Dots for solution nodes (green-tinted, smaller)
function SolutionDots({ size }: { size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const timeRef = useRef(Math.random() * 1000);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dotCount = 18;
    const dots = Array.from({ length: dotCount }, (_, i) => ({
      angle: (i / dotCount) * Math.PI * 2,
      radius: size * 0.8 + Math.random() * 10 - 5,
      speed: (0.004 + Math.random() * 0.005) * (Math.random() > 0.5 ? 1 : -1),
      dotSize: Math.random() * 1.3 + 0.4,
      wobbleAmp: Math.random() * 6 + 2,
      wobbleSpeed: Math.random() * 0.02 + 0.01,
      phase: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      timeRef.current += 1;
      const t = timeRef.current;
      const dim = size * 2.8;
      canvas.width = dim;
      canvas.height = dim;
      const cx = dim / 2;
      const cy = dim / 2;

      ctx.clearRect(0, 0, dim, dim);

      // Subtle green glow
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.6);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.04)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.6, 0, Math.PI * 2);
      ctx.fill();

      for (const dot of dots) {
        dot.angle += dot.speed;
        const wobble = Math.sin(t * dot.wobbleSpeed + dot.phase) * dot.wobbleAmp;
        const r = dot.radius + wobble;
        const x = cx + Math.cos(dot.angle) * r;
        const y = cy + Math.sin(dot.angle) * r;

        ctx.beginPath();
        ctx.arc(x, y, dot.dotSize, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [size]);

  const dim = size * 2.8;
  return (
    <canvas
      ref={canvasRef}
      className="absolute pointer-events-none"
      style={{
        width: dim,
        height: dim,
        marginLeft: -dim / 2,
        marginTop: -dim / 2,
      }}
    />
  );
}
