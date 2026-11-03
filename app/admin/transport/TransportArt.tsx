'use client';

import Image from 'next/image';

const files = {
    bus: 'school-bus-3d-v1.webp',
    route: 'bus-route-3d-v1.webp',
    school: 'school-location-3d-v1.webp',
} as const;

/** 3D artwork for the Transport screens (bus, route, school location). */
export function TransportArt({ kind, size = 40 }: { kind: keyof typeof files; size?: number }) {
    return (
        <span aria-hidden="true" className="flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
            <Image unoptimized src={`/images/transport/${files[kind]}`} alt="" width={size} height={size} draggable={false} className="h-full w-full object-contain select-none" />
        </span>
    );
}
