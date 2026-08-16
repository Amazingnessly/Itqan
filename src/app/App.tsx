import { useState } from "react";
import type { AppRoute } from "./routes";
import { BottomNav } from "../components/navigation/BottomNav";
import { HomePage } from "../pages/Home/HomePage";
import { PathPage } from "../pages/Path/PathPage";
import { LessonPage } from "../pages/Lesson/LessonPage";
import { ReviewPage } from "../pages/Review/ReviewPage";
import { SourcesPage } from "../pages/Sources/SourcesPage";
import { ProfilePage } from "../pages/Profile/ProfilePage";

type NonLessonRoute = Exclude<AppRoute, "lesson">;

export function App() {
  const [route, setRoute] = useState<AppRoute>("home");
  const [lessonReturnRoute, setLessonReturnRoute] =
    useState<NonLessonRoute>("path");

  function startLesson(returnRoute: NonLessonRoute) {
    setLessonReturnRoute(returnRoute);
    setRoute("lesson");
  }

  function finishLesson() {
    setRoute(lessonReturnRoute);
  }

  const content = {
    home: (
      <HomePage
        onStart={() => startLesson("path")}
        onOpenPath={() => setRoute("path")}
      />
    ),
    path: (
      <PathPage
        onBack={() => setRoute("home")}
        onStart={() => startLesson("path")}
      />
    ),
    lesson: (
      <LessonPage
        onClose={() => setRoute(lessonReturnRoute)}
        onComplete={finishLesson}
      />
    ),
    review: <ReviewPage onStart={() => startLesson("review")} />,
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
