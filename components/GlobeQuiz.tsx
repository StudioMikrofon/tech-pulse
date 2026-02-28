"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { playSound } from "@/lib/sounds";

interface Capital {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

const CAPITALS: Capital[] = [
  { name: "Tokyo", country: "Japan", lat: 35.68, lon: 139.69 },
  { name: "London", country: "United Kingdom", lat: 51.51, lon: -0.13 },
  { name: "Paris", country: "France", lat: 48.86, lon: 2.35 },
  { name: "Washington D.C.", country: "United States", lat: 38.91, lon: -77.04 },
  { name: "Beijing", country: "China", lat: 39.91, lon: 116.39 },
  { name: "Moscow", country: "Russia", lat: 55.76, lon: 37.62 },
  { name: "Berlin", country: "Germany", lat: 52.52, lon: 13.41 },
  { name: "Canberra", country: "Australia", lat: -35.28, lon: 149.13 },
  { name: "Brasilia", country: "Brazil", lat: -15.79, lon: -47.88 },
  { name: "Ottawa", country: "Canada", lat: 45.42, lon: -75.70 },
  { name: "New Delhi", country: "India", lat: 28.61, lon: 77.23 },
  { name: "Cairo", country: "Egypt", lat: 30.04, lon: 31.24 },
  { name: "Buenos Aires", country: "Argentina", lat: -34.60, lon: -58.38 },
  { name: "Seoul", country: "South Korea", lat: 37.57, lon: 126.98 },
  { name: "Mexico City", country: "Mexico", lat: 19.43, lon: -99.13 },
  { name: "Jakarta", country: "Indonesia", lat: -6.21, lon: 106.85 },
  { name: "Bangkok", country: "Thailand", lat: 13.76, lon: 100.50 },
  { name: "Rome", country: "Italy", lat: 41.90, lon: 12.50 },
  { name: "Madrid", country: "Spain", lat: 40.42, lon: -3.70 },
  { name: "Ankara", country: "Turkey", lat: 39.93, lon: 32.86 },
  { name: "Nairobi", country: "Kenya", lat: -1.29, lon: 36.82 },
  { name: "Lima", country: "Peru", lat: -12.05, lon: -77.04 },
  { name: "Stockholm", country: "Sweden", lat: 59.33, lon: 18.07 },
  { name: "Oslo", country: "Norway", lat: 59.91, lon: 10.75 },
  { name: "Helsinki", country: "Finland", lat: 60.17, lon: 24.94 },
  { name: "Athens", country: "Greece", lat: 37.98, lon: 23.73 },
  { name: "Lisbon", country: "Portugal", lat: 38.72, lon: -9.14 },
  { name: "Vienna", country: "Austria", lat: 48.21, lon: 16.37 },
  { name: "Warsaw", country: "Poland", lat: 52.23, lon: 21.01 },
  { name: "Prague", country: "Czech Republic", lat: 50.08, lon: 14.44 },
  { name: "Dublin", country: "Ireland", lat: 53.35, lon: -6.26 },
  { name: "Bogota", country: "Colombia", lat: 4.71, lon: -74.07 },
  { name: "Santiago", country: "Chile", lat: -33.45, lon: -70.67 },
  { name: "Hanoi", country: "Vietnam", lat: 21.03, lon: 105.85 },
  { name: "Riyadh", country: "Saudi Arabia", lat: 24.69, lon: 46.72 },
  { name: "Kuala Lumpur", country: "Malaysia", lat: 3.14, lon: 101.69 },
  { name: "Accra", country: "Ghana", lat: 5.56, lon: -0.19 },
  { name: "Rabat", country: "Morocco", lat: 34.02, lon: -6.84 },
  { name: "Kiev", country: "Ukraine", lat: 50.45, lon: 30.52 },
  { name: "Bucharest", country: "Romania", lat: 44.43, lon: 26.10 },
  { name: "Budapest", country: "Hungary", lat: 47.50, lon: 19.04 },
  { name: "Copenhagen", country: "Denmark", lat: 55.68, lon: 12.57 },
  { name: "Reykjavik", country: "Iceland", lat: 64.15, lon: -21.94 },
  { name: "Manila", country: "Philippines", lat: 14.60, lon: 120.98 },
  { name: "Addis Ababa", country: "Ethiopia", lat: 9.03, lon: 38.75 },
  { name: "Havana", country: "Cuba", lat: 23.11, lon: -82.37 },
  { name: "Wellington", country: "New Zealand", lat: -41.29, lon: 174.78 },
  { name: "Islamabad", country: "Pakistan", lat: 33.69, lon: 73.04 },
  { name: "Tehran", country: "Iran", lat: 35.69, lon: 51.39 },
  { name: "Dakar", country: "Senegal", lat: 14.69, lon: -17.44 },
];

const TOTAL_ROUNDS = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface GlobeQuizProps {
  onFlyTo?: (lat: number, lon: number) => void;
  onClose: () => void;
}

export default function GlobeQuiz({ onFlyTo, onClose }: GlobeQuizProps) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const questionsRef = useRef<Capital[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState("");

  // Stable ref for onFlyTo to avoid re-render loops
  const onFlyToRef = useRef(onFlyTo);
  onFlyToRef.current = onFlyTo;

  const startRound = useCallback((roundIdx: number, questions: Capital[]) => {
    if (roundIdx >= TOTAL_ROUNDS) {
      setGameOver(true);
      return;
    }
    const q = questions[roundIdx];
    // Fly globe to location
    onFlyToRef.current?.(q.lat, q.lon);

    // Generate 4 options (1 correct + 3 wrong)
    const wrong = shuffle(CAPITALS.filter(c => c.name !== q.name)).slice(0, 3);
    const opts = shuffle([q, ...wrong].map(c => `${c.name}, ${c.country}`));
    setOptions(opts);
    setCorrectAnswer(`${q.name}, ${q.country}`);
    setAnswered(null);
  }, []);

  useEffect(() => {
    const questions = shuffle(CAPITALS).slice(0, TOTAL_ROUNDS);
    questionsRef.current = questions;
    startRound(0, questions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer = (opt: string) => {
    if (answered !== null) return;
    const isCorrect = opt === correctAnswer;
    setAnswered(isCorrect);

    if (isCorrect) {
      const bonus = streak > 0 ? streak * 5 : 0;
      setScore(s => s + 10 + bonus);
      setStreak(s => s + 1);
      playSound("quizCorrect");
    } else {
      setStreak(0);
      playSound("quizWrong");
    }

    // Auto-advance after 1.5s
    setTimeout(() => {
      const nextRound = round + 1;
      setRound(nextRound);
      if (nextRound >= TOTAL_ROUNDS) {
        setGameOver(true);
      } else {
        startRound(nextRound, questionsRef.current);
      }
    }, 1500);
  };

  const restart = () => {
    setScore(0);
    setStreak(0);
    setRound(0);
    setGameOver(false);
    const questions = shuffle(CAPITALS).slice(0, TOTAL_ROUNDS);
    questionsRef.current = questions;
    startRound(0, questions);
  };

  if (gameOver) {
    return (
      <div className="glass-card p-6 text-center space-y-4 max-w-sm mx-auto">
        <h3 className="font-heading text-2xl font-bold text-accent-amber">Quiz Complete!</h3>
        <p className="text-4xl font-bold font-mono text-text-primary">{score}</p>
        <p className="text-sm text-text-secondary">points</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={restart}
            className="px-4 py-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan font-mono text-sm hover:bg-accent-cyan/20 transition-colors cursor-pointer"
          >
            Play Again
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-text-secondary font-mono text-sm hover:bg-white/10 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 space-y-3 max-w-sm mx-auto !hover:transform-none">
      {/* HUD */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-text-secondary">Round {round + 1}/{TOTAL_ROUNDS}</span>
        <span className="text-accent-amber font-bold">Score: {score}</span>
        {streak > 1 && (
          <span className="text-red-400 font-bold">Streak x{streak}</span>
        )}
      </div>

      <p className="text-sm text-text-primary font-semibold text-center">
        Where is this location?
      </p>

      {/* Options */}
      <div className="grid grid-cols-1 gap-2">
        {options.map((opt) => {
          let btnClass = "w-full text-left px-3 py-2 rounded-lg border text-sm font-mono transition-all cursor-pointer ";
          if (answered !== null) {
            if (opt === correctAnswer) {
              btnClass += "bg-green-400/20 border-green-400/40 text-green-400";
            } else if (answered === false && opt !== correctAnswer) {
              btnClass += "bg-white/5 border-white/10 text-text-secondary opacity-50";
            } else {
              btnClass += "bg-white/5 border-white/10 text-text-secondary opacity-50";
            }
          } else {
            btnClass += "bg-white/5 border-white/10 text-text-primary hover:bg-accent-cyan/10 hover:border-accent-cyan/30";
          }

          return (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              className={btnClass}
              disabled={answered !== null}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {answered !== null && (
        <p className={`text-xs font-mono text-center ${answered ? "text-green-400" : "text-red-400"}`}>
          {answered ? "Correct!" : `Wrong! It was ${correctAnswer}`}
        </p>
      )}
    </div>
  );
}
