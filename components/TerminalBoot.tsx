"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { playSound } from "@/lib/sounds";

const BOOT_LINES = [
  "> INITIALIZING TECH AND SPACE v2.0...",
  "> CONNECTING TO ORBITAL NETWORK...",
  "> LOADING STAR CHARTS... [OK]",
  "> SYNCING GLOBAL NEWS FEED... [OK]",
  "> ACTIVATING NEURAL INTERFACE... [OK]",
  "> SYSTEM ONLINE",
];

const CHAR_DELAY = 20;
const LINE_PAUSE = 200;
const FADE_OUT_DELAY = 600;
const SESSION_KEY = "tp-booted";

export default function TerminalBoot() {
  const [visible, setVisible] = useState<boolean>(false);
  const [lines, setLines] = useState<string[]>([]);
  const [currentText, setCurrentText] = useState<string>("");
  const [cursorVisible, setCursorVisible] = useState<boolean>(true);
  const [phase, setPhase] = useState<"typing" | "flash" | "fadeout" | "done">(
    "typing"
  );

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cursorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    if (cursorIntervalRef.current) {
      clearInterval(cursorIntervalRef.current);
      cursorIntervalRef.current = null;
    }
  }, []);

  // Check session storage and decide whether to show
  useEffect(() => {
    if (typeof window === "undefined") return;

    const alreadyBooted = sessionStorage.getItem(SESSION_KEY);
    if (alreadyBooted) {
      setPhase("done");
      return;
    }

    setVisible(true);
    playSound("boot");

    // Blinking cursor interval
    cursorIntervalRef.current = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 400);

    return () => clearAllTimers();
  }, [clearAllTimers]);

  // Main typing sequence
  useEffect(() => {
    if (!visible || phase !== "typing") return;

    let globalDelay = 0;
    let lineIndex = 0;

    const scheduleChar = (
      line: string,
      charIndex: number,
      baseDelay: number
    ): number => {
      const delay = baseDelay + charIndex * CHAR_DELAY;
      const timer = setTimeout(() => {
        setCurrentText(line.slice(0, charIndex + 1));
      }, delay);
      timersRef.current.push(timer);
      return delay;
    };

    for (lineIndex = 0; lineIndex < BOOT_LINES.length; lineIndex++) {
      const line = BOOT_LINES[lineIndex];
      const lineStartDelay = globalDelay;

      // Type each character of this line
      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        scheduleChar(line, charIdx, lineStartDelay);
      }

      const lineEndDelay = lineStartDelay + line.length * CHAR_DELAY;

      // After line finishes, commit it to completed lines and clear current
      const isLast = lineIndex === BOOT_LINES.length - 1;
      const commitTimer = setTimeout(() => {
        setLines((prev) => [...prev, line]);
        setCurrentText("");

        if (isLast) {
          // Begin exit sequence
          playSound("success");
          const flashTimer = setTimeout(() => {
            setPhase("flash");

            const fadeTimer = setTimeout(() => {
              setPhase("fadeout");

              const doneTimer = setTimeout(() => {
                setPhase("done");
                setVisible(false);
                sessionStorage.setItem(SESSION_KEY, "true");
              }, FADE_OUT_DELAY);
              timersRef.current.push(doneTimer);
            }, 120);
            timersRef.current.push(fadeTimer);
          }, 300);
          timersRef.current.push(flashTimer);
        }
      }, lineEndDelay + 50);
      timersRef.current.push(commitTimer);

      globalDelay = lineEndDelay + LINE_PAUSE;
    }
  }, [visible, phase]);

  if (phase === "done" || !visible) return null;

  return (
    <div
      className={`terminal-boot-overlay ${phase === "flash" ? "flash" : ""} ${phase === "fadeout" ? "fadeout" : ""}`}
    >
      <style jsx>{`
        .terminal-boot-overlay {
          position: fixed;
          inset: 0;
          z-index: 60;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: "Courier New", "Lucida Console", monospace;
          animation: crt-flicker 0.08s infinite alternate;
          transition: opacity 0.5s ease-out;
        }

        .terminal-boot-overlay.flash {
          background: #fff;
          animation: white-flash 0.12s ease-out forwards;
        }

        .terminal-boot-overlay.fadeout {
          opacity: 0;
          pointer-events: none;
        }

        /* CRT scan lines */
        .terminal-boot-overlay::before {
          content: "";
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 255, 65, 0.03) 2px,
            rgba(0, 255, 65, 0.03) 4px
          );
          pointer-events: none;
          z-index: 1;
        }

        /* CRT edge glow / vignette */
        .terminal-boot-overlay::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse at center,
            transparent 50%,
            rgba(0, 0, 0, 0.6) 100%
          );
          pointer-events: none;
          z-index: 2;
        }

        .boot-content {
          position: relative;
          z-index: 3;
          width: 100%;
          max-width: 700px;
          padding: 2rem;
          text-shadow: 0 0 8px rgba(0, 255, 65, 0.6);
        }

        .boot-line {
          color: #00ff41;
          font-size: 1rem;
          line-height: 1.8;
          white-space: pre;
        }

        .boot-line-current {
          color: #00ff41;
          font-size: 1rem;
          line-height: 1.8;
          white-space: pre;
        }

        .cursor {
          display: inline-block;
          width: 0.6em;
          height: 1.1em;
          background: #00ff41;
          vertical-align: text-bottom;
          margin-left: 1px;
        }

        .cursor-hidden {
          opacity: 0;
        }

        @keyframes crt-flicker {
          0% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(0.97);
          }
          100% {
            filter: brightness(1.02);
          }
        }

        @keyframes white-flash {
          0% {
            background: #fff;
          }
          100% {
            background: #000;
          }
        }
      `}</style>

      <div className="boot-content">
        {lines.map((line, i) => (
          <div key={i} className="boot-line">
            {line}
          </div>
        ))}
        {currentText && (
          <div className="boot-line-current">
            {currentText}
            <span
              className={`cursor ${cursorVisible ? "" : "cursor-hidden"}`}
            />
          </div>
        )}
        {!currentText && phase === "typing" && (
          <div className="boot-line-current">
            <span
              className={`cursor ${cursorVisible ? "" : "cursor-hidden"}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
