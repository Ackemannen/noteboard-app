🧷 Digital Cork Board
A beautiful and interactive digital cork board built with React, TypeScript, and Tailwind CSS. Create, edit, and organize sticky notes with a realistic cork board experience — just like the real thing, but better!


✨ Features
📝 Interactive Sticky Notes – Create, edit, and delete notes instantly

🎨 Colorful Notes – Choose from 5 vibrant colors: Yellow, Pink, Blue, Green, Orange

🖱️ Drag & Drop – Smooth repositioning with mouse or touch support

💾 Persistent Storage – Notes are saved automatically via localStorage

🧱 Realistic Design – Authentic cork board look with sticky note texture

📱 Responsive Layout – Works great on both desktop and mobile devices

⚡ Smooth Animations – Includes subtle hover effects and transitions

🌀 Random Rotation – Notes appear with slight rotation for that organic, realistic feel

🚀 Getting Started
Prerequisites
Node.js (v18 or higher)

npm or yarn

Installation
bash
Kopiera
Redigera
# Clone the repository
git clone https://github.com/your-username/digital-cork-board.git
cd digital-cork-board

# Install dependencies
npm install
# or
yarn install

# Start development server
npm run dev
# or
yarn dev
Then open your browser and navigate to:
http://localhost:5173

📦 Available Scripts
Script	Description
npm run dev	Start development server
npm run build	Build app for production
npm run preview	Preview production build
npm run lint	Run ESLint to check code quality

🎮 How to Use
Create a Note – Click anywhere on the board

Edit a Note – Click an existing note to edit title, content, or color

Move Notes – Drag and drop notes to rearrange them freely

Delete Notes – Open a note and click the 🗑️ delete button

Change Color – Select from 5 preset colors while editing or creating a note

🛠️ Tech Stack
Tool	Purpose
React 19.1.0	UI framework
TypeScript 5.8.3	Static typing
Vite 7.0.0	Build and development server
Tailwind CSS 4.1.11	Utility-first CSS styling
Radix UI	Accessible UI primitives
Lucide React	Icon library
React Hook Form	Form management
React Query	State management and caching
React Router DOM	Routing
Sonner	Toast notifications

📁 Project Structure
bash
Kopiera
Redigera
src/
├── components/
│   ├── StickyNote.tsx         # Individual note component
│   ├── NoteModal.tsx          # Modal for editing/creating notes
│   └── hooks/useDrag.ts       # Custom hook for drag-and-drop
├── assets/                    # Cork board background, icons, etc.
├── App.tsx
└── main.tsx
🧩 Key Components
🗒️ StickyNote
Renders individual sticky notes with animations

Implements drag-and-drop and random rotation

Uses Tailwind classes for styling

🪟 NoteModal
Modal for creating and editing notes

Color selection with preview

Includes delete functionality and validation

🧲 useDrag Hook
Smooth drag behavior using requestAnimationFrame

Prevents click events while dragging

Cleans up event listeners to avoid memory leaks

🎨 Customization
Add New Note Colors
Update the colors array in NoteModal.tsx

Update the getColorClasses function in StickyNote.tsx

Modify Note Size
Adjust the w-* and h-* Tailwind classes in StickyNote.tsx

Change Cork Board Background
Replace the background.png in the assets/ folder with your preferred image
