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

export const CATEGORY_LABELS_HR: Record<Category, string> = {
  ai: "Umjetna inteligencija",
  gaming: "Gaming",
  space: "Svemir",
  technology: "Tehnologija",
  medicine: "Medicina",
  society: "Društvo",
  robotics: "Robotika",
};

export const CATEGORY_COLORS: Record<Category, string> = {
  ai: "#00cfff",
  gaming: "#00b8e6",
  space: "#00cfff",
  technology: "#00b8e6",
  medicine: "#00cfff",
  society: "#00b8e6",
  robotics: "#00cfff",
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
  dbId?: number;
  title: string;
  category: Category;
  date: string;
  excerpt: string;
  source: ArticleSource;
  image: ArticleImage;
  subtitle?: string;
  subtitleImage?: ArticleImage;
  tags: string[];
  geo: GeoLocation;
  featured: boolean;
  approved: boolean;
  videoUrl?: string;
  content: string;
}
