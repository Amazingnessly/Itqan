import { useState } from "react";
import type { AppRoute } from "./routes";
import { BottomNav } from "../components/navigation/BottomNav";
import { HomePage } from "../pages/Home/HomePage";
import { PathPage } from "../pages/Path/PathPage";
import { LessonPage } from "../pages/Lesson/LessonPage";
import { ReviewPage } from "../pages/Review/ReviewPage";
import { SourcesPage } from "../pages/Sources/SourcesPage";
import { ProfilePage } from "../pages/Profile/ProfilePage";

export function App() {
  const [route, setRoute] = useState<AppRoute>("home");

  const content = {
    home: <HomePage onStart={() => setRoute("lesson")} />,
    path: (
      <PathPage
        onBack={() => setRoute("home")}
        onStart={() => setRoute("lesson")}
      />
    ),
    lesson: (
      <LessonPage
        onClose={() => setRoute("home")}
        onComplete={() => setRoute("path")}
      />
    ),
    review: <ReviewPage />,
    sources: <SourcesPage />,
    profile: <ProfilePage />,
  }[route];

  return (
    <div className="app-shell">
      <div className="phone-frame">{content}</div>
      {route !== "lesson" && (
        <BottomNav current={route} onChange={setRoute} />
      )}
    </div>
  );
}
