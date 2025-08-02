// backend/server.js
const express = require("express");//node.js에서 서버를 쉽게 만들 수 있게 해주는 웹 프레임워크크
const cookieParser = require("cookie-parser");//쿠키를 파싱하기 위한 미들웨어
const axios = require("axios");//외부 API서버에 HTTP요청 보내기 위한 라이브러리
const cors = require("cors");//다른 도메인에서 요청할 수 있게 해주는 middleware
const mongoose = require("mongoose");//MongoDB, Node.js를 연결해주는 ODM라이브러리  
const dotenv = require("dotenv");//dotenv는 env파일에 저장된 환경변수를 node.js에서 사용할 수 있게 해줌
const crypto = require("crypto");//crypto:Node.js에 내장된 모듈로 보안관련 기능을 제공

//환경 변수 로드
const app = express();//express앱 객체 생성.객체를 통해서 라우팅,middleware설정
dotenv.config();//env파일에 있는 변수들을 process.env객체에 불러오는 역할을 불러옴
app.use(express.json());//요청의 body가 JSON형태면 자동으로 파싱해서 req.body에 넣어줌  
app.use(cookieParser());//쿠키 파싱 미들웨어 등록-요청에 포함된 쿠키를 req.cookies에 넣어줌
const PORT = process.env.PORT || 3001;//포트 설정.env에 port가 정의되어 있으면 그걸 사용하고 없으면 3001번 포트를 사용

// JWT_SECRET을 .env에서 읽지 않고, 서버 시작 시 랜덤하게 생성
const jwtSecret = crypto.randomBytes(64).toString("hex");//64byte 길이의 랜덤 시크릿 키를 생성해서 JWT토큰서명에 사용할 문자열로 변환
//const jwtSecret=process.env.JWT_SECRET
console.log(`동적으로 생성된 JWT_SECRET: ${jwtSecret}`);//생성된 시크릿 키를 출력

// CORS 옵션 설정
//(http://localhost:3000)프론트엔드에서 실행되고
//백엔드 http://localhost:3001에서 실행된다면 브라우저는 기본적으로 요청 차단<-근데 이거 풀어주는 역할을 함
const corsOptions = {//CORS설정 객체-해당 도메인에서 오는 특정 HTTP메서드만 허용
  origin: "http://115.145.36.231:3000", // React 프론트엔드 주소
  methods: "GET,POST,DELETE",//HTTP메서드만 허용
  allowedHeaders: "Content-Type, Authorization",
  credentials: true//헤더만 허용
};//요청 헤더 제한해서 보안 강화

// 미들웨어 설정
app.use(cors(corsOptions));//CORS옵션을 Express앱에 등록
app.use(express.json());//middleware는 들어오는 요청의 body가 app/json이면 자동으로 json객체로 parsing해서 req.body에 넣음

// 요청 로깅 미들웨어
app.use((req, res, next) => { //모든 요청이 들어올때마다 로그 출력-로깅 middleware
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);//요청시간, 메서드, URL기록
  next();
});

// MongoDB 연결
mongoose
  .connect(process.env.MONGO_URI, {//env파일에 정의된 MONGO_URI 사용 & 연결 옵션도 설정
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB 연결 성공"))
  .catch((err) => {
    console.error("MongoDB 연결 오류:", err);
    process.exit(1);
  });//연결 실패 시 에러 출력하고, 서버 종료

const editedSummarySchema = new mongoose.Schema({
  user_id: { type: String, index: true },
  edited_items: [
    {
      item: String,          // 문항 이름 (예: "수면 문제")
      edited_answer: String  // 사용자가 수정한 답변
    }
  ],
  saved_at: { type: Date, default: Date.now }
}, { collection: 'edited_summaries' });
const EditedSummary = mongoose.model('EditedSummary', editedSummarySchema);

//라우트 가져오기
console.log("라우터 등록 전");//인증 API라우트 불러옴.jwtSecret라우터로 전달함
const authRoutes=require("./routes/auth")(jwtSecret); //auth 라우트에 jwtSecret 전달
console.log("라우터 등록됨");
const conversationRoutes=require("./routes/conversation")(jwtSecret);//대화기록 관련 API라우트 불러옴
const chatRoutes=require("./routes/chat")(jwtSecret); //chat API 라우트에 jwtSecret 전달

//라우트 사용->각 라우트를 /api/경로로 등록->프론트엔드에서 이 경로로 요청 보냄
app.use("/api/auth", authRoutes);
app.use("/api/conversation", conversationRoutes);
app.use("/api/chat", chatRoutes);

//기본 라우트
app.get("/", (req, res) => {
  res.send("백엔드 서버가 정상적으로 작동 중입니다.");
});

//rule base response->마찬가지로 규칙 기반 응답->key value형태태
const ruleBaseResponses = {
  안녕: "안녕하세요! 무엇을 도와드릴까요?",
  "이름이 뭐야?": "저는 챗봇입니다.",
  "잘 가": "안녕히 가세요!",
};
//챗봇 대화의 시작할때 첫 응답 분리!대화시작시점이랑 일반적인 대화(대화 도중) 분리 가능함->초기 인삿말 중복 방지
app.post("/api/start", (req, res) => {
  //const greeting = "안녕하세요!저는 챗봇이입니다! 오늘 기분이 어떠세요?";
  const greeting="안녕하세요~저는 챗봇이입니다! 혹시 요즘 스트레스 받는 일 없으신가요?"
  //const greeting="Hello! I'm your chatbot! How are you feeling today?"
  const sessionId = crypto.randomUUID();//내가 추가한 부분-세진 6월17일 세션 id위함
  res.cookie("session_id", sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  });
  //쿠키에 인삿말 저장 (빈 기록에서 시작)
  res.cookie("conversation_history", `|${greeting}`, {
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  });
  
  return res.json({ response: greeting,  session_id: sessionId });
});
//cookie를 서버 측에서 직접 트래킹 할 수 있도록 하는 코드로 수정 
app.post("/api/chatbot", async (req, res) => {
  const userMessage = req.body.message;
  const sessionId = req.cookies.session_id; //쿠키에서 세션 ID 가져오기
  console.log(`요청 세션 ID: ${sessionId}`);
  let oldHistory = req.cookies.conversation_history || "";
  const defaultGreeting="안녕하세요~저는 챗봇이입니다! 혹시 요즘 스트레스 받는 일 없으신가요?"
  if (!oldHistory.includes(defaultGreeting)) {//혹시나 greeting이 화면 렌더링 과정에서 먼저 보이고 서버에는 늦게 전달될 수 있어서 에러처리같이 한거
    oldHistory = `${defaultGreeting}${oldHistory}`;
  }
  // 쿠키 업데이트 (대화 시작과 동시에 업데이트 보장)
  res.cookie("conversation_history", oldHistory, {
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  });
  console.log("기존 대화 기록:", oldHistory); // 기존 대화 기록 출력

  if (!userMessage) {
    return res.status(400).json({ error: "No message provided" });
  }

  const ruleResponse = ruleBaseResponses[userMessage];
  if (ruleResponse) {
    return res.json({ response: ruleResponse });
  }

  try {
    // Flask에 현재 메시지와 기존 대화 기록 전송-기존꺼 (basic!!!)
    const botResponse = await axios.post("http://115.145.36.231:5001/api/chat", {
      message: userMessage,
      conversation_history: oldHistory,
      user_id: sessionId    
    });
    //const chatbotReply = botResponse.data.response;
    const {
        response: chatbotReply,
        summary,
        totalScore,
        slots,
        summary_items
        } = botResponse.data;

    // 기존 기록에 새 대화 턴 추가
    let updatedHistory = oldHistory
      ? `${oldHistory}|${userMessage}|${chatbotReply}`
      : `${userMessage}|${chatbotReply}`;

    // 최대 6턴 (12개 요소)까지만 유지
    const historyParts = updatedHistory.split("|");
    if (historyParts.length > 12) {
      updatedHistory = historyParts.slice(historyParts.length - 12).join("|");
    }

    console.log("업데이트된 대화 기록:", updatedHistory); // 업데이트된 대화 기록 출력

    // 쿠키 업데이트
    res.cookie("conversation_history", updatedHistory, {
      httpOnly: true,
      sameSite: "Lax",
      secure: false
    });
    
    //return res.json({ response: chatbotReply });
    return res.json({
        response:            chatbotReply,
        conversation_history: updatedHistory,
        ...(summary    !== undefined ? { summary    } : {}),
        ...(summary_items !== undefined ? { summary_items } : {}),
        ...(totalScore !== undefined ? { totalScore } : {}),
        ...(slots      !== undefined ? { slots      } : {}),
    });

  } catch (error) {
    console.error("BlenderBot 서비스와의 통신 오류:", error);
    return res.status(500).json({ error: "챗봇 모델로부터 응답을 받지 못했습니다." });
  }
});

app.post("/api/reset-session", (req, res) => {
  res.clearCookie("conversation_history", {
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  });
  res.clearCookie("session_id", {//session_id위해서 추가한 부분-세진-6월17일 새벽 기준
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  });
  const newSessionId = crypto.randomUUID();
  res.cookie("session_id", newSessionId, {
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  });
  return res.json({ message: "Session cookie cleared", session_id: newSessionId  });
});

app.post("/api/summary/edit", async (req, res) => {
  try {
    const { user_id, edited_items } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id required" });
    }
    if (!Array.isArray(edited_items)) {
      return res.status(400).json({ error: "edited_items must be an array" });
    }

    // 간단 검증 + 정제
    const cleaned = edited_items
      .filter(it => it && typeof it === 'object')
      .map(it => ({
        item: it.item || "",
        edited_answer: (it.edited_answer ?? "").trim()
      }))
      .filter(it => it.item); // item 값이 있는 것만 저장

    if (cleaned.length === 0) {
      return res.status(400).json({ error: "no valid edited_items" });
    }

    const doc = await EditedSummary.create({
      user_id,
      edited_items: cleaned
    });

    return res.json({
      message: "edited summary saved",
      id: doc._id,
      count: cleaned.length
    });
  } catch (err) {
    console.error("[/api/summary/edit] save error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

//PHQ-9 고정 질문 전용 라우트-6월 27일 기준 내가 수정한 부분-고정된 PHQ-9질문을 하도록하기 위함
app.post("/api/phq9_fixed", async (req, res) => {
  const userMessage = req.body.message;
  const sessionId = req.cookies.session_id;
  console.log(`요청 세션 ID: ${sessionId}`);
  let oldHistory = req.cookies.conversation_history || "";

  const defaultGreeting = "안녕하세요!저는 챗봇이입니다! 오늘 기분이 어떠세요?";
  if (!oldHistory.includes(defaultGreeting)) {
    oldHistory = `${defaultGreeting}${oldHistory}`;
  }

  res.cookie("conversation_history", oldHistory, {
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  });

  try {
    const botResponse = await axios.post("http://115.145.36.231:5001/api/phq9_fixed", {
      message: userMessage,
      conversation_history: oldHistory,
      user_id: sessionId
    });

    const chatbotReply = botResponse.data.response;

    let updatedHistory = oldHistory
      ? `${oldHistory}|${userMessage}|${chatbotReply}`
      : `${userMessage}|${chatbotReply}`;

    const historyParts = updatedHistory.split("|");
    if (historyParts.length > 12) {
      updatedHistory = historyParts.slice(historyParts.length - 12).join("|");
    }

    res.cookie("conversation_history", updatedHistory, {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    });
    return res.json({ response: chatbotReply });
  } catch (error) {
    console.error("phq9_fixed 라우트 오류:", error);
    return res.status(500).json({ error: "phq9_fixed 처리 실패" });
  }
});

//PHQ-9 low contingency high user agency조건위한 post
app.post("/api/phq9_fixed_editable", async (req, res) => {
  const userMessage = req.body.message;
  const sessionId = req.cookies.session_id;
  console.log(`요청 세션 ID: ${sessionId}`);
  let oldHistory = req.cookies.conversation_history || "";

  const defaultGreeting = "안녕하세요~저는 챗봇이입니다! 혹시 요즘 스트레스 받는 일 없으신가요?";
  if (!oldHistory.includes(defaultGreeting)) {
    oldHistory = `${defaultGreeting}${oldHistory}`;
  }

  res.cookie("conversation_history", oldHistory, {
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  });

  try {
    const botResponse = await axios.post("http://115.145.36.231:5001/api/phq9_fixed_editable", {
      message: userMessage,
      conversation_history: oldHistory,
      user_id: sessionId
    });

        const {
      response: chatbotReply,
      summary_items,
    } = botResponse.data;

    let updatedHistory = oldHistory
      ? `${oldHistory}|${userMessage}|${chatbotReply}`
      : `${userMessage}|${chatbotReply}`;

    const historyParts = updatedHistory.split("|");
    if (historyParts.length > 12) {
      updatedHistory = historyParts.slice(historyParts.length - 12).join("|");
    }

    res.cookie("conversation_history", updatedHistory, {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    });
    return res.json({ response: chatbotReply,
      conversation_history: updatedHistory,
      summary_items:        summary_items !== undefined ? summary_items : [],
     });
  } catch (error) {
    console.error("phq9_fixed_editable 라우트 오류:", error);
    return res.status(500).json({ error: "phq9_fixed editable 처리 실패" });
  }
});

//PHQ-9 high contingency & low user_agency조건
app.post("/api/phq9_high_c_low_u", async (req, res) => {
  const userMessage = req.body.message;
  const sessionId = req.cookies.session_id;
  console.log(`요청 세션 ID: ${sessionId}`);
  let oldHistory = req.cookies.conversation_history || "";
  const defaultGreeting = "안녕하세요~저는 챗봇이입니다! 혹시 요즘 스트레스 받는 일 없으신가요?";
  if (!oldHistory.includes(defaultGreeting)) {
    oldHistory = `${defaultGreeting}${oldHistory}`;
  }
  res.cookie("conversation_history", oldHistory, {
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  });
  try {
    const botResponse = await axios.post("http://115.145.36.231:5001/api/phq9_high_c_low_u", {
      message: userMessage,
      conversation_history: oldHistory,
      user_id: sessionId
    });
    const {
      response: chatbotReply,
      finished,
      slots,
      totalScore 
    } = botResponse.data;
    let updatedHistory = oldHistory
      ? `${oldHistory}|${userMessage}|${chatbotReply}`
      : `${userMessage}|${chatbotReply}`;
    const historyParts = updatedHistory.split("|");
    if (historyParts.length > 12) {
      updatedHistory = historyParts.slice(historyParts.length - 12).join("|");
    }
    res.cookie("conversation_history", updatedHistory, {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    });
    return res.json({ 
      response: chatbotReply,
      finished,
      slots,
      totalScore
     });
  } catch (error) {
    console.error("phq9_fixed_editable 라우트 오류:", error);
    return res.status(500).json({ error: "phq9_fixed editable 처리 실패" });
  }
});

//서버 시작
app.listen(PORT, '0.0.0.0', () => { //설정된 포트에서 서버 시작하고 성공메세지 출력
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log("JWT_SECRET:", process.env.JWT_SECRET);
});