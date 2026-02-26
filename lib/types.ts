export const CATEGORIES = [
  "ai",
  "gaming",
  "space",
  "technology",
  "medicine",
  "society",
  "robotics",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  ai: "AI",
  gaming: "Gaming",
  space: "Space",
  technology: "Technology",
  medicine: "Medicine",
  society: "Society",
  robotics: "Robotics",
};

export const CATEGORY_COLORS: Record<Category, string> = {
  ai: "#A78BFA",
  gaming: "#F87171",
  space: "#60A5FA",
  technology: "#34D399",
  medicine: "#FB923C",
  society: "#F472B6",
  robotics: "#38BDF8",
};

export interface GeoLocation {
  name: string;
  lat: number;
  lon: number;
  countryCode: string;
}

export interface ArticleSource {
  name: string;
  url: string;
}

export interface ArticleImage {
  url: string;
  alt: string;
}

export interface Article {
  id: string;
  title: string;
  category: Category;
  date: string;
  excerpt: string;
  source: ArticleSource;
  image: ArticleImage;
  tags: string[];
  geo: GeoLocation;
  featured: boolean;
  approved: boolean;
  videoUrl?: string;
  content: string;
}
