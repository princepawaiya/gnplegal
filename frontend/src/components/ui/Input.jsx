import { inputStyles } from "../../theme/ui";

export default function Input(props) {
  return (
    <input
      {...props}
      style={inputStyles.base}
      onFocus={(e) => {
        Object.assign(e.target.style, inputStyles.focus);
      }}
      onBlur={(e) => {
        e.target.style.border = "1px solid #cbd5e1";
        e.target.style.boxShadow = "none";
      }}
    />
  );
}