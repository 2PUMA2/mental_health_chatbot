// src/App.js
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Navbar from "./components/Navbar";
import Chat from "./components/Chat";
import Signup from "./components/Signup";
import Login from "./components/Login";
import ConversationList from "./ConversationList";
import ConversationDetail from "./ConversationDetail";
import Greeting from "./components/Greeting";
import DesignSelection from "./components/Selection";
import ResultPage from "./components/ResultPage";

function App() {
  // 로그인 토큰 유무로 인증 상태 초기화
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("token"));
  const [designChoice, setDesignChoice] = useState(
    () => Number(localStorage.getItem("designChoice")) || 1
  );
  // 다른 탭에서 storage 변경 시 인증 상태 동기화
  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem("token"));
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // PHQ-9 최종 요약을 담을 상태
  const [summary, setSummary] = useState(null);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar
          isAuthenticated={isAuthenticated}
          setIsAuthenticated={setIsAuthenticated}
          designChoice={designChoice}
          setDesignChoice={setDesignChoice}
        />

        <div className="flex-1 overflow-hidden">
          <Routes>
            {/* 시작 인사말 */}
            <Route path="/" element={<Greeting />} />

            {/* 챗 페이지 (인증 필요) */}
            <Route
              path="/chat"
              element={
                isAuthenticated ? (
                  <Chat
                    setIsAuthenticated={setIsAuthenticated}
                    setDesignChoice={setDesignChoice}
                    setSummary={setSummary}
                    designChoice={designChoice}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* 디자인 선택 페이지 */}
            <Route path="/selection" element={<DesignSelection designChoice={designChoice} setDesignChoice={setDesignChoice}/>} />

            {/* 최종 결과 페이지 (인증 필요) */}
            <Route path="/results" element={<ResultPage />} />

            {/* 회원가입 / 로그인 */}
            <Route
              path="/signup"
              element={
                !isAuthenticated ? (
                  <Signup />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/login"
              element={
                !isAuthenticated ? (
                  <Login setIsAuthenticated={setIsAuthenticated} />
                ) : (
                  <Navigate to="/selection" replace />
                )
              }
            />

            {/* 대화 목록 / 상세보기 */}
            <Route
              path="/history"
              element={
                isAuthenticated ? (
                  <ConversationList />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/history/:id"
              element={
                isAuthenticated ? (
                  <ConversationDetail />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* 그 외 모든 경로는 루트로 리디렉션 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
