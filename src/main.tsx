import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

const root = ReactDOM.createRoot(document.getElementById("app")!);
if (new URLSearchParams(window.location.search).get("demo") === "1") {
  void import("./demo-main");
} else {
  void import("./normal-main").then(({ mountApp }) => mountApp(root));
}
