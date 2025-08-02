function Message({ sender, text, timestamp, children }) {
  const isUser = sender === 'user';
  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex mb-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <img
          src='/chatbot_icon.png'
          alt="Chatbot"
          className='w-8 h-8 rounded-full mr-2 self-start'
        />
      )}
      <div className={`max-w-xs ${isUser ? "text-right" : "text-left"}`}>
        {!isUser && (
          <div className="text-sm text-gray-500 mb-1">Chatbot</div>
        )}
        <div
          className={`rounded-lg px-4 py-2 break-words ${
            isUser
              ? "bg-emerald-200"
              : "bg-gray-100"
          }`}
        >
          {children ?? <span>{text}</span>}
        </div>
        <div className="text-xs text-gray-400 mt-1">{formattedTime}</div>
      </div>
    </div>
  );
}

export default Message;
