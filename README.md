# KMAP – Knowledge Mapping Adaptive Platform

KMAP is a low-bandwidth, privacy-preserving adaptive learning platform designed for rural environments. It uses a rule-driven procedural question engine and modular concept-based resource delivery to provide personalized learning without heavy AI dependency or large data transfers.



## 🚀 Problem Statement

In rural and low-bandwidth regions:

- Internet connectivity is slow or intermittent
- Large PDFs and video lectures are not practical
- Sending raw student performance data to cloud servers raises privacy concerns

KMAP solves this by:

- Performing local skill assessment
- Delivering lightweight modular learning resources
- Generating questions dynamically without relying on heavy AI APIs
- Preserving student privacy



## 🧠 Core Innovation

KMAP introduces:

### 1️⃣ Procedural Question Engine
Instead of hardcoded questions or runtime AI generation, KMAP uses a rule-based generation engine that dynamically creates questions based on:

- Subject rules
- Concept metadata
- Difficulty scaling
- Parameter ranges

This enables:
- Infinite variations
- Offline compatibility
- Low bandwidth usage

---

### 2️⃣ Knowledge Object Model

Each academic topic is structured as a lightweight JSON-based concept object:

```json
{
  "concept": "Photosynthesis",
  "definition": "...",
  "key_points": [],
  "examples": [],
  "relationships": []
}

```

# 📁 Project Structure
```
- **app/** – Next.js app router pages  
- **components/** – Reusable UI components  
- **contexts/** – Global state management  
- **hooks/** – Custom React hooks  
- **lib/** – Utility functions  
- **question_engine/** – Procedural question generator logic  
- **resource_engine/** – Concept loading & resource allocation  
- **supabase/** – Backend / database integration  
- **public/** – Static assets  
```

⚙️ Tech Stack
Next.js (App Router)
TypeScript
Tailwind CSS
Shadcn UI
Supabase
Rule-Based Procedural Engine

🔄 How It Works
Student selects subject
Micro-diagnostic evaluates skill locally
System assigns difficulty level
Question engine generates adaptive questions
Resource engine loads only required concept
Data is cached for offline usage

🌍 Designed for Rural Deployment
Text-first learning model
Micro-content delivery
Optional compressed media
No heavy streaming
Offline caching supported

🧩 Future Enhancements
AI-assisted concept structuring pipeline
Knowledge graph-based progression mapping
Confidence-based adaptive difficulty
Federated learning support

📌 Hackathon Focus
KMAP demonstrates:
Scalable architecture
AI used intelligently (not as a wrapper)
Procedural generation innovation
Privacy-preserving learning model
Low-bandwidth optimization
