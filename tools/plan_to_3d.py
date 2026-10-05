#!/usr/bin/env python3
"""
plan_to_3d.py - turn a builder's 2D floor-plan picture into an isometric "dollhouse" picture. Free, offline, no AI model.

    python plan_to_3d.py plan.png                      # writes plan_3d.png next to the input
    python plan_to_3d.py plan.png -o out.png --yaw 35 --pitch 52 --wall-height 7

How it works: dark-grey, thick strokes of the drawing are treated as walls (thin lines, text and furniture outlines are
ignored), very dark thick blocks (kitchen counters) become low counters, the original coloured drawing is laid on the
floor, and the walls are raised and shaded. It does not invent furniture or exact heights, so treat it as a visual aid.
Needs: pip install opencv-python-headless numpy pillow
"""
import argparse, math, sys
from pathlib import Path
import cv2
import numpy as np


def find_walls(rgb, wall_lo=62, wall_hi=135, counter_max=62, thick=3, grey_tol=22):
    """Returns (wall_mask, counter_mask) at the image's own resolution. thick = minimum wall thickness in px."""
    f = rgb.astype(np.int32)
    lum = (f[..., 0] * 299 + f[..., 1] * 587 + f[..., 2] * 114) // 1000
    grey = (f.max(axis=2) - f.min(axis=2)) <= grey_tol          # walls are neutral grey/black, furniture is coloured
    wall = (grey & (lum >= wall_lo) & (lum <= wall_hi)).astype(np.uint8)
    dark = (grey & (lum < counter_max)).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (thick, thick))
    kt = cv2.getStructuringElement(cv2.MORPH_RECT, (thick + 2, thick + 2))
    wall = cv2.dilate(cv2.erode(wall, k), k)
    dark = cv2.dilate(cv2.erode(dark, kt), kt)                    # text is thin, so it vanishes; counters stay
    wall = np.where(dark > 0, 0, wall)
    # drop specks
    n, lab, st, _ = cv2.connectedComponentsWithStats(wall, connectivity=8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 60:
            wall[lab == i] = 0
    return wall, dark


def crop_to_walls(rgb, wall, counter, pad=28):
    ys, xs = np.nonzero(wall | counter)
    y0, y1 = max(0, ys.min() - pad), min(rgb.shape[0], ys.max() + pad)
    x0, x1 = max(0, xs.min() - pad), min(rgb.shape[1], xs.max() + pad)
    return rgb[y0:y1, x0:x1], wall[y0:y1, x0:x1], counter[y0:y1, x0:x1]


def render(rgb, wall, counter, yaw=35.0, pitch=52.0, wall_h=0.075, counter_h=0.028, out_w=1800, cell=2):
    rgb, wall, counter = crop_to_walls(rgb, wall, counter)
    H, W = rgb.shape[:2]
    # coarse grid keeps polygon count manageable
    gh, gw = H // cell, W // cell
    wg = cv2.resize(wall, (gw, gh), interpolation=cv2.INTER_AREA) > 0.4 * 255 / 255
    wg = cv2.resize(wall.astype(np.float32), (gw, gh), interpolation=cv2.INTER_AREA) > 0.45
    cg = cv2.resize(counter.astype(np.float32), (gw, gh), interpolation=cv2.INTER_AREA) > 0.45
    cg &= ~wg
    scale_units = float(W)                   # world units = source pixels; heights are a fraction of plan width
    hw, hc = wall_h * W, counter_h * W
    ya, pa = math.radians(yaw), math.radians(pitch)
    cy, sy, cp, sp = math.cos(ya), math.sin(ya), math.cos(pa), math.sin(pa)

    def proj(x, y, z):                       # x right, z down the plan, y up; orthographic
        x -= W / 2; z -= H / 2
        rx = x * cy - z * sy
        rz = x * sy + z * cy
        return rx, -(y * cp) + rz * sp        # screen x, screen y (down)

    corners = [proj(x, 0, z) for x, z in ((0, 0), (W, 0), (W, H), (0, H))]
    xs = [c[0] for c in corners]; ys = [c[1] for c in corners]
    top = min(ys) - hw * cp * 1.2
    sc = (out_w * 0.92) / (max(xs) - min(xs))
    ox = -min(xs) * sc + out_w * 0.04
    oy = -top * sc + 20
    out_h = int((max(ys) - top) * sc + 60)

    def P(x, y, z):
        px, py = proj(x, y, z)
        return (px * sc + ox, py * sc + oy)

    canvas = np.full((out_h, out_w, 3), 255, np.uint8)
    # soft backdrop
    canvas[:] = (247, 244, 238)
    # floor: homography from plan corners
    src = np.float32([[0, 0], [W, 0], [W, H], [0, H]])
    dst = np.float32([P(x, 0, z) for x, z in ((0, 0), (W, 0), (W, H), (0, H))])
    M = cv2.getPerspectiveTransform(src, dst)
    floor = cv2.warpPerspective(rgb, M, (out_w, out_h), flags=cv2.INTER_AREA, borderValue=(0, 0, 0))
    mask = cv2.warpPerspective(np.full((H, W), 255, np.uint8), M, (out_w, out_h))
    # a faint shadow under the plan
    sh = cv2.GaussianBlur(cv2.warpPerspective(np.full((H, W), 255, np.uint8), M, (out_w, out_h)), (0, 0), 14)
    canvas = (canvas * (1 - 0.10 * (sh[..., None] / 255.0))).astype(np.uint8)
    canvas = np.where(mask[..., None] > 0, floor, canvas)
    canvas = canvas.copy()

    # walls and counters back-to-front. Depth = distance along the camera's ground direction.
    cells = [(r, c, hw if wg[r, c] else hc) for r, c in zip(*np.nonzero(wg | cg))]
    def depth(rc):
        r, c, _ = rc
        x = (c + .5) * cell - W / 2; z = (r + .5) * cell - H / 2
        return x * sy + z * cy
    cells.sort(key=depth)                    # far (small) first
    top_col = {True: (245, 241, 232), False: (60, 60, 64)}
    for r, c, h in cells:
        x0, x1, z0, z1 = c * cell, (c + 1) * cell + 0.6, r * cell, (r + 1) * cell + 0.6
        is_wall = h == hw
        faces = []
        # side faces: draw the four sides; nearer cells overpaint hidden ones
        faces.append(([(x0, z1), (x1, z1)], 0.78))   # +z side
        faces.append(([(x1, z0), (x1, z1)], 0.62))   # +x side
        faces.append(([(x0, z0), (x1, z0)], 0.86))   # -z side
        faces.append(([(x0, z0), (x0, z1)], 0.70))   # -x side
        for (a, b), shade in faces:
            # only draw sides whose outward normal faces the camera
            if a[0] == b[0]:
                nx, nz = (1, 0) if a[0] == x1 else (-1, 0)
            else:
                nx, nz = (0, 1) if a[1] == z1 else (0, -1)
            if nx * sy + nz * cy >= 0 and False:
                continue
            quad = np.array([P(a[0], 0, a[1]), P(b[0], 0, b[1]), P(b[0], h, b[1]), P(a[0], h, a[1])], np.int32)
            base = (238, 232, 218) if is_wall else (58, 58, 62)
            col = tuple(int(v * shade) for v in base)
            cv2.fillConvexPoly(canvas, quad, col, cv2.LINE_8)
        quad = np.array([P(x0, h, z0), P(x1, h, z0), P(x1, h, z1), P(x0, h, z1)], np.int32)
        t = top_col[is_wall]
        cv2.fillConvexPoly(canvas, quad, t, cv2.LINE_8)
    return canvas


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan"); ap.add_argument("-o", "--out")
    ap.add_argument("--yaw", type=float, default=35); ap.add_argument("--pitch", type=float, default=52)
    ap.add_argument("--wall-height", type=float, default=6.0, help="percent of the plan width (default 6)")
    ap.add_argument("--wall-light", type=int, default=62, help="darkest grey counted as wall"); ap.add_argument("--wall-dark", type=int, default=135, help="lightest grey counted as wall")
    ap.add_argument("--thick", type=int, default=3, help="thinnest wall in pixels; raise to ignore more thin lines")
    ap.add_argument("--width", type=int, default=1800)
    a = ap.parse_args()
    img = cv2.imread(a.plan, cv2.IMREAD_UNCHANGED)
    if img is None: sys.exit("Could not read the image.")
    if img.ndim == 3 and img.shape[2] == 4:
        al = img[..., 3:4] / 255.0
        img = (img[..., :3] * al + 255 * (1 - al)).astype(np.uint8)
    elif img.ndim == 2: img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    wall, counter = find_walls(rgb, a.wall_light, a.wall_dark, thick=a.thick)
    if wall.sum() < 500: sys.exit("No walls found. Try --wall-dark 160 or a lower --thick.")
    out = render(rgb, wall, counter, a.yaw, a.pitch, a.wall_height / 100, out_w=a.width)
    dest = Path(a.out) if a.out else Path(a.plan).with_name(Path(a.plan).stem + "_3d.png")
    cv2.imwrite(str(dest), cv2.cvtColor(out, cv2.COLOR_RGB2BGR))
    print("Saved", dest)

if __name__ == "__main__":
    main()
