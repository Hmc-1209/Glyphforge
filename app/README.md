# Glyphforge App

A beautiful dark-themed React static website with integrated Prompt gallery management functionality

## Features

- Dark design with deep gray-blue tones
- Rounded border design with seamless integration of tabs and content area
- Responsive layout
- Modern gradient effects
- Prompt gallery browsing and copy functionality
- Image preview popup

## How to Start

### 1. Install Dependencies

First, navigate to the `app` folder in your terminal:

```bash
cd app
```

Then install the required packages:

```bash
npm install
```

### 2. Start the Application

After installation, run the following command to start both the backend API server and frontend development server:

```bash
npm start
```

This will start:
- Backend API server (http://localhost:3001)
- Frontend development server (http://localhost:5173)

### 3. View in Browser

Open `http://localhost:5173` in your browser to see your website!

## Other Commands

- `npm run dev` - Start frontend development server only
- `npm run server` - Start backend API server only
- `npm run build` - Build production version
- `npm run preview` - Preview the built production version

## Features

### Prompt Tab
- Display image thumbnails from all folders in `prompt-folder`
- Click thumbnail to open popup and view two full images
- Click copy button to copy the contents of `prompt.txt` from the corresponding folder

### LoRA Tab
- LoRA model management interface (example)

## Tech Stack

- React 18
- Vite
- Express.js
- CSS3
