// Shared look for the "school drawing book" landing page.
export const INK = '#26294A';
export const TERRA = '#DA7756';
export const PAPER = '#F4F3EF';
export const HAND = { fontFamily: 'var(--font-hand), "Comic Sans MS", cursive' } as const;

// White drawing-book paper (cold press): a soft bumpy "tooth" lit from the
// top left, plus very fine grain. Generated as seamless SVG tiles.
const svg = (body: string, size = 320) =>
    `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>${body}</svg>`)}")`;

// big soft bumps
const TOOTH = svg(
    `<filter id='t' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.06' numOctaves='4' seed='5' stitchTiles='stitch' result='n'/>` +
    `<feDiffuseLighting in='n' lighting-color='#ffffff' surfaceScale='1.9' diffuseConstant='1.05'><feDistantLight azimuth='235' elevation='48'/></feDiffuseLighting></filter>` +
    `<rect width='100%' height='100%' filter='url(#t)' opacity='0.16'/>`,
);
// small crisp bumps on top
const FINE = svg(
    `<filter id='f' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.32' numOctaves='2' seed='11' stitchTiles='stitch' result='n'/>` +
    `<feDiffuseLighting in='n' lighting-color='#ffffff' surfaceScale='1.2'><feDistantLight azimuth='235' elevation='60'/></feDiffuseLighting></filter>` +
    `<rect width='100%' height='100%' filter='url(#f)' opacity='0.09'/>`,
    256,
);
// fine grain
const GRAIN = svg(
    `<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' seed='4' stitchTiles='stitch'/>` +
    `<feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='linear' slope='0.045'/></feComponentTransfer></filter>` +
    `<rect width='100%' height='100%' filter='url(#g)'/>`,
    200,
);

export const paper = {
    backgroundColor: PAPER,
    backgroundImage: [TOOTH, FINE, GRAIN].join(', '),
    backgroundSize: '320px 320px, 256px 256px, 200px 200px',
    backgroundBlendMode: 'multiply, multiply, multiply',
} as const;

// Kept for any section that still wants ruled lines.
export const ruled = paper;
