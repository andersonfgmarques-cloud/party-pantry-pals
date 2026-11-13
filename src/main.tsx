import "./styles.css";

if (new URLSearchParams(window.location.search).get("demo") === "1") {
  void import("./demo-main");
} else {
  void import("./normal-main");
}
