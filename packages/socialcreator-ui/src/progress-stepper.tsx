"use client";

import React from "react";

export interface Step {
  id: string;
  label: string;
  icon: string;
}

interface ProgressStepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

type StepStatus = "pending" | "active" | "completed" | "error";

function getStepStatus(stepIndex: number, currentStep: number): StepStatus {
  if (stepIndex < currentStep) return "completed";
  if (stepIndex === currentStep) return "active";
  return "pending";
}

export function ProgressStepper({ steps, currentStep, className = "" }: ProgressStepperProps) {
  const circleClasses = {
    pending: "bg-surface-strong text-muted",
    active: "bg-gradient-mint text-ink",
    completed: "bg-gradient-mint text-ink",
    error: "bg-semantic-error text-white",
  };
  const lineClasses = {
    pending: "bg-hairline",
    active: "bg-hairline",
    completed: "bg-gradient-mint",
    error: "bg-semantic-error",
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {steps.map((step, index) => {
        const status = getStepStatus(index, currentStep);
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-lg transition-all duration-300 ${circleClasses[status]}`}
              >
                {status === "completed" ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{step.icon}</span>
                )}
              </div>
              <span
                className={`mt-2 text-caption text-center max-w-[80px] ${status === "active" ? "text-body-strong font-medium" : "text-muted"}`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-6 transition-all duration-500 ${lineClasses[index < currentStep ? "completed" : "pending"]}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
