# Finetuned Blenderbot based Counseling Chatbot

## Introduction

This project is a simple chatbot application consisting of a frontend built with React and a backend using Node.js and Flask. It provides rule-based responses and utilizes the finetuned BlenderBot model for natural language processing.

## Features

- Rule-Based Responses: Provides predefined responses to specific questions.
- BlenderBot Model Responses: Generates responses using a deep learning model for queries not covered by the rule-based system.
- Signup and Login available : Chat history is saved after logout.

## Installation and Setup

### 1. Clone the Repository

```sh
git clone https://github.com/skhoon4u/urp2024-counseling.git
```

### 2. Download the Model Files

Download the finetuned_blenderbot model files and place them in the project root directory.

- Download Link : https://drive.google.com/drive/folders/1PdDOUckNtvS9_A92h29txMvV6IsHCubS?usp=drive_link
- After downloading, copy the finetuned_blenderbot folder into the project root directory.

### 3. Backend Setup

Node.js Server Setup

```sh
cd backend
npm install
```

```sh
node ./backend/server.js
```

- The server will run on port 3001.

Flask Server Setup

- Create and Activate a Virtual Environment (Optional)

```sh
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

- Install Dependencies

```sh
pip install -r requirements.txt
```

- Start the Flask Server

```sh
python chatbot_service.py
```

- The server will run on port 5001.

### 4. Frontend Setup

- Start the React App

```sh
cd frontend
npm start
```

- The app will run on port 3000. You can access it in your browser at http://localhost:3000.

## Usage

1. Open your browser and navigate to http://localhost:3000.
2. Login. If you haven't made an account, sign up first.
3. Enter a message in the chat window and send it.
4. If the message matches a rule-based response, you’ll receive an immediate reply.
5. For other messages, the BlenderBot model will generate a response.
