import type { WeeklySnapshotsRouterOutputs } from "@/utils/types";
import { Button } from "@corex/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@corex/ui/components/dialog";
import { ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";

import { GoalsSlide } from "./goals-slide";
import { HighlightsSlide } from "./highlights-slide";
import { IntroSlide } from "./intro-slide";

export type WeeklyWrappedSnapshot = NonNullable<
  WeeklySnapshotsRouterOutputs["getLatest"]
>;
export type WeeklyWrappedData = WeeklyWrappedSnapshot["payload"];

interface WeeklyWrappedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: WeeklyWrappedData;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.96,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.96,
  }),
};

export function WeeklyWrapped({
  open,
  onOpenChange,
  data,
}: WeeklyWrappedProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const slides = useMemo(() => {
    const items: React.ReactNode[] = [<IntroSlide key="intro" data={data} />];

    if (data.goals.length > 0) {
      items.push(<GoalsSlide key="goals" data={data} />);
    }

    if (
      data.highlights &&
      (data.highlights.longestRunMeters ||
        data.highlights.fastestRunPaceSecPerKm ||
        data.highlights.bestDistanceDayMeters)
    ) {
      items.push(<HighlightsSlide key="highlights" data={data} />);
    }

    return items;
  }, [data]);

  const totalSlides = slides.length;
  const isLast = step === totalSlides - 1;

  const handleNext = useCallback(() => {
    if (isLast) {
      onOpenChange(false);
      return;
    }

    setDirection(1);
    setStep((currentStep) => currentStep + 1);
  }, [isLast, onOpenChange]);

  const handleBack = useCallback(() => {
    setDirection(-1);
    setStep((currentStep) => Math.max(0, currentStep - 1));
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setStep(0);
    }

    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-card overflow-hidden border-border/70 p-0 sm:max-w-md"
      >
        <DialogTitle className="sr-only">Weekly Review</DialogTitle>

        <div className="flex w-full flex-col items-end gap-2 px-3 pt-3">
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-full p-1 transition-colors"
          >
            <X className="size-4" />
          </button>
          <div className="flex w-full items-center gap-1.5">
            {Array.from({ length: totalSlides }).map((_, index) => (
              <div
                key={index}
                className="bg-muted relative h-1 flex-1 overflow-hidden rounded-full"
              >
                <motion.div
                  className="bg-primary absolute inset-y-0 left-0 rounded-full"
                  initial={false}
                  animate={{
                    width:
                      index < step ? "100%" : index === step ? "100%" : "0%",
                  }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-90 px-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {slides[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between px-6 pb-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={step === 0}
          >
            Back
          </Button>
          <Button size="sm" className="group" onClick={handleNext}>
            {isLast ? "Done" : "Next"}
            {!isLast ? (
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
            ) : null}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
