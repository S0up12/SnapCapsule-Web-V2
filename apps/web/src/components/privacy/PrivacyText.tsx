import type { ElementType, ReactNode } from "react";

type PrivacyTextProps = {
  as?: ElementType;
  blurred?: boolean;
  className?: string;
  children: ReactNode;
};

export default function PrivacyText({
  as: Component = "span",
  blurred = false,
  className = "",
  children,
}: PrivacyTextProps) {
  return (
    <Component
      className={[
        className,
        blurred
          ? "transition duration-200 [filter:blur(0.28rem)] hover:[filter:blur(0)] focus:[filter:blur(0)]"
          : "",
      ].join(" ").trim()}
    >
      {children}
    </Component>
  );
}
