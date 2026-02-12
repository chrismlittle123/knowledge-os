import * as React from "react";
import { cn } from "../../primitives";

export interface TimelineStepProps extends React.HTMLAttributes<HTMLDivElement> {
  number: number;
  title: string;
  description: string;
  isLast?: boolean;
}

const TimelineStep = React.forwardRef<HTMLDivElement, TimelineStepProps>(
  ({ number, title, description, isLast = false, className, ...props }, ref) => (
    <div ref={ref} className={cn("relative flex gap-4", className)} {...props}>
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
          {number}
        </div>
        {!isLast && (
          <div className="mt-2 h-full w-px bg-gradient-to-b from-primary to-border" />
        )}
      </div>
      <div className="pb-6">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
);
TimelineStep.displayName = "TimelineStep";

export { TimelineStep };
