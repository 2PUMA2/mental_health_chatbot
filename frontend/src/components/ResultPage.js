// src/components/ResultPage.js

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

// PHQ-9 우울도 범주 해석 함수
const interpretCategory = (score) => {
  if (score >= 20) return "중증";
  if (score >= 15) return "중등도-중증";
  if (score >= 10) return "중등도";
  if (score >= 5)  return "경미";
  return "없음";
};

const ResultPage = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { slots = [], totalScore = 0 } = state || {};

  // state가 없으면 채팅 페이지로 리다이렉트
  if (!state) {
    navigate("/chat");
    return null;
  }

  const category = interpretCategory(totalScore);

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-emerald-200 via-teal-100 to-sky-100 py-4 pt-24">
      <div className="mx-auto w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-10 space-y-8">
        {/* 헤더 영역 */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-extrabold text-gray-800">PHQ-9 검사 결과</h1>
          <p className="text-xl text-gray-600">
            당신의 우울 수준이 <span className="font-semibold text-emerald-700">{category}</span>에 해당합니다.
          </p>
        </div>

        {/* 총점 배너 */}
        <div className="flex justify-center">
          <div className="px-8 py-4 bg-emerald-600 text-white text-3xl font-bold rounded-full shadow-lg">
            총점: {totalScore}점
          </div>
        </div>

        {/* 각 문항별 점수 리스트 */}
        <div className="grid grid-cols-1 gap-4">
          {slots.map((slot, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center p-4 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              <p className="text-base text-gray-700">
                Q{idx + 1}. {slot.item}
              </p>
              <div className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-full font-semibold">
                {slot.score ?? 0}점
              </div>
            </div>
          ))}
        </div>

        {/* 다시 상담하기 버튼 */}
        <div className="flex justify-end">
          <button
            onClick={() => navigate("/chat")}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg text-lg font-medium hover:bg-emerald-700 transition"
          >
            다시 상담하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultPage;
