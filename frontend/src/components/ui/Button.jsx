import { buttonStyles } from "../../theme/ui";

export default function Button({ variant = "primary", style, ...props }) {
  return (
    <button
      {...props}
      style={{
        ...buttonStyles[variant],
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.9";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
    />
  );
}