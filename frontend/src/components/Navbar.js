// frontend/src/components/Navbar.js

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "../axiosConfig";

const Navbar = ({ isAuthenticated, setIsAuthenticated }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // 로그인, 회원가입 페이지에서는 Navbar 숨김
  const hideNavbarRoutes = ["/login", "/signup", "/"];
  if (hideNavbarRoutes.includes(location.pathname)) {
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("정말로 회원 탈퇴하시겠습니까?")) {
      try {
        await axios.delete("/auth/delete", { withCredentials: true });
        localStorage.removeItem("token");
        setIsAuthenticated(false);
        navigate("/");
      } catch (error) {
        alert("회원 탈퇴 중 오류가 발생했습니다.");
      }
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-[60px] px-[200px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center justify-between z-50">
      {/* 왼쪽: 로고 + 타이틀 */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-3 hover:opacity-90 transition"
      >
        <img src="/icon_smile.png" alt="로고" className="w-10 h-10" />
        <span className="text-2xl font-bold text-emerald-700">Mind Chatbot</span>
      </button>

      {/* 오른쪽: 메뉴 */}
      {isAuthenticated && (
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/history")}
            className="px-4 py-2 rounded text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition"
          >
            대화 기록
          </button>

          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded text-sm font-medium text-gray-700 hover:bg-yellow-100 hover:text-yellow-600 transition"
          >
            로그아웃
          </button>

          <button
            onClick={handleDeleteAccount}
            className="px-4 py-2 rounded text-sm font-medium text-gray-700 hover:bg-red-100 hover:text-red-600 transition"
          >
            회원 탈퇴
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;