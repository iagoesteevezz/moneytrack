# MoneyTrack

MoneyTrack is a modern and minimalist personal finance management web platform. It allows users to track income and expenses, set categorical budgets, and receive predictive financial analysis powered by adaptive Artificial Intelligence.

**Try the application live:** [https://money-track-one.vercel.app](https://money-track-one.vercel.app)

---

## For Users: What can you do with MoneyTrack?

* **Visualize your financial health:** Check your total balance, income, expenses, and monthly savings rate on an intuitive, distraction-free dashboard.
* **Prevent overspending:** Set monthly limits by category (e.g., groceries, subscriptions) and monitor your available budget in real-time.
* **Smart AI Analysis:** The app securely analyzes your spending habits to provide personalized savings advice and predictive forecasting to maximize your capital.
* **Advanced transaction management:** Log transactions in seconds, filter your history, and export your data to CSV with a single click.

---

## For Developers: Architecture and Technologies

The project is structured as a monorepo optimized for serverless deployments:

* **Frontend:** Single Page Application (SPA) built with **React, TypeScript, and Vite**. Server state management is handled by **React Query** (implementing a 5-minute `staleTime` caching strategy for performance optimization).
* **Backend:** Serverless functions written in TypeScript and deployed natively on **Vercel**, centralized via the `vercel.json` configuration at the root.
* **AI Engine:** Integrated with the official **Google Gemini (`gemini-1.5-flash`)** SDK. It implements a strict API contract using `responseSchema` to guarantee structured JSON responses, completely preventing parsing errors.
* **AI Cache (`ai_cache`):** To mitigate free-tier rate limits and reduce latency to under 50ms, the backend implements a caching table in **Supabase** that stores daily query results.

---

## Local Environment Setup

If you want to run or contribute to this project locally, follow these steps:

### 1. Clone and install dependencies
Install the node modules in both the root (backend) and the client folder (frontend):

```bash
# Install backend dependencies at the root
npm install

# Install frontend dependencies
cd frontend
npm install
```

### 2. Environment Variables
Create a `.env` or `.env.local` file in the following directories:

**At the project root (`/`):**
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_google_ai_studio_key
```

**In the Frontend folder (`/frontend`):**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Migrations
Before starting the application, you must execute the database script to enable the AI caching system. 
Go to the **SQL Editor** in your Supabase dashboard, copy the contents of the file located at `supabase/migrations/20260529_ai_cache.sql`, and run it to create the table and its RLS policies.

### 4. Run the development server
To start the local client:

```bash
cd frontend
npm run dev
```
