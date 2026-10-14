'use client';
import { SetupArtwork } from './SetupArtwork';
export function CategoryArtwork({ name, size = 48 }: { name: string; size?: 24 | 48 | 80 }) {
 return <SetupArtwork kind="categories" name={name} size={size} />;
}
