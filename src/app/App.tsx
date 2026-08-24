import { useState } from "react";
import type { AppRoute } from "./routes";
import type { ExerciseCategory } from "../learning";
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
  const [lessonReturnRoute, setLessonReturnRoute] = useState<NonLessonRoute>("path");
  const [lessonCategory, setLessonCategory] = useState<ExerciseCategory>("reading_units");

  function startLesson(returnRoute: NonLessonRoute, category: ExerciseCategory = "reading_units") {
    setLessonReturnRoute(returnRoute);
    setLessonCategory(category);
    setRoute("lesson");
  }

  function finishLesson() { setRoute(lessonReturnRoute); }

  const content = {
    home: <HomePage onStart={(category) => startLesson("home", category)} onOpenPath={() => setRoute("path")} />,
    path: <PathPage onBack={() => setRoute("home")} onStart={(category) => startLesson("path", category)} />,
    lesson: <LessonPage category={lessonCategory} onClose={() => setRoute(lessonReturnRoute)} onComplete={finishLesson} />,
    review: <ReviewPage onStart={(category) => startLesson("review", category)} />,
    sources: <SourcesPage />,
    profile: <ProfilePage />,
  }[route];

  return <div className="app-shell"><div className="phone-frame">{content}</div>{route !== "lesson" && <BottomNav current={route} onChange={setRoute} />}</div>;
}
