import { Outlet } from "react-router-dom";
import CounselSidebar from "./CounselSidebar";
import CounselTopbar from "./CounselTopbar";

export default function CounselLayout() {
  return (
    <div style={styles.page}>
      <CounselSidebar />

      <div style={styles.main}>
        <CounselTopbar />

        <div style={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    minHeight: "100vh",
    background: "var(--bg)",
  },
  main: {
    display: "grid",
    gridTemplateRows: "72px 1fr",
  },
  content: {
    padding: 20,
    display: "grid",
    gap: 20,
  },
};