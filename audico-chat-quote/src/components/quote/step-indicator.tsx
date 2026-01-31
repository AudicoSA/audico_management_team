"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
}

export function StepIndicator({
  currentStep,
  totalSteps,
  stepLabel,
}: StepIndicatorProps) {
  const progress = ((currentStep - 1) / totalSteps) * 100;

  return (
    <div className="flex items-center gap-4">
      {/* Step Label */}
      <div className="text-right">
        <p className="text-sm font-medium text-foreground">{stepLabel}</p>
        <p className="text-xs text-foreground-muted">
          Step {currentStep} of {totalSteps}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-32 h-2 bg-background-elevated rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step Dots */}
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "w-2 h-2 rounded-full transition-colors duration-200",
              index < currentStep - 1
                ? "bg-accent"
                : index === currentStep - 1
                ? "bg-accent ring-2 ring-accent/30"
                : "bg-background-elevated"
            )}
          >
            {index < currentStep - 1 && (
              <Check size={8} className="text-background" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
