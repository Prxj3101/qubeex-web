'use client';

export default function PencilLoader({ size = 120 }: { size?: number }) {
    return (
        <div style={{ width: size, height: size }}>
            <style>{`
                :root { --pencil-accent: #000000; --pencil-lead: #000000; }
                .dark { --pencil-accent: #D97757; --pencil-lead: #D97757; }
                .pencil__body1, .pencil__body2, .pencil__body3,
                .pencil__eraser, .pencil__eraser-skew,
                .pencil__point, .pencil__rotate, .pencil__stroke {
                    animation-duration: 2s;
                    animation-timing-function: linear;
                    animation-iteration-count: infinite;
                }
                .pencil__body1, .pencil__body2, .pencil__body3 { transform: rotate(-90deg); }
                .pencil__body1 { animation-name: pencilBody1; }
                .pencil__body2 { animation-name: pencilBody2; }
                .pencil__body3 { animation-name: pencilBody3; }
                .pencil__eraser {
                    animation-name: pencilEraser;
                    transform: rotate(-90deg) translate(49px, 0);
                }
                .pencil__eraser-skew {
                    animation-name: pencilEraserSkew;
                    animation-timing-function: ease-in-out;
                }
                .pencil__point {
                    animation-name: pencilPoint;
                    transform: rotate(-90deg) translate(49px, -30px);
                }
                .pencil__rotate { animation-name: pencilRotate; }
                .pencil__stroke {
                    animation-name: pencilStroke;
                    transform: translate(100px, 100px) rotate(-113deg);
                }

                @keyframes pencilBody1 {
                    from, to { stroke-dashoffset: 351.86; transform: rotate(-90deg); }
                    50% { stroke-dashoffset: 150.8; transform: rotate(-225deg); }
                }
                @keyframes pencilBody2 {
                    from, to { stroke-dashoffset: 406.84; transform: rotate(-90deg); }
                    50% { stroke-dashoffset: 174.36; transform: rotate(-225deg); }
                }
                @keyframes pencilBody3 {
                    from, to { stroke-dashoffset: 296.88; transform: rotate(-90deg); }
                    50% { stroke-dashoffset: 127.23; transform: rotate(-225deg); }
                }
                @keyframes pencilEraser {
                    from, to { transform: rotate(-45deg) translate(49px, 0); }
                    50% { transform: rotate(0deg) translate(49px, 0); }
                }
                @keyframes pencilEraserSkew {
                    from, 32.5%, 67.5%, to { transform: skewX(0); }
                    35%, 65% { transform: skewX(-4deg); }
                    37.5%, 62.5% { transform: skewX(8deg); }
                    40%, 45%, 50%, 55%, 60% { transform: skewX(-15deg); }
                    42.5%, 47.5%, 52.5%, 57.5% { transform: skewX(15deg); }
                }
                @keyframes pencilPoint {
                    from, to { transform: rotate(-90deg) translate(49px, -30px); }
                    50% { transform: rotate(-225deg) translate(49px, -30px); }
                }
                @keyframes pencilRotate {
                    from { transform: translate(100px, 100px) rotate(0); }
                    to   { transform: translate(100px, 100px) rotate(720deg); }
                }
                @keyframes pencilStroke {
                    from { stroke-dashoffset: 439.82; transform: translate(100px, 100px) rotate(-113deg); }
                    50%  { stroke-dashoffset: 164.93; transform: translate(100px, 100px) rotate(-113deg); }
                    75%, to { stroke-dashoffset: 439.82; transform: translate(100px, 100px) rotate(112deg); }
                }
            `}</style>

            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
                style={{ width: '100%', height: '100%', display: 'block' }}>
                <defs>
                    <clipPath id="pe-web">
                        <rect rx="5" ry="5" width="30" height="30" />
                    </clipPath>
                </defs>

                {/* Stroke — line being drawn */}
                <circle className="pencil__stroke" r="70" fill="none"
                    stroke="var(--pencil-accent, #D97757)" strokeWidth="2"
                    strokeDasharray="439.82 439.82" strokeDashoffset="439.82"
                    strokeLinecap="round"
                    transform="rotate(-113,100,100)" />

                {/* Rotating pencil group */}
                <g className="pencil__rotate" transform="translate(100,100)">
                    <g fill="none">
                        <circle className="pencil__body1" r="64"
                            stroke="#D97757" strokeWidth="30"
                            strokeDasharray="402.12 402.12" strokeDashoffset="402"
                            transform="rotate(-90)" />
                        <circle className="pencil__body2" r="74"
                            stroke="#E89578" strokeWidth="10"
                            strokeDasharray="464.96 464.96" strokeDashoffset="465"
                            transform="rotate(-90)" />
                        <circle className="pencil__body3" r="54"
                            stroke="#C05F3C" strokeWidth="10"
                            strokeDasharray="339.29 339.29" strokeDashoffset="339"
                            transform="rotate(-90)" />
                    </g>

                    {/* Eraser */}
                    <g className="pencil__eraser" transform="rotate(-90) translate(49,0)">
                        <g className="pencil__eraser-skew">
                            <rect fill="#EBB49E" rx="5" ry="5" width="30" height="30" />
                            <rect fill="#D97757" width="5" height="30" clipPath="url(#pe-web)" />
                            <rect fill="#FAF8FF" width="30" height="20" />
                            <rect fill="#EDE9FE" width="15" height="20" />
                            <rect fill="#F4F0FA" width="5" height="20" />
                            <rect fill="rgba(45,31,16,0.2)" y="6" width="30" height="2" />
                            <rect fill="rgba(45,31,16,0.2)" y="13" width="30" height="2" />
                        </g>
                    </g>

                    {/* Pencil tip */}
                    <g className="pencil__point" transform="rotate(-90) translate(49,-30)">
                        <polygon fill="#F4A261" points="15 0,30 30,0 30" />
                        <polygon fill="#E07C3A" points="15 0,6 30,0 30" />
                        <polygon fill="var(--pencil-lead, #D97757)" points="15 0,20 10,10 10" />
                    </g>
                </g>
            </svg>
        </div>
    );
}
