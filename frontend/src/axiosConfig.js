// frontend/src/axiosConfig.js
//axios인스턴스를 만들어서 interceptors를 이용해서 공통적으로 동작(ex.토큰 자동으로 첨부하게하거나 에러처리같은거) 공통 선언하는 코드
import axios from "axios";//axios:Promise기반의 HTTP클라이언트트
//interceptors:요청과 응답을 가로채는기능->이걸 사용해서 요청이나 응답을 변경가능
// 인스턴스 생성
const instance = axios.create({//axios인스턴스를 새로 생성함
  baseURL: "http://115.145.36.231:3001/api", // baseURL 모든 요청에서 기본이되는 주소: 백엔드 서버의 주소와 포트
  withCredentials: true // ← 필요할 경우만 추가
});
// 요청 인터셉터 추가(HTTP요청을 서버로 보내기 전에 실행됨)
instance.interceptors.request.use( 
  (config) => { 
    const token = localStorage.getItem("token");//요청을 서버로 보내기전에 localstorage에서 token꺼내서
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;//HTTP헤더에 자동으로 넣음
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터 추가
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // 토큰이 유효하지 않거나 만료되었을 때 로그아웃 처리
      localStorage.removeItem("token");//자동 로그아웃->사용자에게 alert창 세션 만료 되었음을 알림
      alert("세션이 만료되었습니다. 다시 로그인해주세요.");
      // 로그인 페이지로 리디렉션
      window.location.href = "/login";//login페이지로 강제로 이동시킴
    }
    return Promise.reject(error);
  }
);
export default instance;
