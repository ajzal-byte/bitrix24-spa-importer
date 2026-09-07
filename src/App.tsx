import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import { TextShimmer } from "@/components/motion-primitives/text-shimmer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  BitrixApiError,
  fetchCustomFields,
  isValidWebhookUrl,
  listSpaTypes,
  type CrmType,
} from "./lib/bitrix";
import { migrateSpa, type MigrationResult } from "./lib/migrate";

type AppPhase =
  | "idle"
  | "loading-spas"
  | "ready"
  | "migrating"
  | "success"
  | "error";

function App() {
  const [sourceWebhook, setSourceWebhook] = useState("");
  const [targetWebhook, setTargetWebhook] = useState("");
  const [spaTypes, setSpaTypes] = useState<CrmType[]>([]);
  const [selectedSpaId, setSelectedSpaId] = useState<string>("");
  const [phase, setPhase] = useState<AppPhase>("idle");
  const [progressMessage, setProgressMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [migrationResult, setMigrationResult] =
    useState<MigrationResult | null>(null);
  const [fieldCount, setFieldCount] = useState<number | null>(null);
  const [fieldCountLoading, setFieldCountLoading] = useState(false);

  const webhooksValid = useMemo(
    () => isValidWebhookUrl(sourceWebhook) && isValidWebhookUrl(targetWebhook),
    [sourceWebhook, targetWebhook],
  );

  const selectedSpa = useMemo(
    () => spaTypes.find((spa) => String(spa.id) === selectedSpaId),
    [spaTypes, selectedSpaId],
  );

  const isBusy = phase === "loading-spas" || phase === "migrating";

  useEffect(() => {
    if (!selectedSpa || !sourceWebhook) {
      setFieldCount(null);
      setFieldCountLoading(false);
      return;
    }

    let cancelled = false;
    setFieldCount(null);
    setFieldCountLoading(true);

    fetchCustomFields(sourceWebhook, selectedSpa.entityTypeId)
      .then((fields) => {
        if (!cancelled) {
          setFieldCount(fields.length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFieldCount(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFieldCountLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSpa, sourceWebhook]);

  const resetMigration = () => {
    setPhase("ready");
    setProgressMessage("");
    setErrorMessage("");
    setMigrationResult(null);
  };

  const handleLoadSpas = async () => {
    if (!webhooksValid) return;

    setPhase("loading-spas");
    setProgressMessage("Loading SPAs..");
    setErrorMessage("");
    setMigrationResult(null);
    setSelectedSpaId("");
    setSpaTypes([]);
    setFieldCount(null);

    try {
      const types = await listSpaTypes(sourceWebhook);
      const sorted = [...types].sort((a, b) => a.title.localeCompare(b.title));
      setSpaTypes(sorted);
      setPhase("ready");
      setProgressMessage("");
    } catch (error) {
      setPhase("error");
      setErrorMessage(
        error instanceof BitrixApiError
          ? error.message
          : "Failed to load SPAs from the source CRM.",
      );
    }
  };

  const handleMigrate = async () => {
    if (!selectedSpa || !webhooksValid) return;

    setPhase("migrating");
    setProgressMessage("Starting migration..");
    setErrorMessage("");
    setMigrationResult(null);

    try {
      const result = await migrateSpa(
        sourceWebhook,
        targetWebhook,
        selectedSpa.id,
        setProgressMessage,
      );
      setMigrationResult(result);
      setPhase("success");
      setProgressMessage("");
    } catch (error) {
      setPhase("error");
      setErrorMessage(
        error instanceof BitrixApiError
          ? error.message
          : "Migration failed. Please verify both webhooks and try again.",
      );
    }
  };

  return (
    <div className="app-shell min-h-svh px-4 py-5 sm:px-8 sm:py-7">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="app-topbar">
          <div className="flex items-center gap-3">
            <div className="brand-mark" aria-hidden="true">
              <Waypoints className="size-5" />
            </div>
            <div>
              <p className="brand-name">Bitrix24</p>
              <p className="brand-context">Operations workspace</p>
            </div>
          </div>
          <div className="topbar-status">
            <span className="status-dot" />
            Local and secure
          </div>
        </header>

        <div className="workspace-heading">
          <div>
            <p className="eyebrow">Smart process utility / Import</p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Move a smart process
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Recreate a SPA and its custom fields in another Bitrix24 portal
              without leaving this workspace.
            </p>
          </div>
        </div>

        <div className="workspace-grid">
          <Card className="workspace-card shadow-sm">
            <CardHeader>
              <CardTitle>Connect both portals</CardTitle>
              <CardDescription>
                Add an incoming webhook from each portal. Credentials are not stored.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="source-webhook">Source CRM webhook</Label>
                <Input
                  id="source-webhook"
                  placeholder="http(s)://portal.example.com/rest/1/xxxxxxxx/"
                  value={sourceWebhook}
                  onChange={(event) => setSourceWebhook(event.target.value)}
                  disabled={isBusy}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-webhook">Target CRM webhook</Label>
                <Input
                  id="target-webhook"
                  placeholder="http(s)://portal.example.com/rest/1/xxxxxxxx/"
                  value={targetWebhook}
                  onChange={(event) => setTargetWebhook(event.target.value)}
                  disabled={isBusy}
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={handleLoadSpas}
                  disabled={!webhooksValid || isBusy}
                >
                  {phase === "loading-spas" ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Loading SPAs..
                    </>
                  ) : (
                    <>
                      <RefreshCw />
                      Load SPAs
                    </>
                  )}
                </Button>

                {spaTypes.length > 0 && (
                  <Badge variant="secondary">
                    {spaTypes.length} SPAs found
                  </Badge>
                )}
              </div>

              {spaTypes.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Source SPA</Label>
                      {selectedSpa &&
                        (fieldCountLoading ? (
                          <span className="text-xs text-muted-foreground">
                            Counting fields…
                          </span>
                        ) : fieldCount !== null ? (
                          <Badge variant="secondary">
                            {fieldCount} custom field
                            {fieldCount === 1 ? "" : "s"}
                          </Badge>
                        ) : null)}
                    </div>
                    <Select
                      value={selectedSpaId || null}
                      onValueChange={(value) => setSelectedSpaId(value ?? "")}
                      disabled={isBusy}
                      items={Object.fromEntries(
                        spaTypes.map((spa) => [String(spa.id), spa.title]),
                      )}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a smart process to import" />
                      </SelectTrigger>
                      <SelectContent>
                        {spaTypes.map((spa) => (
                          <SelectItem
                            key={spa.id}
                            value={String(spa.id)}
                            label={`${spa.title} (${spa.entityTypeId})`}
                          >
                            <span className="flex w-full min-w-0 items-center justify-between gap-3">
                              <span className="truncate">{spa.title}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                ID {spa.entityTypeId}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <Separator />

              <div className="rounded-xl border bg-muted/30 p-4">
                {phase === "migrating" && progressMessage ? (
                  <TextShimmer className="text-sm font-medium" duration={1.6}>
                    {progressMessage}
                  </TextShimmer>
                ) : phase === "success" && migrationResult ? (
                  <MigrationSuccess
                    result={migrationResult}
                    onReset={resetMigration}
                  />
                ) : phase === "error" ? (
                  <Alert variant="destructive">
                    <CircleAlert />
                    <AlertTitle>Migration failed</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {phase === "loading-spas"
                      ? "Fetching smart processes from the source CRM.."
                      : "Load SPAs, choose one, then confirm to create it on the target CRM with all custom fields."}
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter className="justify-between gap-3 border-t">
              <p className="text-xs text-muted-foreground">
                Fields are created sequentially with rate limiting to stay
                within API limits.
              </p>
              <Button
                type="button"
                size="lg"
                onClick={handleMigrate}
                disabled={!selectedSpa || isBusy || phase === "success"}
              >
                {phase === "migrating" ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Migrating..
                  </>
                ) : (
                  <>
                    Confirm migration
                    <ArrowRight />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <aside className="process-rail">
            <div className="rail-header">
              <div className="rail-icon">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <p className="section-kicker">Migration flow</p>
                <h2 className="font-heading text-base font-semibold">
                  Three easy steps
                </h2>
              </div>
            </div>
            <ol className="process-list">
              <li className="process-step">
                <span className="step-number">01</span>
                <span>
                  <strong>Connect</strong>
                  <small>Verify both portals</small>
                </span>
              </li>
              <li className="process-step">
                <span className="step-number">02</span>
                <span>
                  <strong>Choose</strong>
                  <small>Pick the source SPA</small>
                </span>
              </li>
              <li className="process-step">
                <span className="step-number">03</span>
                <span>
                  <strong>Recreate</strong>
                  <small>Copy settings and fields</small>
                </span>
              </li>
            </ol>
          </aside>
        </div>
      </div>
    </div>
  );
}

function MigrationSuccess({
  result,
  onReset,
}: {
  result: MigrationResult;
  onReset: () => void;
}) {
  const failedFields = result.fieldResults.filter((field) => !field.success);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600">
          <CheckCircle2 className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Migration completed</p>
          <p className="text-sm text-muted-foreground">
            Created{" "}
            <span className="font-medium text-foreground">
              {result.createdType.title}
            </span>{" "}
            on the target CRM.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="SPA ID" value={String(result.createdType.id)} />
        <Stat
          label="Entity type"
          value={String(result.createdType.entityTypeId)}
        />
        <Stat
          label="Workplace"
          value={
            result.workplaceId == null ? "None" : String(result.workplaceId)
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">
          {result.fieldsSucceeded} fields created
        </Badge>
        {result.fieldsFailed > 0 && (
          <Badge variant="destructive">
            {result.fieldsFailed} fields failed
          </Badge>
        )}
        {result.fieldsTotal === 0 && (
          <Badge variant="outline">No custom fields to migrate</Badge>
        )}
      </div>

      {failedFields.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Failed fields
          </p>
          <ul className="space-y-1 text-sm text-destructive">
            {failedFields.map((field) => (
              <li key={field.fieldName}>
                {field.title}: {field.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button type="button" variant="outline" onClick={onReset}>
        Import another SPA
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

export default App;
