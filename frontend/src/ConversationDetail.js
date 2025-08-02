// frontend/src/ConversationDetail.js

import React, { useState, useEffect } from "react";
import axios from "./axiosConfig";
import { useParams, Link } from "react-router-dom";

const ConversationDetail = () => {
  const { id } = useParams();
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const fetchConversationDetail = async () => {
      try {
        const response = await axios.get(`/conversation/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        setMessages(response.data.messages || []);
      } catch (error) {
        console.error("대화 세부 정보 오류:", error.response?.data || error.message);
      }
    };

    fetchConversationDetail();
  }, [id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-teal-50 to-sky-100 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-2xl p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">대화 내용</h2>

        {messages.length > 0 ? (
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`rounded-xl px-4 py-3 max-w-xl break-words shadow-sm ${
                  msg.sender === "user"
                    ? "ml-auto bg-emerald-200 text-gray-800 text-right"
                    : "mr-auto bg-gray-100 text-gray-700"
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">대화 내용을 불러오는 중...</p>
        )}

        <div className="text-center mt-8">
          <Link
            to="/history"
            className="inline-block px-5 py-2 rounded-xl bg-emerald-400 text-white hover:bg-emerald-500 transition"
          >
            ← 대화 목록으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ConversationDetail;

// import React, { useState, useEffect } from "react";//usestate:상태 정의할때 사용 useeffect:컴포넌트가 마운트되거나 특정값이 바뀔때 API호출같은거 하려고 사용
// import axios from "./axiosConfig";//axios인스턴스 가져옴 기존 백업 코드임!-7월 16일자 기준
// import { useParams, Link } from "react-router-dom";
// //useparams:url에서 id처럼 지정한 파라미터 읽기 위해 사용
// //link:페이지 이동 브라우저 새로고침 없이 SPA방식으로 라우팅하기 위한 요소
// //역할: URL파라미터에서 id받아서 특정 대화의 메세지 데이터를 API로부터 가져오고 데이터를 화면에 랜더링
// //사용자와 시스템 메세지를 구분된 스타일로 출력
// const ConversationDetail = () => {
//     const { id } = useParams(); //현재 URL에서 id파라미터값을 추출
//     const [messages, setMessages] = useState([]);//messages(현재 대화 메세지 목록 상태),setmessages(상태 업데이트함수)
//     useEffect(() => { //요소가 처음 렌더링되거나 id가 바뀔때 실행됨
//         const fetchConversationDetail = async () => {//함수역할: 백엔드 API에서 대화 세부 정보를 가져오는 역할
//         try {
//             const response = await axios.get(`/conversation/${id}`, {
//                 //axios.get으로 conversation/{id}엔드포인트에 GET요청 보냄
//             headers: {//헤더에 토큰 포함시켜서 인증 처리
//                 Authorization: `Bearer ${localStorage.getItem("token")}`,//localstorage에 저장된 로그인 토큰 가져옴
//             },
//             }); //[]하는 이유는 데이터가 없을 수도 있으니까..?
//             setMessages(response.data.messages || []);//서버응답에서 response.data.messages추출하고 messages상태에 저장
//         } catch (error) {
//             console.error("대화 세부 정보 오류:", error.response?.data || error.message);
//         }
//         };

//         fetchConversationDetail();//위에꺼 실행(id바뀔때마다 실행)
//     }, [id]);

//     return (
//         <div className="max-w-4xl mx-auto p-4">
//         <h2 className="text-2xl font-bold mb-4">대화 내용</h2>
//         <div className="bg-white border border-gray-300 rounded max-h-[500px] overflow-y-auto p-4">
//             {messages.length > 0 ? (
//             messages.map((msg, index) => (
//                 <div
//                 key={index}
//                 className={`mb-2 p-2 rounded ${
//                     msg.sender === "user" ? "bg-blue-100 text-right" : "bg-gray-200"
//                 }`}
//                 >
//                 <p>{msg.text}</p>
//                 </div>
//             ))
//             ) : (
//             <p>대화 내용을 불러오는 중...</p>
//             )}
//         </div>
//         <Link
//             to="/conversations"
//             className="mt-4 inline-block text-blue-500 hover:underline"
//         >
//             대화 목록으로 돌아가기
//         </Link>
//         </div>
//     );
// };

// export default ConversationDetail;
// //채팅창 실제 ui디자인 화면 구성하는 부분들(위에는)