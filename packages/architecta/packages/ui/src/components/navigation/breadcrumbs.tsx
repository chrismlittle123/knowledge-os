import * as React from "react";
import { cn } from "../../primitives";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
}

const Breadcrumbs = React.forwardRef<HTMLElement, BreadcrumbsProps>(
  ({ items, separator, className, ...props }, ref) => {
    const defaultSeparator = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground/50"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    );

    return (
      <nav
        ref={ref}
        aria-label="Breadcrumb"
        className={cn("flex items-center", className)}
        {...props}
      >
        <ol className="flex items-center gap-1.5 text-sm">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;

            return (
              <li key={index} className="flex items-center gap-1.5">
                {item.href && !isLast ? (
                  <a
                    href={item.href}
                    className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </a>
                ) : (
                  <span
                    className={cn(
                      "font-medium",
                      isLast ? "text-foreground" : "text-muted-foreground"
                    )}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {item.label}
                  </span>
                )}
                {!isLast && (separator || defaultSeparator)}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }
);
Breadcrumbs.displayName = "Breadcrumbs";

export { Breadcrumbs };
