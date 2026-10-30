# Prints the vtGenie keyframes used in assets/motion.css: python3 scripts/genie.py
# the genie: the page's outline bends into a funnel whose neck sits at the bottom centre, then the page slides down
# through it. A clip-path polygon with N points down each side, sampled per keyframe (same point count throughout).
N = 12
NECK = 0.05          # half the neck's width
A_MAX = 0.5 - NECK   # how far each side pulls in at the neck
def smooth(a, y):
    if y <= a: return 0.0
    u = min(1.0, (y - a) / (1 - a)); return u * u * (3 - 2 * u)
def poly(A, a, T):
    # T: how far the page has slid down (fraction of its height); the funnel is fixed on the screen
    left = []; right = []
    for i in range(N):
        e = (1 - T) * i / (N - 1); y = e + T
        l = A * smooth(a, y)
        left.append((l, e)); right.append((1 - l, e))
    pts = left + right[::-1]
    return 'polygon(' + ', '.join(f'{x*100:.2f}% {y*100:.2f}%' for x, y in pts) + ')'
frames = []
# 0 to 32%: the outline bends (eased out); the funnel starts a quarter of the way down
for k in range(0, 5):
    t = k / 4; p = 1 - (1 - t) ** 3
    frames.append((0.32 * t, poly(A_MAX * p, 0.6 - 0.35 * p, 0.0), 0.0))
# 32% to 100%: the page slides down through the neck, picking up speed (eased in)
for k in range(1, 9):
    t = k / 8; T = t ** 1.8
    frames.append((0.32 + 0.68 * t, poly(A_MAX, 0.25, min(T, 1.0)), min(T, 1.0)))
out = ['@keyframes vtGenie {']
for at, cp, T in frames:
    out.append(f'  {at*100:.1f}% {{ clip-path: {cp}; transform: translateY({T*100:.2f}%); }}')
out.append('}')
print('\n'.join(out))
