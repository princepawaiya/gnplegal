import { cardStyles } from "../../theme/ui";

export default function Card({ children, style }) {
  return (
    <div
      style={{ ...cardStyles.base, ...style }}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, cardStyles.hover)}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0px)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
      }}
    >
      {children}
    </div>
  );
}