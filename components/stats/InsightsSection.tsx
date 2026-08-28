import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Theme from "@/constants/theme";
import type { Insight, InsightsModel } from "@/lib/stats/types";
import EmptyState from "./EmptyState";
import PremiumPreview from "./PremiumPreview";
import StatsSection from "./StatsSection";

interface InsightsSectionProps {
  model: InsightsModel;
  /** Carries the screen's single premium CTA when the account is on free. */
  onUnlock: () => void;
}

/**
 * Premium's actual promise: interpretation, not more charts. Each card says
 * what happened and why it matters, in two lines.
 */
export default function InsightsSection({ model, onUnlock }: InsightsSectionProps) {
  if (model.unavailable) {
    return (
      <StatsSection title="Insights">
        <EmptyState
          icon="bulb-outline"
          title="We need a little more data"
          body="Insights get useful after several days of focus sessions and usage."
        />
      </StatsSection>
    );
  }

  if (model.locked) {
    return (
      <StatsSection title="Insights" subtitle="Understand why, not just what">
        <View style={styles.list}>
          {model.insights.map((insight, index) => (
            <PremiumPreview
              key={insight.id}
              title={insight.title}
              teaser={insight.teaser}
              testID={`stats-insight-preview-${insight.id}`}
              ctaLabel={index === 0 ? "Unlock Insights" : undefined}
              onPressCta={index === 0 ? onUnlock : undefined}
            />
          ))}
        </View>
      </StatsSection>
    );
  }

  return (
    <StatsSection title="Insights">
      <View style={styles.list}>
        {model.insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </View>
    </StatsSection>
  );
}

const InsightCard = React.memo(function InsightCard({ insight }: { insight: Insight }) {
  return (
    <View style={styles.card} testID={`stats-insight-${insight.id}`}>
      <Text style={styles.title}>{insight.title}</Text>
      <Text style={styles.headline}>{insight.headline}</Text>
      <Text style={styles.detail}>{insight.detail}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  list: {
    gap: Theme.spacing.md,
  },
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    padding: Theme.spacing.xl,
    gap: Theme.spacing.xxs,
  },
  title: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  headline: {
    fontSize: 22,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    letterSpacing: -0.5,
  },
  detail: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text,
    opacity: 0.75,
  },
});
