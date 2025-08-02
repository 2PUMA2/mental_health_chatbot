//frontend/src/Chat.js
//인증된 사용자만 사용할 수 있는 챗봇 인터페이스
//axiosConfig.js에서 설정한 토큰 기반 인증활용해서 채팅데이터 실제로 주고받는거 구현한 부분

import React, { useState, useEffect } from "react";
import axios from "./axiosConfig";
import { useNavigate } from "react-router-dom";

const Chat = ({ setIsAuthenticated }) => { 
  const [messages, setMessages] = useState([]);//채팅메세지배열[](사용자/bot 둘다)
  const [input, setInput] = useState("");//input:현재 입력된 메세지(문자열 형태)
  const navigate = useNavigate();//로그인 페이지로 이동시 사용(react-router-dom의 usernavigate)

  // 채팅 기록 불러오기-처음에만
  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const res = await axios.get("/chat");//get으로 채팅 기록 불러와서 messages에 저장
        setMessages(res.data.messages);
      } catch (err) {
        console.error("채팅 기록 불러오기 오류:", err);
      }
    };

    fetchChatHistory();
  }, []);

  //메시지 전송 함수
  const sendMessage = async () => {
    if (!input.trim()) return;//input이 공백이면 전송안함함

    const userMessage = {
      sender: "user",//사용자
      text: input,//입력텍스트그 자체
      timestamp: new Date().toISOString(),//현재시간을 ISO문자열 형식으로 저장
    };
    //입력메세지를 먼저 화면에 추가(사용자 메세지)
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    try {
      // 사용자의 메세지를 서버에 저장
      await axios.post(
        "/api/chat",
        { sender: "user", text: input },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          withCredentials: true  // 쿠키 전달을 위해 추가
        }
      );

      //챗봇 응답 가져오기(post요청으로)
      const res = await axios.post(
        "/chatbot", //엔드포인트: /chatbot
        { message: input },//요청 본문
        { //요청헤더:사용자 인증 토큰 포함 
          headers: {//응답이 res.data.response형태임 아래를 보니
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          withCredentials: true // 쿠키 전달을 위해 추가
        }
      );

      const botMessage = res.data.response;//챗봇의 답변 텍스트를 변수에 저장
      setMessages((prevMessages) => [//챗봇의 응답 메세지를 기존 메세지 배열에 추가해서 화면 표시
        ...prevMessages,
        { sender: "bot", text: botMessage, timestamp: new Date() },
      ]);
      } catch (error) {
      console.error("메시지 전송 오류:", error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: "bot", text: "오류가 발생했습니다.", timestamp: new Date() },
      ]);
    
      const errorMessage = { //서버에 저장할 오류 메세지 객체 생성(챗봇의 사과 메세지)
        sender: "bot",
        text: "죄송합니다. 문제가 발생했습니다.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
      // 서버에 오류 메시지 저장
      await axios.post("/chat", {//오류지만 어쨌든 챗봇의 응답으로 저장(오류도)
        sender: "bot",
        text: "죄송합니다. 문제가 발생했습니다.",
      });
    }

    setInput("");//챗봇이 사용자 응답에 대해 1번 응답?반응?하고 나서 입력필드를 비워서 사용자가 다시 입력하게 함
  };

  // 채팅 기록 초기화
  const newChat = async () => {//새로운 상담대화 시작하기
    try {
      await axios.delete("/chat/clear");//delete요청 보내서 저장된 채팅 기록 삭제 요청(/chat/clear)
      setMessages([]);//화면의 채팅메세지를 클라이언트 측에서도 모두 초기화함
    } catch (err) {
      console.error("채팅 기록 초기화 오류:", err);
    }
  };

  // 로그아웃 기능
  const logout = () => {
    localStorage.removeItem("token");//로그인 상태유지에 쓰인 JWT토큰 삭제
    setIsAuthenticated(false);//인증상태를 false로 설정해서 UI업데이트 유도
    navigate("/login");//로그인 페이지로 강제 이동
  };

  // 회원 탈퇴 기능
  const deleteAccount = async () => {
    const confirmDelete = window.confirm( //사용자에게 탈퇴여부 확인받는 창 표시
      "정말로 회원 탈퇴를 하시겠습니까? 모든 데이터가 삭제됩니다."
    );
    if (!confirmDelete) return;//아니면 그냥 아닌거

    try {
      const res = await axios.delete("/auth/delete");//서버에 회원탈퇴요청 전송
      alert(res.data.message);//서버로부터 받은 응답 메세지를 알림창으로 사용자에게 보여줌
      // 토큰 제거 및 인증 상태 업데이트
      localStorage.removeItem("token");//토큰 삭제
      setIsAuthenticated(false);//인증상태 업데이트
      navigate("/login");//로그인페이지로 이동
    } catch (err) {
      console.error("회원 탈퇴 오류:", err);
      if (err.response && err.response.data && err.response.data.message) {
        //여러 메세지를 응답한 경우 사용자에게 표시, 아니면 기본 에러 메세지 표시
        alert(err.response.data.message);
      } else {
        alert("회원 탈퇴 중 오류가 발생했습니다.");
      }
    }
  };

  return ( //컴포넌트 전체 감싸는 컨테이너 div.가운데 정렬,~이런 설정들
    <div style={{ maxWidth: "600px", margin: "auto", padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <h2>챗봇</h2>
        <div>
          <button
            onClick={newChat}
            style={{ padding: "5px 10px", marginRight: "10px" }}
          >
            새 채팅하기
          </button>
          <button
            onClick={logout}
            style={{ padding: "5px 10px", marginRight: "10px" }}
          >
            로그아웃
          </button>
          <button
            onClick={deleteAccount}
            style={{
              padding: "5px 10px",
              backgroundColor: "#ff4d4d",
              color: "#fff",
              border: "none",
              borderRadius: "3px",
            }}
          >
            회원 탈퇴
          </button>
        </div>
      </div>
      <div
        style={{
          border: "1px solid #ccc",
          padding: "10px",
          height: "400px",
          overflowY: "scroll",
          backgroundColor: "#f9f9f9",
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              textAlign: msg.sender === "user" ? "right" : "left",
              margin: "10px 0",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "10px",
                borderRadius: "10px",
                backgroundColor: msg.sender === "user" ? "#daf8cb" : "#f1f0f0",
              }}
            >
              {msg.text}
            </span>
          </div>
        ))}
      </div>
      <form
        onSubmit={sendMessage}
        style={{ display: "flex", marginTop: "10px" }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요..."
          style={{ flex: 1, padding: "10px", boxSizing: "border-box" }}
        />
        <button type="submit" style={{ padding: "10px" }}>
          전송
        </button>
      </form>
    </div>
  );
};

export default Chat;
//헤더 및 상단 버튼들-제목과 버튼을 좌우로 배치하기 위한 flex구조
//newchat()호출로 대화 초기화
