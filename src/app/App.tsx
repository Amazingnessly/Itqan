import { useState } from "react";
import type { AppRoute } from "./routes";
import {
  isCategoryAvailableForActiveLesson,
  isLearningStageAvailableForActiveLesson,
  learningStage,
  loadLearnerState,
  type ExerciseCategory,
  type LearningStageId,
} from "../learning";
import { BottomNav } from "../components/navigation/BottomNav";
import { HomePage } from "../pages/Home/HomePage";
import { PathPage } from "../pages/Path/PathPage";
import { LessonPage } from "../pages/Lesson/LessonPage";
import { ReviewPage } from "../pages/Review/ReviewPage";
import { SourcesPage } from "../pages/Sources/SourcesPage";
import { HumanReviewPage } from "../pages/HumanReview/HumanReviewPage";
import { ProfilePage } from "../pages/Profile/ProfilePage";

type NonLessonRoute = Exclude<AppRoute, "lesson">;

export function App() {
  const [route, setRoute] = useState<AppRoute>("home");
  const [lessonReturnRoute, setLessonReturnRoute] = useState<NonLessonRoute>("path");
  const [lessonCategory, setLessonCategory] = useState<ExerciseCategory>("reading_units");
  const [preferredSessionId, setPreferredSessionId] = useState<string | undefined>(undefined);
  const [preferredStageId, setPreferredStageId] = useState<LearningStageId | undefined>(undefined);

  function startLesson(
    returnRoute: NonLessonRoute,
    category: ExerciseCategory = "reading_units",
    targetSessionId?: string,
    targetStageId?: LearningStageId,
  ) {
    const learner = loadLearnerState();
    if (targetStageId) {
      if (learningStage(targetStageId).category !== category) return;
      if (!isLearningStageAvailableForActiveLesson(targetStageId, learner)) return;
    } else if (!isCategoryAvailableForActiveLesson(category, learner)) {
      return;
    }
    setLessonReturnRoute(returnRoute);
    setLessonCategory(category);
    setPreferredSessionId(targetSessionId);
    setPreferredStageId(targetStageId);
    setRoute("lesson");
  }

  function finishLesson() { setRoute(lessonReturnRoute); }

  const content = {
    home: <HomePage onStart={(category, targetSessionId, targetStageId) => startLesson("home", category, targetSessionId, targetStageId)} onOpenPath={() => setRoute("path")} />,
    path: <PathPage onBack={() => setRoute("home")} onStart={(category, stageId) => startLesson("path", category, undefined, stageId)} />,
    lesson: <LessonPage category={lessonCategory} preferredSessionId={preferredSessionId} preferredStageId={preferredStageId} onClose={() => setRoute(lessonReturnRoute)} onComplete={finishLesson} />,
    review: <ReviewPage onStart={(category, targetSessionId) => startLesson("review", category, targetSessionId)} />,
    sources: <SourcesPage onOpenHumanReview={() => setRoute("human-review")} />,
    "human-review": <HumanReviewPage onBack={() => setRoute("sources")} />,
    profile: <ProfilePage />,
  }[route];

  return <div className="app-shell"><div className="phone-frame">{content}</div>{route !== "lesson" && <BottomNav current={route} onChange={setRoute} />}</div>;
}
