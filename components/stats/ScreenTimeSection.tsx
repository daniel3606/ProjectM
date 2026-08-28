import React from "react";
import type { ScreenTimeModel, StatsPeriodId } from "@/lib/stats/types";
import EmptyState from "./EmptyState";
import StatsSection, { Interpretation } from "./StatsSection";
import LineChart from "./charts/LineChart";

interface ScreenTimeSectionProps {
  model: ScreenTimeModel;
  period: StatsPeriodId;
}

/** Answers one question: am I using my phone less? */
export default function ScreenTimeSection({ model, period }: ScreenTimeSectionProps) {
  if (model.unavailable) {
    return (
      <StatsSection title="Screen Time">
        {model.unavailable === "no-source" ? (
          <EmptyState
            icon="phone-portrait-outline"
            title="Screen time isn't connected yet"
            body="Once Marshmallow can read your daily usage, your trend will appear here."
          />
        ) : (
          <EmptyState
            icon="phone-portrait-outline"
            title="Your patterns are still forming"
            body="Keep using Focus Sessions and your weekly trend will appear here."
          />
        )}
      </StatsSection>
    );
  }

  return (
    <StatsSection title="Screen Time">
      <LineChart
        points={model.series}
        references={model.references}
        animationKey={period}
      />
      {model.interpretation ? (
        <Interpretation>{model.interpretation}</Interpretation>
      ) : null}
    </StatsSection>
  );
}
