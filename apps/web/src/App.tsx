import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import { useStoriesWorkspaceVisibility } from "./features";

const Dashboard = lazy(() => import("./views/Dashboard"));
const Profile = lazy(() => import("./views/Profile"));
const Stories = lazy(() => import("./views/Stories"));
const Chats = lazy(() => import("./views/Chats"));
const Memories = lazy(() => import("./views/Memories"));
const Settings = lazy(() => import("./views/Settings"));

function RouteFallback() {
  return (
    <div className="mx-auto flex min-h-[24rem] w-full max-w-[1520px] items-center justify-center rounded-[1.75rem] border border-slate-200/80 bg-white/80 px-6 py-12 text-sm text-slate-500 shadow-[0_20px_48px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
      Loading workspace...
    </div>
  );
}

export default function App() {
  const storiesWorkspace = useStoriesWorkspaceVisibility();
  const allowStoriesRoute = storiesWorkspace.isVisible || storiesWorkspace.isLoading;

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/stories" element={allowStoriesRoute ? <Stories /> : <Navigate replace to="/" />} />
            <Route path="/chats" element={<Chats />} />
            <Route path="/memories" element={<Memories />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/timeline" element={<Navigate replace to="/memories" />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
