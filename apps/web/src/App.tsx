import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import { SHOW_STORIES_WORKSPACE } from "./features";
import Chats from "./views/Chats";
import Dashboard from "./views/Dashboard";
import Memories from "./views/Memories";
import Profile from "./views/Profile";
import Settings from "./views/Settings";
import Stories from "./views/Stories";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          {SHOW_STORIES_WORKSPACE ? <Route path="/stories" element={<Stories />} /> : null}
          <Route path="/chats" element={<Chats />} />
          <Route path="/memories" element={<Memories />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/timeline" element={<Navigate replace to="/memories" />} />
          {!SHOW_STORIES_WORKSPACE ? <Route path="/stories" element={<Navigate replace to="/" />} /> : null}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
