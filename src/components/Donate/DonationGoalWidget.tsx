/**
 * DonationGoalWidget — Spendenziel-Fortschrittsanzeige.
 *
 * Zeigt den Spendenappell mit gestapeltem Fortschrittsbalken,
 * Kostenaufschlüsselung mit Info-Tooltips und Gesamtstatistik.
 * Verwendet dasselbe Layout wie im Event-Wizard.
 *
 * @example
 * <DonationGoalWidget />
 */
import {useState} from "react";

import {useDonationGoalData} from "./useDonationGoalData";
import {
  DonationAppealCard,
} from "./EventCompletionDonation";

/* ===================================================================
// Komponente
// =================================================================== */

/**
 * Zeigt die Spendenappell-Karte mit Fortschrittsbalken und Kostenaufschlüsselung.
 * Lädt Daten über den gemeinsamen useDonationGoalData-Hook.
 */
const DonationGoalWidget = () => {
  const {sections, stats, isLoading} = useDonationGoalData();
  const [expandedBreakdown, setExpandedBreakdown] = useState(-1);

  const currentYear = new Date().getFullYear();

  if (!isLoading && (sections.length === 0 || !stats)) return null;

  const totalTargetCents = sections.reduce(
    (sum, section) => sum + section.targetCents,
    0,
  );
  const totalCollected = stats?.totalCents ?? 0;
  const isGoalReached =
    totalTargetCents > 0 && totalCollected >= totalTargetCents;

  // Segmente für den gestapelten Balken
  const segmentWidths = sections.map((section) => {
    if (totalTargetCents === 0) return 0;
    const sectionShare = section.targetCents / totalTargetCents;
    const sectionFilled = Math.min(totalCollected / section.targetCents, 1);
    return sectionShare * sectionFilled * 100;
  });

  return (
    <DonationAppealCard
      sections={sections}
      segmentWidths={segmentWidths}
      totalCollected={totalCollected}
      totalTargetCents={totalTargetCents}
      isGoalReached={isGoalReached}
      isLoading={isLoading}
      currentYear={currentYear}
      expandedBreakdown={expandedBreakdown}
      onToggleBreakdown={(index) =>
        setExpandedBreakdown(expandedBreakdown === index ? -1 : index)
      }
    />
  );
};

export {DonationGoalWidget};
