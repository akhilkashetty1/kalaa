"use client";

import { useEffect, useRef, useState } from "react";
import { useMotion } from "./motion";

// Two small raw-WebGL scenes, drawn with the site's own colours. No 3D library: each is one fragment shader.
//  - "orb": a raymarched, softly morphing glass-like sphere that turns toward the pointer.
//  - "aurora": slow flowing colour behind the page.
// They only animate while on screen, with the tab visible and motion allowed, and fall back to a
// CSS gradient when WebGL isn't available.

export type ShaderColors = { bg: string; a: string; b: string; ink: string };

const VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
const HEAD = "precision highp float; uniform vec2 uRes; uniform float uT; uniform vec2 uM; uniform vec3 uBg; uniform vec3 uA; uniform vec3 uB; uniform vec3 uInk;\n";

const ORB = HEAD + `
float sdf(vec3 p){
  float t = uT;
  float d = length(p) - 1.0;
  d += 0.16 * sin(p.x*2.6 + t*0.8) * sin(p.y*2.9 + t*0.65) * sin(p.z*2.4 + t*0.9);
  d += 0.05 * sin(p.x*7.0 - t*1.4) * sin(p.y*6.0 + t*1.1) * sin(p.z*6.5);
  return d * 0.75;
}
vec3 nrm(vec3 p){
  vec2 e = vec2(0.003, 0.0);
  return normalize(vec3(sdf(p+e.xyy)-sdf(p-e.xyy), sdf(p+e.yxy)-sdf(p-e.yxy), sdf(p+e.yyx)-sdf(p-e.yyx)));
}
mat2 rot(float a){ float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / min(uRes.x, uRes.y);
  vec3 ro = vec3(0.0, 0.0, 5.6);
  vec3 rd = normalize(vec3(uv, -1.7));
  float ay = (uM.x - 0.5) * 1.1;
  float ax = (0.5 - uM.y) * 0.8;
  ro.yz = rot(ax) * ro.yz; rd.yz = rot(ax) * rd.yz;
  ro.xz = rot(ay) * ro.xz; rd.xz = rot(ay) * rd.xz;
  // Only march rays that pass through a bounding sphere; everything else is background and costs almost nothing.
  float tt = 0.0; float hit = 0.0;
  float bq = dot(ro, rd); float bh = bq*bq - (dot(ro, ro) - 1.8*1.8);
  if (bh > 0.0) {
    tt = max(0.0, -bq - sqrt(bh));
    for (int i = 0; i < 48; i++) {
      float d = sdf(ro + rd*tt);
      if (d < 0.003) { hit = 1.0; break; }
      tt += d;
      if (tt > 9.0) break;
    }
  }
  vec3 col = vec3(0.0); float a = 0.0;
  if (hit > 0.5) {
    vec3 p = ro + rd*tt; vec3 n = nrm(p); vec3 v = -rd;
    vec3 l1 = normalize(vec3(0.6, 0.8, 0.7)); vec3 l2 = normalize(vec3(-0.7, -0.3, 0.4));
    float dif = max(dot(n, l1), 0.0)*0.9 + max(dot(n, l2), 0.0)*0.35;
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    float spe = pow(max(dot(reflect(-l1, n), v), 0.0), 40.0);
    float k = 0.5 + 0.5*sin(n.y*2.2 + n.x*1.6 + uT*0.35);
    vec3 base = mix(uA, uB, k);
    col = base*(0.18 + dif) + fres*mix(uB, uInk, 0.35)*0.85 + spe*0.8;
    a = 1.0;
  }
  float halo = exp(-6.0*max(length(uv) - 0.30, 0.0)) * 0.20 * smoothstep(0.5, 0.34, length(uv));
  col += (1.0 - a) * mix(uA, uB, 0.5) * halo;
  a = max(a, halo);
  gl_FragColor = vec4(col, a);
}`;

const AURORA = HEAD + `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0 - 2.0*f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a*noise(p); p *= 2.02; a *= 0.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.0;
  float t = uT * 0.06;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0*q + vec2(1.7, 9.2) + 0.15*t), fbm(p + 3.0*q + vec2(8.3, 2.8) + 0.126*t));
  float f = fbm(p + 3.0*r);
  vec3 col = mix(uBg, uA, smoothstep(0.25, 0.85, f) * 0.6);
  col = mix(col, uB, smoothstep(0.35, 1.0, length(q)) * 0.34);
  gl_FragColor = vec4(col, 1.0);
}`;

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function ShaderCanvas({ kind, colors, className = "", interactive = false }: { kind: "orb" | "aurora"; colors: ShaderColors; className?: string; interactive?: boolean }) {
  const motion = useMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef(colors);
  const motionRef = useRef(motion);
  const redraw = useRef<() => void>(() => {});
  const [unsupported, setUnsupported] = useState(false);
  colorsRef.current = colors;
  motionRef.current = motion;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) return setUnsupported(true);

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
      console.warn(`[kalaa] ${kind} shader did not compile, using a gradient instead:`, gl.getShaderInfoLog(s));
      return null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, kind === "orb" ? ORB : AURORA);
    if (!vs || !fs) return setUnsupported(true);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return setUnsupported(true);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const [uRes, uT, uM, uBg, uA, uB, uInk] = ["uRes", "uT", "uM", "uBg", "uA", "uB", "uInk"].map(u);

    const scale = kind === "aurora" ? 0.35 : Math.min(window.devicePixelRatio || 1, 1.25) * 0.7; // smooth shading hides the lower resolution
    const resize = () => {
      const w = Math.max(2, Math.round(canvas.clientWidth * scale));
      const h = Math.max(2, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
    };

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let visible = true;
    let raf = 0;
    let t0 = performance.now();
    let frozenAt = 3.2; // the still frame used when motion is off

    const draw = (time: number) => {
      resize();
      const c = colorsRef.current;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uT, time);
      gl.uniform2f(uM, mouse.x, mouse.y);
      gl.uniform3fv(uBg, rgb(c.bg));
      gl.uniform3fv(uA, rgb(c.a));
      gl.uniform3fv(uB, rgb(c.b));
      gl.uniform3fv(uInk, rgb(c.ink));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const animating = () => motionRef.current !== "off" && visible && !document.hidden;
    let lastDraw = 0;
    const frame = (now: number) => {
      raf = 0;
      if (!animating()) return;
      if (now - lastDraw < (kind === "aurora" ? 45 : 28)) { raf = requestAnimationFrame(frame); return; } // the motion is slow, so ~35 fps (orb) and ~22 fps (aurora) look the same and cost far less
      lastDraw = now;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      draw((now - t0) / 1000 + frozenAt);
      raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (animating()) {
        if (!raf) raf = requestAnimationFrame(frame);
      } else draw(frozenAt);
    };
    redraw.current = kick;

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      kick();
    });
    io.observe(canvas);
    const ro = new ResizeObserver(kick);
    ro.observe(canvas);
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.tx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      mouse.ty = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    };
    if (interactive) window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", kick);
    t0 = performance.now();
    kick();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", kick);
      redraw.current = () => {};
      // Free what this effect made, but leave the context alive: React may run the effect again on the same canvas.
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [kind, interactive]);

  // Colour or motion changes: repaint (or start/stop the loop) without rebuilding the scene.
  useEffect(() => {
    redraw.current();
  }, [colors.bg, colors.a, colors.b, colors.ink, motion]);

  if (unsupported) {
    return (
      <div
        className={`shader-fallback ${className}`}
        aria-hidden="true"
        style={{ background: `radial-gradient(60% 60% at 30% 35%, ${colors.a}, transparent 70%), radial-gradient(55% 55% at 70% 65%, ${colors.b}, transparent 70%)`, opacity: kind === "orb" ? 0.9 : 0.5 }}
      />
    );
  }
  return <canvas ref={canvasRef} className={`shader ${className}`} aria-hidden="true" />;
}
