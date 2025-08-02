// src/components/Signup.js
import React, { useState } from "react";//state생성하고 조작
import axios from "../axiosConfig";//HTTP요청 보내기 위해서 Axios인스턴스 import
//axios가 아니라 설정이 미리 포함된 axiosconfig에 불러옴
import { useNavigate } from "react-router-dom";//react router훅(페이지 이동)

const Signup = () => { //회원가입양식 처리(사용자 입력들을 3개 username,email,password받고 서버에 회원가입 요청 보내고 완료되면 로그인페이지 이동
  const [formData, setFormData] = useState({//이름, 이메일, 비밀번호 다 빈문자열로 초기화
    username: "",
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");//사용자에게 보여줄 메세지 저장하는 상태
  const navigate = useNavigate();//페이지전환함수

  const { username, email, password } = formData;//객체에서 개별적으로 3개변수로 할당됨

  const onChange = (e) =>//사용자가 각 입력필드에 입력할때마다 formdata상태 업데이트
    setFormData({ ...formData, [e.target.name]: e.target.value });//e.target.name키로 해서 각 필드username, email,password동적 처리
  console.log("회원가입 요청 경로:", "/auth/signup");
  const onSubmit = async (e) => {//폼 제출 핸들러
    e.preventDefault();//기본 sumbit동작 막시(페이지 새고)
    try { //POST방식으로 /auth/signup엔드포인트에 보냄
      const res = await axios.post("auth/signup", {//axios가 서버로 HTTP요청 보내고 응답을 res에 저장
        username,
        email,
        password,
      },
      { withCredentials: true });//withCredentials: true로 설정하면 쿠키를 포함한 요청을 보낼 수 있음
      setMessage(res.data.message);//서버에서 메세지 꺼내서 화면에 보여주는 message상태에 저장
      setTimeout(() => navigate("/login"), 2000);//2초후 로그인 페이지로 자동 이동(성공 메세지)
    } catch (err) {
      setMessage(
        err.response?.data?.message || "회원가입 중 오류가 발생했습니다."
      );
    }
  };

  return (//tailwind css로 가운데 정렬, 테두리, 그림자, 배경색 적용
    <div className="max-w-md mx-auto p-8 border rounded shadow-lg bg-white">
      <h2 className="text-2xl font-bold text-center mb-4">회원가입</h2>
      {message && <p className="text-center text-red-500 mb-4">{message}</p>}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold">사용자 이름:</label>
          <input
            type="text"
            name="username"
            value={username}
            onChange={onChange}
            required
            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block font-semibold">이메일:</label>
          <input
            type="email"
            name="email"
            value={email}
            onChange={onChange}
            required
            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block font-semibold">비밀번호:</label>
          <input
            type="password"
            name="password"
            value={password}
            onChange={onChange}
            required
            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="w-full py-2 px-4 bg-blue-500 text-white font-bold rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          회원가입
        </button>
      </form>
    </div>
  );
};

export default Signup;
