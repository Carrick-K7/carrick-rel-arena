import type { ActorPerformance } from '../../shared/contracts.js';

interface PortraitProps {
  performance: ActorPerformance;
  round: number;
  compact?: boolean;
}

const mouthPaths: Record<
  ActorPerformance['expression']['mouth'],
  string
> = {
  line: 'M 246 300 Q 265 298 284 300',
  smirk: 'M 245 301 Q 266 305 285 296',
  downturned: 'M 245 303 Q 265 293 285 303',
  parted: 'M 247 299 Q 265 307 283 299 Q 265 313 247 299',
  'small-smile': 'M 246 297 Q 265 310 284 297',
};

const browPaths: Record<
  ActorPerformance['expression']['brows'],
  [string, string]
> = {
  flat: ['M 224 242 Q 239 238 250 242', 'M 280 242 Q 292 238 306 242'],
  furrowed: [
    'M 224 239 Q 240 237 252 246',
    'M 278 246 Q 290 237 306 239',
  ],
  raised: [
    'M 223 235 Q 239 228 252 235',
    'M 278 235 Q 292 228 307 235',
  ],
  soft: ['M 224 240 Q 239 235 251 239', 'M 279 239 Q 292 235 306 240'],
};

export function Portrait({
  performance,
  round,
  compact = false,
}: PortraitProps) {
  const [leftBrow, rightBrow] = browPaths[performance.expression.brows];
  const className = [
    'portrait',
    compact ? 'portrait--compact' : '',
    `emotion-${performance.emotion}`,
    `tone-${performance.tone}`,
    `pose-${performance.action.pose}`,
    `gesture-${performance.action.gesture}`,
    `eyes-${performance.expression.eyes}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <figure className={className}>
      <div className="portrait__frame">
        <svg
          viewBox="0 0 530 680"
          role="img"
          aria-label={`黎岚，${performance.emotion}，${performance.action.stageDirection}`}
        >
          <defs>
            <linearGradient id="roomGlow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#21182e" />
              <stop offset="0.54" stopColor="#100d18" />
              <stop offset="1" stopColor="#0a1018" />
            </linearGradient>
            <radialGradient id="lampGlow" cx="0.78" cy="0.18" r="0.56">
              <stop offset="0" stopColor="#f6bd73" stopOpacity="0.28" />
              <stop offset="1" stopColor="#f6bd73" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="coat" x1="0" y1="0" x2="0.7" y2="1">
              <stop offset="0" stopColor="#3e324c" />
              <stop offset="1" stopColor="#211b2a" />
            </linearGradient>
            <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
          </defs>

          <rect width="530" height="680" fill="url(#roomGlow)" />
          <rect width="530" height="680" fill="url(#lampGlow)" />

          <g className="room">
            <path d="M 52 0 V 510 H 12 V 0 Z" fill="#0c0c14" />
            <path d="M 42 510 H 500" stroke="#55455f" strokeOpacity=".35" />
            <rect
              x="373"
              y="68"
              width="96"
              height="182"
              rx="4"
              fill="#0a1420"
              stroke="#6a5870"
              strokeOpacity=".4"
            />
            <path
              d="M 377 151 Q 420 124 465 146 M 377 190 Q 421 169 465 190"
              stroke="#28394b"
              strokeWidth="3"
              opacity=".8"
            />
            <circle cx="445" cy="91" r="4" fill="#f2b56f" opacity=".75" />
            <path
              d="M 85 91 h 86 l 16 75 H 69 Z"
              fill="#d9915b"
              opacity=".2"
            />
            <rect x="119" y="166" width="7" height="126" fill="#493644" />
            <ellipse
              cx="123"
              cy="166"
              rx="92"
              ry="56"
              fill="#efad68"
              opacity=".12"
              filter="url(#softShadow)"
            />
          </g>

          <g className="suitcase">
            <path
              d="M 415 508 V 447 Q 415 432 430 432 H 440 Q 455 432 455 447 V 508"
              fill="none"
              stroke="#777080"
              strokeWidth="6"
            />
            <rect
              x="385"
              y="495"
              width="101"
              height="150"
              rx="16"
              fill="#272331"
              stroke="#88798e"
              strokeWidth="3"
            />
            <path
              d="M 410 514 V 624 M 461 514 V 624"
              stroke="#534b5c"
              strokeWidth="3"
            />
            <circle cx="406" cy="650" r="8" fill="#0b0a0f" />
            <circle cx="465" cy="650" r="8" fill="#0b0a0f" />
            <rect x="423" y="529" width="25" height="6" rx="3" fill="#a68e98" />
          </g>

          <g className="portrait-character">
            <ellipse
              cx="267"
              cy="649"
              rx="132"
              ry="20"
              fill="#05070a"
              opacity=".5"
            />
            <path
              d="M 225 532 L 205 650 H 253 L 267 540 L 284 650 H 332 L 305 528 Z"
              fill="#171724"
            />
            <path
              d="M 176 438 Q 192 371 232 357 L 298 356 Q 350 372 363 448 L 344 575 Q 270 606 187 573 Z"
              fill="url(#coat)"
              stroke="#56455f"
              strokeWidth="2"
            />
            <path
              d="M 230 355 Q 264 379 300 355 L 289 420 L 239 420 Z"
              fill="#c78677"
            />
            <path
              d="M 234 348 Q 265 373 296 348 V 381 Q 266 408 235 381 Z"
              fill="#d49a88"
            />

            <g className="head">
              <path
                d="M 194 160 Q 210 91 270 91 Q 335 90 350 168 L 337 284 Q 321 350 269 362 Q 216 349 201 284 Z"
                fill="#d79b88"
              />
              <path
                d="M 195 177 Q 191 101 258 79 Q 337 71 355 153 Q 337 137 312 122 Q 278 160 213 162 L 201 237 Q 180 202 195 177 Z"
                fill="#17141d"
              />
              <path
                d="M 308 117 Q 363 155 336 302 Q 370 259 361 166 Q 350 92 282 79 Z"
                fill="#211a27"
              />
              <path
                d="M 205 175 Q 186 171 187 207 Q 190 236 208 230"
                fill="#d79b88"
                stroke="#bc7f73"
                strokeWidth="2"
              />
              <path
                d="M 337 175 Q 354 172 350 209 Q 347 236 333 230"
                fill="#d79b88"
                stroke="#bc7f73"
                strokeWidth="2"
              />

              <g className="brows" fill="none" stroke="#30242a" strokeWidth="6" strokeLinecap="round">
                <path d={leftBrow} />
                <path d={rightBrow} />
              </g>

              <g className="eyes">
                <path
                  className="eye eye--left"
                  d="M 225 263 Q 238 253 251 263 Q 238 273 225 263"
                  fill="#f2ddd1"
                  stroke="#49323a"
                  strokeWidth="3"
                />
                <path
                  className="eye eye--right"
                  d="M 279 263 Q 292 253 305 263 Q 292 273 279 263"
                  fill="#f2ddd1"
                  stroke="#49323a"
                  strokeWidth="3"
                />
                <circle className="pupil pupil--left" cx="239" cy="263" r="5" fill="#241d23" />
                <circle className="pupil pupil--right" cx="292" cy="263" r="5" fill="#241d23" />
                <path
                  className="tear tear--left"
                  d="M 228 271 Q 226 284 232 291"
                  fill="none"
                  stroke="#b9e4ef"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </g>

              <path
                d="M 266 266 Q 260 283 263 290 Q 268 294 275 290"
                fill="none"
                stroke="#ad726b"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                className="mouth"
                d={mouthPaths[performance.expression.mouth]}
                fill="none"
                stroke="#793d49"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </g>

            <g className="arms arms--crossed">
              <path
                d="M 196 402 Q 226 460 315 489"
                fill="none"
                stroke="#3b3047"
                strokeWidth="36"
                strokeLinecap="round"
              />
              <path
                d="M 337 410 Q 306 466 219 491"
                fill="none"
                stroke="#44364f"
                strokeWidth="34"
                strokeLinecap="round"
              />
              <circle cx="315" cy="489" r="16" fill="#d39a89" />
              <circle cx="219" cy="491" r="16" fill="#d39a89" />
            </g>

            <g className="arms arms--handle">
              <path
                d="M 194 407 Q 229 461 245 529"
                fill="none"
                stroke="#3b3047"
                strokeWidth="35"
                strokeLinecap="round"
              />
              <path
                d="M 340 410 Q 374 472 420 505"
                fill="none"
                stroke="#44364f"
                strokeWidth="34"
                strokeLinecap="round"
              />
              <circle cx="423" cy="508" r="17" fill="#d39a89" />
            </g>

            <g className="arms arms--relaxed">
              <path
                d="M 194 411 Q 196 493 215 555"
                fill="none"
                stroke="#3b3047"
                strokeWidth="34"
                strokeLinecap="round"
              />
              <path
                d="M 341 411 Q 342 492 326 553"
                fill="none"
                stroke="#44364f"
                strokeWidth="34"
                strokeLinecap="round"
              />
              <circle cx="215" cy="555" r="16" fill="#d39a89" />
              <circle cx="326" cy="553" r="16" fill="#d39a89" />
            </g>

            <g className="phone">
              <rect
                x="329"
                y="440"
                width="45"
                height="76"
                rx="8"
                fill="#090b12"
                stroke="#85808c"
                strokeWidth="2"
              />
              <rect x="334" y="448" width="35" height="55" rx="4" fill="#193449" />
              <circle cx="351" cy="509" r="3" fill="#6c6871" />
            </g>
          </g>

          <g className="scene-counter">
            <text x="30" y="625" fill="#a89bad" fontSize="13" letterSpacing="2">
              01:0{Math.min(9, 7 + round)}
            </text>
            <text x="30" y="648" fill="#e7dbe7" fontSize="12">
              司机距你们 {Math.max(0, 7 - round)} 轮
            </text>
          </g>
        </svg>
        <div className="portrait__grain" />
        <span className="portrait__emotion">
          {emotionLabel(performance.emotion)}
        </span>
      </div>
      {!compact && (
        <figcaption>{performance.action.stageDirection}</figcaption>
      )}
    </figure>
  );
}

function emotionLabel(emotion: ActorPerformance['emotion']): string {
  const labels: Record<ActorPerformance['emotion'], string> = {
    guarded: '戒备',
    angry: '生气',
    hurt: '受伤',
    testing: '试探',
    softening: '动摇',
    warm: '放软',
    done: '心冷',
  };
  return labels[emotion];
}
