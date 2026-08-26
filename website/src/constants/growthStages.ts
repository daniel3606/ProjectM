export interface GrowthStage {
  id: string;
  sizeCm: number;
  objectName: string;
  message: string;
}

/** Curated stages for the landing growth showcase (from app growthStages). */
export const SHOWCASE_STAGES: GrowthStage[] = [
  {
    id: "blueberry",
    sizeCm: 2,
    objectName: "Blueberry",
    message: "Small and sweet — your very first step.",
  },
  {
    id: "strawberry",
    sizeCm: 4,
    objectName: "Strawberry",
    message: "Sweet progress.",
  },
  {
    id: "cupcake",
    sizeCm: 10,
    objectName: "Cupcake",
    message: "Sweet milestone!",
  },
  {
    id: "donut",
    sizeCm: 12,
    objectName: "Donut",
    message: "Keep the momentum rolling!",
  },
  {
    id: "teddy_bear",
    sizeCm: 28,
    objectName: "Teddy Bear",
    message: "Soft, strong, and growing.",
  },
  {
    id: "cat",
    sizeCm: 70,
    objectName: "Cat",
    message: "Cat-sized discipline.",
  },
];
