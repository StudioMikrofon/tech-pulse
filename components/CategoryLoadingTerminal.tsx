"use client";

import { useState, useEffect } from "react";
import type { Category } from "@/lib/types";

const TERMINAL_LINES: Record<Category, string[]> = {
  ai: [
    "> LOADING AI NEURAL FEED...",
    "> PARSING MODELS... [OK]",
    "> FEED ACTIVE",
  ],
  gaming: [
    "> INITIALIZING GAME DATA STREAM...",
    "> LOADING ASSETS... [OK]",
    "> PLAYER READY",
  ],
  space: [
    "> SCANNING DEEP SPACE...",
    "> CALIBRATING SENSORS... [OK]",
    "> SIGNAL ACQUIRED",
  ],
  technology: [
    "> CONNECTING TO TECH GRID...",
    "> COMPILING SOURCES... [OK]",
    "> STREAM ONLINE",
  ],
  medicine: [
    "> ACCESSING BIOMEDICAL DB...",
    "> ANALYZING DATA POINTS... [OK]",
    "> RESULTS READY",
  ],
  society: [
    "> MONITORING GLOBAL FEEDS...",
    "> AGGREGATING REPORTS... [OK]",
    "> FEED SYNCHRONIZED",
  ],
  robotics: [
    "> BOOTING ROBOTICS CORE...",
    "> RUNNING DIAGNOSTICS... [OK]",
    "> SYSTEMS NOMINAL",
  ],
};

const CATEGORY_COLORS: Record<Category, string> = {
  ai: "#A78BFA",
  gaming: "#F87171",
  space: "#60A5FA",
  technology: "#34D399",
  medicine: "#FB923C",
  society: "#F472B6",
  robotics: "#38BDF8",
};

interface Props {
  category: Category;
}

export default function CategoryLoadingTerminal({ category }: Props) {
  const [visible, setVisible] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [currentText, setCurrentText] = useState("");
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const key = `cat-terminal-${category}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(key)) {
      return; // already shown this session
    }
    setVisible(true);

    const allLines = TERMINAL_LINES[category] || TERMINAL_LINES.technology;
    let lineIdx = 0;
    let charIdx = 0;
    let completedLines: string[] = [];

    const typeInterval = setInterval(() => {
      if (lineIdx >= allLines.length) {
        clearInterval(typeInterval);
        // Fade out after short delay
        setTimeout(() => {
          setFading(true);
          setTimeout(() => {
            setVisible(false);
            if (typeof window !== "undefined") {
              sessionStorage.setItem(key, "1");
            }
          }, 400);
        }, 300);
        return;
      }

      const currentLine = allLines[lineIdx];
      charIdx++;
      setCurrentText(currentLine.slice(0, charIdx));

      if (charIdx >= currentLine.length) {
        completedLines = [...completedLines, currentLine];
        setLines([...completedLines]);
        setCurrentText("");
        lineIdx++;
        charIdx = 0;
      }
    }, 35);

    return () => clearInterval(typeInterval);
  }, [category]);

  if (!visible) return null;

  const color = CATEGORY_COLORS[category];

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 font-mono text-xs transition-opacity duration-400 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{
        borderColor: `${color}30`,
        background: `linear-gradient(135deg, rgba(5,7,16,0.9), ${color}08)`,
      }}
    >
      {lines.map((line, i) => (
        <div key={i} style={{ color: line.includes("[OK]") ? "#34D399" : `${color}CC` }}>
          {line}
        </div>
      ))}
      {currentText && (
        <div style={{ color: `${color}CC` }}>
          {currentText}
          <span className="animate-pulse">_</span>
        </div>
      )}
    </div>
  );
}
