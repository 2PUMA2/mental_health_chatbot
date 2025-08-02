// src/components/Chat.js
import React, { useState, useEffect, useRef } from "react";
import axios from "../axiosConfig";
import Message from "./Message";
import { useNavigate } from "react-router-dom";

const ENDPOINT_MAP = {
  1: "/chatbot",
  2: "/phq9_high_c_low_u",
  3: "/phq9_fixed_editable",
  4: "/phq9_fixed",
};

const defaultGreeting = {
  sender: "bot",
  text: "안녕하세요! 저는 챗봇이입니다! 요즘 스트레스 받는 일이 없으신가요?",
  timestamp: new Date(),
};


const Chat = ({ setIsAuthenticated, designChoice  }) => {              // ← 여기 ‘안’ 에 다 들어갑니다.
  const apiEndpoint = ENDPOINT_MAP[designChoice] || "/chatbot";
  // 기존 상태들
  const [messages, setMessages] = useState([defaultGreeting]);
  const [input, setInput] = useState("");

  // 상담 완료 / 결과 보기 관련
  const [isFinished, setIsFinished] = useState(false);
  const [finalTotalScore, setFinalTotalScore] = useState(null);
  const [slots, setSlots] = useState([]);

  // ★ 추가: summary_items 배열 (Q/A 구조)
  const [summaryItems, setSummaryItems] = useState([]);
  // ★ 추가: 편집 상태
  const [editing, setEditing] = useState(false);
  const [editedAnswers, setEditedAnswers] = useState({});

  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (localStorage.getItem("session_id")) return;
    const initSession = async () => {
      try {
        const res = await axios.post("/start", {}, { withCredentials: true });

        if (res.data && res.data.session_id) {
          localStorage.setItem("session_id", res.data.session_id);
          console.log("초기 session_id 저장:", res.data.session_id);
        } else {
          console.warn("start 응답에 session_id 없음:", res.data);
        }
      } catch (err) {
        console.error("세션 초기화 실패:", err);
      }
    };

    initSession();
  }, []);

  // 대화 기록 불러오기 (기존)
  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const response = await axios.get("/chat", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          withCredentials: true,
        });
        const data = response.data.messages;
        const hasGreeting = data.some(
          (msg) =>
            msg.text === defaultGreeting.text &&
            msg.sender === defaultGreeting.sender
        );
        if (!data || data.length === 0) {
          setMessages([defaultGreeting]);
          await axios.post("/chat", defaultGreeting, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            withCredentials: true,
          });
        } else if (!hasGreeting) {
          setMessages([defaultGreeting, ...data]);
        } else {
          setMessages(data);
        }
      } catch (error) {
        console.error("채팅 기록 로드 오류:", error.response?.data || error.message);
      }
    };
    fetchChatHistory();
  }, []);

  // 메시지 전송
  const sendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (input.trim() === "") return;
    const sessionId = localStorage.getItem("session_id") || "default_user";
    const userMessage = {
      sender: "user",
      text: input,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // 사용자 메시지 저장
      await axios.post(
        "/chat",
        { sender: "user", text: input },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          withCredentials: true,
        }
      );

      // 챗봇 응답
      const res = await axios.post(
        apiEndpoint,
        { message: input , user_id: sessionId, conversation_history: messages },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          withCredentials: true,
        }
      );

      const {
        response: chatbotReply,
        summary,
        totalScore,
        slots: returnedSlots,
        summary_items,
        finished 
      } = res.data;

      // high c, low u 위한 finished 플래그 체크
      if (finished) {
        setIsFinished(true);
        setFinalTotalScore(totalScore ?? null);
        setSlots(returnedSlots || []);
      }

      // high c, high u 에서 “summary_items” 가 있으면 editable 요약 메시지 생성
      if (Array.isArray(summary_items) && summary_items.length > 0) {
        setMessages(prev => [
          ...prev,
          {
            sender: "bot",
            summaryItems: summary_items,   // summary_items 여부로 아래서 렌더 분기
            timestamp: Date.now()
          }
        ]);
        // state에도 기록해 두기
        setSummaryItems(Array.isArray(summary_items) ? summary_items : []);
        setIsFinished(finished || Boolean(summary_items?.length) || Boolean(summary));
        setFinalTotalScore(typeof totalScore === "number" ? totalScore : null);
        setSlots(returnedSlots || []);
      }
      else {
        // summary_items 없으면 기존 일반 채팅처럼 처리
        const botMessage = {
          sender: "bot",
          text: chatbotReply,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, botMessage]);
      }

      // 봇 메시지 저장
      await axios.post(
        "/chat",
        { sender: "bot", text: chatbotReply },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          withCredentials: true,
        }
      );
    } catch (err) {
      console.error("메시지 전송 오류:", err);
      const errorMessage = {
        sender: "bot",
        text: "죄송합니다. 문제가 발생했습니다.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    setInput("");
  };

  // 새 상담
  const handleNewChat = async () => {
    await axios.post(
      "/reset-session",
      {},
      {
        withCredentials: true,
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }
    );

    try {
      const sanitizedMessages = [
        ...messages.map(({ sender, text, timestamp }) => ({
          sender,
            text,
            timestamp,
        })),
      ];

      await axios.post(
        "/conversation/save",
        { messages: sanitizedMessages },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      await axios.delete("/chat/clear", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      setMessages([defaultGreeting]);
      // 상태 초기화
      setIsFinished(false);
      setFinalTotalScore(null);
      setSummaryItems([]);
      setSlots([]);
      setEditing(false);
      setEditedAnswers({});
    } catch (err) {
      console.error("새로운 상담 오류:", err.response?.data || err.message);
    }
  };

  // 엔터키 전송
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  // ★ 추가: Edit 시작
  const handleStartEdit = () => {
    if (!summaryItems || summaryItems.length === 0) return;
    const init = {};
    summaryItems.forEach(si => {
      init[si.item] = si.answer || "";
    });
    setEditedAnswers(init);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditedAnswers({});
  };

  const handleSubmitEdit = async () => {
    try {
      const payload = summaryItems.map(si => ({
        item: si.item,
        edited_answer: editedAnswers[si.item] ?? ""
      }));

      const userId =
        localStorage.getItem("session_id") ||
        localStorage.getItem("user_id") ||
        "default_user";

      await axios.post(
        "/summary/edit",
        {
          user_id: userId,
          edited_items: payload
        },
        { withCredentials: true }
      );

      alert("수정된 응답이 저장되었습니다. (최종 점수/해석은 원본 기준)");
      setEditing(false);
    } catch (e) {
      console.error("Edit submit error", e);
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  return (
    <div
      className="h-screen overflow-y-auto bg-gradient-to-br from-emerald-200 via-teal-100 to-sky-100 flex justify-center pt-16"
    >
      {/* 카드 전체: 부모(h-screen) 높이만큼 Flex Column */}
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col my-6 h-[110vh]">
        
        {/* 1) 고정 헤더 */}
        <header className="flex-none flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-xl font-bold text-gray-800">챗봇이</h2>
          <button
            onClick={handleNewChat}
            className="px-4 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-800 transition"
          >
            새로운 대화
          </button>
        </header>

        {/* 2) 유동 메시지 영역 (남는 공간 + 내부 스크롤) */}
        <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
          {messages.map((msg, idx) => {
            const isSummary = msg.sender === "bot" && isFinished && msg.summaryItems;
            if (isSummary) {
              return (
                <Message key={idx} sender="bot" timestamp={msg.timestamp}>
                  {/* 요약 블록… */}
                  <div className="space-y-4">
                    <p className="whitespace-pre-wrap leading-relaxed">
                      PHQ-9의 모든 항목에 답변해주셔서 감사합니다.
                      {"\n"}다음은 당신이 해주신 응답 요약입니다:
                    </p>
                    {summaryItems.map(si => (
                      <div key={si.num} className="bg-gray-100 p-3 rounded">
                        <p className="font-medium">Q{si.num}. {si.item}</p>
                        {editing ? (
                          <textarea
                            className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-300 resize-none"
                            rows={2}
                            value={editedAnswers[si.item]}
                            onChange={e =>
                              setEditedAnswers(prev => ({ ...prev, [si.item]: e.target.value }))
                            }
                          />
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap">A{si.num}. {si.answer}</p>
                        )}
                      </div>
                    ))}
                    <p className="whitespace-pre-wrap leading-relaxed">
                      당신의 이야기를 들어서 기쁩니다.
                    </p>
                    <div className="flex justify-end space-x-2">
                      {!editing ? (
                        <button
                          onClick={handleStartEdit}
                          className="px-4 py-1 bg-emerald-600 text-white rounded"
                        >
                          Edit
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handleSubmitEdit}
                            className="px-4 py-1 bg-emerald-600 text-white rounded"
                          >
                            Submit
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-4 py-1 bg-gray-300 text-gray-800 rounded"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </Message>
              );
            }

            return (
              <Message
                key={idx}
                sender={msg.sender}
                text={msg.text}
                timestamp={msg.timestamp}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 3) 고정 푸터(입력 + 결과 보기) */}
        <footer className="flex-none border-t px-4 py-3 flex flex-col gap-3">
          <form onSubmit={sendMessage} className="flex w-full">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="flex-1 border rounded-l px-4 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-emerald-600 text-white rounded-r hover:bg-emerald-700 transition "
            >
              전송
            </button>
          </form>
          {(designChoice === 1 || designChoice === 3) && (
            <div className="flex justify-end">
              <button
                onClick={() =>
                  navigate("/results", {
                    state: { totalScore: finalTotalScore, slots },
                  })
                }
                disabled={!isFinished}
                className={`
                  px-6 py-2 rounded
                  ${isFinished
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"}
                `}
              >
                결과 보기
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};

export default Chat;