import React from "react";
import ReactDOM from "react-dom/client"; // 'react-dom/client'에서 가져옵니다.
import App from "./App";
import "./index.css"; // Tailwind CSS를 가져옵니다.

const root = ReactDOM.createRoot(document.getElementById("root")); // 루트 생성

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);