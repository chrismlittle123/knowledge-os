import * as React from "react";
import { cn } from "../../primitives";

export interface PageSectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  columns?: 1 | 2 | 3 | 4;
}

const PageSection = React.forwardRef<HTMLElement, PageSectionProps>(
  ({ title, description, columns = 1, className, children, ...props }, ref) => {
    const gridCols = {
      1: "grid-cols-1",
      2: "grid-cols-1 md:grid-cols-2",
      3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    };

    return (
      <section ref={ref} className={cn("py-8", className)} {...props}>
        {(title || description) && (
          <div className="mb-6">
            {title && (
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        )}
        <div className={cn("grid gap-4", gridCols[columns])}>{children}</div>
      </section>
    );
  }
);
PageSection.displayName = "PageSection";

export { PageSection };
