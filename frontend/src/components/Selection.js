// frontend/src/components/Selection.js

import React from "react";
import { useNavigate } from "react-router-dom";

function Selection({ designChoice, setDesignChoice }) {
  const navigate = useNavigate();

  const buttonConfigs = [
    {
      id: 1,
      icon: "/chat_edit.png",
      label: "High Contingency & High Agency",
      path: "/chat",
    },
    {
      id: 2,
      icon: "/chat_lock.png",
      label: "High Contingency & Low Agency",
      path: "/chat",
    },
    {
      id: 3,
      icon: "/file_edit.png",
      label: "Low Contingency & High Agency",
      path: "/chat",
    },
    {
      id: 4,
      icon: "/file_lock.png",
      label: "Low Contingency & Low Agency",
      path: "/chat",
    },
  ];

  const handleSelect = (cfg) => {
    localStorage.setItem("designChoice", cfg.id);
    setDesignChoice(cfg.id);
    navigate(cfg.path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-200 via-teal-100 to-sky-100 flex items-center justify-center px-6 py-12">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl p-10 space-y-10">
        <h2 className="text-4xl font-bold text-gray-800 text-center">
          자가진단 챗봇 유형</h2>
        <p className="text-center text-gray-700">
          희망하시는 챗봇 유형을 선택해주세요.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {buttonConfigs.map((cfg) => (
            <button
              key={cfg.id}
              onClick={() => handleSelect(cfg)}
              className="flex flex-col items-center justify-center border border-emerald-300 bg-white rounded-xl px-6 py-8 shadow-md hover:bg-emerald-50 transition"
            >
              <img src={cfg.icon} alt={cfg.label} className="w-12 h-12 mb-3" />
              <span className="text-gray-800 font-medium text-center">
                {cfg.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Selection;