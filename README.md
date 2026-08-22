# 🎬 CineSync – Watch Party Platform

A real-time watch party web application that allows users to watch videos together, video call, and share screens seamlessly.

---

## 🚀 Features

* 🎬 Synchronized video playback
* 📹 Real-time video calling (WebRTC)
* 📺 Screen sharing support
* 📌 Pin / maximize video layout
* 💬 Live chat
* ❤️ Emoji reactions
* 🔐 Google Authentication (Firebase)
* 🌐 Multi-device support

---

## 🛠️ Tech Stack

* **Frontend:** React + Tailwind CSS
* **Backend:** Node.js + Socket.IO
* **Real-time:** WebRTC
* **Authentication:** Firebase

---

## ⚙️ Setup Instructions

### 1️⃣ Clone the repository

```bash
git clone https://github.com/Manvith-S-Shetty/CineSync.git
cd CineSync
```

---

### 2️⃣ Install dependencies

#### Frontend

```bash
cd NavPanel
npm install
```

#### Backend

```bash
cd ../VisionBridge
npm install
```

---

### 3️⃣ Setup environment variables

Create `.env` inside `NavPanel`:

```env
VITE_BACKEND_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

### 4️⃣ Run the app

#### Backend

```bash
cd VisionBridge
npm start
```

#### Frontend

```bash
cd NavPanel
npm run dev
```

---

## 🌐 Deployment

* Frontend → Vercel
* Backend → Render

---

## ⚠️ Notes

* YouTube URLs are not supported in the video player (use direct video URLs like `.mp4`)
* Both users should load the same local file for perfect sync

---

## 📸 Demo

---

## 📄 License

This project is for educational purposes.
