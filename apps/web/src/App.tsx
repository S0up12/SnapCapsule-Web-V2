import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import { useStoriesWorkspaceVisibility } from "./features";
import Chats from "./views/Chats";
import Dashboard from "./views/Dashboard";
import Memories from "./views/Memories";
import Profile from "./views/Profile";
import Settings from "./views/Settings";
import Stories from "./views/Stories";

export default function App() {
  const storiesWorkspace = useStoriesWorkspaceVisibility();
  const allowStoriesRoute = storiesWorkspace.isVisible || storiesWorkspace.isLoading;

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
