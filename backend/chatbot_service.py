#chatbot_service.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import os
import datetime
from openai import OpenAI
from dotenv import load_dotenv
from pymongo import MongoClient
import pytz
import json
import re
from bson import ObjectId
#환경 설정
load_dotenv()
app = Flask(__name__)
CORS(app, supports_credentials=True, origins=["http://115.145.36.231:3000"])
logging.basicConfig(level=logging.INFO)

#OpenAI & MongoDB 클라이언트 설정
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
mongo_client = MongoClient(os.environ.get("MONGO_URI"))
db = mongo_client["phq9_chatbot"]
slot_collection = db["slots"]
edited_collection = db["edited_summaries"]   # 사용자가 수정한 요약문 저장용 (1단계에서는 아직 안 씀)

#PHQ-9 항목 정의
PHQ9_ITEMS = [
    "흥미나 즐거움 감소", "우울감", "수면 문제", "피로감", "식욕 변화",
    "자기비하", "집중력 저하", "정신 운동성 지연 또는 초조", "자살 생각"
]

#슬롯 초기화
def init_slot_structure(user_id):
    now = datetime.datetime.now(pytz.timezone('Asia/Seoul'))
    return {
        "user_id": user_id,
        "slots": [
            {
                "item": item,
                "status": "unanswered",
                "score": None,
                "raw_user_input": None,
                "freq_or_intensity": None,
                "last_updated": None,
            }
            for item in PHQ9_ITEMS
        ],
        "last_updated": now
    }

#슬롯 업데이트 조건 확인 및 적용
def update_slot_structure(slot_doc, new_slot_data):
    updated = False
    now = datetime.datetime.now(pytz.timezone('Asia/Seoul'))

    for new_slot in new_slot_data:
        for existing in slot_doc["slots"]:
            if existing["item"] == new_slot["item"]:
                #score/freq_or_intensity가 null이 아니면 덮어씀
                if new_slot.get("score") is not None and new_slot["score"] != existing.get("score"):
                    existing["score"] = new_slot["score"]
                    updated = True
                if new_slot.get("freq_or_intensity") is not None and new_slot["freq_or_intensity"] != existing.get("freq_or_intensity"):
                    existing["freq_or_intensity"] = new_slot["freq_or_intensity"]
                    updated = True
                #raw_user_input은 항상 최신으로 업데이트
                if new_slot.get("raw_user_input") and new_slot["raw_user_input"] != existing.get("raw_user_input"):
                    existing["raw_user_input"] = new_slot["raw_user_input"]
                    updated = True

                if ( #6월 25일자 코드 변경한거 
                    new_slot.get("status")=="answered"
                    and new_slot.get("freq_or_intensity") is not None
                    and new_slot.get("score") is not None
                    and existing['status']!='answered'
                ):
                    existing['status']='answered'
                    updated=True
                #업데이트되었을 경우 timestamp 갱신
                if updated:
                    existing["last_updated"] = now
                break

    if updated:
        slot_doc["last_updated"] = now
    return slot_doc

def build_original_summary(slots):
    """
    slots 배열을 이용해 원본 요약 문자열을 만든다.
    """
    lines = []
    for idx, s in enumerate(slots, 1):
        lines.append(f"Q{idx}. {s['item']}\nA{idx}. {s.get('raw_user_input') or ''}")
    return "\n\n".join(lines)

def build_edited_summary(slots, edited_map):
    """
    edited_map: { item명: 수정된 답변 }
    """
    lines = []
    for idx, s in enumerate(slots, 1):
        ans = edited_map.get(s['item'], s.get('raw_user_input') or '')
        lines.append(f"Q{idx}. {s['item']}\nA{idx}. {ans}")
    return "\n\n".join(lines)


def extract_json_array(text):
    try:
        clean_text = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()

        #배열 단위가 아닌 객체 단위로 강제 분리해서 파싱 시도
        matches = re.findall(r"{[^{}]+}", clean_text)
        parsed_items = []
        now_str = datetime.datetime.now(pytz.timezone('Asia/Seoul')).isoformat()

        for match in matches:
            try:
                item = json.loads(match)
                item["last_updated"] = now_str  # 서버에서 강제로 갱신
                parsed_items.append(item)
            except Exception as e:
                logging.warning(f"JSON 항목 파싱 실패: {match} → {e}")
                continue

        return parsed_items

    except Exception as e:
        logging.warning(f"JSON 배열 추출 실패: {e}")
        return []

@app.route('/')
def home():
    return "Hello, Flask server is running!"

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_message = data.get('message')
        user_id = data.get('user_id') or 'default_user'
        history_raw = data.get('conversation_history', '')
        conversation_history = history_raw.split('|') if history_raw else []

        if not user_message:
            return jsonify({'error': 'No message provided'}), 400

        logging.info(f"사용자 메시지: {user_message}")
        conversation_history.append(user_message)
        latest_user_input = user_message
        context_text = '|'.join(conversation_history)

        # 기존 슬롯 문서 조회 또는 새로 생성
        slot_doc = slot_collection.find_one({"user_id": user_id})
        if not slot_doc:
            slot_doc = init_slot_structure(user_id)
            slot_collection.insert_one(slot_doc)
        #미응답문항만 질문하게 하려고 추가-7월 7일 주세진
        unanswered_items = [s['item'] for s in slot_doc['slots'] if s['status'] != 'answered']

        #GPT 응답 생성  
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "당신은 공감적이고 따뜻한 정신건강 챗봇입니다. 지금 사용자의 PHQ-9 우울증 자가진단을 대화형 방식으로 진행하고 있습니다.\n\n"
                        "* 대화 규칙:\n"
                        "- 이미 응답이 완료된 문항은 절대 반복해서 질문하지 마세요.\n"
                        "- 첫 번째 인삿말 이후에는 '안녕하세요' 같은 인삿말을 반복하지 마세요.\n"  #추가
                        "- 사용자의 발화를 분석하여 어떤 PHQ-9 항목(item)에 해당하는지 판단하세요.\n"
                        "- 사용자의 발화를 바탕으로 해당 항목의 점수(0~3점)와 빈도/강도 정보를 추론하세요.\n"
                        "- 빈도(며칠, 거의 매일 등)나 강도(심함의 정도) 정보가 부족한 경우, 반드시 후속 질문을 통해 **최근 2주간**의 **빈도나 강도**에 대해 자연스럽게 따뜻한 말투로 물어보세요.\n"
                        "- 후속 질문은 기계적이거나 일반적인 표현을 피하고, 반드시 이전 사용자의 응답과 **맥락**을 고려한 말투여야 합니다.\n"
                        "- 후속 질문 예시:\n"
                        "  * “말씀해주셔서 감사해요. 최근 2주 동안 이런 일이 얼마나 자주 있었나요?”\n"
                        "  * “많이 힘드셨겠어요. 최근 2주간 이런 기분이 거의 매일 있었을까요, 아니면 가끔이었을까요?”\n"
                        "  * “솔직하게 얘기해주셔서 고마워요. 최근 2주간 이런 감정이 얼마나 강하게 느껴졌는지 말씀해주실 수 있을까요?”\n"
                        "- 후속 질문에는 항상 '최근 2주간'이라는 표현이 **자연스럽게 포함**되어야 합니다.\n"
                        "- 점수와 빈도/강도가 **모두** 명확히 파악된 경우에만 해당 항목을 'answered'상태로 간주하세요.\n"
                        "- 사용자의 최근 응답을 바탕으로 다음으로 가장 관련 있어 보이는 미응답한 PHQ-9 항목 **하나만** 선택해 자연스럽게 다음 질문을 이어가세요.\n"
                        f"- 다음 질문은 반드시 아래 미응답 항목 중 하나만 선택하세요:\n{unanswered_items}\n"
                        #"- 모든 9개 항목에 대한 응답이 완료되면, 부드럽게 결과를 요약하고 감정적으로 따뜻하게 마무리하며, 필요 시 전문가 상담도 권유하세요.\n\n"
                        "* 말투:\n"
                        "- 항상 따뜻하고 지지적인, 배려심 있는 말투를 사용하세요. 친절한 친구처럼 대화해주세요.\n"
                        "- 사용자를 재촉하거나 압박하지 말고, 필요한 경우에는 공감 어린 후속 질문으로 자연스럽게 유도하세요.\n\n"
                        "* 출력 방식:\n"
                        "- 사용자의 응답에 점수와 빈도/강도가 명확히 포함된 경우, 따뜻하게 공감하며 다음 미응답 항목으로 자연스럽게 넘어가세요.\n"
                        "- 빈도 또는 강도 정보가 부족한 경우, **단 하나의 후속 질문**만 사용해 해당 정보를 자연스럽게 물어보세요. 반드시 대화 문맥에 맞는 따뜻한 말투여야 합니다."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"현재 미응답 항목 리스트:\n{unanswered_items}\n"
                        f"이 중에서 가장 관련 있는 문항 하나를 골라 자연스럽게 질문하세요.\n"
                        f"이전 대화: {context_text}\n"
                        f"이전 답변 완료 문항: {[s['item'] for s in slot_doc['slots'] if s['status']=='answered']}"
                    )
                }
            ],
            temperature=0.0,
            max_tokens=512,
        )
        bot_response = response.choices[0].message.content.strip()
        logging.info(f"GPT 응답: {bot_response}")
        conversation_history.append(bot_response)
        if len(conversation_history)>6:
            conversation_history.pop(0)
        updated_history='|'.join(conversation_history)

        #슬롯 추출 GPT 호출
        slot_update_prompt = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "당신은 사용자의 PHQ-9 자가진단 대화 내용을 바탕으로 JSON 배열을 생성하는 보조 도우미입니다.\n\n"
                        "- 전체 대화 맥락(이전 발화들)과 최신 입력을 함께 고려해서 평가하세요."
                        "- 빈도 또는 강도(freq_intensity)와 점수(score)가 모두 명확히 포함된 경우에만 해당 문항을 'answered'로 간주하세요."
                        "- 출력은 아래와 같은 **JSON 배열 형식만** 제공해야 합니다. 그 외의 텍스트는 절대 포함하지 마세요:\n"
                        "[\n"
                        "  {\n"
                        "    \"item\": \"우울감\",\n"
                        "    \"status\": \"answered\",\n"
                        "    \"score\": (사용자 응답에 근거하여 추론된 0~3 중 하나),\n"
                        "    \"raw_user_input\": \"사용자의 원문 발화\",\n"
                        "    \"freq_or_intensity\": \"사용자가 표현한 빈도 또는 강도 그대로(ex.거의 5일정도, 한 3~4일, 2주넘게)\",\n"
                        "    \"last_updated\": null\n"
                        "  }\n"
                        "]\n\n"
                        "예시:"
                        "[\n"
                        "  {\n"
                        "    \"item\": \"식욕 저하\",\n"
                        "    \"status\": \"answered\",\n"
                        "    \"score\": 1,\n"
                        "    \"raw_user_input\": \"맞아...초콜릿을 안 먹게 된지 3~4일 정도 된 것 같아...\",\n"
                        "    \"freq_or_intensity\": \"3~4일 정도\",\n"
                        "    \"last_updated\": null\n"
                        "  }\n"
                        "]\n"
                        "- score는 다음 기준에 따라 추정하세요:\n"
                        "  - 전혀 아니다, 그런 적 없다, 전혀 하지 않았다 → 0점\n"
                        "  - 며칠 동안, 가끔 → 1점\n"
                        "  - 절반 이상, 자주 → 2점\n"
                        "  - 거의 매일, 대부분의 날 → 3점\n"
                        "- 빈도나 강도에 대한 언급이 없으면 freq_or_intensity는 null로 설정하세요.\n"
                        "- 사용자가 명확히 특정 증상이 *전혀 없다*고 말했으면, 꼭 status: answered, score: 0, freq_or_intensity: 거의 없음 으로 JSON 배열에 포함하세요.\n"
                        "- 이전에 언급된 증상에 대한 후속 응답이 있을 수 있으므로, 같은 항목이라도 내용이 다르면 업데이트해야 합니다.\n"
                        "- 이미 'answered' 상태로 응답된 문항은 다시 질문하지 마세요. JSON배열에도 포함하지 마세요.\n"
                        f"- 가능한 item 값: {PHQ9_ITEMS}"
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"전체 대화 맥락:\n{context_text}\n\n"
                        f"사용자의 최신 입력:\n{latest_user_input}\n\n"
                        f"현재까지의 사용자 응답 상태(JSON):\n{json.dumps(slot_doc['slots'], ensure_ascii=False,default=str)}"
                        f"사용자의 최신 응답은 '직전에 질문한 문항'에 대한 후속 설명일 가능성이 높습니다."
                        f"따라서 '마지막으로 질문했던 문항'이 존재하면, 그 문항만을 업데이트 대상으로 간주하세요."
                        f"* 이미 'answered'상태인 문항은 다시 묻거나 json배열에 포함하지 마세요:\n"
                        f"{[s['item'] for s in slot_doc['slots'] if s['status'] == 'answered']}"
                    )
                },
            ],
            temperature=0.0,
            max_tokens=512,
        )
        slot_update_str = slot_update_prompt.choices[0].message.content.strip()
        logging.info(f"GPT JSON 응답 원문:\n{slot_update_str}")
        try:
            new_slot_data = extract_json_array(slot_update_str)
            logging.info(f"업데이트할 슬롯 데이터: {new_slot_data}")
            updated_slot_doc = update_slot_structure(slot_doc, new_slot_data)
            slot_collection.replace_one({"user_id": user_id}, updated_slot_doc,upsert=True)#upsert=True추가해서
            #문서가 존재하지않거나 key가달라도 덮어쓰기 동작이 확실히 일어남
            slot_doc=slot_collection.find_one({"user_id":user_id})#내가 수정한 부분코드-6월 22일
        except Exception as slot_err:
            logging.warning(f"슬롯 JSON 파싱 실패: {slot_err}")


        unanswered_items = [s['item'] for s in slot_doc['slots'] if s['status'] != 'answered']#미응답문항만 질문하게 하려고 추가-7월 7일 주세진
        all_answered=len(unanswered_items)==0#여기부터
        
        if all_answered:
            summary_lines=[]    
            summary_items = []

            for idx, slot in enumerate(slot_doc['slots'], 1):
                item = slot['item']
                answer = slot.get('raw_user_input') or ""   # None 방지
                summary_lines.append(f"Q{idx}. {item}\nA{idx}. {answer}")
                summary_items.append({
                    "num": idx,
                    "item": item,
                    "answer": answer
                })

            final_summary = "\n\n".join(summary_lines)
            bot_response=(
                "PHQ-9의 모든 항목에 답변해주셔서 감사합니다.\n"
                "다음은 당신이 해주신 응답 요약입니다:\n\n"
                f"{final_summary}\n\n"
                "당신의 이야기를 들어서 기쁩니다."
            )

            conversation_history.append(bot_response)
            updated_history='|'.join(conversation_history)
            total_score = sum(slot["score"] for slot in slot_doc["slots"])
            return jsonify({
                'response': bot_response,
                'conversation_history': updated_history,
                "summary": final_summary,
                "summary_items": summary_items,
                "totalScore": total_score,
                "slots": slot_doc["slots"]   # <-- 여기에 slot-by-slot score 포함
            })#여기까지는 수정한 부분 7월 9일 오후 3시 기준
        return jsonify({
            'response': bot_response,
            'conversation_history': updated_history
        })

    except Exception as e:
        logging.error("채팅 처리 중 오류 발생:", exc_info=True)
        return jsonify({'error': 'An error occurred while processing the message.'}), 500
    

# #가장 최근 7월 12일자 정도꺼
phq9_fixed_db = mongo_client["phq9_fixed_db"]
phq9_fixed_slot_collection = phq9_fixed_db["slots"]
phq9_fixed_dialog_collection = phq9_fixed_db["phq9_fixed_dialog"]
# PHQ-9 고정 문항
PHQ9_ITEMS_FIXED = [
    "1. 최근 2주간 기분이 가라앉거나, 우울하거나, 희망이 없다고 느끼셨나요?",
    "2. 최근 2주간 평소 하던 일에 대한 흥미가 없어지거나 즐거움을 느끼지 못하셨나요?",
    "3. 최근 2주간 잠을 잘 이루지 못하거나 너무 많이 주무셨나요?",
    "4. 최근 2주간 피곤하거나 기운이 없다고 느끼셨나요?",
    "5. 최근 2주간 식욕이 줄거나 너무 많이 먹었나요?",
    "6. 최근 2주간 내가 실패자라고 느끼거나 자신이나 가족을 실망시켰다고 느끼셨나요?",
    "7. 최근 2주간 신문을 읽거나 텔레비전을 보는 것과 같은 일상적인 일에 집중하기 어려우셨나요?",
    "8. 최근 2주간 다른 사람들이 알아차릴 정도로 느리게 움직이거나, 또는 너무 안절부절못하거나 들떠서 가만히 있을 수 없었던 적이 있었나요?",
    "9. 최근 2주간 죽고 싶다는 생각을 하거나 자해할 생각을 해본 적이 있으신가요?"
]

@app.route('/api/phq9_fixed', methods=['POST'])
def fixed_phq9_chat():
    try:
        data = request.get_json()
        user_message = data.get('message')
        user_id = data.get('user_id', 'default_user')
        history_raw = data.get('conversation_history', '')
        conversation_history = history_raw.split('|') if history_raw else []

        now = datetime.datetime.now(pytz.timezone('Asia/Seoul'))

        # 사용자 상태 확인 (시작 여부 및 진행 인덱스)
        user_doc = phq9_fixed_slot_collection.find_one({"user_id": user_id})
        if not user_doc:
            user_doc = {
                "user_id": user_id,
                "started": False,
                "current_index": 0,
                "last_updated": now
            }
            phq9_fixed_slot_collection.insert_one(user_doc)

        current_index = user_doc.get("current_index", 0)

        # 대화 document 생성 또는 불러오기
        dialog_doc = phq9_fixed_dialog_collection.find_one({"user": user_id})
        if not dialog_doc:
            dialog_doc = {
                "user": user_id,
                "messages": [],
                "createdAt": now
            }
            phq9_fixed_dialog_collection.insert_one(dialog_doc)

        # 1단계: 아직 시작하지 않은 경우
        if not user_doc.get("started"):
            if user_message:
                phq9_fixed_dialog_collection.update_one(
                    {"user": user_id},
                    {"$push": {"messages": {
                        "sender": "user",
                        "text": user_message,
                        "timestamp": now
                    }}}
                )

            question = PHQ9_ITEMS_FIXED[0]

            phq9_fixed_dialog_collection.update_one(
                {"user": user_id},
                {"$push": {"messages": {
                    "sender": "bot",
                    "text": question,
                    "timestamp": now
                }}}
            )

            # 시작 상태 업데이트
            phq9_fixed_slot_collection.update_one(
                {"user_id": user_id},
                {"$set": {"started": True, "current_index": 1, "last_updated": now}}
            )

            conversation_history += [user_message, question] if user_message else [question]

            return jsonify({
                'response': question,
                'conversation_history': '|'.join(conversation_history)
            })

        # 2단계: 시작된 경우 (응답 수신 및 다음 질문 전달)
        if user_message:
            phq9_fixed_dialog_collection.update_one(
                {"user": user_id},
                {"$push": {"messages": {
                    "sender": "user",
                    "text": user_message,
                    "timestamp": now
                }}}
            )

        if current_index < len(PHQ9_ITEMS_FIXED):
            question = PHQ9_ITEMS_FIXED[current_index]

            phq9_fixed_dialog_collection.update_one(
                {"user": user_id},
                {"$push": {"messages": {
                    "sender": "bot",
                    "text": question,
                    "timestamp": now
                }}}
            )

            # 다음 문항으로 진행
            phq9_fixed_slot_collection.update_one(
                {"user_id": user_id},
                {"$set": {"current_index": current_index + 1, "last_updated": now}}
            )
        else:
            question = "PHQ-9의 모든 문항에 답변해주셔서 감사합니다. 당신의 이야기를 들어서 정말 소중했어요."
            phq9_fixed_dialog_collection.update_one(
                {"user": user_id},
                {"$push": {"messages": {
                    "sender": "bot",
                    "text": question,
                    "timestamp": now
                }}}
            )

        conversation_history += [user_message, question] if user_message else [question]
        return jsonify({
            'response': question,
            'conversation_history': '|'.join(conversation_history)
        })

    except Exception as e:
        logging.error("고정 질문 API 오류 발생", exc_info=True)
        return jsonify({'error': '고정 질문 API 처리 중 오류 발생'}), 500

#low contingency & high user_agency
phq9_editable_db = mongo_client["phq9_fixed_editable"]
phq9_editable_slot_collection = phq9_editable_db["slots"]
phq9_editable_dialog_collection = phq9_editable_db["dialog"]
@app.route('/api/phq9_fixed_editable', methods=['POST'])
def fixed_phq9_editable():
    try:
        data = request.get_json()
        user_message = data.get('message')
        user_id = data.get('user_id', 'default_user')
        history_raw = data.get('conversation_history', '')
        conversation_history = history_raw.split('|') if history_raw else []

        now = datetime.datetime.now(pytz.timezone('Asia/Seoul'))

        #사용자 상태 확인 (시작 여부 및 진행 인덱스)
        user_doc = phq9_fixed_slot_collection.find_one({"user_id": user_id})
        if not user_doc:
            user_doc = {
                "user_id": user_id,
                "started": False,
                "current_index": 0,
                "last_updated": now
            }
            phq9_fixed_slot_collection.insert_one(user_doc)

        current_index = user_doc.get("current_index", 0)

        # 대화 document 생성 또는 불러오기
        dialog_doc = phq9_fixed_dialog_collection.find_one({"user": user_id})
        if not dialog_doc:
            dialog_doc = {
                "user": user_id,
                "messages": [],
                "createdAt": now
            }
            phq9_fixed_dialog_collection.insert_one(dialog_doc)

        #1단계: 아직 시작하지 않은 경우
        if not user_doc.get("started"):
            if user_message:
                phq9_fixed_dialog_collection.update_one(
                    {"user": user_id},
                    {"$push": {"messages": {
                        "sender": "user",
                        "text": user_message,
                        "timestamp": now
                    }}}
                )

            question = PHQ9_ITEMS_FIXED[0]

            phq9_fixed_dialog_collection.update_one(
                {"user": user_id},
                {"$push": {"messages": {
                    "sender": "bot",
                    "text": question,
                    "timestamp": now
                }}}
            )

            #시작 상태 업데이트
            phq9_fixed_slot_collection.update_one(
                {"user_id": user_id},
                {"$set": {"started": True, "current_index": 1, "last_updated": now}}
            )

            conversation_history += [user_message, question] if user_message else [question]

            return jsonify({
                'response': question,
                'conversation_history': '|'.join(conversation_history)
            })

        #2단계: 시작된 경우 (응답 수신 및 다음 질문 전달)
        if user_message:
            phq9_fixed_dialog_collection.update_one(
                {"user": user_id},
                {"$push": {"messages": {
                    "sender": "user",
                    "text": user_message,
                    "timestamp": now
                }}}
            )

        if current_index < len(PHQ9_ITEMS_FIXED):
            question = PHQ9_ITEMS_FIXED[current_index]

            phq9_fixed_dialog_collection.update_one(
                {"user": user_id},
                {"$push": {"messages": {
                    "sender": "bot",
                    "text": question,
                    "timestamp": now
                }}}
            )

            #다음 문항으로 진행
            phq9_fixed_slot_collection.update_one(
                {"user_id": user_id},
                {"$set": {"current_index": current_index + 1, "last_updated": now}}
            )

            # 대화 이력에 추가하고 응답 반환
            conversation_history += [user_message, question] if user_message else [question]
            return jsonify({
                "response": question,
                "conversation_history": "|".join(conversation_history)
            })
        
        else:
            if user_message:
                phq9_fixed_dialog_collection.update_one(
                    {"user": user_id},
                    {"$push": {"messages": {
                        "sender": "user",
                        "text": user_message,
                        "timestamp": now
                    }}}
                )
            # 메모리상 dialog_doc에도 반영
            dialog_doc["messages"].append({
                "sender": "user",
                "text": user_message,
                "timestamp": now
            })
            #모든 문항 완료 시, 요약 메시지 생성
            if dialog_doc and "messages" in dialog_doc:
                messages = dialog_doc["messages"]
                summary_lines = []
                #첫 줄에 인사말 추가
                summary_lines.append("PHQ-9 전체 문항에 답변해주셔서 감사합니다. 다음은 당신이 해주신 응답 요약입니다:")
                q_count = 0
                a_count = 0
                i=0
                summary_items = []
                while i < len(messages):
                    msg=messages[i]
                    if msg["sender"]=="bot":
                        #PHQ-9 문항 질문인지 확인
                        if msg["text"] not in PHQ9_ITEMS_FIXED:
                            i += 1
                            continue
                        q_count += 1
                        question_text = msg["text"].strip()
                        answer_text = ""
                        if i + 1 < len(messages) and messages[i + 1]["sender"] == "user":
                            a_count += 1
                            answer_text = messages[i + 1]["text"].strip()
                            i += 1
                        #질문-답변 한 쌍을 한 줄 띄워서 추가
                        summary_lines.append(f"Q{q_count}. {question_text}\nA{a_count}. {answer_text}")
                        summary_items.append({
                        "num": q_count,
                        "item": question_text,
                        "answer": answer_text
                    })
                    i += 1

                final_summary="\n\n".join(summary_lines)  #\n\n 두 줄 띄우기
                question=final_summary
            else:
                question="PHQ-9의 모든 문항에 답변해주셔서 감사합니다."
            conversation_history+=[user_message, question] if user_message else [question]
            return jsonify({
                'response': question,
                'conversation_history': '|'.join(conversation_history),
                "summary_items": summary_items
            })
    except Exception as e:
        logging.error("고정 질문 API 오류 발생", exc_info=True)
        return jsonify({'error': '고정 질문 API 처리 중 오류 발생'}), 500
    
edited_answers_collection = db["edited_answers"]

@app.route('/api/summary/edit', methods=['POST'])
def submit_edited_answers():
    """
    Body 예시:
    {
      "user_id": "session_xxx",
      "edited_items": [
        {"item": "수면 문제", "edited_answer": "요새 3~4일 정도 잠 설쳤어요"},
        {"item": "피로감", "edited_answer": "피곤은 거의 없음"}
      ]
    }
    """
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'default_user')
        edited_items = data.get('edited_items')

        if not isinstance(edited_items, list):
            return jsonify({"error": "edited_items must be a list"}), 400

        cleaned = []
        for idx, it in enumerate(edited_items):
            if not isinstance(it, dict):
                return jsonify({"error": f"edited_items[{idx}] invalid"}), 400
            item = it.get("item")
            edited_answer = it.get("edited_answer")
            if not item:
                return jsonify({"error": f"edited_items[{idx}] missing item"}), 400
            if edited_answer is None:
                edited_answer = ""  # 빈 문자열 허용
            cleaned.append({
                "item": item,
                "edited_answer": edited_answer
            })

        doc = {
            "user_id": user_id,
            "edited_items": cleaned,
            "saved_at": datetime.datetime.now(pytz.timezone('Asia/Seoul'))
        }
        ins = edited_answers_collection.insert_one(doc)

        return jsonify({
            "message": "edited answers saved",
            "edited_id": str(ins.inserted_id),
            "count": len(cleaned)
        }), 200

    except Exception:
        logging.exception("submit_edited_answers error")
        return jsonify({"error": "internal error"}), 500

db_high_c_low_u = mongo_client["phq9_high_c_low_u"]
slot_collection_high = db_high_c_low_u["slots"]
@app.route('/api/phq9_high_c_low_u', methods=['POST'])
def phq9_high_c_low_u():
    try:
        data = request.get_json()
        user_message = data.get('message')
        user_id = data.get('user_id') or 'default_user'
        history_raw = data.get('conversation_history', '')
        conversation_history = history_raw.split('|') if history_raw else []
        if not user_message:
            return jsonify({'error': 'No message provided'}), 400
        logging.info(f"사용자 메세지:{user_message}")
        conversation_history.append(user_message)
        latest_user_input=user_message
        context_text="|".join(conversation_history)
        #새로운 컬렉션에 문서 조회/생성
        slot_doc=slot_collection_high.find_one({"user_id":user_id})
        if not slot_doc:
            slot_doc=init_slot_structure(user_id)
            slot_collection_high.insert_one(slot_doc)
        unanswered_items=[s['item'] for s in slot_doc['slots'] if s['status']!='answered']
        
        #GPT응답생성
        response=client.chat.completions.create(
            model='gpt-4o',
            messages=[
                {
                    "role":"system",
                    "content":(
                        "당신은 공감적이고 따뜻한 정신건강 챗봇입니다. 지금 사용자의 PHQ-9 우울증 자가진단을 대화형 방식으로 진행하고 있습니다.\n\n"
                         "* 대화 규칙:\n"
                        "- 이미 응답이 완료된 문항은 절대 반복해서 질문하지 마세요.\n"
                        "- 첫 번째 인삿말 이후에는 '안녕하세요' 같은 인삿말을 반복하지 마세요.\n"  #추가 7/30
                        "- 사용자의 발화를 분석하여 어떤 PHQ-9 항목(item)에 해당하는지 판단하세요.\n"
                        "- 사용자의 발화를 바탕으로 해당 항목의 점수(0~3점)와 빈도/강도 정보를 추론하세요.\n"
                        "- 빈도(며칠, 거의 매일 등)나 강도(심함의 정도) 정보가 부족한 경우, 반드시 후속 질문을 통해 **최근 2주간**의 **빈도나 강도**에 대해 자연스럽게 따뜻한 말투로 물어보세요.\n"
                        "- 후속 질문은 기계적이거나 일반적인 표현을 피하고, 반드시 이전 사용자의 응답과 **맥락**을 고려한 말투여야 합니다.\n"
                        "- 후속 질문 예시:\n"
                        "  * “말씀해주셔서 감사해요. 최근 2주 동안 이런 일이 얼마나 자주 있었나요?”\n"
                        "  * “많이 힘드셨겠어요. 최근 2주간 이런 기분이 거의 매일 있었을까요, 아니면 가끔이었을까요?”\n"
                        "  * “솔직하게 얘기해주셔서 고마워요. 최근 2주간 이런 감정이 얼마나 강하게 느껴졌는지 말씀해주실 수 있을까요?”\n"
                        "- 후속 질문에는 항상 '최근 2주간'이라는 표현이 **자연스럽게 포함**되어야 합니다.\n"
                        "- 점수와 빈도/강도가 **모두** 명확히 파악된 경우에만 해당 항목을 'answered'상태로 간주하세요.\n"
                        "- 사용자의 최근 응답을 바탕으로 다음으로 가장 관련 있어 보이는 미응답한 PHQ-9 항목 **하나만** 선택해 자연스럽게 다음 질문을 이어가세요.\n"
                        f"- 다음 질문은 반드시 아래 미응답 항목 중 하나만 선택하세요:\n{unanswered_items}\n"
                        "* 말투:\n"
                        "- 항상 따뜻하고 지지적인, 배려심 있는 말투를 사용하세요. 친절한 친구처럼 대화해주세요.\n"
                        "- 사용자를 재촉하거나 압박하지 말고, 필요한 경우에는 공감 어린 후속 질문으로 자연스럽게 유도하세요.\n\n"
                        "* 출력 방식:\n"
                        "- 사용자의 응답에 점수와 빈도/강도가 명확히 포함된 경우, 따뜻하게 공감하며 다음 미응답 항목으로 자연스럽게 넘어가세요.\n"
                        "- 빈도 또는 강도 정보가 부족한 경우, **단 하나의 후속 질문**만 사용해 해당 정보를 자연스럽게 물어보세요. 반드시 대화 문맥에 맞는 따뜻한 말투여야 합니다."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"현재 미응답 항목 리스트:\n{unanswered_items}\n"
                        f"이 중에서 가장 관련 있는 항목 하나를 골라 자연스럽게 질문하세요.\n"
                        f"이전 대화: {context_text}\n"
                        f"이전 답변 완료 문항: {[s['item'] for s in slot_doc['slots'] if s['status']=='answered']}"
                    )
                }
            ],
            temperature=0.0,
            max_tokens=512
        )
        bot_response=response.choices[0].message.content.strip()
        conversation_history.append(bot_response)
        if len(conversation_history)>6:
            conversation_history.pop(0)
        updated_history="|".join(conversation_history)
        #슬롯 업데이트
        slot_update_prompt = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "당신은 사용자의 PHQ-9 자가진단 대화 내용을 바탕으로 JSON 배열을 생성하는 보조 도우미입니다.\n\n"
                        "- 전체 대화 맥락(이전 발화들)과 최신 입력을 함께 고려해서 평가하세요."
                        "- 빈도 또는 강도(freq_intensity)와 점수(score)가 모두 명확히 포함된 경우에만 해당 문항을 'answered'로 간주하세요."
                        "- 출력은 아래와 같은 **JSON 배열 형식만** 제공해야 합니다. 그 외의 텍스트는 절대 포함하지 마세요:\n"
                        "[\n"
                        "  {\n"
                        "    \"item\": \"우울감\",\n"
                        "    \"status\": \"answered\",\n"
                        "    \"score\": (사용자 응답에 근거하여 추론된 0~3 중 하나),\n"
                        "    \"raw_user_input\": \"사용자의 원문 발화\",\n"
                        "    \"freq_or_intensity\": \"사용자가 표현한 빈도 또는 강도 그대로(ex.거의 5일정도, 한 3~4일, 2주넘게)\",\n"
                        "    \"last_updated\": null\n"
                        "  }\n"
                        "]\n\n"
                        "예시:"
                        "[\n"
                        "  {\n"
                        "    \"item\": \"식욕 저하\",\n"
                        "    \"status\": \"answered\",\n"
                        "    \"score\": 1,\n"
                        "    \"raw_user_input\": \"맞아...초콜릿을 안 먹게 된지 3~4일 정도 된 것 같아...\",\n"
                        "    \"freq_or_intensity\": \"3~4일 정도\",\n"
                        "    \"last_updated\": null\n"
                        "  }\n"
                        "]\n"
                        "- score는 다음 기준에 따라 추정하세요:\n"
                        "  - 전혀 아니다, 그런 적 없다, 전혀 하지 않았다 → 0점\n"
                        "  - 며칠 동안, 가끔 → 1점\n"
                        "  - 절반 이상, 자주 → 2점\n"
                        "  - 거의 매일, 대부분의 날 → 3점\n"
                        "- 빈도나 강도에 대한 언급이 없으면 freq_or_intensity는 null로 설정하세요.\n"
                        "- 사용자가 명확히 특정 증상이 *전혀 없다*고 말했으면, 꼭 status: answered, score: 0, freq_or_intensity: 거의 없음 으로 JSON 배열에 포함하세요.\n"
                        "- 이전에 언급된 증상에 대한 후속 응답이 있을 수 있으므로, 같은 항목이라도 내용이 다르면 업데이트해야 합니다.\n"
                        "- 이미 'answered' 상태로 응답된 문항은 다시 질문하지 마세요. JSON배열에도 포함하지 마세요.\n"
                        f"- 가능한 item 값: {PHQ9_ITEMS}"
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"전체 대화 맥락:\n{context_text}\n\n"
                        f"사용자의 최신 입력:\n{latest_user_input}\n\n"
                        f"현재까지의 사용자 응답 상태(JSON):\n{json.dumps(slot_doc['slots'], ensure_ascii=False,default=str)}"
                        f"사용자의 최신 응답은 '직전에 질문한 문항'에 대한 후속 설명일 가능성이 높습니다."
                        f"따라서 '마지막으로 질문했던 문항'이 존재하면, 그 문항만을 업데이트 대상으로 간주하세요."
                        f"* 이미 'answered'상태인 문항은 다시 묻거나 json배열에 포함하지 마세요:\n"
                        f"{[s['item'] for s in slot_doc['slots'] if s['status'] == 'answered']}"
                    )
                }
            ],
            temperature=0.0,
            max_tokens=512,
        )

        slot_update_str = slot_update_prompt.choices[0].message.content.strip()
        logging.info(f"GPT JSON 응답 원문:\n{slot_update_str}")
        try:
            new_slot_data = extract_json_array(slot_update_str)
            logging.info(f"업데이트할 슬롯 데이터: {new_slot_data}")
            updated_slot_doc = update_slot_structure(slot_doc, new_slot_data)
            slot_collection_high.replace_one({"user_id": user_id}, updated_slot_doc, upsert=True)
        except Exception as slot_err:
            logging.warning(f"슬롯 JSON 파싱 실패: {slot_err}")

        unanswered_items=[s['item'] for s in slot_doc['slots'] if s['status']!='answered']
        all_answered=len(unanswered_items)==0

        if all_answered:
            bot_response="PHQ-9 모든 문항에 답변해주셔서 감사합니다. 수고 많으셨습니다."
            conversation_history.append(bot_response)
            updated_history="|".join(conversation_history)
            slots_data = slot_doc['slots']
            total_score = sum(s.get('score', 0) for s in slots_data)
            return jsonify({
                "response":bot_response,
                "conversation_history":updated_history,
                "finished":True,
                "slots": slots_data,
                "totalScore": total_score
            })

        return jsonify({
            'response': bot_response,
            'conversation_history': updated_history
        })
    except Exception as e:
        logging.error("채팅 처리 중 오류 발생:", exc_info=True)
        return jsonify({'error': 'An error occurred while processing the message.'}), 500

#서버 실행
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)