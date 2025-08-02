// src/components/ChatSelection.js
import React from "react";
import { useNavigate } from "react-router-dom";

function ChatSelection({ designChoice, setDesignChoice }) {
  const navigate = useNavigate();

  const buttonConfigs = [ //각 버튼의 아이콘, 내용, 경로 설정
    {
      id: 1,
      icon: "/chat_edit.png",
      label: "High Contingency & High Agency",
      description: "사용자 반응에 따라 질문이 유동적으로 변화하며, 응답을 수정할 수 있습니다.",
      path: "/chat",
    },
    {
      id: 2,
      icon: "/chat_lock.png",
      label: "High Contingency & Low Agency",
      description: "사용자 반응에 따라 질문이 유동적으로 변화하며, 응답을 수정할 수 없습니다.",
      path: "/chat",
    },
    {
      id: 3,
      icon: "/file_edit.png",
      label: "Low Contingency & High Agency",
      description: "정해진 질문 순서를 따르며, 응답을 수정할 수 있습니다",
      path: "/chat",
    },
    {
      id: 4,
      icon: "/file_lock.png",
      label: "Low Contingency & Low Agency",
      description: "정해진 질문 순서를 따르며, 응답을 수정할 수 없습니다",
      path: "/chat",
    },
  ];

  const handleSelect = (cfg) => {
    localStorage.setItem("designChoice", cfg.id);
    setDesignChoice(cfg.id);
    navigate(cfg.path);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex flex-col items-center justify-center">
      <div className="w-full text-center space-y-10">
        <h2 className="text-5xl font-bold">
          자가진단 <span className="text-emerald-500">챗봇 유형</span>
        </h2>
        <p className="text-lg">희망하시는 자가진단 챗봇 유형을 선택해주세요</p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          {buttonConfigs.map((cfg) => (
            <button
              key={cfg.id}
              onClick={() => handleSelect(cfg)}
              className="
                w-[280px] h-[200px]      
                flex flex-col items-center justify-center
                bg-white border-2 border-gray-200 rounded-xl shadow-sm
                hover:bg-emerald-100 hover:shadow-md
                text-xm font-semibold
                transition-colors transition-shadow
                focus:outline-none focus:ring-2 focus:ring-emerald-200
              "
            >
              <img src={cfg.icon} alt="" className="w-12 h-12 mb-4" />
              <span>{cfg.label}</span>
              {/*<small className="text-sm text-gray-500 mt-2">
                {cfg.description}
              </small>*/}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChatSelection;
