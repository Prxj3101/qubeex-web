'use client';
import Image from 'next/image';
const artwork: Record<string, Record<string, string>> = {
    "categories": {
        "sports": "sports-3d-v1.webp",
        "stationery": "stationery-3d-v2.webp",
        "furniture": "furniture-3d-v2.webp",
        "electronics": "electronics-3d-v2.webp",
        "computers & it": "computers-it-3d-v2.webp",
        "cleaning supplies": "cleaning-3d-v2.webp",
        "lab equipment": "lab-equipment-3d-v2.webp",
        "books & library": "books-library-3d-v2.webp",
        "uniforms": "uniforms-3d-v2.webp",
        "art & craft": "art-craft-3d-v2.webp",
        "tools & hardware": "tools-hardware-3d-v2.webp",
        "medical & first aid": "medical-3d-v2.webp",
        "kitchen & canteen": "kitchen-3d-v2.webp",
        "electrical": "electrical-3d-v2.webp",
        "printing & paper": "printing-3d-v2.webp",
        "miscellaneous": "miscellaneous-3d-v2.webp",
        "stationary": "stationery-3d-v2.webp"
    },
    "units": {
        "pieces": "pieces-3d-v2.webp",
        "box": "box-3d-v2.webp",
        "packet": "packet-3d-v2.webp",
        "set": "set-3d-v2.webp",
        "pair": "pair-3d-v2.webp",
        "dozen": "dozen-3d-v2.webp",
        "ream": "ream-3d-v2.webp",
        "bundle": "bundle-3d-v2.webp",
        "roll": "roll-3d-v2.webp",
        "bottle": "bottle-3d-v2.webp",
        "can": "can-3d-v2.webp",
        "litre": "litre-3d-v2.webp",
        "millilitre": "millilitre-3d-v2.webp",
        "kilogram": "kilogram-3d-v2.webp",
        "gram": "gram-3d-v2.webp",
        "metre": "metre-3d-v2.webp",
        "foot": "foot-3d-v2.webp",
        "sheet": "sheet-3d-v2.webp",
        "book": "book-3d-v2.webp",
        "unit": "unit-3d-v2.webp"
    },
    "locations": {
        "store room": "store-room-3d-v2.webp",
        "principal office": "principal-office-3d-v2.webp",
        "staff room": "staff-room-3d-v2.webp",
        "library": "library-3d-v2.webp",
        "computer lab": "computer-lab-3d-v2.webp",
        "science lab": "science-lab-3d-v2.webp",
        "sports room": "sports-room-3d-v2.webp",
        "reception": "reception-3d-v2.webp",
        "classroom block": "classroom-block-3d-v2.webp",
        "canteen": "canteen-3d-v2.webp"
    }
};
export function SetupArtwork({ kind, name, size = 48 }: { kind: 'categories' | 'units' | 'locations'; name: string; size?: 24 | 48 | 80 }) {
 const fallback = { categories: 'custom-category-3d-v1.webp', units: 'custom-unit-3d-v1.webp', locations: 'custom-location-3d-v1.webp' };
 const src = artwork[kind][name.trim().replace(/\s+/g, ' ').toLowerCase()] || fallback[kind];
 return <span aria-hidden="true" className={`flex shrink-0 items-center justify-center ${size === 80 ? "h-20 w-20" : size === 24 ? "h-6 w-6" : "h-12 w-12"}`}>
  <Image unoptimized src={'/images/inventory/setup/' + src + '?v=3'} alt="" width={size} height={size} draggable={false} className="h-full w-full object-contain select-none" />
 </span>;
}
