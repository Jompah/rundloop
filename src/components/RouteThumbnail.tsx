'use client';

import { useRef, useEffect } from 'react';

/**
 * Route/trace thumbnail rendered on a canvas element.
 * @param points - Array of {lat, lng} objects (NOT [lng, lat] tuples).
 *   For polyline data stored as [lng, lat][], callers must map to {lat, lng} before passing.
 * @param size - Canvas CSS size in pixels (default 80). Actual canvas is 2x for retina.
 * @param color - Stroke color (default '#4ade80' / green-400).
 */
interface RouteThumbnailProps {
  points: { lat: number; lng: number }[];
  size?: number;
  color?: string;
}

export function RouteThumbnail({ points, size = 80, color = '#4ade80' }: RouteThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = size * 2;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    ctx.clearRect(0, 0, canvasSize, canvasSize);

    if (points.length < 2) return;

    // Sample points if too many
    let sampled = points;
    if (points.length > 100) {
      const step = Math.ceil(points.length / 100);
      sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
      // Always include last point
      if (sampled[sampled.length - 1] !== points[points.length - 1]) {
        sampled.push(points[points.length - 1]);
      }
    }

    // Compute bounding box
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const p of sampled) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }

    const padding = 8 * 2; // 8px CSS padding * 2 for retina
    const drawSize = canvasSize - padding * 2;
    const latRange = maxLat - minLat || 0.0001;
    const lngRange = maxLng - minLng || 0.0001;
    const scale = Math.min(drawSize / lngRange, drawSize / latRange);

    const offsetX = (canvasSize - lngRange * scale) / 2;
    const offsetY = (canvasSize - latRange * scale) / 2;

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    for (let i = 0; i < sampled.length; i++) {
      const x = (sampled[i].lng - minLng) * scale + offsetX;
      // Flip Y: canvas Y increases downward, lat increases upward
      const y = (maxLat - sampled[i].lat) * scale + offsetY;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }, [points, size, color]);

  return (
    <div
      className="bg-gray-700 rounded-xl overflow-hidden"
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
      />
    </div>
  );
}
