#!/usr/bin/env python3
"""Generate Suction Cup home-screen icons."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]

BG = (15, 20, 25)
ACCENT = (61, 156, 245)
FORCE = (245, 158, 11)
LAND = (82, 168, 108)
OCEAN_INNER = (76, 163, 224)
OCEAN_OUTER = (26, 95, 138)
SURFACE = (36, 48, 68)


def lerp_color(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_earth(draw: ImageDraw.ImageDraw, center: tuple[int, int], radius: int) -> None:
    cx, cy = center
    for y in range(cy - radius - 2, cy + radius + 3):
        for x in range(cx - radius - 2, cx + radius + 3):
            dx = x - cx
            dy = y - cy
            dist = math.hypot(dx, dy)
            if dist > radius:
                continue
            light = max(0.0, 1.0 - (dx / radius) * 0.35 - (dy / radius) * 0.15)
            depth = math.sqrt(max(0.0, 1.0 - (dist / radius) ** 2))
            t = min(1.0, max(0.0, 0.35 + depth * 0.45))
            color = lerp_color(OCEAN_OUTER, OCEAN_INNER, t * light)

            angle = math.atan2(dy, dx)
            if dist < radius * 0.82:
                if -1.1 < angle < 0.4 and dy > -radius * 0.35:
                    color = lerp_color(color, LAND, 0.72)
                elif 0.8 < angle < 2.2 and dist < radius * 0.55:
                    color = lerp_color(color, LAND, 0.55)

            draw.point((x, y), fill=color)

    draw.ellipse(
        (cx - radius - 3, cy - radius - 3, cx + radius + 3, cy + radius + 3),
        outline=(120, 190, 255, 110),
        width=max(2, radius // 36),
    )


def draw_pressure_arrows(draw: ImageDraw.ImageDraw, center: tuple[int, int], earth_radius: int) -> None:
    cx, cy = center
    outer = earth_radius + int(earth_radius * 0.42)
    inner = earth_radius + int(earth_radius * 0.08)
    count = 14

    for i in range(count):
        angle = (i / count) * math.tau - math.pi / 2
        cos_a = math.cos(angle)
        sin_a = math.sin(angle)
        x1 = cx + outer * cos_a
        y1 = cy + outer * sin_a
        x2 = cx + inner * cos_a
        y2 = cy + inner * sin_a
        tip_x = cx + (earth_radius + 4) * cos_a
        tip_y = cy + (earth_radius + 4) * sin_a
        wing = earth_radius * 0.11
        px = -sin_a * wing
        py = cos_a * wing
        alpha = 170 if i % 3 else 210
        color = (*ACCENT, alpha)
        draw.line((x1, y1, x2, y2), fill=color, width=max(2, earth_radius // 28))
        draw.polygon(
            [
                (tip_x, tip_y),
                (x2 + px, y2 + py),
                (x2 - px, y2 - py),
            ],
            fill=color,
        )


def draw_suction_cup(draw: ImageDraw.ImageDraw, center: tuple[int, int], size: int) -> None:
    cx, cy = center
    cup_w = size
    cup_h = int(size * 0.62)
    left = cx - cup_w // 2
    right = cx + cup_w // 2
    top = cy - cup_h // 2
    bottom = cy + cup_h // 2

    draw.rounded_rectangle(
        (left, bottom - max(4, size // 10), right, bottom + max(5, size // 8)),
        radius=max(3, size // 12),
        fill=FORCE,
    )
    draw.chord(
        (left, top, right, bottom + cup_h // 3),
        start=180,
        end=0,
        fill=SURFACE,
    )
    draw.arc(
        (left + size // 10, top + size // 12, right - size // 10, bottom),
        start=200,
        end=340,
        fill=(220, 230, 245, 90),
        width=max(2, size // 18),
    )
    draw.ellipse(
        (
            cx - size // 5,
            top + size // 8,
            cx + size // 5,
            top + size // 3,
        ),
        fill=(90, 110, 135),
    )


def build_icon(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG + (255,))
    draw = ImageDraw.Draw(canvas)

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    earth_center = (size // 2, int(size * 0.43))
    earth_radius = int(size * 0.24)
    glow_draw.ellipse(
        (
            earth_center[0] - earth_radius - 18,
            earth_center[1] - earth_radius - 18,
            earth_center[0] + earth_radius + 18,
            earth_center[1] + earth_radius + 18,
        ),
        fill=(40, 100, 180, 28),
    )
    canvas = Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(radius=size // 48)))

    draw = ImageDraw.Draw(canvas)
    draw_pressure_arrows(draw, earth_center, earth_radius)
    draw_earth(draw, earth_center, earth_radius)
    draw_suction_cup(draw, (size // 2, int(size * 0.78)), int(size * 0.28))

    return canvas.convert("RGB")


def save_icons() -> None:
    icon_512 = build_icon(512)
    icon_512.save(ROOT / "icon-512.png", "PNG")

    icon_180 = icon_512.resize((180, 180), Image.Resampling.LANCZOS)
    icon_180.save(ROOT / "apple-touch-icon.png", "PNG")

    print(f"Wrote {ROOT / 'icon-512.png'}")
    print(f"Wrote {ROOT / 'apple-touch-icon.png'}")


if __name__ == "__main__":
    save_icons()