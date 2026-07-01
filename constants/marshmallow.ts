export const MARSHMALLOW_COLORS = [
  { name: "Strawberry", hex: "#FFB5C2" },
  { name: "Classic", hex: "#FFF5EE" },
  { name: "Blue Berry", hex: "#B5D8FF" },
  { name: "Mint", hex: "#B5FFCB" },
  { name: "Pineapple", hex: "#f5e689" },
  { name: "Grape", hex: "#D4B5FF" },
  { name: "Peach", hex: "#FFD4B5" },
  { name: "Cherry", hex: "#FF9EBF" },
] as const;

export const DURATION_OPTIONS = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "4 hours", minutes: 240 },
] as const;

export function getSizeDescription(cm: number): string {
  if (cm < 3) return "A tiny marshmallow seed";
  if (cm < 5) return "A little marshmallow sprout";
  if (cm < 10) return "A small but sweet marshmallow";
  if (cm < 15) return "A growing marshmallow";
  if (cm < 20) return "A healthy fluffy marshmallow";
  if (cm < 30) return "A big cuddly marshmallow";
  if (cm < 50) return "A magnificent marshmallow";
  return "A legendary marshmallow!";
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
