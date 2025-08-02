// frontend/src/components/Greeting.js

import React from "react";
import { useNavigate } from "react-router-dom";

const Greeting = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    const token = localStorage.getItem("token");
    navigate(token ? "/selection" : "/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-between px-[200px] bg-gradient-to-br from-emerald-200 via-teal-100 to-sky-100">
      <div className="flex-1 max-w-xl space-y-6 text-left">
        <h1 className="text-5xl font-bold text-gray-800">Mind Chatbot</h1>
        <p className="text-base leading-relaxed text-gray-700">안녕하세요, 성균관대학교 DSAIL 연구실입니다.<br />본 챗봇은 PHQ-9 문진 대화용이며 주기적인 진료에 사용됩니다.</p>
        <button onClick={handleStart} className="mt-6 px-16 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded transition-colors">시작하기</button>
      </div>
      <img src="/icon_smile.png" alt="정신 건강 아이콘" className="w-[400px] h-[400px]" />
    </div>
  );
};

export default Greeting;