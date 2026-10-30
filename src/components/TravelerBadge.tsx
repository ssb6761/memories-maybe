import { Traveler } from "@/lib/types";

export function TravelerAvatar({ traveler, size = 22 }: { traveler: Traveler; size?: number }) {
  return (
    <span
      title={traveler.name}
      style={{ backgroundColor: traveler.color, width: size, height: size, fontSize: size * 0.42 }}
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-white font-bold text-white"
    >
      {traveler.name.slice(0, 1)}
    </span>
  );
}

export function TravelerStack({ travelers, size = 22 }: { travelers: Traveler[]; size?: number }) {
  return (
    <div className="flex -space-x-2">
      {travelers.map((t) => (
        <TravelerAvatar key={t.id} traveler={t} size={size} />
      ))}
    </div>
  );
}
