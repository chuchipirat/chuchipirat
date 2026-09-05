/**
 * Zeigt den aggregierten Verbindungsstatus mehrerer Realtime-Subscriptions
 * an (siehe {@link useRealtimeConnectionStatus}). Rendert nichts, solange
 * alles verbunden ist — der Hinweis erscheint erst nach einem echten
 * Verbindungsproblem.
 */
import {Alert, Button, CircularProgress} from "@mui/material";
import {RealtimeConnectionStatus} from "../Database/Repository/realtimeSubscription";
import {
  REALTIME_RECONNECTING as TEXT_REALTIME_RECONNECTING,
  REALTIME_CONNECTION_FAILED as TEXT_REALTIME_CONNECTION_FAILED,
  REALTIME_RETRY as TEXT_REALTIME_RETRY,
} from "../../constants/text";

/**
 * Eigenschaften für {@link RealtimeStatusBanner}.
 *
 * @param status - Aggregierter Verbindungsstatus.
 * @param onRetry - Callback für den "Erneut versuchen"-Button (nur bei `failed` sichtbar).
 */
interface RealtimeStatusBannerProps {
  status: RealtimeConnectionStatus;
  onRetry: () => void;
}

/**
 * Banner für den Realtime-Verbindungsstatus einer Seite.
 *
 * @param status - Aggregierter Verbindungsstatus.
 * @param onRetry - Callback für den manuellen Wiederverbindungsversuch.
 * @returns `null` bei `connected`, sonst ein Hinweis-Banner.
 * @example
 * <RealtimeStatusBanner status={realtime.overallStatus} onRetry={realtime.retryAll} />
 */
export const RealtimeStatusBanner = ({
  status,
  onRetry,
}: RealtimeStatusBannerProps) => {
  if (status === "connected") return null;

  if (status === "reconnecting") {
    return (
      <Alert severity="info" icon={<CircularProgress size={20} />}>
        {TEXT_REALTIME_RECONNECTING}
      </Alert>
    );
  }

  return (
    <Alert
      severity="warning"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          {TEXT_REALTIME_RETRY}
        </Button>
      }
    >
      {TEXT_REALTIME_CONNECTION_FAILED}
    </Alert>
  );
};
