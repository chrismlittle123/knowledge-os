"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Textarea,
  Badge,
  Skeleton,
} from "@architecta/ui";
import {
  createWorkflow,
  startPlan,
  refinePlan,
  approvePlan,
  answerQuestions,
  acceptPlaybook,
  rejectPlaybook,
  subscribeToWorkflow,
  type Workflow,
  type SSEEvent,
  type ClarifyingQuestion,
  type Playbook,
} from "@/lib/api";

type BuildPhase = "intent" | "exploring" | "questions" | "playbook" | "planning" | "plan" | "complete";

export default function BuildPage() {
  // Workflow state
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [phase, setPhase] = useState<BuildPhase>("intent");

  // Input state
  const [requirement, setRequirement] = useState("");
  const [feedback, setFeedback] = useState("");

  // Question state
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});

  // Playbook state
  const [proposedPlaybook, setProposedPlaybook] = useState<Playbook | null>(null);
  const [playbookFeedback, setPlaybookFeedback] = useState("");

  // UI state
  const [thinking, setThinking] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle SSE events
  const handleEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case "thinking":
        setThinking(event.message);
        break;
      case "output":
        // We don't show raw output in the new UI
        break;
      case "questions":
        setQuestions(event.questions);
        setSelectedAnswers({});
        setPhase("questions");
        setThinking(null);
        setIsLoading(false);
        break;
      case "playbookProposed":
        setProposedPlaybook(event.playbook);
        setPlaybookFeedback("");
        setPhase("playbook");
        setThinking(null);
        setIsLoading(false);
        break;
      case "phaseChange":
        setWorkflow((prev) => (prev ? { ...prev, phase: event.phase } : null));
        break;
      case "planReady":
        setWorkflow((prev) => (prev ? { ...prev, plan: event.plan } : null));
        setQuestions([]);
        setPhase("plan");
        setThinking(null);
        setIsLoading(false);
        break;
      case "error":
        setError(event.error);
        setThinking(null);
        setIsLoading(false);
        break;
      case "done":
        setThinking(null);
        setIsLoading(false);
        break;
    }
  }, []);

  // Initialize workflow
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      try {
        const wf = await createWorkflow();
        setWorkflow(wf);
        unsubscribe = subscribeToWorkflow(
          wf.id,
          handleEvent,
          (err) => setError(err.message)
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create workflow");
      }
    };

    init();

    return () => {
      unsubscribe?.();
    };
  }, [handleEvent]);

  // Start planning
  const handleStartPlan = async () => {
    if (!workflow || !requirement.trim()) return;

    setIsLoading(true);
    setError(null);
    setPhase("exploring");

    try {
      await startPlan(workflow.id, requirement);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start planning");
      setIsLoading(false);
      setPhase("intent");
    }
  };

  // Submit answers
  const handleSubmitAnswers = async () => {
    if (!workflow || questions.length === 0) return;

    const unanswered = questions.filter((q) => !selectedAnswers[q.id]);
    if (unanswered.length > 0) {
      setError(`Please answer all questions (${unanswered.length} remaining)`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setPhase("planning");
    setThinking("Creating your plan...");

    try {
      await answerQuestions(workflow.id, selectedAnswers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit answers");
      setIsLoading(false);
      setPhase("questions");
    }
  };

  // Accept playbook
  const handleAcceptPlaybook = async () => {
    if (!workflow || !proposedPlaybook) return;

    setIsLoading(true);
    setError(null);
    setPhase("planning");
    setThinking("Generating detailed plan...");

    try {
      await acceptPlaybook(workflow.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept playbook");
      setIsLoading(false);
      setPhase("playbook");
    }
  };

  // Reject playbook
  const handleRejectPlaybook = async () => {
    if (!workflow || !proposedPlaybook || !playbookFeedback.trim()) return;

    setIsLoading(true);
    setError(null);
    setPhase("exploring");
    setThinking("Reconsidering playbook...");

    try {
      await rejectPlaybook(workflow.id, playbookFeedback);
      setProposedPlaybook(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject playbook");
      setIsLoading(false);
      setPhase("playbook");
    }
  };

  // Refine plan
  const handleRefinePlan = async () => {
    if (!workflow || !feedback.trim()) return;

    setIsLoading(true);
    setError(null);
    setPhase("planning");
    setThinking("Refining your plan...");

    try {
      await refinePlan(workflow.id, feedback);
      setFeedback("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refine plan");
      setIsLoading(false);
      setPhase("plan");
    }
  };

  // Approve plan
  const handleApprovePlan = async () => {
    if (!workflow) return;

    setIsLoading(true);
    setError(null);

    try {
      await approvePlan(workflow.id);
      setPhase("complete");
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve plan");
      setIsLoading(false);
    }
  };

  // Reset
  const handleReset = () => {
    window.location.reload();
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Build</h1>
          <p className="text-muted-foreground text-lg">
            Describe what you want. Answer a few questions. Get a plan.
          </p>
        </div>

        {/* Error */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="mt-2">
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Phase: Intent */}
        {phase === "intent" && workflow && (
          <Card className="border-2">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl">What do you want to build?</CardTitle>
              <CardDescription className="text-base">
                Be as specific or general as you like. I&apos;ll ask questions to clarify.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Textarea
                placeholder="e.g., Add user authentication with social login support..."
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                rows={5}
                className="text-lg resize-none"
                autoFocus
              />
              <Button
                onClick={handleStartPlan}
                disabled={!requirement.trim()}
                size="lg"
                className="w-full text-lg py-6"
              >
                Start Planning
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Phase: Exploring */}
        {phase === "exploring" && (
          <Card className="border-2">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-xl font-medium mb-2">
                    {thinking || "Exploring your codebase..."}
                  </p>
                  <p className="text-muted-foreground">
                    Looking at your project to ask the right questions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Phase: Questions */}
        {phase === "questions" && questions.length > 0 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold mb-2">A few questions</h2>
              <p className="text-muted-foreground">
                Help me understand what you need so I can create the right plan
              </p>
            </div>

            {questions.map((q, index) => (
              <Card key={q.id} className="border-2">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                      {index + 1}
                    </div>
                    <CardTitle className="text-xl leading-relaxed">{q.question}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pl-16">
                  <div className="space-y-3">
                    {q.options.map((option) => (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all hover:bg-muted/50 ${
                          selectedAnswers[q.id] === option.value
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          selectedAnswers[q.id] === option.value
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/50"
                        }`}>
                          {selectedAnswers[q.id] === option.value && (
                            <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                          )}
                        </div>
                        <input
                          type="radio"
                          name={q.id}
                          value={option.value}
                          checked={selectedAnswers[q.id] === option.value}
                          onChange={(e) =>
                            setSelectedAnswers((prev) => ({
                              ...prev,
                              [q.id]: e.target.value,
                            }))
                          }
                          className="sr-only"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-base">{option.label}</p>
                          {option.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {option.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              onClick={handleSubmitAnswers}
              disabled={questions.some((q) => !selectedAnswers[q.id])}
              size="lg"
              className="w-full text-lg py-6"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Phase: Playbook Confirmation */}
        {phase === "playbook" && proposedPlaybook && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold mb-2">Recommended Approach</h2>
              <p className="text-muted-foreground">
                Based on your requirements, here&apos;s the best workflow
              </p>
            </div>

            <Card className="border-2 border-primary/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge className="bg-primary/20 text-primary text-sm px-3 py-1">
                    {proposedPlaybook.type.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>
                <CardTitle className="text-2xl mt-2">{proposedPlaybook.name}</CardTitle>
                <CardDescription className="text-base mt-2">
                  {proposedPlaybook.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Why this approach?</p>
                  <p className="text-sm text-muted-foreground">{proposedPlaybook.reasoning}</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button
                onClick={handleAcceptPlaybook}
                size="lg"
                className="flex-1 text-lg py-6"
                disabled={isLoading}
              >
                Accept & Generate Plan
              </Button>
            </div>

            <Card className="border-2 border-dashed">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-3">
                  Not quite right? Tell me what&apos;s different:
                </p>
                <div className="flex gap-3">
                  <Textarea
                    placeholder="e.g., This is more of a refactor than a new feature..."
                    value={playbookFeedback}
                    onChange={(e) => setPlaybookFeedback(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={handleRejectPlaybook}
                    disabled={!playbookFeedback.trim() || isLoading}
                  >
                    Reconsider
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Phase: Planning (generating plan) */}
        {phase === "planning" && (
          <Card className="border-2">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-xl font-medium mb-2">
                    {thinking || "Creating your plan..."}
                  </p>
                  <p className="text-muted-foreground">
                    Building a detailed task list based on your answers
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Phase: Plan */}
        {phase === "plan" && workflow?.plan && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Badge className="bg-primary/20 text-primary mb-3">
                {workflow.plan.playbook?.type?.replace("_", " ").toUpperCase() || "PLAN"}
              </Badge>
              <h2 className="text-2xl font-semibold mb-2">{workflow.plan.title}</h2>
              <p className="text-muted-foreground">
                {workflow.plan.tasks.length} tasks to complete your goal
              </p>
            </div>

            {/* Task Legend */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-center gap-6">
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500/20 text-orange-400">MUST DO</Badge>
                  <span className="text-muted-foreground">You perform</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/20 text-blue-400">MUST VERIFY</Badge>
                  <span className="text-muted-foreground">Review result</span>
                </div>
              </div>
              <div className="flex justify-center gap-6">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-red-500/50 text-red-400">High Risk</Badge>
                  <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">Med Risk</Badge>
                  <Badge variant="outline" className="border-green-500/50 text-green-400">Low Risk</Badge>
                </div>
              </div>
            </div>

            {/* Tasks */}
            <div className="space-y-4">
              {workflow.plan.tasks.map((task) => {
                const humanRole = task.humanRole || "must_verify";
                const risk = task.risk || "medium";
                const complexity = task.complexity || "medium";
                const dependsOn = task.dependsOn || [];

                const riskColors = {
                  high: "border-red-500/50 text-red-400",
                  medium: "border-yellow-500/50 text-yellow-400",
                  low: "border-green-500/50 text-green-400",
                };

                const complexityColors = {
                  high: "border-purple-500/50 text-purple-400",
                  medium: "border-blue-500/50 text-blue-400",
                  low: "border-cyan-500/50 text-cyan-400",
                };

                return (
                  <Card key={task.id} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-medium">
                          {task.id}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge
                              className={
                                humanRole === "must_do"
                                  ? "bg-orange-500/20 text-orange-400"
                                  : "bg-blue-500/20 text-blue-400"
                              }
                            >
                              {humanRole === "must_do" ? "MUST DO" : "MUST VERIFY"}
                            </Badge>
                            <Badge variant="outline" className={riskColors[risk]}>
                              {risk.charAt(0).toUpperCase() + risk.slice(1)} Risk
                            </Badge>
                            <Badge variant="outline" className={complexityColors[complexity]}>
                              {complexity.charAt(0).toUpperCase() + complexity.slice(1)} Complexity
                            </Badge>
                          </div>
                          <CardTitle className="text-lg">{task.title}</CardTitle>
                          {dependsOn.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Depends on: {dependsOn.map(id => `Task ${id}`).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pl-16">
                      <p className="text-muted-foreground mb-4">{task.description}</p>

                      {/* Human Action Info (for MUST DO tasks) */}
                      {humanRole === "must_do" && task.humanActionType && (
                        <div className="mb-4 bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="h-4 w-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-sm font-medium text-orange-400">
                              Human Action Required: {task.humanActionType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                          </div>
                          {task.humanActionDetail && (
                            <p className="text-sm text-orange-300/80 ml-6">
                              {task.humanActionDetail}
                            </p>
                          )}
                        </div>
                      )}

                      {task.requirements.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium mb-1">Requirements:</p>
                          <ul className="list-inside list-disc text-sm text-muted-foreground">
                            {task.requirements.map((req, i) => (
                              <li key={i}>{req}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {task.acceptanceCriteria.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-1">Acceptance Criteria:</p>
                          <ul className="list-inside list-disc text-sm text-muted-foreground">
                            {task.acceptanceCriteria.map((ac, i) => (
                              <li key={i}>{ac}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Refinement */}
            <Card className="border-2 border-dashed">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-3">
                  Want to change something?
                </p>
                <div className="flex gap-3">
                  <Textarea
                    placeholder="e.g., Add support for 2FA, remove the admin panel task..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={handleRefinePlan}
                    disabled={!feedback.trim() || isLoading}
                  >
                    Refine
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button
                onClick={handleApprovePlan}
                size="lg"
                className="flex-1 text-lg py-6"
                disabled={isLoading}
              >
                Approve Plan
              </Button>
            </div>
          </div>
        )}

        {/* Phase: Complete */}
        {phase === "complete" && (
          <Card className="border-2 border-green-500/50">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                  <svg
                    className="h-8 w-8 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold mb-2">Plan Approved</p>
                  <p className="text-muted-foreground">
                    Your plan is ready. Start working through the tasks.
                  </p>
                </div>
                <Button variant="outline" onClick={handleReset}>
                  Start New Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading (no workflow yet) */}
        {!workflow && !error && (
          <Card className="border-2">
            <CardContent className="pt-6 space-y-4">
              <Skeleton className="h-8 w-48 mx-auto" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
