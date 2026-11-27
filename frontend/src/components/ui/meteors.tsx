import { cn } from "@/lib/utils";
import { motion } from "motion/react";

/** Aceternity Meteors: thin streaks falling across a panel.  */
export const Meteors = ({ number = 20, className }: { number?: number; className?: string }) => {
  // Scattered by index, not Math.random, so every render keeps the same timings.
  const meteors = Array.from({ length: number }, (_, idx) => ({
    left: idx * (800 / number) - 400 + "px",
    animationDelay: ((idx * 37) % 50) / 10 + "s",
    animationDuration: 5 + ((idx * 7) % 5) + "s",
  }));
  return (
    <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      {meteors.map((style, idx) => (
        <span
          key={idx}
          className={cn(
            "animate-meteor-effect pointer-events-none absolute h-0.5 w-0.5 rotate-[45deg] rounded-[9999px] bg-slate-500 shadow-[0_0_0_1px_#ffffff10]",
            "before:absolute before:top-1/2 before:h-[1px] before:w-[50px] before:-translate-y-[50%] before:transform before:bg-gradient-to-r before:from-[#64748b] before:to-transparent before:content-['']",
            className,
          )}
          style={{ top: "-40px", ...style }}
        />
      ))}
    </motion.div>
  );
};
