import { animate, useMotionValue, useTransform } from "motion/react";
import { useEffect, useState } from "react";

function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1.2,
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const motionVal = useMotionValue(0);
  const display = useTransform(motionVal, (v) => v.toFixed(decimals));
  const [text, setText] = useState("0");

  useEffect(() => {
    const unsubscribe = display.on("change", setText);
    const controls = animate(motionVal, value, {
      duration,
      ease: [0.25, 0.46, 0.45, 0.94],
    });

    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, duration, motionVal, display]);

  return <span className={className}>{text}</span>;
}

export { AnimatedNumber };
