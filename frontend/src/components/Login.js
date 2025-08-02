// src/components/Login.js
//사용자로부터 이메일/비밀번호 받아서 로그인 요청 보내고, 로그인되면 localstorage에 토큰 저장하고 인증상태를 상위에 전달하고
//로그인 실패시 에러메세지 출력하고 하단에는 회원가입페이지로 이동하는 링크 포함
import React, { useState } from "react";//React함수형 컴포넌트와 state관리를 userstate가져옴
import axios from "../axiosConfig";//자체 설정된 axios인스턴스 import
import { useNavigate, Link } from "react-router-dom";//useNavigate:페이지이동,Link:사용자 클릭하는 링크용 컴포넌트

const Login = ({ setIsAuthenticated }) => {//setIsAuthenticated:app등에서 인증상태 제어하기 위해 전달된 함수
  const [formData, setFormData] = useState({ //로그인 폼 입력값을 상태로 관리(초기값은 빈 문자열)
    email: "dsail@gmail.com",
    password: "dsail",
  });
  const [message, setMessage] = useState("");//로그인 실패하면 사용자에게 보여주는 메세지 저장하는 상태
  const navigate = useNavigate();//react router훅을 통해서 페이지 이동 기능 준비

  const { email, password } = formData;//구조분해할당을 통해 사용성 높임

  const onChange = (e) => //모든 입력필드에서 사용할 공통 onchange핸들러->입력된 값을 현재필드이름에 따라 업데이트함
    setFormData({ ...formData, [e.target.name]: e.target.value });
//post요청:데이터를 보내는 HTTP 요청 방식
  const onSubmit = async (e) => {//기본 동작인 페이지 새로고침 방지
    e.preventDefault();
    try { //post요청을 통해 이메일/비밀번호를 백엔드에 전송(/auth/login경로에 이메일,비밀번호 데이터 보내는거임)
      //const res = await axios.post("/auth/login", { email, password });
      const res = await axios.post("/auth/login", { email, password }, {withCredentials: true});//withCredentials: true로 설정하면 쿠키를 포함한 요청을 보낼 수 있음
      // 토큰 저장 및 인증 상태 업데이트
      localStorage.setItem("token", res.data.token);//응답받은 토큰을 localstorage에 저장
      setIsAuthenticated(true);//상위 요소에 인증완료 알림
      navigate("/"); // 로그인 성공 시 메인으로 이동(홈화면 리디렉션)
    } catch (err) {
      setMessage(
        err.response?.data?.message || "로그인 중 오류가 발생했습니다."
      );
    }
  };
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 px-6">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-2xl">
        <h2 className="text-3xl font-extrabold text-center mb-6">
          로그인
        </h2>
        {message && (
          <p className="text-center text-red-500 mb-4">{message}</p>
        )}

        <form onSubmit={onSubmit} className="space-y-8">
          {/* 이메일 */}
          <div className="relative">
            <label
              htmlFor="email"
              className="absolute -top-2.5 left-4 bg-white px-1 text-sm text-emerald-600 font-medium"
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={email}
              onChange={onChange}
              required
              className="w-full border border-emerald-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
            />
          </div>

          {/* 비밀번호 */}
          <div className="relative">
            <label
              htmlFor="password"
              className="absolute -top-2.5 left-4 bg-white px-1 text-sm text-emerald-600 font-medium"
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              name="password"
              value={password}
              onChange={onChange}
              required
              className="w-full border border-emerald-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
            />
          </div>

          {/* 버튼 */}
          <button
            type="submit"
            className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-lg shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition"
          >
            로그인
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          계정이 없으신가요?{" "}
          <Link to="/signup" className="text-emerald-600 font-medium hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;