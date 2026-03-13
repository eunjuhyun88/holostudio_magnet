import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";

import {
  buildDecoratedNodeIdSet,
  buildJobNodeCountMap,
  buildJobOutcomeStateMap,
  buildJobStageMetrics,
  buildJobSwarmGroups,
  buildNodeIdsByJob,
  buildProtocolPhaseMetrics,
  buildScaledNodes,
  formatNodeLabel,
  getJobFlowCount,
  getJobAccent,
  getJobShardCount,
  isWorkerActiveState,
  latLngToVector3,
  latToPitch,
  lngToRotation,
  nodeTone,
  oscillate01,
  smoothPulse,
  tapeTone,
  type JobStageMetric,
  type JobSwarmGroup,
  type ProtocolPhaseMetric,
  workerTone,
} from "./core/meshSim.ts";
import {
  clearObjectGroup,
  createLabelSprite,
  createLine,
  createOrbitalParticleShell,
  createStarField,
} from "./core/globeScene.ts";
import {
  createFixturePlayback,
  demoFixtureText,
  parseNdjson,
} from "./fixed/fixturePlayer.ts";
import { connectTelemetryStream, resolveTelemetryUrl } from "./fixed/liveTelemetry.ts";
import type {
  Job,
  Node,
  TapeEntry,
  TelemetryEvent,
  VisualizerModel,
  Worker,
} from "./fixed/types.ts";

const globeRadius = 2.12;
const idleAutoSpinDelayMs = 1300;

type PacketRuntime = {
  curve: THREE.CubicBezierCurve3;
  mesh: THREE.Mesh;
  glow: THREE.Mesh;
  phase: number;
  speed: number;
  direction: 1 | -1;
};

type PulseRuntime = {
  baseOpacity: number;
  baseScale: number;
  material: THREE.MeshBasicMaterial;
  mesh: THREE.Mesh;
  phase: number;
  speed: number;
  amplitude: number;
};

type LineRuntime = {
  baseOpacity: number;
  material: THREE.LineBasicMaterial;
  phase: number;
  speed: number;
};

type GlobeInteractionState = {
  currentYaw: number;
  targetYaw: number;
  currentPitch: number;
  targetPitch: number;
  isDragging: boolean;
  pointerId: number | null;
  lastClientX: number;
  lastClientY: number;
  lastInteractionAt: number;
};

type GlobeDebugWindow = Window & {
  __meshGlobeDebug?: {
    pitch: number;
    targetPitch: number;
    targetYaw: number;
    yaw: number;
  };
};

export default function Visualizer() {
  const events = useMemo(() => parseNdjson(demoFixtureText), []);
  const playback = useMemo(() => createFixturePlayback(events), [events]);
  const telemetryUrl = useMemo(
    () => (typeof window === "undefined" ? null : resolveTelemetryUrl(window.location.search)),
    [],
  );

  const [frameIndex, setFrameIndex] = useState(playback.length > 0 ? 0 : -1);
  const [telemetryMode, setTelemetryMode] = useState<"fixture" | "live">(
    telemetryUrl ? "live" : "fixture",
  );
  const [liveModel, setLiveModel] = useState<VisualizerModel | null>(null);
  const [lastTelemetryEvent, setLastTelemetryEvent] = useState<TelemetryEvent | null>(null);
  const [telemetryStatus, setTelemetryStatus] = useState<"offline" | "connecting" | "streaming" | "error">(
    telemetryUrl ? "connecting" : "offline",
  );
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );

  const fixtureModel = playback[Math.max(frameIndex, 0)] ?? {
    workers: [],
    nodes: [],
    jobs: [],
    tape: [],
  };
  const model = telemetryMode === "live" ? liveModel ?? fixtureModel : fixtureModel;
  const [meshSimulationTime, setMeshSimulationTime] = useState(0);
  const meshPopulationCeiling = useMemo(() => {
    if (model.nodes.length === 0) {
      return 0;
    }

    return THREE.MathUtils.clamp(
      Math.max(3200, model.nodes.length * 660),
      2200,
      5600,
    );
  }, [model.nodes.length]);
  const meshPopulationTarget = useMemo(() => {
    if (model.nodes.length === 0) {
      return 0;
    }

    const longWave = smoothPulse(oscillate01(meshSimulationTime / 24 - Math.PI / 2));
    const surgeWave = smoothPulse(oscillate01(meshSimulationTime / 12.5 - 0.7));
    const envelope = THREE.MathUtils.clamp(0.07 + longWave * 0.72 + surgeWave * 0.12, 0.07, 0.97);

    return Math.round(model.nodes.length + meshPopulationCeiling * envelope);
  }, [meshPopulationCeiling, meshSimulationTime, model.nodes.length]);
  const [meshPopulationDisplayed, setMeshPopulationDisplayed] = useState(model.nodes.length);
  const renderNodes = useMemo(
    () =>
      buildScaledNodes(
        model.nodes,
        model.jobs,
        meshPopulationDisplayed,
        meshPopulationCeiling,
        meshSimulationTime,
      ),
    [meshPopulationCeiling, meshPopulationDisplayed, meshSimulationTime, model.jobs, model.nodes],
  );

  useEffect(() => {
    if (telemetryMode !== "fixture" || playback.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setFrameIndex((currentFrame) => {
        if (currentFrame < 0) {
          return 0;
        }

        return Math.min(currentFrame + 1, playback.length - 1);
      });
    }, 1450);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [playback, telemetryMode]);

  useEffect(() => {
    if (!telemetryUrl || telemetryMode !== "live") {
      return undefined;
    }

    setTelemetryStatus("connecting");

    const connection = connectTelemetryStream({
      url: telemetryUrl,
      onSnapshot(nextModel, event) {
        setLiveModel(nextModel);
        setLastTelemetryEvent(event);
        setTelemetryStatus("streaming");
      },
      onError() {
        setTelemetryStatus("error");
      },
    });

    return () => {
      connection.unsubscribe();
    };
  }, [telemetryMode, telemetryUrl]);

  useEffect(() => {
    if (telemetryMode === "fixture") {
      setTelemetryStatus("offline");
    } else if (telemetryMode === "live" && !telemetryUrl) {
      setTelemetryStatus("error");
    }
  }, [telemetryMode, telemetryUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMeshSimulationTime((current) => current + 0.25);
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    setMeshPopulationDisplayed((current) =>
      Math.max(model.nodes.length, Math.min(current, meshPopulationTarget)),
    );
  }, [meshPopulationTarget, model.nodes.length]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMeshPopulationDisplayed((current) => {
        const floor = model.nodes.length;
        const safeCurrent = Math.max(current, floor);

        if (safeCurrent === meshPopulationTarget) {
          return safeCurrent;
        }

        if (safeCurrent < meshPopulationTarget) {
          const step = Math.max(2, Math.ceil((meshPopulationTarget - safeCurrent) * 0.017));
          return Math.min(meshPopulationTarget, safeCurrent + step);
        }

        const step = Math.max(2, Math.ceil((safeCurrent - meshPopulationTarget) * 0.013));
        return Math.max(meshPopulationTarget, safeCurrent - step);
      });
    }, 140);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [meshPopulationTarget, model.nodes.length]);

  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [recentNodeJoinDelta, setRecentNodeJoinDelta] = useState<number>(0);
  const previousNodeCountRef = useRef<number>(0);

  const selectedWorker = useMemo(
    () => model.workers.find((worker) => worker.id === selectedWorkerId) ?? null,
    [model.workers, selectedWorkerId],
  );

  useEffect(() => {
    if (!selectedWorkerId) {
      return;
    }

    if (model.workers.some((worker) => worker.id === selectedWorkerId)) {
      return;
    }

    setSelectedWorkerId(model.workers[0]?.id ?? null);
  }, [model.workers, selectedWorkerId]);

  useEffect(() => {
    const nextCount = model.nodes.length;
    const previousCount = previousNodeCountRef.current;

    if (nextCount > previousCount) {
      setRecentNodeJoinDelta(nextCount - previousCount);
      const timeoutId = window.setTimeout(() => {
        setRecentNodeJoinDelta(0);
      }, 900);

      previousNodeCountRef.current = nextCount;
      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    previousNodeCountRef.current = nextCount;
    return undefined;
  }, [model.nodes.length]);

  const totalGpu = model.nodes.reduce((sum, node) => sum + node.gpu, 0);
  const activeWorkers = model.workers.filter((worker) => isWorkerActiveState(worker.state)).length;
  const claimedDonors = renderNodes.filter((node) => node.jobId).length;
  const evaluatingWorkers = model.workers.filter((worker) => worker.state === "evaluating").length;
  const activeJobs = model.jobs.filter((job) => job.state === "training" || job.state === "evaluating");
  const keepCount = model.tape.filter((entry) => entry.result === "keep").length;
  const discardCount = model.tape.filter((entry) => entry.result === "discard").length;
  const crashCount = model.tape.filter((entry) => entry.result === "crash").length;
  const isTablet = viewportWidth < 1280;
  const isMobile = viewportWidth < 820;

  return (
    <div
      style={{
        ...styles.shell,
        padding: isMobile ? "14px" : isTablet ? "18px" : "24px",
      }}
    >
      <header
        style={{
          ...styles.header,
          flexDirection: isTablet ? "column" : "row",
          gap: isMobile ? "16px" : "24px",
        }}
      >
        <div
          style={{
            ...styles.headerCopy,
            maxWidth: isTablet ? "100%" : styles.headerCopy.maxWidth,
          }}
        >
          <div style={styles.eyebrow}>AUTONOMOUS RESEARCH MESH</div>
          <h1 style={styles.title}>Browser Donors Become Live Training Capacity</h1>
          <div style={styles.headerLead}>
            People open the browser, donate idle compute, and the mesh routes that
            supply into training, verification, and payout lanes in real time.
          </div>
          <p style={styles.headerText}>
            This view is now tuned for first-time visitors. Quiet donors stay dim,
            claimed donors rise off the globe, and only shards that are actively
            training or verifying glow. The left side answers who owns the work,
            the globe answers where the work is flowing, and the ledger shows what
            outcomes actually landed.
          </p>

          <div style={styles.journeyStrip}>
            <div style={{ ...styles.flowPill, borderColor: "rgba(125,215,255,0.24)" }}>
              <span style={styles.flowPillIndex}>01</span>
              <span style={styles.flowPillLabel}>Contributors join</span>
            </div>
            <div style={{ ...styles.flowPill, borderColor: "rgba(88,200,255,0.24)" }}>
              <span style={styles.flowPillIndex}>02</span>
              <span style={styles.flowPillLabel}>Capacity is claimed</span>
            </div>
            <div style={{ ...styles.flowPill, borderColor: "rgba(255,188,103,0.24)" }}>
              <span style={styles.flowPillIndex}>03</span>
              <span style={styles.flowPillLabel}>Verification runs</span>
            </div>
            <div style={{ ...styles.flowPill, borderColor: "rgba(126,255,171,0.24)" }}>
              <span style={styles.flowPillIndex}>04</span>
              <span style={styles.flowPillLabel}>Outcomes settle</span>
            </div>
          </div>

          <div style={styles.controlRow}>
            <ModeButton
              label="Fixture"
              active={telemetryMode === "fixture"}
              onClick={() => setTelemetryMode("fixture")}
            />
            <ModeButton
              label="Live"
              active={telemetryMode === "live"}
              disabled={!telemetryUrl}
              onClick={() => setTelemetryMode("live")}
            />
            <span style={styles.telemetryHint}>
              {telemetryUrl
                ? `Telemetry URL: ${telemetryUrl}`
                : "Add ?telemetry=http://localhost:8787/events for live SSE"}
            </span>
          </div>
        </div>

        <div
          style={{
            ...styles.summaryRow,
            width: "100%",
            gridTemplateColumns: isMobile
              ? "1fr"
              : "repeat(3, minmax(0, 1fr))",
          }}
        >
          <SummaryStat
            label="Visible Contributors"
            value={renderNodes.length.toLocaleString()}
            detail="slow regional swell"
          />
          <SummaryStat
            label="Claimed Capacity"
            value={claimedDonors.toLocaleString()}
            detail={`${activeJobs.length} jobs fan out across the mesh`}
          />
          <SummaryStat
            label="Verification"
            value={String(evaluatingWorkers)}
            detail={`${keepCount} keep · ${discardCount} discard · ${crashCount} crash`}
          />
        </div>
        <div style={styles.summaryStatusBar}>
          <span style={styles.summaryStatusItem}>
            Real supply: {model.nodes.length}
            {recentNodeJoinDelta > 0 ? ` · +${recentNodeJoinDelta} joined` : ""}
          </span>
          <span style={styles.summaryStatusItem}>GPU pool: {totalGpu}x</span>
          <span style={styles.summaryStatusItem}>Workspaces: {model.workers.length}</span>
          <span style={styles.summaryStatusItem}>Hot workers: {activeWorkers}</span>
          <span style={styles.summaryStatusItem}>
            Runtime:{" "}
            {telemetryMode === "live"
              ? telemetryStatus
              : playback.length > 0
                ? `${frameIndex + 1}/${playback.length}`
                : "0/0"}
          </span>
        </div>
      </header>

      <main
        style={{
          ...styles.mainGrid,
          gridTemplateColumns: isTablet
            ? "1fr"
            : "minmax(320px, 0.76fr) minmax(620px, 1.44fr)",
          gap: isMobile ? "14px" : "18px",
        }}
      >
        <section
          style={{
            ...styles.panel,
            padding: isMobile ? "14px" : isTablet ? "16px" : "18px",
            order: isTablet ? 2 : 1,
          }}
        >
          <PanelTitle
            title="Research Swarm"
            subtitle="Featured GPU workspaces plus the donor swarms and shard groups they currently own."
          />
          <WorkerBoard
            workers={model.workers}
            jobs={model.jobs}
            renderNodes={renderNodes}
            tape={model.tape}
            selectedWorkerId={selectedWorkerId}
            onSelectWorker={setSelectedWorkerId}
            compact={isMobile}
            tablet={isTablet}
          />
        </section>

        <section
          style={{
            ...styles.panel,
            padding: isMobile ? "14px" : isTablet ? "16px" : "18px",
            order: 1,
          }}
        >
          <PanelTitle
            title="Global Compute Mesh"
            subtitle="Idle donors stay quiet. Claimed donors rise off the surface. Only training and verify traffic should glow."
          />
          <GlobeMeshPanel
            nodes={model.nodes}
            renderNodes={renderNodes}
            jobs={model.jobs}
            workers={model.workers}
            tape={model.tape}
            selectedWorker={selectedWorker}
            frameIndex={frameIndex}
            totalFrames={playback.length}
            recentNodeJoinDelta={recentNodeJoinDelta}
            telemetryMode={telemetryMode}
            telemetryStatus={telemetryStatus}
            lastTelemetryEvent={lastTelemetryEvent}
            compact={isMobile}
            tablet={isTablet}
          />
        </section>
      </main>

      <section
        style={{
          ...styles.bottomPanel,
          padding: isMobile ? "14px" : isTablet ? "16px" : "18px",
        }}
      >
        <PanelTitle
          title="Experiment Tape"
          subtitle="Newest keep, discard, and crash decisions from the swarm."
        />
        <ExperimentTape tape={model.tape} compact={isMobile} />
      </section>
    </div>
  );
}

function WorkerBoard({
  workers,
  jobs,
  renderNodes,
  tape,
  selectedWorkerId,
  onSelectWorker,
  compact,
  tablet,
}: {
  workers: Worker[];
  jobs: Job[];
  renderNodes: Node[];
  tape: TapeEntry[];
  selectedWorkerId: string | null;
  onSelectWorker: (workerId: string) => void;
  compact: boolean;
  tablet: boolean;
}) {
  const jobNodeCountMap = useMemo(() => buildJobNodeCountMap(renderNodes), [renderNodes]);
  const swarmGroups = useMemo(
    () => buildJobSwarmGroups(jobs, jobNodeCountMap).slice(0, 4),
    [jobNodeCountMap, jobs],
  );
  const availableDonors = renderNodes.filter((node) => !node.jobId).length;
  const jobOutcomeById = buildJobOutcomeStateMap(jobs, workers, tape);

  return (
    <div style={styles.workerBoardStack}>
      <div
        style={{
          ...styles.workerGrid,
          gridTemplateColumns: compact
            ? "1fr"
            : tablet
              ? "repeat(2, minmax(0, 1fr))"
              : styles.workerGrid.gridTemplateColumns,
        }}
      >
        {workers.map((worker) => {
          const isSelected = worker.id === selectedWorkerId;
          const accent = workerTone[worker.state];

          return (
            <button
              key={worker.id}
              onClick={() => onSelectWorker(worker.id)}
              style={{
                ...styles.workerCard,
                borderColor: isSelected ? accent : "rgba(255,255,255,0.08)",
                boxShadow: isSelected
                  ? `0 0 0 1px ${accent} inset, 0 24px 40px rgba(0,0,0,0.32)`
                  : "0 20px 34px rgba(0,0,0,0.24)",
              }}
              type="button"
            >
              <div style={styles.workerCardTop}>
                <div>
                  <strong>{worker.id}</strong>
                  <div style={styles.workerCardRegion}>{worker.region}</div>
                </div>
                <StatePill label={worker.state} color={accent} />
              </div>

              <div style={styles.metaLine}>{worker.gpuLabel}</div>
              <div style={styles.metaLine}>
                Workspace: {worker.experimentId} · Node: {worker.nodeId}
              </div>

              <ProgressBar progress={worker.progress ?? 0} color={accent} />

              <div style={styles.workerMetricsRow}>
                <div style={styles.workerMetricBox}>
                  <div style={styles.workerMetricLabel}>Progress</div>
                  <div style={styles.workerMetricValue}>
                    {Math.round((worker.progress ?? 0) * 100)}%
                  </div>
                </div>
                <div style={styles.workerMetricBox}>
                  <div style={styles.workerMetricLabel}>Delta</div>
                  <div style={styles.workerMetricValue}>
                    {typeof worker.metricDelta === "number"
                      ? `${worker.metricDelta > 0 ? "+" : ""}${worker.metricDelta.toFixed(4)}`
                      : "n/a"}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={styles.swarmBoardMeta}>
        <div style={styles.blockTitle}>Swarm Partitions</div>
        <div style={styles.swarmBoardMetaLine}>
          {availableDonors.toLocaleString()} donors currently free to receive new shards.
        </div>
        <div style={styles.swarmPartitionList}>
          {swarmGroups.map((group) => (
            <div key={group.id} style={styles.swarmPartitionCard}>
              <div style={styles.swarmPartitionTop}>
                <strong>{group.id}</strong>
                <StatePill label={group.state} color={group.tone} />
              </div>
              <div style={styles.swarmBoardMetaLine}>
                {group.donors.toLocaleString()} donors · {group.workers} GPU workspaces
              </div>
              <div style={styles.swarmBoardMetaLine}>
                {group.shards} shards · {group.flows} reduce / coordination lanes
              </div>
              <div style={styles.stageMeter}>
                {buildJobStageMetrics(group.state, jobOutcomeById.get(group.id) ?? null).map(
                  (step) => (
                    <div
                      key={`${group.id}-${step.label}`}
                      style={{
                        ...styles.stageMeterSegment,
                        background: step.done
                          ? step.tone
                          : step.active
                            ? `${step.tone}88`
                            : "rgba(255,255,255,0.08)",
                        boxShadow: step.active ? `0 0 16px ${step.tone}44` : "none",
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GlobeMeshPanel({
  nodes,
  renderNodes,
  jobs,
  workers,
  tape,
  selectedWorker,
  frameIndex,
  totalFrames,
  recentNodeJoinDelta,
  telemetryMode,
  telemetryStatus,
  lastTelemetryEvent,
  compact,
  tablet,
}: {
  nodes: Node[];
  renderNodes: Node[];
  jobs: Job[];
  workers: Worker[];
  tape: TapeEntry[];
  selectedWorker: Worker | null;
  frameIndex: number;
  totalFrames: number;
  recentNodeJoinDelta: number;
  telemetryMode: "fixture" | "live";
  telemetryStatus: "offline" | "connecting" | "streaming" | "error";
  lastTelemetryEvent: TelemetryEvent | null;
  compact: boolean;
  tablet: boolean;
}) {
  const selectedNode = selectedWorker
    ? nodes.find((node) => node.id === selectedWorker.nodeId) ?? null
    : null;
  const activeLinks = jobs.reduce((sum, job) => sum + getJobFlowCount(job), 0);
  const assignedDonors = renderNodes.filter((node) => node.jobId).length;
  const activeJobs = jobs.filter((job) => job.state === "training" || job.state === "evaluating");
  const jobNodeCountMap = useMemo(() => buildJobNodeCountMap(renderNodes), [renderNodes]);
  const jobSwarmGroups = useMemo(
    () => buildJobSwarmGroups(jobs, jobNodeCountMap).slice(0, 6),
    [jobNodeCountMap, jobs],
  );
  const protocolPhases = buildProtocolPhaseMetrics(workers, jobs, renderNodes, tape);
  const jobOutcomeById = buildJobOutcomeStateMap(jobs, workers, tape);

  return (
    <div style={styles.globePanel}>
      <div
        style={{
          ...styles.globeStageFrame,
          minHeight: compact ? "360px" : tablet ? "460px" : "540px",
        }}
      >
        <div style={styles.stageNebula} />
        <div style={styles.stageVignette} />

        <div style={styles.globeStage}>
          <GlobeCanvas
            nodes={renderNodes}
            jobs={jobs}
            workers={workers}
            selectedWorker={selectedWorker}
          />
        </div>
      </div>

      <div
        style={{
          ...styles.globeLegendRow,
          alignItems: compact ? "stretch" : "center",
        }}
      >
        <div style={styles.stageLegendPill}>
          Glow = claimed donor · Amber = verify · Quiet dots = idle supply
        </div>
        <div style={styles.stageInstruction}>
          Drag to orbit. Scroll to keep the globe moving. The globe should read as
          routing, not as a dashboard.
        </div>
        <div style={styles.stageFocusPill}>
          {selectedWorker
            ? `${selectedWorker.id} · ${selectedWorker.gpuLabel}`
            : "No worker selected"}
        </div>
      </div>

      <div
        style={{
          ...styles.globeSummaryRow,
          gridTemplateColumns: compact
            ? "1fr"
            : tablet
              ? "repeat(2, minmax(0, 1fr))"
              : styles.globeSummaryRow.gridTemplateColumns,
        }}
      >
        <StageChip
          label="Visible Contributors"
          value={String(renderNodes.length)}
          tone="#8deaff"
          detail={
            recentNodeJoinDelta > 0
              ? `${nodes.length} real · slow regional swell`
              : `${nodes.length} telemetry · slow regional swell`
          }
          emphasized={recentNodeJoinDelta > 0}
        />
        <StageChip
          label="Claimed Swarm"
          value={String(assignedDonors)}
          tone="#56d5ff"
          detail={`${Math.max(renderNodes.length - assignedDonors, 0)} currently available`}
        />
        <StageChip
          label="In-flight Jobs"
          value={String(activeJobs.length)}
          tone="#ffb44d"
          detail={`${activeLinks} active flows`}
        />
        <StageChip
          label="Focus"
          value={selectedWorker ? selectedWorker.region : "mesh overview"}
          tone={selectedWorker ? workerTone[selectedWorker.state] : "#cfe6ff"}
        />
      </div>

      <div
        style={{
          ...styles.globeMetaGrid,
          gridTemplateColumns: compact
            ? "1fr"
            : tablet
              ? "repeat(2, minmax(0, 1fr))"
              : styles.globeMetaGrid.gridTemplateColumns,
        }}
      >
        <div style={styles.globeMetaBlock}>
          <div style={styles.blockTitle}>Featured Nodes</div>
          {nodes.map((node) => {
            const worker = workers.find((candidate) => candidate.nodeId === node.id);
            const accent = worker ? workerTone[worker.state] : nodeTone[node.state];

            return (
              <div key={node.id} style={styles.listRow}>
                <span>
                  {node.id} · {node.gpu} GPU
                </span>
                <StatePill label={worker?.state ?? node.state} color={accent} />
              </div>
            );
          })}
        </div>

        <div style={styles.globeMetaBlock}>
          <div style={styles.blockTitle}>In-flight Job Swarms</div>
          {jobSwarmGroups.map((group) => (
            <div key={group.id} style={styles.swarmGroupCard}>
              <div style={styles.swarmGroupTop}>
                <strong>{group.id}</strong>
                <StatePill label={group.state} color={group.tone} />
              </div>
              <div style={styles.swarmGroupMeta}>
                {group.donors.toLocaleString()} donors · {group.workers} workers
              </div>
              <div style={styles.swarmGroupMeta}>
                {group.shards} shards · {group.flows} coordination flows
              </div>
              <div style={styles.stageMeter}>
                {buildJobStageMetrics(group.state, jobOutcomeById.get(group.id) ?? null).map(
                  (step) => (
                    <div
                      key={`${group.id}-${step.label}`}
                      style={{
                        ...styles.stageMeterSegment,
                        background: step.done
                          ? step.tone
                          : step.active
                            ? `${step.tone}88`
                            : "rgba(255,255,255,0.08)",
                        boxShadow: step.active ? `0 0 16px ${step.tone}44` : "none",
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={styles.globeMetaBlock}>
          <div style={styles.blockTitle}>Focus Context</div>
          {selectedWorker ? (
            <div style={styles.selectionBox}>
              <div>{selectedWorker.id}</div>
              <div>{selectedWorker.experimentId}</div>
              <div>{selectedWorker.region}</div>
              <div>{selectedWorker.gpuLabel}</div>
              <div>Node: {selectedWorker.nodeId}</div>
              {selectedNode ? (
                <div>
                  Coordinates: {selectedNode.lat.toFixed(2)}, {selectedNode.lng.toFixed(2)}
                </div>
              ) : null}
            </div>
          ) : (
            <div style={styles.selectionBox}>No worker selected</div>
          )}
        </div>

        <div style={styles.globeMetaBlock}>
          <div style={styles.blockTitle}>Why The Mesh Lights Up</div>
          {protocolPhases.map((phase) => (
            <div key={phase.label} style={styles.protocolFlowRow}>
              <span style={styles.protocolFlowLabel}>{phase.label}</span>
              <span style={{ ...styles.protocolFlowValue, color: phase.tone }}>{phase.value}</span>
              <span style={styles.protocolFlowDetail}>{phase.detail}</span>
            </div>
          ))}
        </div>

        <div style={styles.globeMetaBlock}>
          <div style={styles.blockTitle}>Runtime Source</div>
          <div style={styles.selectionBox}>
            <div>Mode: {telemetryMode}</div>
            <div>Status: {telemetryStatus}</div>
            <div>
              Frame: {telemetryMode === "fixture" && totalFrames > 0 ? frameIndex + 1 : 0}
            </div>
            <div>Total: {telemetryMode === "fixture" ? totalFrames : "live"}</div>
            <div>
              Event:{" "}
              {lastTelemetryEvent
                ? lastTelemetryEvent.type
                : telemetryMode === "fixture"
                  ? "fixture replay"
                  : "waiting"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlobeCanvas({
  nodes,
  jobs,
  workers,
  selectedWorker,
}: {
  nodes: Node[];
  jobs: Job[];
  workers: Worker[];
  selectedWorker: Worker | null;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const dataGroupRef = useRef<THREE.Group | null>(null);
  const cloudMeshRef = useRef<THREE.Mesh | null>(null);
  const particleShellRefs = useRef<THREE.Points[]>([]);
  const animationRef = useRef<number | null>(null);
  const packetRefs = useRef<PacketRuntime[]>([]);
  const pulseRefs = useRef<PulseRuntime[]>([]);
  const lineRefs = useRef<LineRuntime[]>([]);
  const textureRefs = useRef<THREE.Texture[]>([]);
  const focusedNodeIdRef = useRef<string | null>(null);
  const interactionRef = useRef<GlobeInteractionState>({
    currentYaw: lngToRotation(72),
    targetYaw: lngToRotation(72),
    currentPitch: latToPitch(24),
    targetPitch: latToPitch(24),
    isDragging: false,
    pointerId: null,
    lastClientX: 0,
    lastClientY: 0,
    lastInteractionAt: performance.now(),
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    mount.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030711, 0.018);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(0, 0.14, 7.7);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x78a7ff, 0.78);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x6ea7ff, 0x050913, 0.82);
    hemiLight.position.set(0, 4, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
    keyLight.position.set(5.5, 2.8, 5.8);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x2de3ff, 1.05);
    rimLight.position.set(-7.5, 0.4, -5.5);
    scene.add(rimLight);

    const underLight = new THREE.PointLight(0x0f63ff, 3.2, 16, 2.2);
    underLight.position.set(0, -4.4, 3.8);
    scene.add(underLight);

    scene.add(createStarField(1900, 16, 16, 0.038, 0x7baeff, 0.76));
    scene.add(createStarField(1100, 20, 22, 0.062, 0xd6eeff, 0.44));
    scene.add(createStarField(520, 24, 26, 0.095, 0xffffff, 0.2));

    const globeGroup = new THREE.Group();
    globeGroupRef.current = globeGroup;
    scene.add(globeGroup);

    const textureLoader = new THREE.TextureLoader();
    const surfaceMap = textureLoader.load("/textures/earth_atmos_2048.jpg");
    surfaceMap.colorSpace = THREE.SRGBColorSpace;
    const normalMap = textureLoader.load("/textures/earth_normal_2048.jpg");
    const specularMap = textureLoader.load("/textures/earth_specular_2048.jpg");
    const cloudMap = textureLoader.load("/textures/earth_clouds_1024.png");
    cloudMap.colorSpace = THREE.SRGBColorSpace;

    textureRefs.current = [surfaceMap, normalMap, specularMap, cloudMap];

    const surfaceMesh = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius, 112, 112),
      new THREE.MeshPhongMaterial({
        map: surfaceMap,
        normalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        specularMap,
        specular: new THREE.Color("#8fd6ff"),
        shininess: 22,
        emissive: new THREE.Color("#02111e"),
        emissiveIntensity: 0.55,
      }),
    );
    globeGroup.add(surfaceMesh);

    const cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius * 1.015, 96, 96),
      new THREE.MeshLambertMaterial({
        map: cloudMap,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    cloudMeshRef.current = cloudMesh;
    globeGroup.add(cloudMesh);

    const wireShell = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius * 1.004, 48, 48),
      new THREE.MeshBasicMaterial({
        color: 0x47dbff,
        wireframe: true,
        transparent: true,
        opacity: 0.018,
        blending: THREE.AdditiveBlending,
      }),
    );
    globeGroup.add(wireShell);

    const innerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius * 1.03, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x1744c9,
        transparent: true,
        opacity: 0.046,
        blending: THREE.AdditiveBlending,
      }),
    );
    globeGroup.add(innerGlow);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius * 1.12, 96, 96),
      new THREE.MeshBasicMaterial({
        color: 0x48c8ff,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    globeGroup.add(atmosphere);

    const atmosphereHalo = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius * 1.165, 96, 96),
      new THREE.MeshBasicMaterial({
        color: 0x4b6cff,
        transparent: true,
        opacity: 0.028,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    globeGroup.add(atmosphereHalo);

    const particleShell = createOrbitalParticleShell(
      1600,
      globeRadius * 1.075,
      0.07,
      0.02,
      0x59d6ff,
      0.08,
    );
    const outerParticleShell = createOrbitalParticleShell(
      760,
      globeRadius * 1.17,
      0.11,
      0.016,
      0x91ecff,
      0.045,
    );
    particleShellRefs.current = [particleShell, outerParticleShell];
    globeGroup.add(particleShell);
    globeGroup.add(outerParticleShell);

    const dataGroup = new THREE.Group();
    dataGroupRef.current = dataGroup;
    globeGroup.add(dataGroup);

    function resize() {
      if (!mount || !rendererRef.current || !cameraRef.current) {
        return;
      }

      const width = mount.clientWidth;
      const height = mount.clientHeight;
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / Math.max(height, 1);
      cameraRef.current.updateProjectionMatrix();
    }

    function handlePointerDown(event: PointerEvent) {
      const interaction = interactionRef.current;
      interaction.isDragging = true;
      interaction.pointerId = event.pointerId;
      interaction.lastClientX = event.clientX;
      interaction.lastClientY = event.clientY;
      interaction.lastInteractionAt = performance.now();
      mount.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent) {
      const interaction = interactionRef.current;
      if (!interaction.isDragging || interaction.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - interaction.lastClientX;
      const deltaY = event.clientY - interaction.lastClientY;

      interaction.targetYaw += deltaX * 0.0085;
      interaction.targetPitch = THREE.MathUtils.clamp(
        interaction.targetPitch + deltaY * 0.0068,
        -0.7,
        0.42,
      );

      interaction.lastClientX = event.clientX;
      interaction.lastClientY = event.clientY;
      interaction.lastInteractionAt = performance.now();
    }

    function handlePointerUp(event: PointerEvent) {
      const interaction = interactionRef.current;
      if (interaction.pointerId !== event.pointerId) {
        return;
      }

      interaction.isDragging = false;
      interaction.pointerId = null;
      interaction.lastInteractionAt = performance.now();

      if (mount.hasPointerCapture(event.pointerId)) {
        mount.releasePointerCapture(event.pointerId);
      }
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault();

      const interaction = interactionRef.current;
      const dominantDelta =
        Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;

      interaction.targetYaw += dominantDelta * 0.0026;
      interaction.lastInteractionAt = performance.now();
    }

    function animate() {
      const rendererInstance = rendererRef.current;
      const sceneInstance = sceneRef.current;
      const cameraInstance = cameraRef.current;
      const globeGroupInstance = globeGroupRef.current;
      if (!rendererInstance || !sceneInstance || !cameraInstance || !globeGroupInstance) {
        return;
      }

      const now = performance.now();
      const interaction = interactionRef.current;

      if (!interaction.isDragging && now - interaction.lastInteractionAt > idleAutoSpinDelayMs) {
        interaction.targetYaw += 0.00125;
      }

      interaction.currentYaw += (interaction.targetYaw - interaction.currentYaw) * 0.07;
      interaction.currentPitch += (interaction.targetPitch - interaction.currentPitch) * 0.08;

      globeGroupInstance.rotation.y = interaction.currentYaw;
      globeGroupInstance.rotation.x = interaction.currentPitch;

      const time = now * 0.001;
      const breathingScale = 1 + Math.sin(time * 0.52) * 0.012;
      const trafficBoost =
        packetRefs.current.length > 0
          ? 1 + Math.sin(time * 1.4) * Math.min(packetRefs.current.length * 0.0016, 0.022)
          : 1;
      globeGroupInstance.scale.setScalar(breathingScale * trafficBoost);

      if (typeof window !== "undefined") {
        (window as GlobeDebugWindow).__meshGlobeDebug = {
          yaw: interaction.currentYaw,
          targetYaw: interaction.targetYaw,
          pitch: interaction.currentPitch,
          targetPitch: interaction.targetPitch,
        };
      }

      if (cloudMeshRef.current) {
        cloudMeshRef.current.rotation.y += 0.00045;
      }

      for (const [shellIndex, shell] of particleShellRefs.current.entries()) {
        shell.rotation.y += shellIndex === 0 ? 0.00032 : -0.00018;
        shell.rotation.x += shellIndex === 0 ? 0.00004 : 0.00002;
      }

      for (const packet of packetRefs.current) {
        packet.phase = THREE.MathUtils.euclideanModulo(
          packet.phase + packet.speed * packet.direction,
          1,
        );

        const point = packet.curve.getPoint(packet.phase);
        packet.mesh.position.copy(point);
        packet.glow.position.copy(point);

        const pulse = 0.82 + Math.sin(time * 7 + packet.phase * Math.PI * 2) * 0.18;
        packet.glow.scale.setScalar(pulse);
      }

      for (const pulse of pulseRefs.current) {
        const scale =
          pulse.baseScale + Math.sin(time * pulse.speed + pulse.phase) * pulse.amplitude;
        pulse.mesh.scale.setScalar(scale);
        pulse.material.opacity =
          pulse.baseOpacity * (0.7 + 0.3 * Math.sin(time * pulse.speed + pulse.phase));
      }

      for (const line of lineRefs.current) {
        line.material.opacity =
          line.baseOpacity * (0.78 + 0.22 * Math.sin(time * line.speed + line.phase));
      }

      rendererInstance.render(sceneInstance, cameraInstance);
      animationRef.current = window.requestAnimationFrame(animate);
    }

    resize();
    animate();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    mount.addEventListener("pointerdown", handlePointerDown);
    mount.addEventListener("pointermove", handlePointerMove);
    mount.addEventListener("pointerup", handlePointerUp);
    mount.addEventListener("pointerleave", handlePointerUp);
    mount.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      resizeObserver.disconnect();

      mount.removeEventListener("pointerdown", handlePointerDown);
      mount.removeEventListener("pointermove", handlePointerMove);
      mount.removeEventListener("pointerup", handlePointerUp);
      mount.removeEventListener("pointerleave", handlePointerUp);
      mount.removeEventListener("wheel", handleWheel);

      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
      }

      packetRefs.current = [];
      pulseRefs.current = [];
      lineRefs.current = [];
      particleShellRefs.current = [];

      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        const material = mesh.material;
        if (Array.isArray(material)) {
          for (const item of material) {
            item.dispose();
          }
        } else if (material) {
          material.dispose();
        }
      });

      for (const texture of textureRefs.current) {
        texture.dispose();
      }
      textureRefs.current = [];

      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }

      if (typeof window !== "undefined") {
        delete (window as GlobeDebugWindow).__meshGlobeDebug;
      }
    };
  }, []);

  useEffect(() => {
    const dataGroup = dataGroupRef.current;
    if (!dataGroup) {
      return;
    }

    clearObjectGroup(dataGroup);
    packetRefs.current = [];
    pulseRefs.current = [];
    lineRefs.current = [];

    const workerByNodeId = new Map(workers.map((worker) => [worker.nodeId, worker]));
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const nodeIdsByJob = buildNodeIdsByJob(nodes);
    const selectedNodeId = selectedWorker?.nodeId ?? null;
    const decoratedNodeIds = buildDecoratedNodeIdSet(nodes, workers, selectedNodeId);
    const selectedJobIds = new Set(
      selectedNodeId
        ? jobs.filter((job) => job.nodeIds.includes(selectedNodeId)).map((job) => job.id)
        : [],
    );
    const jobOutcomeById = buildJobOutcomeStateMap(jobs, workers);
    const surfaceNodePositions: number[] = [];
    const surfaceNodeColors: number[] = [];
    const claimedNodePositions: number[] = [];
    const claimedNodeColors: number[] = [];
    const activeNodePositions: number[] = [];
    const activeNodeColors: number[] = [];
    let visibleNodeLabels = 0;
    const ambientPointScale = THREE.MathUtils.clamp(1.08 - nodes.length / 7200, 0.72, 1.08);

    for (const node of nodes) {
      const worker = workerByNodeId.get(node.id) ?? null;
      const accent = worker ? workerTone[worker.state] : nodeTone[node.state];
      const isSelected = node.id === selectedNodeId;
      const resultState =
        worker?.state === "keep" || worker?.state === "discard" || worker?.state === "crash"
          ? worker.state
          : null;
      const resultTone = resultState ? tapeTone[resultState] : accent;
      const isAssigned = worker
        ? worker.state === "patching" || isWorkerActiveState(worker.state)
        : node.state === "assigned" || node.state === "training";
      const isHot =
        (worker
          ? worker.state === "training" ||
            worker.state === "evaluating" ||
            worker.state === "keep" ||
            worker.state === "discard" ||
            worker.state === "crash"
          : node.state === "training") || isSelected;
      const shouldDecorate =
        isSelected || isHot || resultState !== null || decoratedNodeIds.has(node.id);

      const surfacePosition = latLngToVector3(node.lat, node.lng, globeRadius + 0.015);
      const tipHeight = globeRadius + (isSelected ? 0.24 : isHot ? 0.19 : isAssigned ? 0.145 : 0.11);
      const tipPosition = latLngToVector3(node.lat, node.lng, tipHeight);
      const tipNormal = tipPosition.clone().normalize();
      const accentColor = new THREE.Color(resultTone);
      const surfaceAccent = isSelected
        ? accentColor.clone()
        : isHot
          ? accentColor.clone().lerp(new THREE.Color("#dbfcff"), 0.12)
          : isAssigned
            ? accentColor.clone().multiplyScalar(0.5)
            : new THREE.Color("#27364c");

      surfaceNodePositions.push(surfacePosition.x, surfacePosition.y, surfacePosition.z);
      surfaceNodeColors.push(surfaceAccent.r, surfaceAccent.g, surfaceAccent.b);

      if (isSelected || isHot) {
        activeNodePositions.push(tipPosition.x, tipPosition.y, tipPosition.z);
        activeNodeColors.push(accentColor.r, accentColor.g, accentColor.b);
      } else if (isAssigned) {
        claimedNodePositions.push(tipPosition.x, tipPosition.y, tipPosition.z);
        claimedNodeColors.push(surfaceAccent.r, surfaceAccent.g, surfaceAccent.b);
      }

      if (!shouldDecorate) {
        continue;
      }

      const stem = createLine(
        surfacePosition,
        tipPosition,
        resultTone,
        isSelected ? 0.92 : isHot ? 0.58 : 0.24,
      );
      dataGroup.add(stem);

      const tipGlow = new THREE.Mesh(
        new THREE.SphereGeometry(isSelected ? 0.14 : isHot ? 0.11 : 0.08, 18, 18),
        new THREE.MeshBasicMaterial({
          color: resultTone,
          transparent: true,
          opacity: isSelected ? 0.22 : isHot ? 0.16 : 0.08,
          blending: THREE.AdditiveBlending,
        }),
      );
      tipGlow.position.copy(tipPosition);
      dataGroup.add(tipGlow);

      const tipCore = new THREE.Mesh(
        new THREE.SphereGeometry(isSelected ? 0.058 : isHot ? 0.045 : 0.032, 18, 18),
        new THREE.MeshBasicMaterial({
          color: resultTone,
          transparent: true,
          opacity: 0.98,
        }),
      );
      tipCore.position.copy(tipPosition);
      dataGroup.add(tipCore);

      if (isSelected || isHot || resultState) {
        const ringPosition = surfacePosition
          .clone()
          .normalize()
          .multiplyScalar(globeRadius + 0.03);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(isSelected ? 0.082 : 0.064, isSelected ? 0.14 : 0.108, 36),
          new THREE.MeshBasicMaterial({
            color: resultTone,
            transparent: true,
            opacity: isSelected ? 0.34 : 0.22,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        ring.position.copy(ringPosition);
        ring.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          ringPosition.clone().normalize(),
        );
        dataGroup.add(ring);

        const ringMaterial = ring.material as THREE.MeshBasicMaterial;
        pulseRefs.current.push({
          mesh: ring,
          material: ringMaterial,
          baseScale: 1,
          baseOpacity: ringMaterial.opacity,
          phase: Math.random() * Math.PI * 2,
          speed: isSelected ? 4.6 : 3.2,
          amplitude: isSelected ? 0.18 : 0.12,
        });
      }

      if (isSelected || ((isHot || resultState) && visibleNodeLabels < 5)) {
        const labelText = worker?.region ?? formatNodeLabel(node.id);
        const label = createLabelSprite(labelText, accent, isSelected);
        const labelLateral = new THREE.Vector3().crossVectors(
          new THREE.Vector3(0, 1, 0),
          tipNormal,
        );
        if (labelLateral.lengthSq() < 0.0001) {
          labelLateral.set(1, 0, 0);
        }
        labelLateral.normalize();
        const labelVertical = new THREE.Vector3()
          .crossVectors(tipNormal, labelLateral)
          .normalize();
        const labelPosition = tipPosition
          .clone()
          .add(tipNormal.clone().multiplyScalar(isSelected ? 0.12 : 0.08))
          .add(labelLateral.multiplyScalar(tipPosition.x >= 0 ? 0.22 : -0.22))
          .add(labelVertical.multiplyScalar(tipPosition.y >= 0 ? 0.05 : -0.03));
        label.position.copy(labelPosition);
        dataGroup.add(label);
        visibleNodeLabels += 1;
      }

      if (isSelected || isHot || resultState) {
        const pulseMaterial = tipGlow.material as THREE.MeshBasicMaterial;
        pulseRefs.current.push({
          mesh: tipGlow,
          material: pulseMaterial,
          baseScale: 1,
          baseOpacity: pulseMaterial.opacity,
          phase: Math.random() * Math.PI * 2,
          speed: isSelected ? 4.8 : 3.6,
          amplitude: isSelected ? 0.16 : 0.1,
        });
      }

      if (resultState) {
        const resultRing = new THREE.Mesh(
          new THREE.RingGeometry(0.1, 0.17, 40),
          new THREE.MeshBasicMaterial({
            color: resultTone,
            transparent: true,
            opacity: resultState === "keep" ? 0.24 : resultState === "discard" ? 0.16 : 0.2,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        resultRing.position.copy(
          surfacePosition.clone().normalize().multiplyScalar(globeRadius + 0.05),
        );
        resultRing.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          resultRing.position.clone().normalize(),
        );
        dataGroup.add(resultRing);

        const resultRingMaterial = resultRing.material as THREE.MeshBasicMaterial;
        pulseRefs.current.push({
          mesh: resultRing,
          material: resultRingMaterial,
          baseScale: 1,
          baseOpacity: resultRingMaterial.opacity,
          phase: Math.random() * Math.PI * 2,
          speed: resultState === "crash" ? 7.2 : resultState === "keep" ? 3.4 : 2.4,
          amplitude: resultState === "crash" ? 0.22 : 0.12,
        });
      }
    }

    if (surfaceNodePositions.length > 0) {
      const surfaceGeometry = new THREE.BufferGeometry();
      surfaceGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(surfaceNodePositions, 3),
      );
      surfaceGeometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(surfaceNodeColors, 3),
      );
      const surfacePoints = new THREE.Points(
        surfaceGeometry,
        new THREE.PointsMaterial({
          size: 0.058 * ambientPointScale,
          vertexColors: true,
          transparent: true,
          opacity: 0.34,
          sizeAttenuation: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      dataGroup.add(surfacePoints);
    }

    if (claimedNodePositions.length > 0) {
      const claimedGeometry = new THREE.BufferGeometry();
      claimedGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(claimedNodePositions, 3),
      );
      claimedGeometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(claimedNodeColors, 3),
      );
      const claimedPoints = new THREE.Points(
        claimedGeometry,
        new THREE.PointsMaterial({
          size: 0.078,
          vertexColors: true,
          transparent: true,
          opacity: 0.42,
          sizeAttenuation: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      dataGroup.add(claimedPoints);
    }

    if (activeNodePositions.length > 0) {
      const activeGeometry = new THREE.BufferGeometry();
      activeGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(activeNodePositions, 3),
      );
      activeGeometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(activeNodeColors, 3),
      );
      const activePoints = new THREE.Points(
        activeGeometry,
        new THREE.PointsMaterial({
          size: 0.092,
          vertexColors: true,
          transparent: true,
          opacity: 0.74,
          sizeAttenuation: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      dataGroup.add(activePoints);
    }

    for (const job of jobs) {
      const hubSurfacePosition = latLngToVector3(job.hubLat, job.hubLng, globeRadius + 0.02);
      const hubTipPosition = latLngToVector3(
        job.hubLat,
        job.hubLng,
        globeRadius + (job.state === "training" ? 0.62 : job.state === "evaluating" ? 0.56 : 0.48),
      );
      const hubAccent = getJobAccent(job.id, job.state);
      const hubSelected = selectedJobIds.size > 0 && selectedJobIds.has(job.id);
      const outcomeState = jobOutcomeById.get(job.id) ?? null;
      const outcomeTone = outcomeState ? tapeTone[outcomeState] : hubAccent;

      const hubStem = createLine(
        hubSurfacePosition,
        hubTipPosition,
        outcomeState ? outcomeTone : hubAccent,
        hubSelected ? 0.92 : 0.36,
      );
      dataGroup.add(hubStem);

      const hubGlow = new THREE.Mesh(
        new THREE.SphereGeometry(hubSelected ? 0.14 : 0.11, 18, 18),
        new THREE.MeshBasicMaterial({
          color: outcomeTone,
          transparent: true,
          opacity: hubSelected ? 0.24 : 0.16,
          blending: THREE.AdditiveBlending,
        }),
      );
      hubGlow.position.copy(hubTipPosition);
      dataGroup.add(hubGlow);

      const hubCore = new THREE.Mesh(
        new THREE.SphereGeometry(0.042, 18, 18),
        new THREE.MeshBasicMaterial({
          color: outcomeTone,
          transparent: true,
          opacity: 0.94,
        }),
      );
      hubCore.position.copy(hubTipPosition);
      dataGroup.add(hubCore);

      const hubMaterial = hubGlow.material as THREE.MeshBasicMaterial;
      pulseRefs.current.push({
        mesh: hubGlow,
        material: hubMaterial,
        baseScale: 1,
        baseOpacity: hubMaterial.opacity,
        phase: Math.random() * Math.PI * 2,
        speed:
          outcomeState === "crash"
            ? 6.1
            : outcomeState === "keep"
              ? 3.8
              : job.state === "training"
                ? 4.2
                : 2.8,
        amplitude:
          outcomeState === "crash"
            ? 0.2
            : outcomeState === "keep"
              ? 0.14
              : hubSelected
                ? 0.18
                : 0.08,
      });

      const syntheticContributorIds = (nodeIdsByJob.get(job.id) ?? []).slice(
        0,
        Math.min(18, Math.max(6, Math.floor(nodes.length * 0.006))),
      );
      const contributorNodeIds = Array.from(new Set([...job.nodeIds, ...syntheticContributorIds]));
      const workerCount = Math.max(job.workerIds.length, contributorNodeIds.length, 1);
      const shardCount = getJobShardCount(job);
      const hubNormal = hubTipPosition.clone().normalize();
      const hubTangent = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hubNormal);
      if (hubTangent.lengthSq() < 0.0001) {
        hubTangent.set(1, 0, 0);
      }
      hubTangent.normalize();
      const hubBitangent = new THREE.Vector3().crossVectors(hubNormal, hubTangent).normalize();
      const shardPositions = Array.from({ length: shardCount }, (_, shardIndex) => {
        const angle = (shardIndex / Math.max(shardCount, 1)) * Math.PI * 2 + workerCount * 0.17;
        const orbitRadius =
          0.085 + (shardIndex % 2) * 0.022 + Math.min(workerCount * 0.012, 0.045);

        return hubTipPosition
          .clone()
          .add(hubTangent.clone().multiplyScalar(Math.cos(angle) * orbitRadius))
          .add(hubBitangent.clone().multiplyScalar(Math.sin(angle) * orbitRadius))
          .add(hubNormal.clone().multiplyScalar(0.018 + (shardIndex % 3) * 0.006));
      });

      if (shardPositions.length > 1) {
        for (let shardIndex = 0; shardIndex < shardPositions.length; shardIndex += 1) {
          const shardPosition = shardPositions[shardIndex];
          const spoke = createLine(
            hubTipPosition,
            shardPosition,
            outcomeState ? outcomeTone : hubAccent,
            hubSelected ? 0.34 : 0.18,
          );
          dataGroup.add(spoke);

          const shardGlow = new THREE.Mesh(
            new THREE.SphereGeometry(hubSelected ? 0.054 : 0.042, 12, 12),
            new THREE.MeshBasicMaterial({
              color: outcomeTone,
              transparent: true,
              opacity: hubSelected ? 0.18 : 0.12,
              blending: THREE.AdditiveBlending,
            }),
          );
          shardGlow.position.copy(shardPosition);
          dataGroup.add(shardGlow);

          const shardCore = new THREE.Mesh(
            new THREE.SphereGeometry(0.014, 12, 12),
            new THREE.MeshBasicMaterial({
              color: 0xecfbff,
              transparent: true,
              opacity: 0.94,
            }),
          );
          shardCore.position.copy(shardPosition);
          dataGroup.add(shardCore);

          if (shardIndex % 2 === 0 || hubSelected) {
            const shardMaterial = shardGlow.material as THREE.MeshBasicMaterial;
            pulseRefs.current.push({
              mesh: shardGlow,
              material: shardMaterial,
              baseScale: 1,
              baseOpacity: shardMaterial.opacity,
              phase: Math.random() * Math.PI * 2,
              speed: job.state === "training" ? 5.1 : 3.4,
              amplitude: hubSelected ? 0.16 : 0.1,
            });
          }
        }
      }

      const flowsPerNode = Math.max(
        1,
        Math.min(4, Math.ceil(shardCount / Math.max(job.nodeIds.length, 1))),
      );

      for (const [nodeIndex, nodeId] of contributorNodeIds.entries()) {
        const node = nodeMap.get(nodeId);
        if (!node) {
          continue;
        }

        const worker = workerByNodeId.get(node.id) ?? null;
        const isSyntheticContributor = !job.nodeIds.includes(node.id);
        const nodeTipHeight =
          globeRadius +
          (node.id === selectedNodeId ? 0.24 : isSyntheticContributor ? 0.145 : 0.18);
        const nodeTipPosition = latLngToVector3(node.lat, node.lng, nodeTipHeight);
        const laneBudget = isSyntheticContributor ? 1 : flowsPerNode;

        for (let laneIndex = 0; laneIndex < laneBudget; laneIndex += 1) {
          const shardIndex =
            shardPositions.length > 0
              ? (nodeIndex * Math.max(laneBudget, 1) + laneIndex) % shardPositions.length
              : 0;
          const laneHubPosition = shardPositions[shardIndex] ?? hubTipPosition;
          const laneHubNormal = laneHubPosition.clone().normalize();
          const arcDirection = laneHubPosition.clone().sub(nodeTipPosition).normalize();
          const arcNormal = nodeTipPosition.clone().normalize();
          const arcLateral = new THREE.Vector3().crossVectors(arcDirection, arcNormal);
          if (arcLateral.lengthSq() < 0.0001) {
            arcLateral.set(0, 1, 0);
          }
          arcLateral.normalize();

          const laneCenter = (laneIndex - (laneBudget - 1) / 2) * 0.11;
          const laneBend = arcLateral.clone().multiplyScalar(laneCenter);
          const controlA = nodeTipPosition
            .clone()
            .normalize()
            .multiplyScalar(globeRadius + 1.08 + laneIndex * 0.05)
            .add(laneBend);
          const controlB = laneHubNormal
            .clone()
            .multiplyScalar(globeRadius + 1.2 + laneIndex * 0.05)
            .add(laneBend.clone().multiplyScalar(1.3));
          const curve = new THREE.CubicBezierCurve3(
            nodeTipPosition,
            controlA,
            controlB,
            laneHubPosition,
          );

          const linePoints = curve.getPoints(84);
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
          const lineOpacity = selectedNodeId
            ? node.id === selectedNodeId || hubSelected
              ? 0.78 - laneIndex * 0.08
              : 0.12
            : job.state === "queued"
              ? isSyntheticContributor
                ? 0.12
                : 0.24
              : (isSyntheticContributor ? 0.24 : 0.68) - laneIndex * 0.08;

          const lineMaterial = new THREE.LineBasicMaterial({
            color:
              laneIndex % 2 === 0
                ? hubAccent
                : worker?.state === "evaluating"
                  ? "#ffd17f"
                  : isSyntheticContributor
                    ? new THREE.Color(hubAccent).lerp(new THREE.Color("#8ed3ff"), 0.35).getHex()
                    : new THREE.Color(hubAccent).lerp(new THREE.Color("#d9fbff"), 0.18).getHex(),
            transparent: true,
            opacity: Math.max(0.14, lineOpacity),
            blending: THREE.AdditiveBlending,
          });
          const line = new THREE.Line(lineGeometry, lineMaterial);
          dataGroup.add(line);
          lineRefs.current.push({
            material: lineMaterial,
            baseOpacity: Math.max(0.14, lineOpacity),
            phase: Math.random() * Math.PI * 2,
            speed: job.state === "training" ? 4.8 + laneIndex * 0.6 : 2.4,
          });

          if (job.state === "training" || job.state === "evaluating") {
            const packetBurstCount =
              job.state === "training"
                ? isSyntheticContributor
                  ? 1
                  : Math.min(4, 2 + Math.max(0, workerCount - 1))
                : isSyntheticContributor
                  ? 1
                  : 2;

            for (let burstIndex = 0; burstIndex < packetBurstCount; burstIndex += 1) {
              const packetCore = new THREE.Mesh(
                new THREE.SphereGeometry(0.028, 14, 14),
                new THREE.MeshBasicMaterial({
                  color:
                    worker?.state === "evaluating"
                      ? 0xffdf8f
                      : laneIndex % 2 === 0
                        ? new THREE.Color(hubAccent).lerp(new THREE.Color("#ecfbff"), 0.2).getHex()
                        : new THREE.Color(hubAccent).lerp(new THREE.Color("#76dfff"), 0.35).getHex(),
                  transparent: true,
                  opacity: 0.98,
                }),
              );
              const packetGlow = new THREE.Mesh(
                new THREE.SphereGeometry(0.06, 14, 14),
                new THREE.MeshBasicMaterial({
                  color: hubAccent,
                  transparent: true,
                  opacity: 0.18,
                  blending: THREE.AdditiveBlending,
                }),
              );

              const initialPhase =
                (Math.random() + burstIndex * 0.22 + laneIndex * 0.14 + nodeIndex * 0.18) % 1;
              packetCore.position.copy(curve.getPoint(initialPhase));
              packetGlow.position.copy(packetCore.position);
              dataGroup.add(packetGlow);
              dataGroup.add(packetCore);

              packetRefs.current.push({
                curve,
                mesh: packetCore,
                glow: packetGlow,
                phase: initialPhase,
                speed:
                  job.state === "training"
                    ? 0.0038 + Math.random() * 0.0034
                    : 0.0026 + laneIndex * 0.0003,
                direction: job.state === "evaluating" ? -1 : 1,
              });
            }
          }
        }
      }
    }
  }, [jobs, nodes, selectedWorker, workers]);

  useEffect(() => {
    const nextNodeId = selectedWorker?.nodeId ?? null;

    if (!nextNodeId) {
      focusedNodeIdRef.current = null;
      return;
    }

    if (focusedNodeIdRef.current === nextNodeId) {
      return;
    }

    const targetNode = nodes.find((node) => node.id === nextNodeId);
    if (!targetNode) {
      return;
    }

    focusedNodeIdRef.current = nextNodeId;

    const interaction = interactionRef.current;
    interaction.targetYaw = lngToRotation(targetNode.lng);
    interaction.targetPitch = latToPitch(targetNode.lat);
    interaction.lastInteractionAt = performance.now();
  }, [nodes, selectedWorker?.nodeId]);

  return <div ref={mountRef} style={styles.globeCanvasMount} />;
}

function ExperimentTape({ tape, compact }: { tape: TapeEntry[]; compact: boolean }) {
  return (
    <div style={styles.tapeList}>
      {tape.map((entry) => (
        <div
          key={`${entry.ts}-${entry.workerId}`}
          style={{
            ...styles.tapeRow,
            flexDirection: compact ? "column" : "row",
            alignItems: compact ? "flex-start" : "center",
          }}
        >
          <div
            style={{
              ...styles.tapeLeft,
              width: compact ? "100%" : undefined,
            }}
          >
            <span style={{ color: "#8ea0bf" }}>{entry.ts}</span>
            <strong>{entry.experimentId}</strong>
            <span>{entry.workerId}</span>
          </div>
          <div style={styles.tapeRight}>
            {typeof entry.metricDelta === "number" ? (
              <span style={{ color: "#c7d3ea" }}>
                {entry.metricDelta > 0 ? "+" : ""}
                {entry.metricDelta.toFixed(4)}
              </span>
            ) : null}
            <StatePill label={entry.result} color={tapeTone[entry.result]} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent,
  detail,
}: {
  label: string;
  value: string;
  accent?: string;
  detail?: string;
}) {
  return (
    <div
      style={{
        ...styles.summaryCard,
        borderColor: accent ? `${accent}55` : "rgba(255,255,255,0.08)",
        boxShadow: accent
          ? `0 0 0 1px ${accent}22 inset, 0 18px 34px rgba(0,0,0,0.22)`
          : "0 18px 32px rgba(0,0,0,0.22)",
      }}
    >
      <div style={styles.summaryLabel}>{label}</div>
      <div style={{ ...styles.summaryValue, color: accent ?? "#f4f7fb" }}>{value}</div>
      {detail ? <div style={styles.summaryDetail}>{detail}</div> : null}
    </div>
  );
}

function JourneyCard({
  step,
  title,
  value,
  detail,
  tone,
}: {
  step: string;
  title: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div
      style={{
        ...styles.journeyCard,
        borderColor: `${tone}33`,
        boxShadow: `0 16px 30px rgba(0,0,0,0.18), 0 0 0 1px ${tone}14 inset`,
      }}
    >
      <div style={styles.journeyStep}>{step}</div>
      <div style={styles.journeyTitle}>{title}</div>
      <div style={{ ...styles.journeyValue, color: tone }}>{value}</div>
      <div style={styles.journeyDetail}>{detail}</div>
    </div>
  );
}

function StageChip({
  label,
  value,
  tone,
  detail,
  emphasized,
}: {
  label: string;
  value: string;
  tone: string;
  detail?: string;
  emphasized?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.stageChip,
        borderColor: emphasized ? `${tone}55` : "rgba(255,255,255,0.08)",
        boxShadow: emphasized
          ? `0 0 0 1px ${tone}24 inset, 0 14px 24px rgba(0,0,0,0.18)`
          : "0 14px 24px rgba(0,0,0,0.18)",
      }}
    >
      <div style={styles.stageChipLabel}>{label}</div>
      <div style={{ ...styles.stageChipValue, color: tone }}>{value}</div>
      {detail ? <div style={styles.stageChipDetail}>{detail}</div> : null}
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={styles.panelHeader}>
      <h2 style={styles.panelTitle}>{title}</h2>
      <div style={styles.panelSubtitle}>{subtitle}</div>
    </div>
  );
}

function StatePill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        ...styles.statePill,
        borderColor: color,
        color,
      }}
    >
      {label}
    </span>
  );
}

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  const width = `${Math.max(0, Math.min(progress, 1)) * 100}%`;

  return (
    <div style={styles.progressTrack}>
      <div
        style={{
          ...styles.progressFill,
          width,
          background: color,
        }}
      />
    </div>
  );
}

function ModeButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles.modeButton,
        borderColor: active ? "#56d5ff" : "rgba(255,255,255,0.08)",
        color: active ? "#ecfbff" : "#a9bad4",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(18,36,76,0.84) 0%, rgba(6,10,19,0.98) 40%, #020307 100%)",
    color: "#f4f7fb",
    padding: "24px",
    fontFamily: "\"Avenir Next\", \"IBM Plex Sans\", sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "24px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: "22px",
  },
  headerCopy: {
    maxWidth: "860px",
  },
  eyebrow: {
    fontSize: "12px",
    letterSpacing: "0.18em",
    color: "#86b8ff",
    marginBottom: "8px",
  },
  title: {
    margin: 0,
    fontSize: "34px",
    lineHeight: 1.04,
    letterSpacing: "-0.03em",
  },
  headerLead: {
    marginTop: "14px",
    maxWidth: "820px",
    color: "#e8f3ff",
    fontSize: "16px",
    lineHeight: 1.55,
    letterSpacing: "-0.01em",
  },
  headerText: {
    margin: "12px 0 0",
    maxWidth: "760px",
    color: "#9fb4d8",
    lineHeight: 1.6,
    fontSize: "14px",
  },
  journeyStrip: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "18px",
  },
  flowPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(9,15,29,0.74)",
    padding: "8px 12px",
  },
  flowPillIndex: {
    color: "#dce8ff",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  flowPillLabel: {
    color: "#9cb1d2",
    fontSize: "12px",
    letterSpacing: "0.02em",
  },
  controlRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: "14px",
  },
  modeButton: {
    appearance: "none",
    background: "rgba(8,14,28,0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "999px",
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    transition: "border-color 120ms ease, color 120ms ease",
  },
  telemetryHint: {
    color: "#8ea0bf",
    fontSize: "12px",
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
    width: "min(100%, 760px)",
  },
  summaryCard: {
    minWidth: "128px",
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(9,16,31,0.94), rgba(7,11,22,0.72))",
    borderRadius: "16px",
    padding: "14px 16px",
    boxShadow: "0 18px 32px rgba(0,0,0,0.22)",
  },
  summaryLabel: {
    fontSize: "12px",
    color: "#8ea0bf",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  summaryValue: {
    fontSize: "24px",
    fontWeight: 700,
  },
  summaryDetail: {
    marginTop: "6px",
    fontSize: "11px",
    color: "#8ea0bf",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  summaryStatusBar: {
    display: "flex",
    gap: "10px 16px",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: "10px",
    color: "#89a0c6",
    fontSize: "12px",
  },
  summaryStatusItem: {
    whiteSpace: "nowrap",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 0.74fr) minmax(620px, 1.56fr)",
    gap: "18px",
    marginBottom: "18px",
  },
  panel: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "24px",
    background:
      "linear-gradient(180deg, rgba(8,13,24,0.92), rgba(4,7,14,0.86))",
    padding: "18px",
    backdropFilter: "blur(12px)",
    boxShadow: "0 26px 54px rgba(0,0,0,0.28)",
  },
  bottomPanel: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "24px",
    background:
      "linear-gradient(180deg, rgba(8,13,24,0.92), rgba(4,7,14,0.86))",
    padding: "18px",
    boxShadow: "0 26px 54px rgba(0,0,0,0.28)",
  },
  panelHeader: {
    marginBottom: "14px",
  },
  panelTitle: {
    margin: 0,
    fontSize: "18px",
    letterSpacing: "-0.02em",
  },
  panelSubtitle: {
    color: "#8ea0bf",
    fontSize: "13px",
    marginTop: "4px",
    lineHeight: 1.5,
  },
  workerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  workerBoardStack: {
    display: "grid",
    gap: "14px",
  },
  workerCard: {
    textAlign: "left",
    background:
      "linear-gradient(180deg, rgba(11,18,33,0.92), rgba(8,13,24,0.78))",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "18px",
    padding: "14px",
    color: "inherit",
    cursor: "pointer",
    transition: "transform 120ms ease, border-color 120ms ease",
  },
  workerCardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "10px",
  },
  workerCardRegion: {
    color: "#7ea7e8",
    fontSize: "12px",
    marginTop: "4px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  metaLine: {
    color: "#9eb0cc",
    fontSize: "13px",
    marginBottom: "6px",
    lineHeight: 1.5,
  },
  workerMetricsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    marginTop: "12px",
  },
  workerMetricBox: {
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
    padding: "10px 11px",
  },
  workerMetricLabel: {
    fontSize: "11px",
    color: "#7f94b6",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "6px",
  },
  workerMetricValue: {
    fontSize: "14px",
    fontWeight: 700,
  },
  swarmBoardMeta: {
    borderRadius: "18px",
    border: "1px solid rgba(255,255,255,0.06)",
    background:
      "linear-gradient(180deg, rgba(11,18,33,0.92), rgba(8,13,24,0.78))",
    padding: "14px",
  },
  swarmBoardMetaLine: {
    color: "#9eb0cc",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  swarmPartitionList: {
    display: "grid",
    gap: "10px",
    marginTop: "12px",
  },
  swarmPartitionCard: {
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.03)",
    padding: "11px 12px",
  },
  stageMeter: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "6px",
    marginTop: "10px",
  },
  stageMeterSegment: {
    height: "6px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.08)",
  },
  swarmPartitionTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
    marginBottom: "7px",
    fontSize: "13px",
  },
  statePill: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid",
    borderRadius: "999px",
    padding: "4px 8px",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    whiteSpace: "nowrap",
  },
  progressTrack: {
    width: "100%",
    height: "8px",
    background: "rgba(255,255,255,0.08)",
    borderRadius: "999px",
    overflow: "hidden",
    marginTop: "10px",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    boxShadow: "0 0 14px currentColor",
  },
  globePanel: {
    display: "grid",
    gridTemplateRows: "minmax(540px, 1fr) auto",
    gap: "14px",
  },
  globeStageFrame: {
    position: "relative",
    minHeight: "540px",
    borderRadius: "24px",
    border: "1px solid rgba(255,255,255,0.06)",
    background:
      "radial-gradient(circle at 50% 45%, rgba(17,44,87,0.34), rgba(2,6,15,0.96) 58%, rgba(1,4,10,1) 100%)",
    overflow: "hidden",
    boxShadow: "inset 0 0 90px rgba(42,90,180,0.12)",
  },
  stageNebula: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 28% 22%, rgba(44,136,255,0.16), transparent 28%), radial-gradient(circle at 74% 34%, rgba(88,233,255,0.12), transparent 24%), radial-gradient(circle at 52% 86%, rgba(41,92,214,0.2), transparent 30%)",
    mixBlendMode: "screen",
    pointerEvents: "none",
    zIndex: 0,
  },
  stageVignette: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 50% 52%, transparent 38%, rgba(3,8,18,0.16) 58%, rgba(1,4,11,0.56) 100%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  globeStage: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
  },
  globeCanvasMount: {
    width: "100%",
    height: "100%",
    borderRadius: "24px",
    overflow: "hidden",
    cursor: "grab",
  },
  stageLegendPill: {
    color: "#dbe9ff",
    fontSize: "11px",
    borderRadius: "999px",
    border: "1px solid rgba(141,234,255,0.22)",
    background: "rgba(4,10,22,0.58)",
    backdropFilter: "blur(12px)",
    padding: "8px 12px",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  stageChip: {
    minWidth: "112px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(4,10,22,0.7)",
    backdropFilter: "blur(12px)",
    padding: "10px 12px",
    boxShadow: "0 14px 24px rgba(0,0,0,0.18)",
  },
  stageChipLabel: {
    fontSize: "10px",
    color: "#7f94b6",
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    marginBottom: "5px",
  },
  stageChipValue: {
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },
  stageChipDetail: {
    marginTop: "6px",
    fontSize: "10px",
    color: "#88a3ca",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  globeLegendRow: {
    display: "flex",
    gap: "12px",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: "12px",
    marginBottom: "12px",
  },
  stageInstruction: {
    flex: "1 1 420px",
    color: "#bbcee9",
    fontSize: "12px",
    lineHeight: 1.6,
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(4,10,22,0.54)",
    backdropFilter: "blur(12px)",
    padding: "10px 12px",
  },
  phaseRail: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
    gap: "10px",
    width: "min(100%, 720px)",
  },
  phaseChip: {
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(4,10,22,0.66)",
    backdropFilter: "blur(12px)",
    padding: "10px 12px",
  },
  phaseChipLabel: {
    fontSize: "10px",
    color: "#7f94b6",
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    marginBottom: "5px",
  },
  phaseChipValue: {
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  phaseChipDetail: {
    marginTop: "5px",
    color: "#91a7ca",
    fontSize: "11px",
    lineHeight: 1.5,
  },
  stageFocusPill: {
    color: "#eef6ff",
    fontSize: "12px",
    borderRadius: "999px",
    border: "1px solid rgba(86,213,255,0.24)",
    background: "rgba(4,10,22,0.68)",
    backdropFilter: "blur(12px)",
    padding: "10px 14px",
    whiteSpace: "nowrap",
  },
  globeSummaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
    marginBottom: "12px",
  },
  globeMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "12px",
  },
  globeMetaBlock: {
    borderRadius: "16px",
    background:
      "linear-gradient(180deg, rgba(10,16,30,0.86), rgba(7,12,23,0.7))",
    border: "1px solid rgba(255,255,255,0.06)",
    padding: "12px",
  },
  blockTitle: {
    fontWeight: 700,
    marginBottom: "10px",
    fontSize: "13px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#cfe0f7",
  },
  listRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
    fontSize: "13px",
    marginBottom: "8px",
  },
  swarmGroupCard: {
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.025)",
    padding: "11px 12px",
    marginBottom: "10px",
  },
  swarmGroupTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
    marginBottom: "8px",
    fontSize: "13px",
  },
  swarmGroupMeta: {
    color: "#9eb2d3",
    fontSize: "12px",
    lineHeight: 1.6,
    letterSpacing: "0.03em",
  },
  selectionBox: {
    color: "#c9d5e7",
    fontSize: "13px",
    lineHeight: 1.7,
  },
  protocolFlowRow: {
    display: "grid",
    gridTemplateColumns: "64px 44px minmax(0, 1fr)",
    gap: "10px",
    alignItems: "center",
    marginBottom: "10px",
    fontSize: "12px",
  },
  protocolFlowLabel: {
    color: "#cfe0f7",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    fontSize: "10px",
  },
  protocolFlowValue: {
    fontSize: "15px",
    fontWeight: 700,
  },
  protocolFlowDetail: {
    color: "#8ea0bf",
    lineHeight: 1.5,
  },
  tapeList: {
    display: "grid",
    gap: "10px",
  },
  tapeRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    borderRadius: "16px",
    background:
      "linear-gradient(180deg, rgba(10,16,30,0.86), rgba(7,12,23,0.7))",
    border: "1px solid rgba(255,255,255,0.06)",
    padding: "12px 14px",
  },
  tapeLeft: {
    display: "flex",
    gap: "14px",
    flexWrap: "wrap",
    alignItems: "center",
    fontSize: "13px",
  },
  tapeRight: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    fontSize: "13px",
  },
};
