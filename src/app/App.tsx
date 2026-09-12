import { useState } from "react";
import type { AppRoute } from "./routes";
import {
  isCategoryAvailableForActiveLesson,
  loadLearnerState,
  type ExerciseCategory,
} from "../learning";
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
  const [preferredSessionId, setPreferredSessionId] = useState<string | undefined>(undefined);

  function startLesson(
    returnRoute: NonLessonRoute,
    category: ExerciseCategory = "reading_units",
    targetSessionId?: string,
  ) {
    if (!isCategoryAvailableForActiveLesson(category, loadLearnerState())) return;
    setLessonReturnRoute(returnRoute);
    setLessonCategory(category);
    setPreferredSessionId(targetSessionId);
    setRoute("lesson");
  }

  function finishLesson() { setRoute(lessonReturnRoute); }

  const content = {
    home: <HomePage onStart={(category, targetSessionId) => startLesson("home", category, targetSessionId)} onOpenPath={() => setRoute("path")} />,
    path: <PathPage onBack={() => setRoute("home")} onStart={(category) => startLesson("path", category)} />,
    lesson: <LessonPage category={lessonCategory} preferredSessionId={preferredSessionId} onClose={() => setRoute(lessonReturnRoute)} onComplete={finishLesson} />,
    review: <ReviewPage onStart={(category, targetSessionId) => startLesson("review", category, targetSessionId)} />,
    sources: <SourcesPage />,
    profile: <ProfilePage />,
  }[route];

  return <div className="app-shell"><div className="phone-frame">{content}</div>{route !== "lesson" && <BottomNav current={route} onChange={setRoute} />}</div>;
}
