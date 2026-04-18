import { inputStyles } from "../../theme/ui";

export default function Textarea(props) {
  return (
    <textarea
      {...props}
      style={{
        ...inputStyles.base,
        minHeight: 100,
      }}
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