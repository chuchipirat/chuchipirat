/**
 * useDonationGoalData — Hook zum Laden der Spendenziel-Daten.
 *
 * Lädt Spendenziel-Abschnitte und aggregierte Statistiken für das aktuelle Jahr.
 * Wird sowohl vom DonationGoalWidget als auch vom EventCompletionDonation verwendet.
 *
 * @param year - Optionales Jahr (Standard: aktuelles Jahr).
 * @returns Abschnitte, Statistiken und Ladezustand.
 */
import {useEffect, useState} from "react";

import {useDatabase} from "../Database/DatabaseContext";
import {DonationGoalSection, DonationGoalStats} from "./donation.types";

type DonationGoalData = {
  sections: DonationGoalSection[];
  stats: DonationGoalStats | null;
  isLoading: boolean;
};

const useDonationGoalData = (year?: number): DonationGoalData => {
  const database = useDatabase();

  const [sections, setSections] = useState<DonationGoalSection[]>([]);
  const [stats, setStats] = useState<DonationGoalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentYear = year ?? new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const [goalSections, goalStats] = await Promise.all([
          database.donations.getGoalSections(currentYear),
          database.donations.getDonationGoalStats(),
        ]);

        if (!cancelled) {
          setSections(goalSections);
          setStats(goalStats);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [database, currentYear]);

  return {sections, stats, isLoading};
};

export {useDonationGoalData};
