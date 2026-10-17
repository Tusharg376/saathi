/**
 * App icon as vector art (no fonts, so it renders identically everywhere): a vehicle
 * number plate resting on a road. The blue strip on the LEFT is the cue that makes it
 * read as an Indian plate (not a bank card); the yellow dashes beneath are the lane line.
 * Everything sits inside the central 62% so it survives circular "maskable" cropping.
 */
export function IconArt({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#15171b" />

      {/* plate, with the thin inner rule real plates have */}
      <rect x="82" y="112" width="348" height="204" rx="30" fill="#f6c700" />
      <rect x="96" y="126" width="320" height="176" rx="20" fill="none" stroke="#15171b" strokeWidth="8" />

      {/* blue strip on the left edge, like the IND strip on a real plate */}
      <path d="M116 126 H170 V302 H116 A20 20 0 0 1 96 282 V146 A20 20 0 0 1 116 126 Z" fill="#12449a" />
      <circle cx="133" cy="214" r="15" fill="none" stroke="#ffffff" strokeWidth="5" />

      {/* a bold S: the name's initial, drawn as a stroke so it needs no font.
          Scaled to sit clear of the plate's inner rule (stroke 33 x 0.72 = about 24 on screen). */}
      <g transform="translate(300 214) scale(0.72) translate(-300 -222)">
        <path
          d="M366 178 C358 152 332 140 302 140 C268 140 246 158 246 184 C246 208 268 217 302 224 C336 231 362 242 362 266 C362 292 336 304 302 304 C268 304 246 292 238 268"
          fill="none"
          stroke="#15171b"
          strokeWidth="33"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* the road: a lane line under the plate */}
      <rect x="112" y="368" width="72" height="22" rx="8" fill="#f6c700" />
      <rect x="220" y="368" width="72" height="22" rx="8" fill="#f6c700" />
      <rect x="328" y="368" width="72" height="22" rx="8" fill="#f6c700" />
    </svg>
  );
}
