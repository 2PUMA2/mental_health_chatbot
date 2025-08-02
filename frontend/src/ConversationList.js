// frontend/src/ConversationList.js

import React, { useState, useEffect } from "react";
import axios from "./axiosConfig";
import { Link } from "react-router-dom";

const ConversationList = () => {
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await axios.get("/conversation/history", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        setConversations(response.data || []);
      } catch (error) {
        console.error("대화 목록 조회 오류:", error.response?.data || error.message);
      }
    };

    fetchConversations();
  }, []);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-teal-50 to-sky-100 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-2xl p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">대화 기록</h2>

        {conversations.length === 0 ? (
          <p className="text-center text-gray-500">저장된 대화가 없습니다.</p>
        ) : (
          <ul className="space-y-4">
            {conversations.map((conv, idx) => (
              <li key={conv._id}>
                <Link
                  to={`/history/${conv._id}`}
                  className="block bg-white border border-emerald-200 rounded-xl p-4 hover:shadow-lg hover:bg-emerald-50 transition-all duration-300"
                >
                  <span className="text-gray-700 font-semibold">💬 대화 {idx + 1}</span>
                  <div className="text-sm text-gray-500 mt-1">
                    🕒 {formatDate(conv.createdAt)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ConversationList;