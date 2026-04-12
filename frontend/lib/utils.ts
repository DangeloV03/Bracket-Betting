import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isLocked(lockAt: string) {
  return new Date(lockAt) <= new Date();
}

export const ROUND_LABELS: Record<string, string> = {
  playin: "Play-In",
  first_round: "First Round",
  semifinals: "Conference Semifinals",
  conference_finals: "Conference Finals",
  finals: "NBA Finals",
};
