import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import {
  buildDecoratedNodeIdSet,
  buildJobOutcomeStateMap,
  buildNodeIdsByJob,
  formatNodeLabel,
  getJobAccent,
  getJobShardCount,
  latLngToVector3,
  latToPitch,
  lngToRotation,
  nodeTone,
  tapeTone,
  workerTone,
} from "../core/meshSim.ts";
import {
  clearObjectGroup,
  createLabelSprite,
  createLine,
  createOrbitalParticleShell,
  createStarField,
} from "../core/globeScene.ts";
import type { Job, Node, Worker } from "../fixed/types.ts";

const globeRadius = 2.28;
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

export default function GlobeCanvas({
  nodes,
  jobs,
  workers,
  selectedWorker,
  viewerLocation,
}: {
  nodes: Node[];
  jobs: Job[];
  workers: Worker[];
  selectedWorker: Worker | null;
  viewerLocation:
    | {
        lat: number;
        lng: number;
        label: string;
      }
    | null;
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
  const composerRef = useRef<EffectComposer | null>(null);
  const starFieldRefs = useRef<THREE.Points[]>([]);
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

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 0.06, 6.9);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x030711, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    // Post-processing: Bloom + Output
    const composer = new EffectComposer(renderer);
    composerRef.current = composer;
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(mount.clientWidth, mount.clientHeight),
      0.5,   // strength
      0.7,   // radius
      0.7,   // threshold
    );
    composer.addPass(bloomPass);
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

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

    const starField1 = createStarField(1900, 16, 16, 0.038, 0x7baeff, 0.76);
    const starField2 = createStarField(1100, 20, 22, 0.062, 0xd6eeff, 0.44);
    const starField3 = createStarField(520, 24, 26, 0.095, 0xffffff, 0.2);
    starFieldRefs.current = [starField1, starField2, starField3];
    scene.add(starField1);
    scene.add(starField2);
    scene.add(starField3);

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
      3400,
      globeRadius * 1.075,
      0.07,
      0.024,
      0x59d6ff,
      0.16,
    );
    const outerParticleShell = createOrbitalParticleShell(
      1800,
      globeRadius * 1.17,
      0.11,
      0.018,
      0x91ecff,
      0.11,
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
      composerRef.current?.setSize(width, height);
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

      interaction.currentYaw += (interaction.targetYaw - interaction.currentYaw) * 0.065;
      interaction.currentPitch += (interaction.targetPitch - interaction.currentPitch) * 0.075;

      globeGroupInstance.rotation.y = interaction.currentYaw;
      globeGroupInstance.rotation.x = interaction.currentPitch;

      const time = now * 0.001;
      const breathingScale = 1 + Math.sin(time * 0.52) * 0.008;
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

      // Update star twinkle time uniforms
      for (const starField of starFieldRefs.current) {
        const mat = starField.material as THREE.ShaderMaterial;
        if (mat.uniforms?.uTime) {
          mat.uniforms.uTime.value = time;
        }
      }

      if (composerRef.current) {
        composerRef.current.render();
      } else {
        rendererInstance.render(sceneInstance, cameraInstance);
      }
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
      starFieldRefs.current = [];
      composerRef.current?.dispose();
      composerRef.current = null;

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
    const ambientPointScale = THREE.MathUtils.clamp(1.32 - nodes.length / 26000, 1.06, 1.32);

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
        ? worker.state === "patching" ||
          worker.state === "training" ||
          worker.state === "evaluating" ||
          worker.state === "keep" ||
          worker.state === "discard" ||
          worker.state === "crash"
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

      if (isSelected || ((isHot || resultState) && visibleNodeLabels < 7)) {
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

    if (viewerLocation) {
      const viewerSurfacePosition = latLngToVector3(
        viewerLocation.lat,
        viewerLocation.lng,
        globeRadius + 0.024,
      );
      const viewerTipPosition = latLngToVector3(
        viewerLocation.lat,
        viewerLocation.lng,
        globeRadius + 0.34,
      );
      const viewerTone = "#c8fbff";
      const viewerStem = createLine(viewerSurfacePosition, viewerTipPosition, viewerTone, 0.78);
      dataGroup.add(viewerStem);

      const viewerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 18, 18),
        new THREE.MeshBasicMaterial({
          color: viewerTone,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
        }),
      );
      viewerGlow.position.copy(viewerTipPosition);
      dataGroup.add(viewerGlow);

      const viewerCore = new THREE.Mesh(
        new THREE.SphereGeometry(0.052, 18, 18),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.98,
        }),
      );
      viewerCore.position.copy(viewerTipPosition);
      dataGroup.add(viewerCore);

      const viewerRingPosition = viewerSurfacePosition
        .clone()
        .normalize()
        .multiplyScalar(globeRadius + 0.045);
      const viewerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.09, 0.155, 36),
        new THREE.MeshBasicMaterial({
          color: viewerTone,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      viewerRing.position.copy(viewerRingPosition);
      viewerRing.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        viewerRingPosition.clone().normalize(),
      );
      dataGroup.add(viewerRing);

      const viewerMaterial = viewerGlow.material as THREE.MeshBasicMaterial;
      pulseRefs.current.push({
        mesh: viewerGlow,
        material: viewerMaterial,
        baseScale: 1,
        baseOpacity: viewerMaterial.opacity,
        phase: Math.random() * Math.PI * 2,
        speed: 3.8,
        amplitude: 0.14,
      });

      const viewerRingMaterial = viewerRing.material as THREE.MeshBasicMaterial;
      pulseRefs.current.push({
        mesh: viewerRing,
        material: viewerRingMaterial,
        baseScale: 1,
        baseOpacity: viewerRingMaterial.opacity,
        phase: Math.random() * Math.PI * 2,
        speed: 3.2,
        amplitude: 0.16,
      });

      const viewerLabel = createLabelSprite(viewerLocation.label, viewerTone, true);
      const viewerNormal = viewerTipPosition.clone().normalize();
      const viewerLateral = new THREE.Vector3().crossVectors(
        new THREE.Vector3(0, 1, 0),
        viewerNormal,
      );
      if (viewerLateral.lengthSq() < 0.0001) {
        viewerLateral.set(1, 0, 0);
      }
      viewerLateral.normalize();
      const viewerVertical = new THREE.Vector3()
        .crossVectors(viewerNormal, viewerLateral)
        .normalize();
      viewerLabel.position.copy(
        viewerTipPosition
          .clone()
          .add(viewerNormal.multiplyScalar(0.14))
          .add(viewerLateral.multiplyScalar(viewerTipPosition.x >= 0 ? 0.26 : -0.26))
          .add(viewerVertical.multiplyScalar(viewerTipPosition.y >= 0 ? 0.06 : -0.03)),
      );
      dataGroup.add(viewerLabel);
    }

    // Helper: create node points with per-point size variation
    const nodePointPixelRatio = Math.min(window.devicePixelRatio, 2);
    function addNodePoints(positions: number[], colors: number[], baseSize: number, opacity: number) {
      if (positions.length === 0) return;
      const count = positions.length / 3;
      const sizes = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        sizes[i] = baseSize * (0.6 + Math.random() * 0.8);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uOpacity: { value: opacity },
          uPixelRatio: { value: nodePointPixelRatio },
        },
        vertexShader: /* glsl */ `
          attribute float aSize;
          uniform float uPixelRatio;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uOpacity;
          varying vec3 vColor;
          void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            float alpha = smoothstep(0.5, 0.05, dist) * uOpacity;
            gl_FragColor = vec4(vColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
      });
      dataGroup.add(new THREE.Points(geometry, material));
    }

    addNodePoints(surfaceNodePositions, surfaceNodeColors, 0.074 * ambientPointScale, 0.64);
    addNodePoints(claimedNodePositions, claimedNodeColors, 0.104, 0.8);
    addNodePoints(activeNodePositions, activeNodeColors, 0.128, 0.96);

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
  }, [jobs, nodes, selectedWorker, viewerLocation, workers]);

  useEffect(() => {
    const nextNodeId = selectedWorker?.nodeId ?? null;

    if (!nextNodeId) {
      if (!viewerLocation) {
        focusedNodeIdRef.current = null;
        return;
      }

      if (focusedNodeIdRef.current === "__viewer__") {
        return;
      }

      focusedNodeIdRef.current = "__viewer__";

      const interaction = interactionRef.current;
      interaction.targetYaw = lngToRotation(viewerLocation.lng);
      interaction.targetPitch = latToPitch(viewerLocation.lat);
      interaction.lastInteractionAt = performance.now();
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
  }, [nodes, selectedWorker?.nodeId, viewerLocation]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%", minHeight: "100%" }} />;
}
