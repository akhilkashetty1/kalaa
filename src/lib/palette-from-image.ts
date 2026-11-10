// Suggests brand colours from a logo, in the browser. The image is drawn small onto a canvas and its
// pixels are grouped into coarse colour buckets; the most prominent, most colourful buckets win, with
// near-white, near-black and grey buckets down-weighted so the suggestions are usable accents.
// Library images are same-origin, so the canvas isn't tainted. A cross-origin https link can't be read
// and yields no suggestions.

type Bucket = { n: number; r: number; g: number; b: number };

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
}

export async function paletteFromImage(src: string, count = 5): Promise<string[]> {
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    await img.decode();
    const w = 64;
    const h = Math.max(1, Math.min(128, Math.round((w * (img.naturalHeight || w)) / (img.naturalWidth || w))));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const buckets = new Map<number, Bucket>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue; // transparent
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      cur.n++;
      cur.r += r;
      cur.g += g;
      cur.b += b;
      buckets.set(key, cur);
    }

    const scored = [...buckets.values()].map((k) => {
      const [r, g, b] = [k.r / k.n, k.g / k.n, k.b / k.n];
      const light = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
      const edge = light > 0.93 || light < 0.07 ? 0.04 : 1; // paper white and ink black are rarely the brand colour
      return { r, g, b, score: k.n * edge * (0.15 + saturation(r, g, b)) };
    });
    scored.sort((a, b) => b.score - a.score);

    const picked: typeof scored = [];
    for (const c of scored) {
      if (picked.length >= count) break;
      if (picked.every((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) > 70)) picked.push(c);
    }
    return picked.map((c) => hex(c.r, c.g, c.b));
  } catch {
    return [];
  }
}
